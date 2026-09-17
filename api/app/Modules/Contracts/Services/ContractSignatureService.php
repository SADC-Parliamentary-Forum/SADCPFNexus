<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractDocumentVersion;
use App\Models\ContractSignatory;
use App\Models\SignatureEvent;
use App\Models\User;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Execution & signature (PRD §45–§55). Generates the locked, hashed approved
 * PDF, manages internal (SAAM) and external (secure-link) signing with decline
 * / request-changes, verifies document-hash integrity, and produces the
 * immutable executed contract once all signatures are captured.
 */
class ContractSignatureService
{
    public function __construct(private readonly ContractTemplateService $templates) {}

    /**
     * Produce the approved (locked) signature PDF from the current template
     * version, record a hashed document version, and prepare signatories in the
     * configured order (SADC PF first by default). Contract enters signing.
     */
    public function sendForSignature(Contract $contract, User $user, string $order = 'sadcpf_first'): Contract
    {
        if ($contract->lifecycle() !== 'APPROVED_FOR_SIGNATURE') {
            throw ValidationException::withMessages(['status' => ['Only approved contracts can be sent for signature.']]);
        }

        $version = $contract->templateVersion;
        if ($version === null) {
            throw ValidationException::withMessages(['template' => ['Generate the contract document before sending for signature.']]);
        }

        $html = $this->templates->render($version, $contract);
        $pdf = Pdf::loadHTML($this->wrapHtml($contract, $html))->output();
        $hash = hash('sha256', $pdf);
        $next = (int) $contract->documentVersions()->max('version') + 1;
        $path = sprintf('contracts/%d/approved-v%d-%s.pdf', $contract->id, $next, substr($hash, 0, 8));
        Storage::put($path, $pdf);

        $doc = ContractDocumentVersion::create([
            'tenant_id' => $contract->tenant_id,
            'contract_id' => $contract->id,
            'version' => $next,
            'kind' => 'approved',
            'storage_path' => $path,
            'hash' => $hash,
            'hash_algorithm' => 'sha256',
            'generated_at' => now(),
            'generated_by' => $user->id,
            'is_locked' => true,
        ]);

        $contract->update([
            'current_document_version_id' => $doc->id,
            'contract_status' => 'SENT_FOR_SIGNATURE',
            'signature_status' => 'awaiting',
        ]);

        $this->prepareSignatories($contract, $order);

        return $contract->fresh(['signatories', 'documentVersions']);
    }

    private function prepareSignatories(Contract $contract, string $order): void
    {
        if ($contract->signatories()->exists()) {
            return;
        }

        $sadcOrder = $order === 'counterparty_first' ? 2 : 1;
        $counterOrder = $order === 'counterparty_first' ? 1 : 2;

        ContractSignatory::create([
            'tenant_id' => $contract->tenant_id, 'contract_id' => $contract->id,
            'party' => 'sadcpf', 'sign_order' => $sadcOrder, 'method' => 'electronic', 'status' => 'pending',
        ]);

        ContractSignatory::create([
            'tenant_id' => $contract->tenant_id, 'contract_id' => $contract->id,
            'party' => 'counterparty', 'sign_order' => $counterOrder, 'method' => 'electronic', 'status' => 'pending',
            'signer_name' => $contract->display_counterparty,
            'signer_email' => optional($contract->counterparty)->email ?? optional($contract->vendor)->contact_email,
            'token' => Str::random(48),
            'token_expires_at' => now()->addDays(14),
        ]);
    }

    /** Verify the stored approved document has not been altered since locking (PRD §46, AT §120). */
    public function assertDocumentIntegrity(Contract $contract): ContractDocumentVersion
    {
        $doc = $contract->currentDocumentVersion;
        if ($doc === null || $doc->kind !== 'approved') {
            throw ValidationException::withMessages(['document' => ['No approved document is available to sign.']]);
        }

        $actual = $doc->storage_path && Storage::exists($doc->storage_path)
            ? hash('sha256', Storage::get($doc->storage_path))
            : null;

        if ($actual === null || ! hash_equals((string) $doc->hash, $actual)) {
            throw ValidationException::withMessages([
                'document' => ['The document to be signed does not match the approved version (hash mismatch).'],
            ]);
        }

        return $doc;
    }

    /** Internal institutional signatory signs on behalf of SADC PF. */
    public function signInternal(Contract $contract, User $user, ?string $confirmPassword = null): Contract
    {
        $this->guardSigningOpen($contract);
        $doc = $this->assertDocumentIntegrity($contract);

        // Re-authentication for the institutional signature (PRD §47).
        if ($confirmPassword !== null && ! \Illuminate\Support\Facades\Hash::check($confirmPassword, $user->password)) {
            throw ValidationException::withMessages(['confirm_password' => ['Password confirmation failed.']]);
        }

        $sig = $contract->signatories()->where('party', 'sadcpf')->firstOrFail();
        $this->assertTurn($contract, $sig);

        $event = SignatureEvent::create([
            'tenant_id' => $contract->tenant_id,
            'signable_type' => Contract::class,
            'signable_id' => $contract->id,
            'step_key' => 'contract_internal',
            'signer_user_id' => $user->id,
            'action' => 'sign',
            'auth_level' => $confirmPassword !== null ? 'password' : 'session',
            'document_hash' => $doc->hash,
            'signed_at' => now(),
        ]);

        $sig->update([
            'status' => 'signed', 'signer_user_id' => $user->id,
            'signer_name' => $user->name, 'signature_event_id' => $event->id,
            'document_version_id' => $doc->id, 'signed_at' => now(),
        ]);

        return $this->progressAfterSignature($contract);
    }

    /** Counterparty signs via a secure link (no Nexus account). */
    public function signExternal(ContractSignatory $sig, array $data): Contract
    {
        $contract = $sig->contract;
        $this->guardSigningOpen($contract);
        $doc = $this->assertDocumentIntegrity($contract);
        $this->assertTurn($contract, $sig);

        // External counterparties have no Nexus account; signature evidence
        // (signer, timestamp, hashed document version) is recorded on the
        // signatory row. SignatureEvent is reserved for internal SAAM signers.
        $sig->update([
            'status' => 'signed',
            'signer_name' => $data['name'] ?? $sig->signer_name,
            'document_version_id' => $doc->id,
            'signed_at' => now(),
            'token' => null,
        ]);

        return $this->progressAfterSignature($contract);
    }

    public function decline(ContractSignatory $sig, string $reason): Contract
    {
        $contract = $sig->contract;
        $this->guardSigningOpen($contract);

        $sig->update(['status' => 'declined', 'decline_reason' => $reason, 'token' => null]);
        $contract->update(['contract_status' => 'DECLINED', 'signature_status' => 'declined']);

        return $contract->fresh(['signatories']);
    }

    public function requestChanges(ContractSignatory $sig, string $comments): Contract
    {
        $contract = $sig->contract;
        $this->guardSigningOpen($contract);

        $sig->update(['status' => 'changes_requested', 'decline_reason' => $comments]);
        $contract->update(['contract_status' => 'NEGOTIATION_REQUESTED']);

        return $contract->fresh(['signatories']);
    }

    /** Record a physical (wet-ink) signature after the returned copy is verified. */
    public function recordWetSignature(Contract $contract, ContractSignatory $sig, User $verifier): Contract
    {
        $this->guardSigningOpen($contract);
        $sig->update([
            'status' => 'signed', 'method' => 'wet',
            'signer_user_id' => $sig->party === 'sadcpf' ? $verifier->id : $sig->signer_user_id,
            'signed_at' => now(), 'token' => null,
        ]);

        return $this->progressAfterSignature($contract);
    }

    private function assertTurn(Contract $contract, ContractSignatory $sig): void
    {
        $pendingEarlier = $contract->signatories()
            ->where('sign_order', '<', $sig->sign_order)
            ->where('status', '!=', 'signed')
            ->exists();

        if ($pendingEarlier) {
            throw ValidationException::withMessages(['signature' => ['An earlier signatory must sign first.']]);
        }
    }

    private function guardSigningOpen(Contract $contract): void
    {
        if (! in_array($contract->lifecycle(), ['SENT_FOR_SIGNATURE', 'PARTIALLY_SIGNED'], true)) {
            throw ValidationException::withMessages(['status' => ['This contract is not open for signature.']]);
        }
    }

    /** Advance signature status; when all signatories sign, produce the executed contract. */
    private function progressAfterSignature(Contract $contract): Contract
    {
        $contract->load('signatories');
        $total = $contract->signatories->count();
        $signed = $contract->signatories->where('status', 'signed')->count();

        if ($signed >= $total && $total > 0) {
            $this->finaliseExecuted($contract);
        } else {
            $contract->update(['contract_status' => 'PARTIALLY_SIGNED', 'signature_status' => 'partially_signed']);
        }

        return $contract->fresh(['signatories', 'documentVersions']);
    }

    /** Freeze the immutable executed contract from the approved version. */
    private function finaliseExecuted(Contract $contract): void
    {
        $approved = $contract->currentDocumentVersion;
        $bytes = $approved && $approved->storage_path && Storage::exists($approved->storage_path)
            ? Storage::get($approved->storage_path)
            : '';
        $hash = hash('sha256', $bytes);
        $next = (int) $contract->documentVersions()->max('version') + 1;
        $path = sprintf('contracts/%d/CTR-%d-EXECUTED.pdf', $contract->id, $contract->id);
        Storage::put($path, $bytes);

        $signerSequence = $contract->signatories
            ->sortBy('sign_order')
            ->map(fn ($s) => ['party' => $s->party, 'name' => $s->signer_name, 'signed_at' => optional($s->signed_at)->toIso8601String()])
            ->values()->all();

        $executed = ContractDocumentVersion::create([
            'tenant_id' => $contract->tenant_id, 'contract_id' => $contract->id,
            'version' => $next, 'kind' => 'executed', 'storage_path' => $path,
            'hash' => $hash, 'hash_algorithm' => 'sha256', 'generated_at' => now(),
            'signer_sequence' => $signerSequence, 'is_locked' => true,
        ]);

        $contract->update([
            'current_document_version_id' => $executed->id,
            'contract_status' => 'FULLY_EXECUTED',
            'signature_status' => 'signed',
            'signed_at' => now(),
        ]);
    }

    private function wrapHtml(Contract $contract, string $body): string
    {
        return "<html><head><meta charset='utf-8'><style>body{font-family:DejaVu Sans,sans-serif;font-size:12px;} h1{font-size:18px;} h2{font-size:14px;}</style></head><body>{$body}<hr><p style='font-size:9px;color:#666'>Contract {$contract->reference_number} — generated by SADC PF Nexus.</p></body></html>";
    }
}
