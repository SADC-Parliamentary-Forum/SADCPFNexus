<?php

namespace App\Modules\UserManagement\Services;

use App\Models\AuditLog;
use App\Models\AccountInvitation;
use App\Models\UserSession;
use App\Models\User;
use App\Services\NotificationService;
use App\Support\FrontendUrl;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;
use App\Modules\AccessControl\Services\CanonicalRoleManager;

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
                'active'   => $query->where('is_active', true)->where('account_status', User::STATUS_ACTIVE),
                'inactive' => $query->where('is_active', false),
                'invited'  => $query->where('account_status', User::STATUS_INVITED),
                'suspended' => $query->where('account_status', User::STATUS_SUSPENDED),
                'disabled' => $query->where('account_status', User::STATUS_DISABLED),
                'offboarded' => $query->where('account_status', User::STATUS_OFFBOARDED),
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
        return DB::transaction(function () use ($data, $createdBy): User {
            $user = User::create([
                'tenant_id'       => $createdBy->tenant_id,
                'department_id'   => $data['department_id'] ?? null,
                'name'            => $data['name'],
                'email'           => strtolower(trim((string) $data['email'])),
                'password'        => Hash::make(Str::random(64)),
                'employee_number' => $data['employee_number'] ?? null,
                'job_title'       => $data['job_title'] ?? null,
                'classification'  => $data['classification'] ?? 'UNCLASSIFIED',
                'mfa_enabled'          => false,
                'mfa_secret'           => null,
                'must_reset_password'  => false,
                'setup_completed'      => false,
                'is_active'            => false,
                'account_status'       => User::STATUS_INVITED,
                'invited_at'           => now(),
                'status_changed_at'    => now(),
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

            if (!empty($data['role'])) {
                $roleManager = app(CanonicalRoleManager::class);
                $role = $roleManager->canonicalize((string) $data['role']);
                if (! $roleManager->isAssignableRole($role)) {
                    throw ValidationException::withMessages([
                        'role' => ['The selected role is not part of the governed role catalogue.'],
                    ]);
                }
                $user->syncRoles($roleManager->assignmentRoleNames((string) $data['role']));
                app(PermissionRegistrar::class)->forgetCachedPermissions();
            }

            $invitation = $this->issueInvitation(
                $user,
                $createdBy,
                (bool) ($data['send_welcome_email'] ?? true)
            );

            AuditLog::record('user.invited', [
                'auditable_type' => User::class,
                'auditable_id'   => $user->id,
                'new_values'     => [
                    'name'       => $user->name,
                    'email'      => $user->email,
                    'role'       => $data['role'] ?? null,
                    'invitation_id' => $invitation->id,
                ],
                'tags' => 'user_management',
            ]);

            return $user->fresh(['department', 'roles', 'latestAccountInvitation']);
        });
    }

    public function issueInvitation(User $user, User $invitedBy, bool $sendEmail = true): AccountInvitation
    {
        [$plainToken, $tokenHash] = $this->makeInvitationToken();
        $expiresAt = now()->addHours(max(1, (int) config('auth_lifecycle.invitation_expire_hours', 48)));

        AccountInvitation::where('user_id', $user->id)
            ->where('status', AccountInvitation::STATUS_PENDING)
            ->update(['status' => AccountInvitation::STATUS_SUPERSEDED]);

        $invitation = AccountInvitation::create([
            'tenant_id' => $user->tenant_id,
            'user_id' => $user->id,
            'invited_by_id' => $invitedBy->id,
            'email' => $user->email,
            'token_hash' => $tokenHash,
            'status' => AccountInvitation::STATUS_PENDING,
            'expires_at' => $expiresAt,
        ]);

        if ($sendEmail) {
            $this->notifications->dispatch($user, 'user.invited', [
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->getRoleNames()->first() ?? 'Staff',
                'activation_url' => $this->activationUrl($plainToken),
                'expires_at' => $expiresAt->toDayDateTimeString(),
            ], [
                'module' => 'auth',
                'invitation_id' => $invitation->id,
            ], true, false);
        }

        return $invitation;
    }

    private function makeInvitationToken(): array
    {
        $plainToken = bin2hex(random_bytes(32));

        return [$plainToken, AccountInvitation::hashToken($plainToken)];
    }

    private function activationUrl(string $plainToken): string
    {
        $frontendUrl = FrontendUrl::base();

        return "{$frontendUrl}/activate-account?token=".urlencode($plainToken);
    }

    /**
     * Update a user's profile fields.
     *
     * Privileged fields (role, classification, MFA, department, position) may
     * only be changed by a System Admin — never by the subject user themselves
     * via this service (closes privilege-escalation via self PUT).
     */
    public function update(User $user, array $data, User $updatedBy): User
    {
        if (! $updatedBy->isSystemAdmin()) {
            unset(
                $data['role'],
                $data['classification'],
                $data['mfa_enabled'],
                $data['department_id'],
                $data['position_id'],
                $data['portfolio_ids'],
            );
        }

        $oldValues = $user->only([
            'name', 'email', 'department_id', 'classification', 'job_title', 'is_active', 'account_status', 'bio', 'date_of_birth', 'join_date', 'phone',
            'nationality', 'gender', 'marital_status', 'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
            'address_line1', 'address_line2', 'city', 'country'
        ]);
        $oldRoles = $user->getRoleNames()->values()->all();

        $user->update(array_filter([
            'name'           => $data['name'] ?? null,
            'email'          => $data['email'] ?? null,
            'department_id'  => $data['department_id'] ?? null,
            'job_title'      => $data['job_title'] ?? null,
            'classification' => $data['classification'] ?? null,
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
            $roleManager = app(CanonicalRoleManager::class);
            $role = $roleManager->canonicalize((string) $data['role']);
            if (! $roleManager->isAssignableRole($role)) {
                throw ValidationException::withMessages([
                    'role' => ['The selected role is not part of the governed role catalogue.'],
                ]);
            }
            $assigned = $roleManager->assignmentRoleNames((string) $data['role']);
            $user->syncRoles($assigned);
            app(PermissionRegistrar::class)->forgetCachedPermissions();

            if ($oldRoles !== $assigned) {
                $this->revokeAllAccess($user);

                AuditLog::record('user.role_changed', [
                    'auditable_type' => User::class,
                    'auditable_id' => $user->id,
                    'old_values' => ['roles' => $oldRoles],
                    'new_values' => ['roles' => $assigned],
                    'tags' => 'user_management',
                ]);
            }
        }

        AuditLog::record('user.updated', [
            'auditable_type' => User::class,
            'auditable_id'   => $user->id,
            'old_values'     => $oldValues,
            'new_values'     => $user->fresh()->only([
                'name', 'email', 'department_id', 'classification', 'job_title', 'is_active', 'account_status', 'bio', 'date_of_birth', 'join_date', 'phone',
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
        return $this->updateAccountStatus($user, User::STATUS_DISABLED, $deactivatedBy, 'Deactivated by administrator.');
    }

    public function bulkDeactivate(array $ids, User $actor, callable $canDelete): array
    {
        $deactivated = [];
        $skipped = [];
        $uniqueIds = array_values(array_unique(array_map('intval', $ids)));

        $users = User::query()
            ->whereIn('id', $uniqueIds)
            ->get()
            ->keyBy('id');

        foreach ($uniqueIds as $id) {
            $user = $users->get($id);
            if (! $user) {
                $skipped[] = ['id' => $id, 'reason' => 'not_found'];
                continue;
            }
            if (! $user->is_active) {
                $skipped[] = ['id' => $id, 'reason' => 'already_inactive'];
                continue;
            }
            if ($actor->id === $user->id) {
                $skipped[] = ['id' => $id, 'reason' => 'self'];
                continue;
            }
            if (! $canDelete($user)) {
                $skipped[] = ['id' => $id, 'reason' => 'forbidden'];
                continue;
            }

            $this->deactivate($user, $actor);
            $deactivated[] = $id;
        }

        return [
            'deactivated' => $deactivated,
            'skipped'     => $skipped,
        ];
    }

    public function revokeAllAccess(User $user): void
    {
        $user->tokens()->delete();
        UserSession::where('user_id', $user->id)->delete();
    }

    /**
     * Reactivate a user.
     */
    public function reactivate(User $user, User $reactivatedBy): User
    {
        return $this->updateAccountStatus($user, User::STATUS_ACTIVE, $reactivatedBy, 'Reactivated by administrator.');
    }

    public function updateAccountStatus(User $user, string $status, User $actor, ?string $reason = null): User
    {
        $allowed = [
            User::STATUS_ACTIVE,
            User::STATUS_LOCKED,
            User::STATUS_SUSPENDED,
            User::STATUS_DISABLED,
            User::STATUS_OFFBOARDED,
        ];

        if (! in_array($status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => ['Unsupported account status transition.'],
            ]);
        }

        $oldValues = $user->only(['is_active', 'account_status', 'status_reason']);
        $now = now();

        $updates = [
            'account_status' => $status,
            'is_active' => $status === User::STATUS_ACTIVE,
            'status_changed_at' => $now,
            'status_reason' => $reason,
        ];

        if ($status === User::STATUS_ACTIVE) {
            $updates['activated_at'] = $user->activated_at ?? $now;
        }
        if ($status === User::STATUS_SUSPENDED) {
            $updates['suspended_at'] = $now;
        }
        if ($status === User::STATUS_DISABLED) {
            $updates['disabled_at'] = $now;
        }
        if ($status === User::STATUS_OFFBOARDED) {
            $updates['offboarded_at'] = $now;
        }

        $user->forceFill($updates)->save();

        if ($status !== User::STATUS_ACTIVE) {
            $this->revokeAllAccess($user);
        }

        AuditLog::record('user.account_status_changed', [
            'auditable_type' => User::class,
            'auditable_id' => $user->id,
            'old_values' => $oldValues,
            'new_values' => $user->fresh()->only(['is_active', 'account_status', 'status_reason']),
            'tags' => 'user_management',
        ]);

        return $user->fresh(['department', 'roles']);
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
