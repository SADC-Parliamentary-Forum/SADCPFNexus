<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ContractSignatory;
use App\Modules\Contracts\Services\ContractSignatureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Secure external counterparty signing portal (PRD §47, §51, §52, §95).
 * Access is by opaque token only — no Nexus account, no browsing of other
 * contracts or internal workflow data.
 */
class ContractExternalSignatureController extends Controller
{
    public function __construct(private readonly ContractSignatureService $signatures) {}

    private function resolve(string $token): ContractSignatory
    {
        $sig = ContractSignatory::where('token', $token)->where('party', 'counterparty')->first();
        abort_if($sig === null, 404, 'Invalid or expired signature link.');
        abort_if($sig->token_expires_at !== null && $sig->token_expires_at->isPast(), 410, 'This signature link has expired.');

        return $sig;
    }

    /**
     * Scoped, read-only workspace for the counterparty (PRD §95): only this
     * contract's own terms, deliverables, obligations and signature status.
     * NEVER exposes internal reviewers, budget/funding, workflow/approvals,
     * internal comments, or any other contract.
     */
    public function show(string $token): JsonResponse
    {
        $sig = $this->resolve($token);
        $contract = $sig->contract->loadMissing(['deliverables', 'obligations', 'signatories', 'currentDocumentVersion']);

        $scope = (array) ($contract->scope ?? []);

        return response()->json(['data' => [
            'reference_number' => $contract->reference_number,
            'title' => $contract->title,
            'counterparty' => $sig->signer_name,
            'value' => $contract->current_value,
            'currency' => $contract->currency,
            'start_date' => $contract->start_date,
            'end_date' => $contract->end_date,
            'signature_deadline' => $contract->signature_deadline,
            'purpose' => $scope['purpose'] ?? null,
            'my_status' => $sig->status,
            'document_hash' => optional($contract->currentDocumentVersion)->hash,
            'document_available' => $this->documentPath($contract) !== null,
            // Signature progress (parties + status only — no internal identities).
            'signatories' => $contract->signatories->sortBy('sign_order')->map(fn ($s) => [
                'party' => $s->party,
                'status' => $s->status,
                'signed_at' => optional($s->signed_at)->toDateString(),
            ])->values(),
            // What the counterparty must deliver.
            'deliverables' => $contract->deliverables->map(fn ($d) => [
                'name' => $d->name,
                'description' => $d->description,
                'due_date' => optional($d->due_date)->toDateString(),
                'status' => $d->status,
            ])->values(),
            // Contract obligations (both parties' commitments).
            'obligations' => $contract->obligations->map(fn ($o) => [
                'obligation' => $o->obligation,
                'responsible_party' => $o->responsible_party,
                'due_date' => optional($o->due_date)->toDateString(),
                'status' => $o->status,
            ])->values(),
        ]]);
    }

    /** Download the contract document scoped to this counterparty's link. */
    public function document(string $token): \Symfony\Component\HttpFoundation\StreamedResponse
    {
        $sig = $this->resolve($token);
        $path = $this->documentPath($sig->contract);
        abort_if($path === null, 404, 'No contract document is available yet.');

        $ext = str_ends_with($path, '.pdf') ? 'pdf' : 'html';
        $safeRef = str_replace(['/', '\\'], '-', (string) $sig->contract->reference_number);

        return \Illuminate\Support\Facades\Storage::download($path, "{$safeRef}.{$ext}");
    }

    private function documentPath(\App\Models\Contract $contract): ?string
    {
        $doc = $contract->currentDocumentVersion;
        if ($doc && $doc->storage_path && \Illuminate\Support\Facades\Storage::exists($doc->storage_path)) {
            return $doc->storage_path;
        }

        return null;
    }

    public function sign(Request $request, string $token): JsonResponse
    {
        $sig = $this->resolve($token);
        $data = $request->validate(['name' => ['required', 'string', 'max:255'], 'consent' => ['accepted']]);

        $contract = $this->signatures->signExternal($sig, [
            'name' => $data['name'],
            'ip' => $request->ip(),
            'user_agent' => (string) $request->userAgent(),
        ]);

        AuditLog::record('contract.signed_external', [
            'auditable_type' => \App\Models\Contract::class, 'auditable_id' => $contract->id,
            'new_values' => ['signer' => $data['name'], 'contract_status' => $contract->contract_status],
            'tags' => ['contract', 'signature', 'external'],
        ]);

        return response()->json(['message' => 'Signature recorded. Thank you.', 'data' => ['status' => $contract->signature_status]]);
    }

    public function decline(Request $request, string $token): JsonResponse
    {
        $sig = $this->resolve($token);
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $contract = $this->signatures->decline($sig, $data['reason']);

        AuditLog::record('contract.declined_external', [
            'auditable_type' => \App\Models\Contract::class, 'auditable_id' => $contract->id,
            'new_values' => ['reason' => $data['reason']], 'tags' => ['contract', 'signature', 'external'],
        ]);

        return response()->json(['message' => 'Your decision has been recorded.']);
    }

    public function requestChanges(Request $request, string $token): JsonResponse
    {
        $sig = $this->resolve($token);
        $data = $request->validate(['comments' => ['required', 'string', 'max:2000']]);
        $this->signatures->requestChanges($sig, $data['comments']);

        return response()->json(['message' => 'Your requested changes have been submitted.']);
    }
}
