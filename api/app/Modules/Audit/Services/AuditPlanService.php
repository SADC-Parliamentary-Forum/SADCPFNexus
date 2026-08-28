<?php

namespace App\Modules\Audit\Services;

use App\Models\AuditPlan;
use App\Models\AuditPlanApproval;
use App\Models\AuditPlanVersion;
use App\Models\AuditSetting;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuditPlanService
{
    public function __construct(
        private readonly AuditEventRecorder $events,
        private readonly AuditAccessGate $gate,
        private readonly NotificationService $notifications,
    ) {}

    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $q = AuditPlan::query()->where('tenant_id', $user->tenant_id)->orderByDesc('fiscal_year')->orderByDesc('version');
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['fiscal_year'])) {
            $q->where('fiscal_year', $filters['fiscal_year']);
        }

        return $q->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): AuditPlan
    {
        return DB::transaction(function () use ($data, $user) {
            $plan = AuditPlan::create([
                'tenant_id' => $user->tenant_id,
                'title' => $data['title'],
                'fiscal_year' => $data['fiscal_year'],
                'version' => 1,
                'status' => 'draft',
                'summary' => $data['summary'] ?? null,
                'created_by' => $user->id,
                'confidentiality_level' => $data['confidentiality_level'] ?? 'standard',
            ]);

            $this->snapshot($plan, $user, 'Initial draft');
            $this->events->record('audit.plan.created', $user, AuditPlan::class, $plan->id, [
                'title' => $plan->title,
                'fiscal_year' => $plan->fiscal_year,
            ]);

            return $plan;
        });
    }

    public function updateDraft(AuditPlan $plan, array $data, User $user): AuditPlan
    {
        $this->assertTenant($plan, $user);
        if (! in_array($plan->status, ['draft', 'amended'], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft/amended plans can be edited. Use amend to change an approved plan.']);
        }

        $plan->update(array_filter([
            'title' => $data['title'] ?? null,
            'summary' => $data['summary'] ?? null,
            'confidentiality_level' => $data['confidentiality_level'] ?? null,
        ], fn ($v) => $v !== null));

        $this->events->record('audit.plan.updated', $user, AuditPlan::class, $plan->id);

        return $plan->fresh();
    }

    public function submitForApproval(AuditPlan $plan, User $user, ?string $comments = null): AuditPlan
    {
        $this->assertTenant($plan, $user);
        if (! in_array($plan->status, ['draft', 'amended'], true)) {
            throw ValidationException::withMessages(['status' => 'Plan cannot be submitted from its current status.']);
        }

        $plan->update(['status' => 'pending_approval']);
        $this->recordApproval($plan, $user, 'submit', $comments);
        $this->events->record('audit.plan.submitted', $user, AuditPlan::class, $plan->id);

        return $plan->fresh();
    }

    public function approve(AuditPlan $plan, User $user, ?string $comments = null): AuditPlan
    {
        $this->assertTenant($plan, $user);
        if (! $user->can('audit.plan.approve') && ! $user->can('audit.admin')) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to approve audit plans.']);
        }
        if ($plan->status !== 'pending_approval') {
            throw ValidationException::withMessages(['status' => 'Plan is not pending approval.']);
        }

        $plan->update([
            'status' => 'approved',
            'approved_by' => $user->id,
            'approved_at' => now(),
        ]);
        $this->recordApproval($plan, $user, 'approve', $comments);
        $this->snapshot($plan, $user, 'Approved version '.$plan->version);
        $this->events->record('audit.plan.approved', $user, AuditPlan::class, $plan->id);

        return $plan->fresh();
    }

    public function reject(AuditPlan $plan, User $user, ?string $comments = null): AuditPlan
    {
        $this->assertTenant($plan, $user);
        if (! $user->can('audit.plan.approve') && ! $user->can('audit.admin')) {
            throw ValidationException::withMessages(['auth' => 'Not authorised to reject audit plans.']);
        }
        $plan->update(['status' => 'draft']);
        $this->recordApproval($plan, $user, 'reject', $comments);
        $this->events->record('audit.plan.rejected', $user, AuditPlan::class, $plan->id);

        return $plan->fresh();
    }

    public function amend(AuditPlan $plan, array $data, User $user): AuditPlan
    {
        $this->assertTenant($plan, $user);
        if ($plan->status !== 'approved') {
            throw ValidationException::withMessages(['status' => 'Only approved plans can be amended.']);
        }

        return DB::transaction(function () use ($plan, $data, $user) {
            $this->snapshot($plan, $user, 'Pre-amendment snapshot v'.$plan->version);

            $plan->update([
                'version' => $plan->version + 1,
                'status' => 'amended',
                'summary' => $data['summary'] ?? $plan->summary,
                'title' => $data['title'] ?? $plan->title,
                'amendment_reason' => $data['amendment_reason'] ?? null,
                'approved_by' => null,
                'approved_at' => null,
            ]);

            $this->recordApproval($plan, $user, 'amend', $data['amendment_reason'] ?? null);
            $this->snapshot($plan, $user, 'Amended to version '.$plan->version);
            $this->events->record('audit.plan.amended', $user, AuditPlan::class, $plan->id, [
                'version' => $plan->version,
                'reason' => $data['amendment_reason'] ?? null,
            ]);

            return $plan->fresh(['versions', 'approvals']);
        });
    }

    public function settings(User $user): AuditSetting
    {
        return AuditSetting::firstOrCreate(
            ['tenant_id' => $user->tenant_id],
            [
                'plan_approval_mode' => 'sg',
                'charter_configured' => false,
                'charter_notes' => 'Governance Configuration Pending — Audit Charter not yet configured.',
            ]
        );
    }

    public function updateSettings(User $user, array $data): AuditSetting
    {
        $row = $this->settings($user);
        $row->update([
            'plan_approval_mode' => $data['plan_approval_mode'] ?? $row->plan_approval_mode,
            'charter_configured' => (bool) ($data['charter_configured'] ?? $row->charter_configured),
            'charter_notes' => $data['charter_notes'] ?? $row->charter_notes,
        ]);

        \App\Models\AuditLog::record('audit.charter.updated', [
            'auditable_type' => AuditSetting::class,
            'auditable_id' => $row->id,
            'new_values' => [
                'charter_configured' => $row->charter_configured,
                'plan_approval_mode' => $row->plan_approval_mode,
            ],
            'tags' => 'audit,governance',
        ]);

        return $row->fresh();
    }

    private function snapshot(AuditPlan $plan, User $user, string $summary): void
    {
        $existing = AuditPlanVersion::query()
            ->where('audit_plan_id', $plan->id)
            ->where('version', $plan->version)
            ->first();

        if ($existing) {
            $existing->update([
                'snapshot' => $plan->toArray(),
                'change_summary' => $summary,
                'created_by' => $user->id,
            ]);

            return;
        }

        AuditPlanVersion::create([
            'tenant_id' => $plan->tenant_id,
            'audit_plan_id' => $plan->id,
            'version' => $plan->version,
            'snapshot' => $plan->toArray(),
            'change_summary' => $summary,
            'created_by' => $user->id,
        ]);
    }

    private function recordApproval(AuditPlan $plan, User $user, string $action, ?string $comments): void
    {
        AuditPlanApproval::create([
            'tenant_id' => $plan->tenant_id,
            'audit_plan_id' => $plan->id,
            'plan_version' => $plan->version,
            'action' => $action,
            'comments' => $comments,
            'actor_id' => $user->id,
        ]);
    }

    private function assertTenant(AuditPlan $plan, User $user): void
    {
        if ((int) $plan->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }
}
