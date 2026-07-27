<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AuditLog;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Fixed Asset register-of-record operations (capitalisation of pending drafts).
 */
class AssetService
{
    /**
     * Confirm a pending (typically GRN-draft) asset into the active register.
     *
     * @param  array{
     *     asset_code?: string,
     *     category: string,
     *     purchase_date: string,
     *     purchase_value: float|int|string,
     *     useful_life_years?: int|null,
     *     salvage_value?: float|int|string|null,
     *     depreciation_method?: string|null,
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

        $computedValue = Asset::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $purchaseDate);

        return DB::transaction(function () use ($asset, $data, $user, $category, $purchaseValue, $usefulLife, $salvage, $purchaseDate, $method, $computedValue) {
            $old = $asset->only(['status', 'category', 'purchase_date', 'purchase_value', 'value']);

            if (! empty($data['asset_code'])) {
                $asset->asset_code = $data['asset_code'];
            }

            $asset->category = $category;
            $asset->status = 'active';
            $asset->purchase_date = $purchaseDate->toDateString();
            $asset->purchase_value = $purchaseValue;
            $asset->useful_life_years = $usefulLife;
            $asset->salvage_value = $salvage;
            $asset->depreciation_method = $method;
            $asset->value = $computedValue ?? $purchaseValue;
            if (array_key_exists('notes', $data) && $data['notes'] !== null) {
                $asset->notes = $data['notes'];
            }
            $asset->save();

            AuditLog::record('assets.capitalised', [
                'auditable_type' => Asset::class,
                'auditable_id'   => $asset->id,
                'old_values'     => $old,
                'new_values'     => [
                    'status'         => 'active',
                    'purchase_value' => $purchaseValue,
                    'purchase_date'  => $asset->purchase_date,
                    'category'       => $category,
                ],
                'tags'           => 'assets',
            ]);

            return $asset->fresh();
        });
    }

    /**
     * Reject capitalisation of a pending draft (retire, keep procurement FKs).
     */
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

    private function assertTenant(Asset $asset, User $user): void
    {
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertCanManage(User $user): void
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Only system administrators or asset managers can capitalise assets.');
        }
    }
}
