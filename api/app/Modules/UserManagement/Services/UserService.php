<?php

namespace App\Modules\UserManagement\Services;

use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserService
{
    /**
     * List users within the authenticated user's tenant.
     * RLS handles cross-tenant isolation automatically.
     */
    public function list(array $filters = []): LengthAwarePaginator
    {
        $query = User::with(['department', 'roles'])
            ->orderBy('name');

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('name', 'ilike', "%{$filters['search']}%")
                  ->orWhere('email', 'ilike', "%{$filters['search']}%")
                  ->orWhere('employee_number', 'ilike', "%{$filters['search']}%");
            });
        }

        if (!empty($filters['department_id'])) {
            $query->where('department_id', $filters['department_id']);
        }

        if (!empty($filters['status'])) {
            match ($filters['status']) {
                'active'   => $query->where('is_active', true),
                'inactive' => $query->where('is_active', false),
                default    => null,
            };
        }

        if (!empty($filters['role'])) {
            $query->role($filters['role']);
        }

        return $query->paginate($filters['per_page'] ?? 25);
    }

    /**
     * Create a new user within the tenant.
     */
    public function create(array $data, User $createdBy): User
    {
        $user = User::create([
            'tenant_id'       => $createdBy->tenant_id,
            'department_id'   => $data['department_id'] ?? null,
            'name'            => $data['name'],
            'email'           => $data['email'],
            'password'        => Hash::make($data['password'] ?? str()->random(16)),
            'employee_number' => $data['employee_number'] ?? null,
            'job_title'       => $data['job_title'] ?? null,
            'classification'  => $data['classification'] ?? 'UNCLASSIFIED',
            'mfa_enabled'     => $data['mfa_enabled'] ?? true,
            'is_active'       => true,
        ]);

        // Assign role if provided
        if (!empty($data['role'])) {
            $user->assignRole($data['role']);
        }

        AuditLog::record('user.created', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'new_values'     => [
                'name'       => $user->name,
                'email'      => $user->email,
                'role'       => $data['role'] ?? null,
            ],
            'tags' => 'user_management',
        ]);

        return $user->load(['department', 'roles']);
    }

    /**
     * Update a user's profile fields.
     */
    public function update(User $user, array $data, User $updatedBy): User
    {
        $oldValues = $user->only(['name', 'email', 'department_id', 'classification', 'job_title', 'is_active']);

        $user->update(array_filter([
            'name'           => $data['name'] ?? null,
            'email'          => $data['email'] ?? null,
            'department_id'  => $data['department_id'] ?? null,
            'job_title'      => $data['job_title'] ?? null,
            'classification' => $data['classification'] ?? null,
            'mfa_enabled'    => $data['mfa_enabled'] ?? null,
        ], fn ($v) => $v !== null));

        if (!empty($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        AuditLog::record('user.updated', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'old_values'     => $oldValues,
            'new_values'     => $user->fresh()->only(['name', 'email', 'department_id', 'classification', 'job_title', 'is_active']),
            'tags' => 'user_management',
        ]);

        return $user->fresh(['department', 'roles']);
    }

    /**
     * Deactivate (soft-disable) a user. Does not delete.
     */
    public function deactivate(User $user, User $deactivatedBy): User
    {
        $user->update(['is_active' => false]);

        // Revoke all tokens
        $user->tokens()->delete();

        AuditLog::record('user.deactivated', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags' => 'user_management',
        ]);

        return $user->fresh();
    }

    /**
     * Reactivate a user.
     */
    public function reactivate(User $user, User $reactivatedBy): User
    {
        $user->update(['is_active' => true]);

        AuditLog::record('user.reactivated', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'tags' => 'user_management',
        ]);

        return $user->fresh();
    }

    /**
     * Get a user's audit trail.
     */
    public function auditTrail(User $user): \Illuminate\Database\Eloquent\Collection
    {
        return \App\Models\AuditLog::where('auditable_type', User::class)
            ->where('auditable_id', $user->id)
            ->orderByDesc('created_at')
            ->limit(50)
            ->get();
    }
}
