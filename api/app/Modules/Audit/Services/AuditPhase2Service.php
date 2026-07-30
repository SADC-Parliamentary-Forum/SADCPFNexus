<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditControlTestingCampaign;
use App\Models\AuditControlTestingItem;
use App\Models\AuditDonorTemplate;
use App\Models\AuditEffortBudget;
use App\Models\AuditEffortEntry;
use App\Models\AuditEngagement;
use App\Models\AuditEngagementTemplateApplication;
use App\Models\AuditFinding;
use App\Models\AuditGovernancePack;
use App\Models\AuditPlan;
use App\Models\AuditQaReview;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class AuditPhase2Service
{
    public function __construct(private readonly AuditEventRecorder $events) {}

    public function listCampaigns(array $filters, User $user): LengthAwarePaginator
    {
        return AuditControlTestingCampaign::query()
            ->with('items')
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function createCampaign(array $data, User $user): AuditControlTestingCampaign
    {
        if (! empty($data['risk_campaign_id']) && Schema::hasTable('risk_control_testing_campaigns')) {
            $exists = \DB::table('risk_control_testing_campaigns')
                ->where('id', $data['risk_campaign_id'])
                ->where('tenant_id', $user->tenant_id)
                ->exists();
            if (! $exists) {
                throw ValidationException::withMessages([
                    'risk_campaign_id' => 'Linked Risk control-testing campaign not found for this tenant.',
                ]);
            }
        }

        $campaign = AuditControlTestingCampaign::create([
            'tenant_id' => $user->tenant_id,
            'title' => $data['title'],
            'risk_campaign_id' => $data['risk_campaign_id'] ?? null,
            'engagement_id' => $data['engagement_id'] ?? null,
            'universe_entity_id' => $data['universe_entity_id'] ?? null,
            'scheduled_start' => $data['scheduled_start'] ?? null,
            'scheduled_end' => $data['scheduled_end'] ?? null,
            'status' => $data['status'] ?? 'planned',
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        foreach ($data['items'] ?? [] as $item) {
            AuditControlTestingItem::create([
                'tenant_id' => $user->tenant_id,
                'campaign_id' => $campaign->id,
                'finding_id' => $item['finding_id'] ?? null,
                'control_ref' => $item['control_ref'] ?? null,
                'control_title' => $item['control_title'],
                'status' => 'pending',
                'due_date' => $item['due_date'] ?? null,
            ]);
        }

        $this->events->record('audit.campaign.created', $user, AuditControlTestingCampaign::class, $campaign->id);

        return $campaign->load('items');
    }

    public function createEffortBudget(array $data, User $user): AuditEffortBudget
    {
        $budget = AuditEffortBudget::create([
            'tenant_id' => $user->tenant_id,
            'audit_plan_id' => $data['audit_plan_id'] ?? null,
            'engagement_id' => $data['engagement_id'] ?? null,
            'auditor_user_id' => $data['auditor_user_id'] ?? null,
            'budget_hours' => $data['budget_hours'],
            'label' => $data['label'] ?? null,
            'created_by' => $user->id,
        ]);
        $this->events->record('audit.effort.budget_created', $user, AuditEffortBudget::class, $budget->id);

        return $budget;
    }

    public function logEffort(array $data, User $user): AuditEffortEntry
    {
        $entry = AuditEffortEntry::create([
            'tenant_id' => $user->tenant_id,
            'effort_budget_id' => $data['effort_budget_id'] ?? null,
            'engagement_id' => $data['engagement_id'] ?? null,
            'auditor_user_id' => $data['auditor_user_id'] ?? $user->id,
            'work_date' => $data['work_date'],
            'hours' => $data['hours'],
            'activity' => $data['activity'] ?? null,
            'notes' => $data['notes'] ?? null,
            'created_by' => $user->id,
        ]);

        return $entry;
    }

    public function capacityView(User $user): array
    {
        $budgets = AuditEffortBudget::where('tenant_id', $user->tenant_id)->get();
        $entries = AuditEffortEntry::where('tenant_id', $user->tenant_id)->get();

        $byAuditor = [];
        foreach ($budgets as $b) {
            $key = (string) ($b->auditor_user_id ?? 'unassigned');
            $byAuditor[$key] ??= ['auditor_user_id' => $b->auditor_user_id, 'budget_hours' => 0, 'actual_hours' => 0];
            $byAuditor[$key]['budget_hours'] += (float) $b->budget_hours;
        }
        foreach ($entries as $e) {
            $key = (string) $e->auditor_user_id;
            $byAuditor[$key] ??= ['auditor_user_id' => $e->auditor_user_id, 'budget_hours' => 0, 'actual_hours' => 0];
            $byAuditor[$key]['actual_hours'] += (float) $e->hours;
        }

        return [
            'auditors' => array_values($byAuditor),
            'total_budget_hours' => (float) $budgets->sum('budget_hours'),
            'total_actual_hours' => (float) $entries->sum('hours'),
        ];
    }

    public function createQaReview(array $data, User $user): AuditQaReview
    {
        $review = AuditQaReview::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $data['engagement_id'] ?? null,
            'workpaper_id' => $data['workpaper_id'] ?? null,
            'reviewer_id' => $data['reviewer_id'] ?? $user->id,
            'review_type' => $data['review_type'] ?? 'engagement_qa',
            'outcome' => $data['outcome'] ?? 'pending',
            'findings_summary' => $data['findings_summary'] ?? null,
            'recommendations' => $data['recommendations'] ?? null,
            'reviewed_at' => ($data['outcome'] ?? 'pending') === 'pending' ? null : now(),
            'created_by' => $user->id,
        ]);
        $this->events->record('audit.qa.created', $user, AuditQaReview::class, $review->id);

        return $review;
    }

    public function listQaReviews(array $filters, User $user): LengthAwarePaginator
    {
        return AuditQaReview::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('id')
            ->paginate($filters['per_page'] ?? 20);
    }

    public function listTemplates(User $user): array
    {
        return AuditDonorTemplate::query()
            ->where(function ($q) use ($user) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $user->tenant_id);
            })
            ->where('is_active', true)
            ->orderBy('name')
            ->get()
            ->all();
    }

    public function applyTemplate(int $engagementId, int $templateId, User $user, ?int $reportId = null): AuditEngagementTemplateApplication
    {
        $engagement = AuditEngagement::where('tenant_id', $user->tenant_id)->findOrFail($engagementId);
        $template = AuditDonorTemplate::query()
            ->where(function ($q) use ($user) {
                $q->whereNull('tenant_id')->orWhere('tenant_id', $user->tenant_id);
            })
            ->findOrFail($templateId);

        $app = AuditEngagementTemplateApplication::create([
            'tenant_id' => $user->tenant_id,
            'engagement_id' => $engagement->id,
            'donor_template_id' => $template->id,
            'report_id' => $reportId,
            'applied_snapshot' => $template->toArray(),
            'applied_by' => $user->id,
        ]);
        $this->events->record('audit.template.applied', $user, AuditEngagementTemplateApplication::class, $app->id);

        return $app;
    }

    public function createGovernancePack(array $data, User $user): AuditGovernancePack
    {
        $fiscalYear = $data['fiscal_year'] ?? (int) now()->year;
        $plans = AuditPlan::where('tenant_id', $user->tenant_id)
            ->where('fiscal_year', $fiscalYear)
            ->get(['id', 'title', 'status', 'version', 'fiscal_year']);

        $planProgress = [];
        foreach ($plans as $plan) {
            $total = AuditEngagement::where('audit_plan_id', $plan->id)->count();
            $done = AuditEngagement::where('audit_plan_id', $plan->id)->whereIn('status', ['issued', 'closed'])->count();
            $planProgress[] = [
                'plan_id' => $plan->id,
                'title' => $plan->title,
                'status' => $plan->status,
                'completion_pct' => $total === 0 ? 0 : round(($done / $total) * 100, 1),
            ];
        }

        $findings = AuditFinding::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('rating', ['critical', 'high'])
            ->whereNotIn('status', ['draft', 'closed'])
            ->orderByRaw("CASE rating WHEN 'critical' THEN 0 WHEN 'high' THEN 1 ELSE 2 END")
            ->get(['id', 'title', 'rating', 'status', 'engagement_id']);

        $payload = [
            'generated_at' => now()->toIso8601String(),
            'fiscal_year' => $fiscalYear,
            'plan_progress' => $planProgress,
            'critical_high_findings' => $findings->toArray(),
        ];

        $pack = AuditGovernancePack::create([
            'tenant_id' => $user->tenant_id,
            'title' => $data['title'],
            'fiscal_year' => $fiscalYear,
            'audience' => $data['audience'] ?? 'fsc',
            'format' => $data['format'] ?? 'structured_json',
            'payload' => $payload,
            'generated_by' => $user->id,
        ]);
        $this->events->record('audit.governance_pack.created', $user, AuditGovernancePack::class, $pack->id);

        return $pack;
    }
}
