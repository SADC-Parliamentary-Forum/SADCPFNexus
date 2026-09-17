<?php

namespace App\Modules\Contracts\Services;

use App\Models\ApprovalRequest;
use App\Models\Contract;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Validation\ValidationException;

/**
 * Drives a contract through the shared Nexus workflow engine (Finance review →
 * Legal (conditional) → Management authorisation (value threshold) → SG
 * approval). Procurement submits; authority to approve/sign stays separate.
 */
class ContractWorkflowService
{
    public function __construct(
        private readonly WorkflowService $workflow,
        private readonly ContractService $contracts,
    ) {}

    public function submit(Contract $contract, User $user): Contract
    {
        if (! in_array($contract->lifecycle(), ['DRAFT', 'CHANGES_REQUESTED'], true)) {
            throw ValidationException::withMessages(['status' => ['Only draft or returned contracts can be submitted.']]);
        }

        // Enforce document readiness (blocking checks) before submission (PRD §35, AT §117).
        $readiness = $this->contracts->readiness($contract);
        if (! $readiness['ready']) {
            $failing = collect($readiness['checks'])
                ->filter(fn ($c) => $c['blocking'] && ! $c['passed'])
                ->pluck('label')->all();

            throw ValidationException::withMessages([
                'readiness' => ['Cannot submit — resolve: '.implode('; ', $failing)],
            ]);
        }

        $contract->update(['contract_status' => 'IN_REVIEW', 'status' => 'submitted']);

        $request = $this->workflow->initiate(
            $contract,
            'contract',
            $user,
            'contract-submit-'.$contract->id.'-'.now()->timestamp,
            $this->conditionContext($contract),
        );

        if ($request === null) {
            // No workflow configured — revert and surface a clear error.
            $contract->update(['contract_status' => 'DRAFT', 'status' => 'draft']);
            throw ValidationException::withMessages(['workflow' => ['No contract approval workflow is configured for this tenant.']]);
        }

        return $contract->fresh(['approvalRequest.workflow.steps', 'approvalRequest.history']);
    }

    /**
     * Dynamic workflow routing inputs (value, legal-review flag, department,
     * donor) evaluated by the engine's stage conditions and authority checks.
     *
     * @return array<string, mixed>
     */
    private function conditionContext(Contract $contract): array
    {
        $contract->loadMissing('type');

        return [
            'amount' => (float) $contract->current_value,
            'currency' => $contract->currency,
            'requires_legal_review' => (bool) optional($contract->type)->requires_legal_review,
            'department_id' => $contract->department_id,
            'donor' => $contract->donor,
            'contract_type_id' => $contract->type_id,
        ];
    }

    public function activeRequest(Contract $contract): ?ApprovalRequest
    {
        return $contract->approvalRequest()->latest('id')->first();
    }
}
