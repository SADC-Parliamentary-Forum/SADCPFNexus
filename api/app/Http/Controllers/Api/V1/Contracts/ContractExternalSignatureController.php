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

    /** Minimal, scoped view of the contract for the counterparty. */
    public function show(string $token): JsonResponse
    {
        $sig = $this->resolve($token);
        $contract = $sig->contract;

        return response()->json(['data' => [
            'reference_number' => $contract->reference_number,
            'title' => $contract->title,
            'counterparty' => $sig->signer_name,
            'value' => $contract->current_value,
            'currency' => $contract->currency,
            'start_date' => $contract->start_date,
            'end_date' => $contract->end_date,
            'status' => $sig->status,
            'document_hash' => optional($contract->currentDocumentVersion)->hash,
        ]]);
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
