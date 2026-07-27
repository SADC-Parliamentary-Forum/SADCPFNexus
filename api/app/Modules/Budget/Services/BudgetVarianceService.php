<?php

namespace App\Modules\Budget\Services;

use App\Models\AuditLog;
use App\Models\BudgetControlSetting;
use App\Models\BudgetLine;
use App\Models\BudgetVariance;
use App\Models\BudgetVarianceExplanation;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetVarianceService
{
    public function __construct(
        private readonly BudgetAvailabilityService $availability,
    ) {}

    /**
     * Snapshot YTD variance for one line (approved vs actual).
     */
    public function snapshotLine(BudgetLine $line, ?Carbon $asOf = null, string $periodType = 'ytd'): BudgetVariance
    {
        $asOf ??= now();
        $line->loadMissing('budget');
        $tenantId = (int) $line->budget->tenant_id;
        $settings = BudgetControlSetting::forTenant($tenantId);
        $check = $this->availability->check($line->id);

        $approved = (float) $check['approved'];
        $actual = (float) $check['actual'];
        $commitments = (float) $check['commitments'];
        $available = (float) $check['available'];
        $varianceAmount = round($approved - $actual, 2);
        $variancePct = $approved > 0 ? round(($varianceAmount / $approved) * 100, 2) : null;
        $utilisationPct = $approved > 0 ? round((($approved - $available) / $approved) * 100, 2) : null;
        $isSignificant = $variancePct !== null
            && abs($variancePct) >= (float) $settings->significant_variance_pct;

        $periodKey = $this->periodKey($periodType, $asOf, $line);

        $existing = BudgetVariance::query()
            ->where('budget_line_id', $line->id)
            ->where('period_type', $periodType)
            ->where('period_key', $periodKey)
            ->first();

        $status = $existing?->status ?? 'open';
        if ($isSignificant && in_array($status, ['open', 'closed'], true)) {
            $status = 'explanation_required';
        }
        if (! $isSignificant && $status === 'explanation_required') {
            $status = 'open';
        }

        $payload = [
            'tenant_id' => $tenantId,
            'budget_line_id' => $line->id,
            'financial_year_id' => $line->budget->financial_year_id,
            'period_type' => $periodType,
            'period_key' => $periodKey,
            'as_of_date' => $asOf->toDateString(),
            'approved_budget' => $approved,
            'actual_expenditure' => $actual,
            'open_commitments' => $commitments,
            'available_budget' => $available,
            'variance_amount' => $varianceAmount,
            'variance_pct' => $variancePct,
            'utilisation_pct' => $utilisationPct,
            'is_significant' => $isSignificant,
            'status' => $status,
        ];

        if ($existing) {
            $existing->update($payload);

            return $existing->fresh(['budgetLine', 'explanations']);
        }

        return BudgetVariance::create($payload)->load(['budgetLine', 'explanations']);
    }

    /**
     * @return array{scanned:int, significant:int, created:int, updated:int}
     */
    public function scanTenant(int $tenantId, ?Carbon $asOf = null): array
    {
        $asOf ??= now();
        $lines = BudgetLine::query()
            ->where('is_active', true)
            ->whereHas('budget', fn ($q) => $q->where('tenant_id', $tenantId)->where('status', 'active'))
            ->with('budget')
            ->get();

        $significant = 0;
        $created = 0;
        $updated = 0;

        foreach ($lines as $line) {
            $before = BudgetVariance::query()
                ->where('budget_line_id', $line->id)
                ->where('period_type', 'ytd')
                ->where('period_key', $this->periodKey('ytd', $asOf, $line))
                ->exists();

            $row = $this->snapshotLine($line, $asOf, 'ytd');
            $before ? $updated++ : $created++;
            if ($row->is_significant) {
                $significant++;
            }
        }

        return [
            'scanned' => $lines->count(),
            'significant' => $significant,
            'created' => $created,
            'updated' => $updated,
        ];
    }

    public function list(int $tenantId, array $filters = []): LengthAwarePaginator
    {
        return BudgetVariance::query()
            ->with(['budgetLine.budget', 'explanations.submitter'])
            ->where('tenant_id', $tenantId)
            ->when(! empty($filters['significant_only']), fn ($q) => $q->where('is_significant', true))
            ->when(! empty($filters['status']), fn ($q) => $q->where('status', $filters['status']))
            ->when(! empty($filters['period_type']), fn ($q) => $q->where('period_type', $filters['period_type']))
            ->orderByDesc('is_significant')
            ->orderByRaw('ABS(COALESCE(variance_pct, 0)) DESC')
            ->paginate($filters['per_page'] ?? 50);
    }

    public function submitExplanation(BudgetVariance $variance, array $data, User $actor): BudgetVarianceExplanation
    {
        if ((int) $variance->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if (! in_array($data['category'], BudgetVarianceExplanation::CATEGORIES, true)) {
            throw ValidationException::withMessages(['category' => 'Invalid variance category.']);
        }

        return DB::transaction(function () use ($variance, $data, $actor) {
            $explanation = BudgetVarianceExplanation::create([
                'budget_variance_id' => $variance->id,
                'submitted_by' => $actor->id,
                'category' => $data['category'],
                'explanation' => $data['explanation'],
                'remedial_action' => $data['remedial_action'] ?? null,
                'status' => 'submitted',
            ]);

            $variance->update(['status' => 'explained']);

            AuditLog::record('budget.variance_explained', [
                'auditable_type' => BudgetVariance::class,
                'auditable_id' => $variance->id,
                'new_values' => [
                    'category' => $explanation->category,
                    'explanation_id' => $explanation->id,
                ],
                'tags' => 'budget,variance',
            ]);

            return $explanation->load(['submitter', 'variance']);
        });
    }

    public function reviewExplanation(
        BudgetVarianceExplanation $explanation,
        string $decision,
        User $actor,
        ?string $comments = null,
    ): BudgetVarianceExplanation {
        $explanation->loadMissing('variance');
        if ((int) $explanation->variance->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        if (! in_array($decision, ['accepted', 'returned'], true)) {
            throw ValidationException::withMessages(['decision' => 'Decision must be accepted or returned.']);
        }

        return DB::transaction(function () use ($explanation, $decision, $actor, $comments) {
            $explanation->update([
                'status' => $decision,
                'reviewed_by' => $actor->id,
                'reviewed_at' => now(),
                'finance_comments' => $comments,
            ]);

            $explanation->variance->update([
                'status' => $decision === 'accepted' ? 'finance_reviewed' : 'explanation_required',
            ]);

            AuditLog::record('budget.variance_reviewed', [
                'auditable_type' => BudgetVarianceExplanation::class,
                'auditable_id' => $explanation->id,
                'new_values' => ['decision' => $decision],
                'tags' => 'budget,variance',
            ]);

            return $explanation->fresh(['submitter', 'reviewer', 'variance']);
        });
    }

    private function periodKey(string $periodType, Carbon $asOf, BudgetLine $line): string
    {
        return match ($periodType) {
            'month' => $asOf->format('Y-m'),
            'quarter' => $asOf->format('Y').'-Q'.$asOf->quarter,
            'full_year' => (string) ($line->budget?->financialYear?->code ?? $line->budget?->year ?? $asOf->year),
            default => 'YTD-'.($line->budget?->financialYear?->code ?? $line->budget?->year ?? $asOf->format('Y')),
        };
    }
}
