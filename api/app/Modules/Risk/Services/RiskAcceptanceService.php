<?php

namespace App\Modules\Risk\Services;

use App\Models\AuditLog;
use App\Models\Risk;
use App\Models\RiskAcceptance;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class RiskAcceptanceService
{
    public function __construct(
        private readonly RiskAppetiteService $appetite,
        private readonly RiskService $risks,
    ) {}

    public function request(Risk $risk, array $data, User $user): RiskAcceptance
    {
        if (in_array($risk->status, ['draft', 'proposed', 'closed', 'archived'], true)) {
            throw ValidationException::withMessages(['status' => 'Risk cannot be accepted from its current status.']);
        }

        if (! $risk->residual_likelihood || ! $risk->residual_impact) {
            throw ValidationException::withMessages([
                'residual' => 'Residual assessment is required before formal acceptance.',
            ]);
        }

        // Internal Audit cannot accept risks for Management.
        if ($user->hasRole('Internal Auditor')
            && ! $user->hasAnyRole(['Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
            throw ValidationException::withMessages([
                'requested_by' => 'Internal Audit provides assurance and cannot accept risks for Management.',
            ]);
        }

        $score = $risk->residual_likelihood * $risk->residual_impact;
        $level = Risk::computeRiskLevel($score);

        $acceptance = RiskAcceptance::create([
            'tenant_id' => $risk->tenant_id,
            'risk_id' => $risk->id,
            'justification' => $data['justification'],
            'expires_at' => $data['expires_at'],
            'status' => 'pending',
            'residual_likelihood' => $risk->residual_likelihood,
            'residual_impact' => $risk->residual_impact,
            'residual_score' => $score,
            'residual_level' => $level,
            'requested_by' => $user->id,
        ]);

        // Low: owner may self-approve if policy allows; high/critical never by owner alone.
        if (in_array($level, ['high', 'critical'], true)) {
            // remains pending — needs separate approver
        } elseif ($level === 'low' && (int) $risk->risk_owner_id === (int) $user->id) {
            // still require explicit approve call for audit trail, but owner is eligible
        }

        $this->risks->recordHistory($risk, 'acceptance_requested', $user, $risk->status, $risk->status, [], [
            'acceptance_id' => $acceptance->id,
            'level' => $level,
            'expires_at' => $data['expires_at'],
        ]);

        AuditLog::record('risk.acceptance_requested', [
            'auditable_type' => Risk::class,
            'auditable_id' => $risk->id,
            'new_values' => ['acceptance_id' => $acceptance->id],
            'tags' => 'risk',
        ]);

        return $acceptance;
    }

    public function decide(RiskAcceptance $acceptance, array $data, User $approver): RiskAcceptance
    {
        if (! $acceptance->isPending()) {
            throw ValidationException::withMessages(['status' => 'Acceptance is not pending.']);
        }

        $risk = $acceptance->risk;
        $level = $acceptance->residual_level;
        $decision = $data['decision'] ?? 'approved';

        if ($decision === 'approved') {
            // High/critical cannot be casually accepted by owner alone.
            if (in_array($level, ['high', 'critical'], true)) {
                if ((int) $approver->id === (int) $risk->risk_owner_id
                    && ! $approver->hasAnyRole(['Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
                    throw ValidationException::withMessages([
                        'approved_by' => 'High/critical residual risks cannot be accepted by the Risk Owner alone.',
                    ]);
                }
                if (! $this->appetite->canAcceptLevel($approver, $level)) {
                    throw ValidationException::withMessages([
                        'approved_by' => 'You do not have authority to accept this residual risk level.',
                    ]);
                }
            } elseif (! $this->appetite->canAcceptLevel($approver, $level)
                && (int) $approver->id !== (int) $risk->risk_owner_id
                && ! $approver->hasAnyRole(['HOD', 'Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
                throw ValidationException::withMessages([
                    'approved_by' => 'You do not have authority to accept this residual risk level.',
                ]);
            }

            // IA cannot approve acceptance for Management
            if ($approver->hasRole('Internal Auditor')
                && ! $approver->hasAnyRole(['Director', 'Governance Officer', 'Secretary General', 'System Admin', 'super-admin'])) {
                throw ValidationException::withMessages([
                    'approved_by' => 'Internal Audit cannot accept risks for Management.',
                ]);
            }

            $acceptance->update([
                'status' => 'approved',
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'decision_notes' => $data['decision_notes'] ?? null,
            ]);

            $risk->update(['treatment_strategy' => 'accept']);
        } else {
            $acceptance->update([
                'status' => 'rejected',
                'approved_by' => $approver->id,
                'approved_at' => now(),
                'decision_notes' => $data['decision_notes'] ?? null,
            ]);
        }

        $this->risks->recordHistory($risk, 'acceptance_'.$acceptance->status, $approver, $risk->status, $risk->status, [], [
            'acceptance_id' => $acceptance->id,
        ], $data['decision_notes'] ?? null);

        return $acceptance->fresh(['requester', 'approver']);
    }
}
