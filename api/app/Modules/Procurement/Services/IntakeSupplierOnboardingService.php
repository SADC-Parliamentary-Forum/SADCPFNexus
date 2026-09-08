<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementDocumentIntake;
use App\Models\SupplierCategory;
use App\Models\User;
use App\Models\Vendor;
use App\Modules\AccessControl\Services\CanonicalRoleManager;
use App\Modules\UserManagement\Services\UserService;
use App\Support\FrontendUrl;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Spatie\Permission\PermissionRegistrar;

class IntakeSupplierOnboardingService
{
    public function __construct(
        private readonly UserService $users,
        private readonly CanonicalRoleManager $roles,
    ) {}

    /**
     * Create or link a vendor on an unmatched intake and optionally invite a portal user.
     * Never emails a plaintext password.
     *
     * @param  array<string, mixed>  $payload
     * @return array{intake: ProcurementDocumentIntake, invitation: array<string, mixed>, created: bool}
     */
    public function onboard(ProcurementDocumentIntake $intake, User $actor, array $payload): array
    {
        if ((int) $intake->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        return DB::transaction(function () use ($intake, $actor, $payload) {
            $created = false;
            if (! empty($payload['vendor_id'])) {
                $vendor = Vendor::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->where('id', $payload['vendor_id'])
                    ->firstOrFail();
                $intake->update([
                    'vendor_id' => $vendor->id,
                    'supplier_match_status' => 'user_selected',
                ]);
                AuditLog::record('procurement.supplier_linked_from_intake', [
                    'auditable_type' => ProcurementDocumentIntake::class,
                    'auditable_id' => $intake->id,
                    'new_values' => ['vendor_id' => $vendor->id],
                    'tags' => 'procurement',
                ]);
            } else {
                $name = trim((string) ($payload['name'] ?? ''));
                if ($name === '') {
                    throw ValidationException::withMessages(['name' => 'Supplier name is required.']);
                }
                $categoryIds = array_values(array_unique(array_map('intval', $payload['category_ids'] ?? [])));
                if (count($categoryIds) < 1 || count($categoryIds) > 3) {
                    throw ValidationException::withMessages(['category_ids' => 'Select between 1 and 3 supplier categories.']);
                }

                $vendor = Vendor::create([
                    'tenant_id' => $actor->tenant_id,
                    'name' => $name,
                    'contact_name' => $payload['contact_name'] ?? null,
                    'registration_number' => $payload['registration_number'] ?? null,
                    'tax_number' => $payload['tax_number'] ?? null,
                    'contact_email' => $payload['contact_email'] ?? $payload['email'] ?? null,
                    'contact_phone' => $payload['contact_phone'] ?? $payload['phone'] ?? null,
                    'address' => $payload['address'] ?? null,
                    'country' => $payload['country'] ?? null,
                    'payment_terms' => $payload['payment_terms'] ?? null,
                    'bank_name' => $payload['bank_name'] ?? null,
                    'bank_account' => $payload['bank_account'] ?? null,
                    'bank_branch' => $payload['bank_branch'] ?? null,
                    'is_approved' => false,
                    'status' => 'pending_approval',
                    'submitted_at' => now(),
                    'notes' => 'Created from procurement document intake #'.$intake->id,
                ]);
                $vendor->syncLegacyFlagsFromStatus();
                $vendor->save();
                $this->syncCategories($vendor, $categoryIds, (int) $actor->tenant_id);

                $intake->update([
                    'vendor_id' => $vendor->id,
                    'supplier_match_status' => 'created_from_document',
                ]);
                $created = true;
                AuditLog::record('procurement.supplier_created_from_intake', [
                    'auditable_type' => Vendor::class,
                    'auditable_id' => $vendor->id,
                    'new_values' => [
                        'intake_id' => $intake->id,
                        'name' => $vendor->name,
                        'auto_approved' => false,
                    ],
                    'tags' => 'procurement',
                ]);
            }

            $sendInvitation = array_key_exists('send_invitation', $payload)
                ? (bool) $payload['send_invitation']
                : $created;

            $invitation = [
                'sent' => false,
                'email' => null,
                'password_emailed' => false,
                'login_url' => FrontendUrl::to('login'),
                'activation_hint' => 'The supplier will receive an activation link at /activate-account to choose a password. Nexus never emails a password.',
            ];

            if ($sendInvitation) {
                $email = strtolower(trim((string) ($payload['contact_email'] ?? $payload['email'] ?? $vendor->contact_email ?? '')));
                if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
                    throw ValidationException::withMessages([
                        'contact_email' => 'A valid email is required to send supplier login details.',
                    ]);
                }
                $contactName = trim((string) ($payload['contact_name'] ?? $vendor->contact_name ?? $vendor->name));
                $portalUser = $this->invitePortalUser($vendor, $actor, $email, $contactName !== '' ? $contactName : $vendor->name);
                $invitation['sent'] = true;
                $invitation['email'] = $portalUser->email;
                AuditLog::record('procurement.supplier_portal_invited', [
                    'auditable_type' => User::class,
                    'auditable_id' => $portalUser->id,
                    'new_values' => [
                        'vendor_id' => $vendor->id,
                        'intake_id' => $intake->id,
                        'email' => $portalUser->email,
                    ],
                    'tags' => 'procurement',
                ]);
            }

            return [
                'intake' => $intake->fresh(['lines', 'vendor', 'project']),
                'invitation' => $invitation,
                'created' => $created,
            ];
        });
    }

    private function invitePortalUser(Vendor $vendor, User $actor, string $email, string $name): User
    {
        $existing = User::query()->where('email', $email)->first();
        if ($existing) {
            if ((int) $existing->tenant_id !== (int) $actor->tenant_id) {
                throw ValidationException::withMessages([
                    'contact_email' => 'That email is already registered.',
                ]);
            }
            if ($existing->vendor_id && (int) $existing->vendor_id !== (int) $vendor->id) {
                throw ValidationException::withMessages([
                    'contact_email' => 'That email already belongs to another supplier portal user.',
                ]);
            }
            if (! $existing->isSupplier()) {
                throw ValidationException::withMessages([
                    'contact_email' => 'That email belongs to a staff account and cannot be used for the supplier portal.',
                ]);
            }
            $existing->update(['vendor_id' => $vendor->id]);
            $this->issuePortalInvitation($existing->fresh(), $actor, $vendor);

            return $existing->fresh();
        }

        $user = User::create([
            'tenant_id' => $actor->tenant_id,
            'vendor_id' => $vendor->id,
            'name' => $name,
            'email' => $email,
            'password' => Hash::make(Str::random(64)),
            'job_title' => 'Supplier',
            'classification' => 'UNCLASSIFIED',
            'is_active' => false,
            'account_status' => User::STATUS_INVITED,
            'invited_at' => now(),
            'status_changed_at' => now(),
            'must_reset_password' => true,
            'setup_completed' => false,
        ]);
        $user->syncRoles($this->roles->assignmentRoleNames('Supplier'));
        app(PermissionRegistrar::class)->forgetCachedPermissions();
        $this->issuePortalInvitation($user, $actor, $vendor);

        return $user->fresh();
    }

    private function issuePortalInvitation(User $user, User $actor, Vendor $vendor): void
    {
        $this->users->issueInvitation($user, $actor, true, 'supplier.portal_invited', [
            'supplier' => $vendor->name,
            'login_url' => FrontendUrl::to('login'),
            'portal_url' => FrontendUrl::to('supplier'),
            'role' => 'Supplier',
        ]);
    }

    /**
     * @param  list<int>  $categoryIds
     */
    private function syncCategories(Vendor $vendor, array $categoryIds, int $tenantId): void
    {
        $validIds = SupplierCategory::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('id', $categoryIds)
            ->pluck('id')
            ->all();

        if (count($validIds) !== count($categoryIds)) {
            throw ValidationException::withMessages([
                'category_ids' => 'One or more selected categories are invalid for this Secretariat.',
            ]);
        }

        $vendor->categories()->sync($validIds);
        $vendor->category = SupplierCategory::whereIn('id', $validIds)->orderBy('name')->pluck('name')->join(', ');
        $vendor->save();
    }
}
