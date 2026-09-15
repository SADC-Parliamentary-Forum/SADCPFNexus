<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetLabel;
use App\Models\AssetRecoveryContact;
use App\Models\AssetRecoveryContactVersion;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetRecoveryContactService
{
    public function __construct(private readonly AssetTimelineService $timeline) {}

    public function current(int $tenantId, ?int $categoryId = null): ?AssetRecoveryContact
    {
        $query = AssetRecoveryContact::query()
            ->where('tenant_id', $tenantId)
            ->where('active', true)
            ->orderByDesc('version');

        if ($categoryId) {
            $override = (clone $query)->where('asset_category_id', $categoryId)->first();
            if ($override) {
                return $override;
            }
        }

        return $query->whereNull('asset_category_id')->first();
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(User $actor, array $data): AssetRecoveryContact
    {
        if (! AssetAccess::canManage($actor) && ! $actor->hasPermissionTo('assets.settings.recovery_contact.manage')) {
            abort(403, 'Not authorised to manage asset recovery contacts.');
        }

        $primary = trim((string) ($data['primary_phone'] ?? ''));
        if ($primary === '') {
            throw ValidationException::withMessages(['primary_phone' => 'Primary telephone is required.']);
        }

        return DB::transaction(function () use ($actor, $data, $primary) {
            $categoryId = $data['asset_category_id'] ?? null;
            $contact = AssetRecoveryContact::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where(function ($q) use ($categoryId) {
                    if ($categoryId) {
                        $q->where('asset_category_id', $categoryId);
                    } else {
                        $q->whereNull('asset_category_id');
                    }
                })
                ->first();

            $old = $contact?->only([
                'name', 'department', 'primary_phone', 'secondary_phone', 'whatsapp',
                'email', 'return_address', 'office_hours', 'instructions',
                'show_primary_phone', 'show_secondary_phone', 'show_whatsapp',
                'show_email', 'show_address', 'version',
            ]);

            $payload = [
                'name' => $data['name'] ?? null,
                'department' => $data['department'] ?? null,
                'primary_phone' => $primary,
                'secondary_phone' => $data['secondary_phone'] ?? null,
                'whatsapp' => $data['whatsapp'] ?? null,
                'email' => $data['email'] ?? null,
                'return_address' => $data['return_address'] ?? null,
                'office_hours' => $data['office_hours'] ?? null,
                'instructions' => $data['instructions'] ?? null,
                'show_primary_phone' => (bool) ($data['show_primary_phone'] ?? true),
                'show_secondary_phone' => (bool) ($data['show_secondary_phone'] ?? false),
                'show_whatsapp' => (bool) ($data['show_whatsapp'] ?? false),
                'show_email' => (bool) ($data['show_email'] ?? true),
                'show_address' => (bool) ($data['show_address'] ?? false),
                'active' => (bool) ($data['active'] ?? true),
                'effective_from' => now(),
                'updated_by' => $actor->id,
            ];

            if (! $contact) {
                $contact = AssetRecoveryContact::create([
                    ...$payload,
                    'tenant_id' => $actor->tenant_id,
                    'asset_category_id' => $categoryId,
                    'version' => 1,
                    'created_by' => $actor->id,
                ]);
            } else {
                $contact->fill($payload);
                $contact->version = ((int) $contact->version) + 1;
                $contact->save();
            }

            AssetRecoveryContactVersion::create([
                'tenant_id' => $actor->tenant_id,
                'recovery_contact_id' => $contact->id,
                'version' => $contact->version,
                'effective_from' => $contact->effective_from,
                'snapshot' => $contact->only([
                    'name', 'department', 'primary_phone', 'secondary_phone', 'whatsapp',
                    'email', 'return_address', 'office_hours', 'instructions',
                    'show_primary_phone', 'show_secondary_phone', 'show_whatsapp',
                    'show_email', 'show_address', 'active',
                ]),
                'reason' => $data['reason'] ?? null,
                'created_by' => $actor->id,
            ]);

            AuditLog::record('assets.recovery_contact_changed', [
                'auditable_type' => AssetRecoveryContact::class,
                'auditable_id' => $contact->id,
                'old_values' => $old,
                'new_values' => [
                    'primary_phone' => $contact->primary_phone,
                    'email' => $contact->email,
                    'version' => $contact->version,
                    'reason' => $data['reason'] ?? null,
                ],
                'tags' => 'assets',
            ]);

            $this->flagStaleLabels((int) $actor->tenant_id, (int) $contact->version, $categoryId);

            return $contact->fresh();
        });
    }

    private function flagStaleLabels(int $tenantId, int $currentVersion, ?int $categoryId): void
    {
        $labelQuery = AssetLabel::query()
            ->where('tenant_id', $tenantId)
            ->whereIn('status', ['current', 'printed'])
            ->where(function ($q) use ($currentVersion) {
                $q->whereNull('recovery_contact_version')
                    ->orWhere('recovery_contact_version', '!=', $currentVersion);
            });

        $labels = $labelQuery->get();
        $categoryCode = null;
        if ($categoryId) {
            $categoryCode = \App\Models\AssetCategory::query()->where('id', $categoryId)->value('code');
        }
        foreach ($labels as $label) {
            $asset = Asset::query()->find($label->asset_id);
            if (! $asset) {
                continue;
            }
            if ($categoryCode && $asset->category !== $categoryCode) {
                continue;
            }
            if (! $categoryId) {
                $override = $this->current((int) $asset->tenant_id, $this->categoryIdForAsset($asset));
                if ($override && $override->asset_category_id) {
                    continue;
                }
            }
            $label->status = 'reprint_required';
            $label->reprint_reason = 'CONTACT_CHANGED';
            $label->save();
            if (($asset->label_status ?? 'never_printed') !== 'never_printed') {
                $asset->label_status = 'reprint_required';
                $asset->label_reprint_reason = 'CONTACT_CHANGED';
                $asset->save();
                $this->timeline->record($asset, 'LABEL_REPRINT_REQUIRED', 'Asset Recovery contact details have changed. This asset label should be reprinted.');
            }
        }
    }

    private function categoryIdForAsset(Asset $asset): ?int
    {
        if (! $asset->category) {
            return null;
        }
        $id = \App\Models\AssetCategory::query()
            ->where('tenant_id', $asset->tenant_id)
            ->where('code', $asset->category)
            ->value('id');

        return $id ? (int) $id : null;
    }
}
