<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCategory;
use App\Models\AssetLocation;
use App\Models\AssetLocationHistory;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Fixed Asset register-of-record operations.
 */
class AssetService
{
    public function __construct(
        private readonly AssetCapitalisationPolicyService $policyService,
    ) {}

    /**
     * Confirm a pending (typically GRN-draft) asset into the active register.
     *
     * @param  array{
     *     asset_code?: string,
     *     tag_number?: string,
     *     serial_number?: string,
     *     category: string,
     *     purchase_date: string,
     *     purchase_value: float|int|string,
     *     useful_life_years?: int|null,
     *     salvage_value?: float|int|string|null,
     *     depreciation_method?: string|null,
     *     asset_class?: string|null,
     *     force_controlled?: bool,
     *     allow_serial_duplicate?: bool,
     *     funding_source?: string|null,
     *     location_id?: int|null,
     *     notes?: string|null
     * }  $data
     */
    public function capitalise(Asset $asset, array $data, User $user): Asset
    {
        $this->assertTenant($asset, $user);
        $this->assertCanManage($user);

        if ($asset->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Only pending assets can be capitalised.',
            ]);
        }

        $allowedCategories = AssetCategory::forTenant($user->tenant_id)->pluck('code')->values()->all();
        if (empty($allowedCategories)) {
            throw ValidationException::withMessages([
                'category' => 'No asset categories defined. Create asset categories first.',
            ]);
        }

        $category = $data['category'] ?? $asset->category;
        if (! in_array($category, $allowedCategories, true)) {
            throw ValidationException::withMessages([
                'category' => 'Invalid asset category for this tenant.',
            ]);
        }

        $purchaseValue = (float) $data['purchase_value'];
        $usefulLife = isset($data['useful_life_years']) ? (int) $data['useful_life_years'] : null;
        $salvage = isset($data['salvage_value']) ? (float) $data['salvage_value'] : 0.0;
        $purchaseDate = Carbon::parse($data['purchase_date']);
        $method = $data['depreciation_method'] ?? 'straight_line';

        $policy = $this->policyService->ensureDefault((int) $user->tenant_id);
        $assetClass = $data['asset_class'] ?? $this->policyService->classify(
            $purchaseValue,
            $usefulLife,
            $policy,
            (bool) ($data['force_controlled'] ?? false),
        );
        if (! in_array($assetClass, ['capital', 'controlled'], true)) {
            throw ValidationException::withMessages([
                'asset_class' => 'Asset class must be capital or controlled.',
            ]);
        }

        $serial = $data['serial_number'] ?? $asset->serial_number;
        if ($serial) {
            $this->assertSerialAllowed($user->tenant_id, $serial, $asset->id, (bool) ($data['allow_serial_duplicate'] ?? false));
        }

        $tag = $data['tag_number'] ?? $asset->tag_number ?? $this->generateTag($user->tenant_id, $category);
        $this->assertTagUnique($user->tenant_id, $tag, $asset->id);

        $computedValue = Asset::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $purchaseDate);

        return DB::transaction(function () use ($asset, $data, $user, $category, $purchaseValue, $usefulLife, $salvage, $purchaseDate, $method, $computedValue, $policy, $assetClass, $serial, $tag) {
            $old = $asset->only(['status', 'category', 'purchase_date', 'purchase_value', 'value', 'asset_class']);

            if (! empty($data['asset_code'])) {
                $asset->asset_code = $data['asset_code'];
            }

            $asset->category = $category;
            $asset->asset_class = $assetClass;
            $asset->status = 'active';
            $asset->purchase_date = $purchaseDate->toDateString();
            $asset->purchase_value = $purchaseValue;
            $asset->useful_life_years = $usefulLife;
            $asset->salvage_value = $salvage;
            $asset->depreciation_method = $method;
            $asset->value = $computedValue ?? $purchaseValue;
            $asset->book_value = $computedValue ?? $purchaseValue;
            $asset->accumulated_depreciation = max(0, $purchaseValue - (float) ($computedValue ?? $purchaseValue));
            $asset->capitalisation_policy_id = $policy->id;
            $asset->serial_number = $serial;
            $asset->tag_number = $tag;
            if (array_key_exists('funding_source', $data)) {
                $asset->funding_source = $data['funding_source'];
            }
            if (! empty($data['location_id'])) {
                $this->recordLocationMove($asset, (int) $data['location_id'], $user, 'Capitalisation');
            }
            if (array_key_exists('notes', $data) && $data['notes'] !== null) {
                $asset->notes = $data['notes'];
            }
            if (! empty($data['allow_serial_duplicate'])) {
                $asset->serial_duplicate_override = true;
            }
            $asset->save();

            AuditLog::record('assets.capitalised', [
                'auditable_type' => Asset::class,
                'auditable_id'   => $asset->id,
                'old_values'     => $old,
                'new_values'     => [
                    'status'         => 'active',
                    'asset_class'    => $assetClass,
                    'purchase_value' => $purchaseValue,
                    'purchase_date'  => $asset->purchase_date,
                    'category'       => $category,
                    'tag_number'     => $tag,
                    'policy_id'      => $policy->id,
                ],
                'tags'           => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    public function rejectCapitalisation(Asset $asset, string $reason, User $user): Asset
    {
        $this->assertTenant($asset, $user);
        $this->assertCanManage($user);

        if ($asset->status !== 'pending') {
            throw ValidationException::withMessages([
                'status' => 'Only pending assets can have capitalisation rejected.',
            ]);
        }

        return DB::transaction(function () use ($asset, $reason) {
            $oldStatus = $asset->status;
            $asset->status = 'retired';
            $note = trim((string) $asset->notes);
            $rejection = 'Capitalisation rejected: '.$reason;
            $asset->notes = $note === '' ? $rejection : $note."\n".$rejection;
            $asset->save();

            AuditLog::record('assets.capitalisation_rejected', [
                'auditable_type' => Asset::class,
                'auditable_id'   => $asset->id,
                'old_values'     => ['status' => $oldStatus],
                'new_values'     => ['status' => 'retired', 'reason' => $reason],
                'tags'           => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    /**
     * Assign custody to a user — appends immutable history (never overwrite prior rows).
     */
    public function assign(Asset $asset, User $assignee, User $actor, array $data = []): Asset
    {
        $this->assertTenant($asset, $actor);
        $this->assertCanManage($actor);
        $this->assertAssignable($asset);

        if ((int) $assignee->tenant_id !== (int) $actor->tenant_id) {
            throw ValidationException::withMessages(['assigned_to' => 'Assignee must belong to the same tenant.']);
        }

        return DB::transaction(function () use ($asset, $assignee, $actor, $data) {
            $this->closeOpenAssignment($asset);

            AssetAssignmentHistory::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'assigned_to' => $assignee->id,
                'department' => $data['department'] ?? $asset->department,
                'assignment_type' => $data['assignment_type'] ?? 'custody',
                'assigned_at' => now(),
                'assigned_by' => $actor->id,
                'notes' => $data['notes'] ?? null,
            ]);

            $asset->assigned_to = $assignee->id;
            $asset->issued_at = now()->toDateString();
            $asset->acknowledgement_at = null;
            $asset->acknowledged_by = null;
            if (! empty($data['department'])) {
                $asset->department = $data['department'];
            }
            if (! empty($data['location_id'])) {
                $this->recordLocationMove($asset, (int) $data['location_id'], $actor, 'Assignment');
            }
            $asset->status = ($data['assignment_type'] ?? 'custody') === 'loan' ? 'loan_out' : 'assigned';
            $asset->save();

            AuditLog::record('assets.assigned', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'new_values' => ['assigned_to' => $assignee->id],
                'tags' => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    public function acknowledge(Asset $asset, User $user): Asset
    {
        $this->assertTenant($asset, $user);

        if ((int) $asset->assigned_to !== (int) $user->id) {
            abort(403, 'Only the assigned custodian can acknowledge this asset.');
        }

        $open = AssetAssignmentHistory::where('asset_id', $asset->id)
            ->whereNull('returned_at')
            ->orderByDesc('id')
            ->first();

        return DB::transaction(function () use ($asset, $user, $open) {
            $asset->acknowledgement_at = now();
            $asset->acknowledged_by = $user->id;
            $asset->save();

            if ($open) {
                $open->acknowledged_at = now();
                $open->save();
            }

            AuditLog::record('assets.acknowledged', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'new_values' => ['acknowledged_by' => $user->id],
                'tags' => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    public function transfer(Asset $asset, User $toUser, User $actor, array $data = []): Asset
    {
        return $this->assign($asset, $toUser, $actor, array_merge($data, [
            'notes' => trim(($data['notes'] ?? '').' (transfer)'),
        ]));
    }

    public function returnAsset(Asset $asset, User $actor, array $data = []): Asset
    {
        $this->assertTenant($asset, $actor);
        $this->assertCanManage($actor);
        $this->assertAssignable($asset);

        return DB::transaction(function () use ($asset, $actor, $data) {
            $this->closeOpenAssignment($asset);

            $asset->assigned_to = null;
            $asset->acknowledgement_at = null;
            $asset->acknowledged_by = null;
            $asset->status = 'available';
            if (! empty($data['location_id'])) {
                $this->recordLocationMove($asset, (int) $data['location_id'], $actor, 'Return');
            }
            $asset->save();

            AuditLog::record('assets.returned', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'tags' => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    public function markCondition(Asset $asset, string $status, User $actor, ?string $notes = null): Asset
    {
        $this->assertTenant($asset, $actor);
        $this->assertCanManage($actor);

        if (! in_array($status, ['missing', 'damaged', 'lost', 'stolen', 'under_investigation'], true)) {
            throw ValidationException::withMessages(['status' => 'Invalid exception status.']);
        }

        return DB::transaction(function () use ($asset, $status, $notes) {
            $old = $asset->status;
            $asset->status = $status;
            if ($status === 'damaged') {
                $asset->condition = 'damaged';
            }
            if ($notes) {
                $note = trim((string) $asset->notes);
                $asset->notes = $note === '' ? $notes : $note."\n".$notes;
            }
            $asset->save();

            AuditLog::record('assets.condition_marked', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'old_values' => ['status' => $old],
                'new_values' => ['status' => $status],
                'tags' => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    public function setLocation(Asset $asset, int $locationId, User $actor, ?string $notes = null): Asset
    {
        $this->assertTenant($asset, $actor);
        $this->assertCanManage($actor);

        return DB::transaction(function () use ($asset, $locationId, $actor, $notes) {
            $this->recordLocationMove($asset, $locationId, $actor, $notes);
            $asset->save();

            return $asset->fresh(['location']);
        });
    }

    public function generateTag(int $tenantId, string $category): string
    {
        $prefix = strtoupper(substr(preg_replace('/[^A-Za-z0-9]/', '', $category) ?: 'AST', 0, 4));
        do {
            $tag = sprintf('SADCPF-%s-%s', $prefix, strtoupper(Str::random(6)));
        } while (Asset::where('tenant_id', $tenantId)->where('tag_number', $tag)->exists());

        return $tag;
    }

    private function recordLocationMove(Asset $asset, int $locationId, User $actor, ?string $notes = null): void
    {
        $location = AssetLocation::where('tenant_id', $asset->tenant_id)->find($locationId);
        if (! $location) {
            throw ValidationException::withMessages(['location_id' => 'Location not found.']);
        }

        AssetLocationHistory::create([
            'tenant_id' => $asset->tenant_id,
            'asset_id' => $asset->id,
            'location_id' => $location->id,
            'location_label' => trim(implode(' / ', array_filter([$location->building, $location->floor, $location->room, $location->name]))),
            'moved_at' => now(),
            'moved_by' => $actor->id,
            'notes' => $notes,
        ]);

        $asset->location_id = $location->id;
    }

    private function closeOpenAssignment(Asset $asset): void
    {
        AssetAssignmentHistory::where('asset_id', $asset->id)
            ->whereNull('returned_at')
            ->update(['returned_at' => now()]);
    }

    private function assertAssignable(Asset $asset): void
    {
        if ($asset->isDisposed() || in_array($asset->status, ['pending_disposal', 'retired', 'pending'], true)) {
            throw ValidationException::withMessages([
                'status' => 'Asset cannot be assigned in its current status.',
            ]);
        }
    }

    private function assertSerialAllowed(int $tenantId, string $serial, ?int $ignoreId, bool $allowDuplicate): void
    {
        $exists = Asset::where('tenant_id', $tenantId)
            ->where('serial_number', $serial)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists && ! $allowDuplicate) {
            throw ValidationException::withMessages([
                'serial_number' => 'Serial number already exists for another asset. Pass allow_serial_duplicate to override with audit.',
            ]);
        }
    }

    private function assertTagUnique(int $tenantId, string $tag, ?int $ignoreId): void
    {
        $exists = Asset::where('tenant_id', $tenantId)
            ->where('tag_number', $tag)
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();

        if ($exists) {
            throw ValidationException::withMessages([
                'tag_number' => 'Asset tag must be unique within the tenant.',
            ]);
        }
    }

    private function assertTenant(Asset $asset, User $user): void
    {
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertCanManage(User $user): void
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Only system administrators or asset managers can manage assets.');
        }
    }
}
