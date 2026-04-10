<?php

namespace App\Modules\UserManagement\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class UserService
{
    public function __construct(private readonly NotificationService $notifications)
    {
    }

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
        $plainPassword = $data['password'] ?? str()->random(16);

        $user = User::create([
            'tenant_id'       => $createdBy->tenant_id,
            'department_id'   => $data['department_id'] ?? null,
            'name'            => $data['name'],
            'email'           => $data['email'],
            'password'        => Hash::make($plainPassword),
            'employee_number' => $data['employee_number'] ?? null,
            'job_title'       => $data['job_title'] ?? null,
            'classification'  => $data['classification'] ?? 'UNCLASSIFIED',
            'mfa_enabled'          => $data['mfa_enabled'] ?? true,
            'must_reset_password'  => true,
            'is_active'            => true,
            'bio'             => $data['bio'] ?? null,
            'date_of_birth'   => $data['date_of_birth'] ?? null,
            'join_date'       => $data['join_date'] ?? null,
            'phone'           => $data['phone'] ?? null,
            'nationality'     => $data['nationality'] ?? null,
            'gender'          => $data['gender'] ?? null,
            'marital_status'  => $data['marital_status'] ?? null,
            'emergency_contact_name'         => $data['emergency_contact_name'] ?? null,
            'emergency_contact_relationship' => $data['emergency_contact_relationship'] ?? null,
            'emergency_contact_phone'        => $data['emergency_contact_phone'] ?? null,
            'address_line1'   => $data['address_line1'] ?? null,
            'address_line2'   => $data['address_line2'] ?? null,
            'city'            => $data['city'] ?? null,
            'country'         => $data['country'] ?? null,
            'skills'          => $data['skills'] ?? null,
            'qualifications'  => $data['qualifications'] ?? null,
        ]);

        if (!empty($data['portfolio_ids'])) {
            $user->portfolios()->sync($data['portfolio_ids']);
        }

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

        if ($data['send_welcome_email'] ?? true) {
            $this->notifications->dispatch($user, 'user.welcome', [
                'name'       => $user->name,
                'email'      => $user->email,
                'password'   => $plainPassword,
                'role'       => $data['role'] ?? 'Staff',
                'portal_url' => env('APP_FRONTEND_URL', config('app.url')),
            ]);
        }

        return $user->load(['department', 'roles']);
    }

    /**
     * Update a user's profile fields.
     */
    public function update(User $user, array $data, User $updatedBy): User
    {
        $oldValues = $user->only([
            'name', 'email', 'department_id', 'classification', 'job_title', 'is_active', 'bio', 'date_of_birth', 'join_date', 'phone',
            'nationality', 'gender', 'marital_status', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
            'address_line1', 'address_line2', 'city', 'country'
        ]);

        $user->update(array_filter([
            'name'           => $data['name'] ?? null,
            'email'          => $data['email'] ?? null,
            'department_id'  => $data['department_id'] ?? null,
            'job_title'      => $data['job_title'] ?? null,
            'classification' => $data['classification'] ?? null,
            'mfa_enabled'    => $data['mfa_enabled'] ?? null,
            'bio'            => $data['bio'] ?? null,
            'date_of_birth'  => $data['date_of_birth'] ?? null,
            'join_date'      => $data['join_date'] ?? null,
            'phone'          => $data['phone'] ?? null,
            'nationality'     => $data['nationality'] ?? null,
            'gender'          => $data['gender'] ?? null,
            'marital_status'  => $data['marital_status'] ?? null,
            'emergency_contact_name'         => $data['emergency_contact_name'] ?? null,
            'emergency_contact_relationship' => $data['emergency_contact_relationship'] ?? null,
            'emergency_contact_phone'        => $data['emergency_contact_phone'] ?? null,
            'address_line1'   => $data['address_line1'] ?? null,
            'address_line2'   => $data['address_line2'] ?? null,
            'city'            => $data['city'] ?? null,
            'country'         => $data['country'] ?? null,
            'skills'          => $data['skills'] ?? null,
            'qualifications'  => $data['qualifications'] ?? null,
        ], fn ($v) => $v !== null));

        // Handle position_id separately — allows explicitly clearing it to null
        if (array_key_exists('position_id', $data)) {
            $user->update(['position_id' => $data['position_id']]);
        }

        if (isset($data['portfolio_ids'])) {
            $user->portfolios()->sync($data['portfolio_ids']);
        }

        if (!empty($data['role'])) {
            $user->syncRoles([$data['role']]);
        }

        AuditLog::record('user.updated', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'old_values'     => $oldValues,
            'new_values'     => $user->fresh()->only([
                'name', 'email', 'department_id', 'classification', 'job_title', 'is_active', 'bio', 'date_of_birth', 'join_date', 'phone',
                'nationality', 'gender', 'marital_status', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
                'address_line1', 'address_line2', 'city', 'country'
            ]),
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
