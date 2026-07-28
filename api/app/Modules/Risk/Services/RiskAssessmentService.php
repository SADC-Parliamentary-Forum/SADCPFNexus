<?php

namespace App\Modules\Risk\Services;

use App\Models\AuditLog;
use App\Models\Risk;
use App\Models\RiskAppetitePolicy;
use App\Models\RiskAssessment;
use App\Models\RiskHistory;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class RiskAssessmentService
{
    /**
     * Record an inherent or residual assessment.
     * Never overwrites prior rows — supersedes the current one.
     * Rejects any attempt to pass a control-reduction percentage formula.
     */
    public function record(Risk $risk, array $data, User $user): RiskAssessment
    {
        if (! empty($data['control_reduction_pct']) || ! empty($data['controls_reduce_percent'])) {
            throw ValidationException::withMessages([
                'residual' => 'Residual risk must be assessed explicitly. Arbitrary control-reduction percentage formulas are not allowed.',
            ]);
        }

        $type = $data['assessment_type'] ?? '';
        if (! in_array($type, ['inherent', 'residual'], true)) {
            throw ValidationException::withMessages(['assessment_type' => 'Must be inherent or residual.']);
        }

        $likelihood = (int) ($data['likelihood'] ?? 0);
        $impact = (int) ($data['impact'] ?? 0);
        if ($likelihood < 1 || $likelihood > 5 || $impact < 1 || $impact > 5) {
            throw ValidationException::withMessages([
                'likelihood' => 'Likelihood and impact must each be integers from 1 to 5.',
            ]);
        }

        $score = $likelihood * $impact;
        $level = $this->levelFor($risk->tenant_id, $score);

        return \DB::transaction(function () use ($risk, $type, $likelihood, $impact, $score, $level, $data, $user) {
            RiskAssessment::query()
                ->where('risk_id', $risk->id)
                ->where('assessment_type', $type)
                ->whereNull('superseded_at')
                ->update(['superseded_at' => now()]);

            $assessment = RiskAssessment::create([
                'tenant_id' => $risk->tenant_id,
                'risk_id' => $risk->id,
                'assessment_type' => $type,
                'likelihood' => $likelihood,
                'impact' => $impact,
                'score' => $score,
                'level' => $level,
                'rationale' => $data['rationale'] ?? null,
                'assessed_by' => $user->id,
                'assessed_at' => now(),
            ]);

            if ($type === 'inherent') {
                $risk->update([
                    'likelihood' => $likelihood,
                    'impact' => $impact,
                    'inherent_score' => $score,
                    'risk_level' => $level,
                ]);
            } else {
                $risk->update([
                    'residual_likelihood' => $likelihood,
                    'residual_impact' => $impact,
                    'residual_score' => $score,
                    'residual_reassessment_required' => false,
                ]);
            }

            RiskHistory::create([
                'tenant_id' => $risk->tenant_id,
                'risk_id' => $risk->id,
                'actor_id' => $user->id,
                'change_type' => $type.'_assessed',
                'from_status' => $risk->status,
                'to_status' => $risk->status,
                'new_values' => [
                    'assessment_id' => $assessment->id,
                    'likelihood' => $likelihood,
                    'impact' => $impact,
                    'score' => $score,
                    'level' => $level,
                ],
                'hash' => hash('sha256', json_encode(['a' => $assessment->id, 't' => now()->toISOString()])),
            ]);

            AuditLog::record('risk.assessment_recorded', [
                'auditable_type' => Risk::class,
                'auditable_id' => $risk->id,
                'new_values' => ['type' => $type, 'score' => $score, 'level' => $level],
                'tags' => 'risk',
            ]);

            return $assessment;
        });
    }

    public function history(Risk $risk): Collection
    {
        return $risk->assessments()->with('assessor')->orderByDesc('assessed_at')->get();
    }

    private function levelFor(int $tenantId, int $score): string
    {
        $policy = RiskAppetitePolicy::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if ($policy) {
            return $policy->levelForScore($score);
        }

        return Risk::computeRiskLevel($score);
    }
}
