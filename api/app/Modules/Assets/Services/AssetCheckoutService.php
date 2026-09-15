<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetCheckout;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetCheckoutService
{
    public function __construct(
        private readonly AssetTimelineService $timeline,
        private readonly NotificationService $notifications,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function checkout(Asset $asset, User $actor, array $data): AssetCheckout
    {
        if (! AssetAccess::canManage($actor) && ! $actor->hasPermissionTo('assets.checkout.manage')) {
            abort(403);
        }
        if ((int) $asset->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
        if (AssetCheckout::query()->where('asset_id', $asset->id)->whereNull('returned_at')->exists()) {
            throw ValidationException::withMessages(['asset' => 'Asset is already checked out.']);
        }
        if ($asset->reserved_handover_id) {
            throw ValidationException::withMessages(['asset' => 'Asset is reserved for a handover.']);
        }

        $borrower = User::query()->where('tenant_id', $actor->tenant_id)->findOrFail($data['borrower_id']);

        return DB::transaction(function () use ($asset, $actor, $data, $borrower) {
            $checkout = AssetCheckout::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'borrower_id' => $borrower->id,
                'purpose' => $data['purpose'] ?? null,
                'checked_out_at' => now(),
                'expected_return_at' => $data['expected_return_at'] ?? null,
                'accessories' => $data['accessories'] ?? null,
                'condition_out' => $data['condition_out'] ?? $asset->condition,
                'issued_by' => $actor->id,
                'notes' => $data['notes'] ?? null,
            ]);
            $asset->status = 'loan_out';
            $asset->save();
            $this->timeline->record($asset, 'CHECKED_OUT', 'Checked out to '.$borrower->name, $actor, [
                'borrower_id' => $borrower->id,
            ]);
            AuditLog::record('assets.checked_out', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'new_values' => ['borrower_id' => $borrower->id],
                'tags' => 'assets',
            ]);

            return $checkout->fresh();
        });
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function returnCheckout(Asset $asset, User $actor, array $data = []): AssetCheckout
    {
        if (! AssetAccess::canManage($actor) && ! $actor->hasPermissionTo('assets.checkout.manage')) {
            abort(403);
        }
        $open = AssetCheckout::query()->where('asset_id', $asset->id)->whereNull('returned_at')->first();
        if (! $open) {
            throw ValidationException::withMessages(['asset' => 'No open checkout.']);
        }

        return DB::transaction(function () use ($asset, $actor, $data, $open) {
            $open->returned_at = now();
            $open->condition_in = $data['condition_in'] ?? null;
            $open->damage_reported = (bool) ($data['damage_reported'] ?? false);
            $open->received_by = $actor->id;
            if (! empty($data['notes'])) {
                $open->notes = trim(($open->notes ?? '')."\n".$data['notes']);
            }
            $open->save();
            $asset->status = $asset->assigned_to ? 'assigned' : 'available';
            if (! empty($data['condition_in'])) {
                $asset->condition = $data['condition_in'];
            }
            $asset->save();
            $this->timeline->record($asset, 'CHECKED_IN', 'Checkout returned', $actor);
            AuditLog::record('assets.checked_in', [
                'auditable_type' => Asset::class,
                'auditable_id' => $asset->id,
                'tags' => 'assets',
            ]);

            return $open->fresh();
        });
    }

    public function notifyOverdue(): int
    {
        $open = AssetCheckout::query()
            ->whereNull('returned_at')
            ->where('overdue_notified', false)
            ->whereNotNull('expected_return_at')
            ->where('expected_return_at', '<', now())
            ->with(['asset', 'borrower'])
            ->get();
        $n = 0;
        foreach ($open as $checkout) {
            if ($checkout->borrower && $checkout->asset) {
                $this->notifications->dispatch($checkout->borrower, 'assets.checkout_overdue', [
                    'name' => $checkout->borrower->name,
                    'asset' => $checkout->asset->name,
                    'tag' => $checkout->asset->tag_number ?: $checkout->asset->asset_code,
                ]);
            }
            $checkout->overdue_notified = true;
            $checkout->save();
            $n++;
        }

        return $n;
    }
}
