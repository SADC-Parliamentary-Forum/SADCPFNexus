<?php

namespace App\Modules\Risk\Services;

use App\Models\RiskAppetitePolicy;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class RiskAppetiteService
{
    public function active(int $tenantId): RiskAppetitePolicy
    {
        $policy = RiskAppetitePolicy::query()
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->first();

        if ($policy) {
            return $policy;
        }

        return $this->ensureDefault($tenantId);
    }

    public function list(int $tenantId): Collection
    {
        $this->ensureDefault($tenantId);

        return RiskAppetitePolicy::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('version')
            ->get();
    }

    public function createVersion(array $data, User $user): RiskAppetitePolicy
    {
        $next = (int) RiskAppetitePolicy::query()
            ->where('tenant_id', $user->tenant_id)
            ->max('version') + 1;

        $policy = RiskAppetitePolicy::create([
            'tenant_id' => $user->tenant_id,
            'version' => $next,
            'title' => $data['title'] ?? ('Appetite Policy v'.$next),
            'effective_from' => $data['effective_from'] ?? now()->toDateString(),
            'effective_to' => $data['effective_to'] ?? null,
            'matrix_thresholds' => $data['matrix_thresholds'] ?? RiskAppetitePolicy::defaultThresholds(),
            'acceptance_authority' => $data['acceptance_authority'] ?? RiskAppetitePolicy::defaultAuthority(),
            'tolerance_statement' => $data['tolerance_statement'] ?? null,
            'is_active' => false,
            'created_by' => $user->id,
        ]);

        if (! empty($data['activate'])) {
            $this->activate($policy, $user);
        }

        return $policy->fresh();
    }

    public function activate(RiskAppetitePolicy $policy, User $user): RiskAppetitePolicy
    {
        if ((int) $policy->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        RiskAppetitePolicy::query()
            ->where('tenant_id', $policy->tenant_id)
            ->where('is_active', true)
            ->update(['is_active' => false, 'effective_to' => now()->toDateString()]);

        $policy->update(['is_active' => true, 'effective_to' => null]);

        return $policy->fresh();
    }

    public function canAcceptLevel(User $user, string $level): bool
    {
        // Internal Audit must never accept risks for Management.
        if ($user->hasRole('Internal Auditor') && ! $user->hasAnyRole(['System Admin', 'super-admin'])) {
            return false;
        }

        $policy = $this->active((int) $user->tenant_id);
        $authority = $policy->acceptance_authority[$level] ?? RiskAppetitePolicy::defaultAuthority()[$level] ?? [];

        foreach ($authority as $role) {
            if ($role === 'Risk Owner') {
                continue; // handled by caller for low only
            }
            if ($user->hasRole($role) || $user->hasAnyRole(['System Admin', 'super-admin'])) {
                return true;
            }
        }

        return $user->hasAnyRole(['System Admin', 'super-admin']);
    }

    private function ensureDefault(int $tenantId): RiskAppetitePolicy
    {
        $existing = RiskAppetitePolicy::query()->where('tenant_id', $tenantId)->first();
        if ($existing) {
            if (! RiskAppetitePolicy::query()->where('tenant_id', $tenantId)->where('is_active', true)->exists()) {
                $existing->update(['is_active' => true]);
            }

            return RiskAppetitePolicy::query()->where('tenant_id', $tenantId)->where('is_active', true)->first()
                ?? $existing;
        }

        $admin = User::query()->where('tenant_id', $tenantId)->orderBy('id')->first();
        if (! $admin) {
            throw ValidationException::withMessages(['tenant' => 'Cannot create appetite policy without a user.']);
        }

        return RiskAppetitePolicy::create([
            'tenant_id' => $tenantId,
            'version' => 1,
            'title' => 'Default Risk Appetite Policy',
            'effective_from' => now()->toDateString(),
            'matrix_thresholds' => RiskAppetitePolicy::defaultThresholds(),
            'acceptance_authority' => RiskAppetitePolicy::defaultAuthority(),
            'tolerance_statement' => 'Low residual risks may be accepted by the Risk Owner. Medium requires HOD+. High/Critical require Director/SG/Governance Officer. Internal Audit does not accept risks for Management.',
            'is_active' => true,
            'created_by' => $admin->id,
        ]);
    }
}
