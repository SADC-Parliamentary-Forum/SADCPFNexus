<?php

namespace App\Modules\Leave\Services;

use App\Models\LeavePolicyVersion;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\Models\Role;

class LeavePolicyService
{
    public const MODE_STANDARD = 'standard';

    public const MODE_FINANCE_FIRST = 'finance_first';

    public const MODE_DIRECTOR_PRINCIPAL = 'director_principal';

    /** @return list<string> */
    public function allowedModes(): array
    {
        return [
            self::MODE_STANDARD,
            self::MODE_FINANCE_FIRST,
            self::MODE_DIRECTOR_PRINCIPAL,
        ];
    }

    /** @return array<string, array<string, mixed>> */
    public function defaultTypeDefinitions(): array
    {
        return [
            'annual' => ['name' => 'Annual Leave', 'cycle' => 'employment_cycle', 'is_paid' => true],
            'sick' => ['name' => 'Sick Leave', 'cycle' => 'contract_four_year', 'is_paid' => true, 'medical_certificate_after_days' => 2],
            'lil' => ['name' => 'Leave in Lieu of Overtime', 'cycle' => 'credit_expiry', 'is_paid' => true],
            'unpaid' => ['name' => 'Authorised Leave Without Pay', 'cycle' => 'calendar_year', 'is_paid' => false],
            'study' => ['name' => 'Study Leave', 'cycle' => 'calendar_year', 'is_paid' => true],
            'home' => ['name' => 'Home Leave', 'cycle' => 'service_interval', 'is_paid' => true],
            'maternity' => ['name' => 'Maternity Leave', 'cycle' => 'event', 'is_paid' => true],
            'paternity' => ['name' => 'Paternity Leave', 'cycle' => 'two_year_interval', 'is_paid' => true],
            'compassionate' => ['name' => 'Compassionate Leave', 'cycle' => 'calendar_year', 'is_paid' => true],
            'special' => ['name' => 'Special Leave', 'cycle' => 'policy', 'is_paid' => true],
        ];
    }

    public function activePolicyForTenant(int $tenantId, ?CarbonInterface $date = null): LeavePolicyVersion
    {
        $date ??= now();

        $policy = LeavePolicyVersion::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->whereDate('effective_from', '<=', $date->toDateString())
            ->where(function ($q) use ($date) {
                $q->whereNull('effective_to')
                    ->orWhereDate('effective_to', '>=', $date->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();

        if (! $policy) {
            $policy = LeavePolicyVersion::create([
                'tenant_id' => $tenantId,
                'name' => 'SADC PF Leave Policy',
                'version' => 'v1',
                'effective_from' => '2026-01-01',
                'rules' => [
                    'annual_entitlement_configured_by_hr' => true,
                    'annual_leave_may_not_be_taken_in_advance' => true,
                    'public_holidays_excluded_from_annual_leave' => true,
                    'toil_expires_after_days' => 30,
                ],
                'workflow_mode' => self::MODE_STANDARD,
                'admin_review_required' => false,
                'principal_role' => 'Director',
                'final_approver_role' => 'Secretary General',
                'is_active' => true,
            ]);
        }

        $this->ensureDefaultTypes($policy);

        return $policy->fresh(['types']);
    }

    public function leaveType(int $tenantId, string $code): ?LeaveType
    {
        $this->activePolicyForTenant($tenantId);

        return LeaveType::query()
            ->where('tenant_id', $tenantId)
            ->where('code', $code)
            ->where('is_active', true)
            ->first();
    }

    public function ensureDefaultTypes(LeavePolicyVersion $policy): void
    {
        foreach ($this->defaultTypeDefinitions() as $code => $definition) {
            LeaveType::firstOrCreate(
                ['tenant_id' => $policy->tenant_id, 'code' => $code],
                array_merge($definition, [
                    'policy_version_id' => $policy->id,
                    'allow_negative_balance' => false,
                    'allow_half_day' => false,
                    'requires_attachment' => false,
                    'is_active' => true,
                ])
            );
        }
    }

    public function ensureForAllTenants(): void
    {
        Tenant::query()->select('id')->each(fn (Tenant $tenant) => $this->activePolicyForTenant($tenant->id));
    }

    public function workflowMode(LeavePolicyVersion $policy): string
    {
        $mode = (string) ($policy->workflow_mode ?: self::MODE_STANDARD);

        return in_array($mode, $this->allowedModes(), true) ? $mode : self::MODE_STANDARD;
    }

    public function adminReviewRequired(LeavePolicyVersion $policy): bool
    {
        if ($this->workflowMode($policy) === self::MODE_DIRECTOR_PRINCIPAL) {
            return true;
        }

        return (bool) $policy->admin_review_required;
    }

    /**
     * Ordered domain stage keys for holder progression.
     *
     * @return list<'finance'|'recommend'|'certify'|'principal'|'authorise'>
     */
    public function resolveApprovalStages(LeavePolicyVersion $policy, ?User $requester = null): array
    {
        $mode = $this->workflowMode($policy);
        $requesterIsDirector = $requester && $requester->hasAnyRole([
            $policy->principal_role ?: 'Director',
            'Director',
        ]);

        $stages = match ($mode) {
            self::MODE_FINANCE_FIRST => ['finance', 'certify', 'authorise'],
            self::MODE_DIRECTOR_PRINCIPAL => ['recommend', 'certify', 'principal', 'authorise'],
            default => ['recommend', 'certify', 'authorise'],
        };

        // Director (or equivalent principal) requesters skip HOD recommend / finance gate.
        if ($requesterIsDirector) {
            $stages = array_values(array_filter(
                $stages,
                fn (string $stage) => ! in_array($stage, ['recommend', 'finance'], true)
            ));
            if ($this->adminReviewRequired($policy) && ! in_array('principal', $stages, true)) {
                $authoriseIdx = array_search('authorise', $stages, true);
                if ($authoriseIdx === false) {
                    $stages[] = 'principal';
                } else {
                    array_splice($stages, (int) $authoriseIdx, 0, ['principal']);
                }
            }
        } elseif ($this->adminReviewRequired($policy) && $mode === self::MODE_FINANCE_FIRST && ! in_array('principal', $stages, true)) {
            $authoriseIdx = array_search('authorise', $stages, true);
            if ($authoriseIdx === false) {
                $stages[] = 'principal';
            } else {
                array_splice($stages, (int) $authoriseIdx, 0, ['principal']);
            }
        }

        return $stages;
    }

    /**
     * @return list<array{approver_type: string, role_id?: int}>
     */
    public function resolveWorkflowSteps(LeavePolicyVersion $policy, int $tenantId): array
    {
        $steps = [];
        $stages = $this->resolveApprovalStages($policy);

        foreach ($stages as $stage) {
            if ($stage === 'recommend') {
                $steps[] = ['approver_type' => 'supervisor'];
                continue;
            }
            if ($stage === 'finance') {
                $role = Role::findOrCreate('Finance Controller', 'web');
                $steps[] = ['approver_type' => 'specific_role', 'role_id' => $role->id];
                continue;
            }
            if ($stage === 'certify') {
                $role = Role::where('name', 'HR Manager')->where('guard_name', 'web')->first()
                    ?: Role::where('name', 'HR Administrator')->where('guard_name', 'web')->first();
                if ($role) {
                    $steps[] = ['approver_type' => 'specific_role', 'role_id' => $role->id];
                }
                continue;
            }
            if ($stage === 'principal') {
                $roleName = $policy->principal_role ?: 'Director';
                $role = Role::where('name', $roleName)->where('guard_name', 'web')->first()
                    ?: Role::findOrCreate('Director', 'web');
                $steps[] = ['approver_type' => 'specific_role', 'role_id' => $role->id];
                continue;
            }
            if ($stage === 'authorise') {
                $roleName = $policy->final_approver_role ?: 'Secretary General';
                $role = Role::where('name', $roleName)->where('guard_name', 'web')->first()
                    ?: Role::findOrCreate('Secretary General', 'web');
                $steps[] = ['approver_type' => 'specific_role', 'role_id' => $role->id];
            }
        }

        return $steps;
    }

    /** @return Collection<int, LeavePolicyVersion> */
    public function listPolicies(User $actor): Collection
    {
        return LeavePolicyVersion::query()
            ->where('tenant_id', $actor->tenant_id)
            ->orderByDesc('effective_from')
            ->orderByDesc('id')
            ->get();
    }

    public function createPolicyVersion(User $actor, array $data): LeavePolicyVersion
    {
        $mode = (string) ($data['workflow_mode'] ?? self::MODE_STANDARD);
        if (! in_array($mode, $this->allowedModes(), true)) {
            throw ValidationException::withMessages([
                'workflow_mode' => ['Unsupported leave workflow mode.'],
            ]);
        }

        $adminReview = array_key_exists('admin_review_required', $data)
            ? (bool) $data['admin_review_required']
            : ($mode === self::MODE_DIRECTOR_PRINCIPAL);

        $active = $this->activePolicyForTenant($actor->tenant_id);
        $rules = array_merge($active->rules ?? [], $data['rules'] ?? []);

        LeavePolicyVersion::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('is_active', true)
            ->update([
                'is_active' => false,
                'effective_to' => now()->toDateString(),
            ]);

        $policy = LeavePolicyVersion::create([
            'tenant_id' => $actor->tenant_id,
            'name' => $data['name'] ?? ($active->name ?? 'SADC PF Leave Policy'),
            'version' => $data['version'] ?? ('v'.(LeavePolicyVersion::query()->where('tenant_id', $actor->tenant_id)->count() + 1)),
            'effective_from' => $data['effective_from'] ?? now()->toDateString(),
            'rules' => $rules,
            'workflow_mode' => $mode,
            'admin_review_required' => $adminReview,
            'principal_role' => $data['principal_role'] ?? ($active->principal_role ?: 'Director'),
            'final_approver_role' => $data['final_approver_role'] ?? ($active->final_approver_role ?: 'Secretary General'),
            'is_active' => true,
            'approved_by' => $actor->id,
        ]);

        $this->ensureDefaultTypes($policy);

        return $policy->fresh(['types']);
    }

    public function firstStage(LeavePolicyVersion $policy, ?User $requester = null): string
    {
        $stages = $this->resolveApprovalStages($policy, $requester);

        return $stages[0] ?? 'recommend';
    }

    public function stageAfter(LeavePolicyVersion $policy, string $currentStage, ?User $requester = null): ?string
    {
        $stages = $this->resolveApprovalStages($policy, $requester);
        $idx = array_search($currentStage, $stages, true);
        if ($idx === false) {
            return null;
        }

        return $stages[$idx + 1] ?? null;
    }

    public function stageLabel(string $stage): string
    {
        return match ($stage) {
            'finance' => 'Finance Certification',
            'recommend' => 'Supervisor/HOD Recommendation',
            'certify' => 'Administration/HR Certification',
            'principal' => 'Director Principal Review',
            'authorise' => 'Head of Institution Authorisation',
            default => ucfirst($stage),
        };
    }
}
