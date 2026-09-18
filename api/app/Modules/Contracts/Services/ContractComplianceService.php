<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractComplianceRequirement;
use Illuminate\Support\Collection;

/**
 * Configurable compliance requirements (PRD §81–§82). Resolves the requirements
 * that apply to a contract (by type, or global) and reconciles them against the
 * uploaded contract_compliance_documents, so readiness, activation and payment
 * can react to missing or expired mandatory documents.
 */
class ContractComplianceService
{
    /** @return Collection<int, ContractComplianceRequirement> */
    public function requirementsFor(Contract $contract): Collection
    {
        return ContractComplianceRequirement::query()
            ->where('tenant_id', $contract->tenant_id)
            ->where('is_active', true)
            ->where(function ($q) use ($contract) {
                $q->whereNull('contract_type_id')->orWhere('contract_type_id', $contract->type_id);
            })
            ->orderBy('sort_order')->orderBy('code')
            ->get();
    }

    /**
     * Per-requirement compliance status for a contract.
     *
     * @return list<array{code: string, name: string, satisfied: bool, missing: bool, expired: bool, blocks_activation: bool, blocks_payment: bool}>
     */
    public function status(Contract $contract): array
    {
        $documents = $contract->relationLoaded('complianceDocuments')
            ? $contract->complianceDocuments
            : $contract->complianceDocuments()->get();

        return $this->requirementsFor($contract)->map(function (ContractComplianceRequirement $req) use ($documents) {
            $docs = $documents->where('requirement_type', $req->code)
                ->reject(fn ($d) => (string) $d->status === 'rejected');

            $missing = $docs->isEmpty();
            $expired = ! $missing && $req->requires_expiry
                && $docs->every(fn ($d) => $d->expiry_date === null || $d->expiry_date->isPast());

            return [
                'code' => $req->code,
                'name' => $req->name,
                'satisfied' => ! $missing && ! $expired,
                'missing' => $missing,
                'expired' => $expired,
                'blocks_activation' => $req->blocks_activation,
                'blocks_payment' => $req->blocks_payment,
            ];
        })->values()->all();
    }

    /**
     * Unmet requirements that block a gate ('activation' or 'payment').
     *
     * @return list<string> human-readable reasons
     */
    public function unmet(Contract $contract, string $gate): array
    {
        $key = $gate === 'payment' ? 'blocks_payment' : 'blocks_activation';

        return collect($this->status($contract))
            ->filter(fn ($s) => $s[$key] && ! $s['satisfied'])
            ->map(fn ($s) => $s['expired']
                ? "Compliance document \"{$s['name']}\" has expired."
                : "Required compliance document \"{$s['name']}\" is missing.")
            ->values()
            ->all();
    }
}
