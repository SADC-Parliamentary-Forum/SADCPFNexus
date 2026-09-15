<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetTransfer;
use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Support\AssetAccess;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AssetTransferService
{
    public function __construct(
        private readonly AssetService $assets,
        private readonly AssetTimelineService $timeline,
        private readonly AssetLabelService $labels,
    ) {}

    /**
     * @param  array<string, mixed>  $data
     */
    public function initiate(Asset $asset, User $actor, array $data): AssetTransfer
    {
        if (! AssetAccess::canManage($actor) && ! $actor->hasPermissionTo('assets.transfer.manage')) {
            abort(403);
        }
        if ((int) $asset->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
        if (AssetTransfer::query()->where('asset_id', $asset->id)->whereIn('status', ['pending_outgoing', 'pending_incoming'])->exists()) {
            throw ValidationException::withMessages(['asset' => 'A transfer is already in progress.']);
        }
        $to = User::query()->where('tenant_id', $actor->tenant_id)->findOrFail($data['to_user_id']);

        return DB::transaction(function () use ($asset, $actor, $data, $to) {
            $override = $data['override_reason'] ?? null;
            $status = $override ? 'pending_incoming' : 'pending_outgoing';
            if ($override && ! AssetAccess::canManage($actor)) {
                abort(403, 'Override requires elevated permission.');
            }
            $transfer = AssetTransfer::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'from_user_id' => $asset->assigned_to,
                'to_user_id' => $to->id,
                'status' => $status,
                'reason' => $data['reason'] ?? null,
                'condition' => $data['condition'] ?? $asset->condition,
                'override_reason' => $override,
                'override_notes' => $data['override_notes'] ?? null,
                'initiated_by' => $actor->id,
                'outgoing_confirmed_at' => $override ? now() : null,
                'outgoing_confirmed_by' => $override ? $actor->id : null,
            ]);
            $this->timeline->record($asset, 'TRANSFER_INITIATED', 'Transfer initiated to '.$to->name, $actor);
            AuditLog::record('assets.transfer_initiated', [
                'auditable_type' => AssetTransfer::class,
                'auditable_id' => $transfer->id,
                'new_values' => ['to_user_id' => $to->id, 'status' => $status, 'override' => $override],
                'tags' => 'assets',
            ]);

            return $transfer->fresh();
        });
    }

    public function confirmOutgoing(AssetTransfer $transfer, User $actor): AssetTransfer
    {
        $this->assertTenant($transfer, $actor);
        if ($transfer->status !== 'pending_outgoing') {
            throw ValidationException::withMessages(['status' => 'Outgoing confirmation is not pending.']);
        }
        $isFrom = $transfer->from_user_id && (int) $transfer->from_user_id === (int) $actor->id;
        if (! $isFrom && ! AssetAccess::canManage($actor)) {
            abort(403);
        }
        $transfer->status = 'pending_incoming';
        $transfer->outgoing_confirmed_at = now();
        $transfer->outgoing_confirmed_by = $actor->id;
        $transfer->save();
        $this->timeline->record($transfer->asset, 'TRANSFER_OUTGOING_CONFIRMED', 'Outgoing custodian confirmed transfer', $actor);

        return $transfer->fresh();
    }

    public function accept(AssetTransfer $transfer, User $actor): AssetTransfer
    {
        $this->assertTenant($transfer, $actor);
        if (! in_array($transfer->status, ['pending_incoming', 'pending_outgoing'], true)) {
            throw ValidationException::withMessages(['status' => 'Transfer cannot be accepted.']);
        }
        $isTo = (int) $transfer->to_user_id === (int) $actor->id;
        if (! $isTo && ! AssetAccess::canManage($actor)) {
            abort(403);
        }
        if ($transfer->status === 'pending_outgoing' && ! AssetAccess::canManage($actor)) {
            throw ValidationException::withMessages(['status' => 'Outgoing custodian must confirm first.']);
        }

        return DB::transaction(function () use ($transfer, $actor) {
            $asset = $transfer->asset;
            $to = User::findOrFail($transfer->to_user_id);
            $this->assets->assign($asset, $to, $actor, [
                'skip_handshake' => true,
                'skip_manage' => true,
                'notes' => $transfer->reason,
                'assignment_type' => 'custody',
            ]);
            $transfer->status = 'completed';
            $transfer->accepted_at = now();
            $transfer->accepted_by = $actor->id;
            $transfer->completed_at = now();
            $transfer->save();
            $this->labels->markReprintRequired($asset->fresh(), 'CUSTODY_OR_LOCATION_CHANGED');
            $this->timeline->record($asset, 'TRANSFER_COMPLETED', 'Custody transferred to '.$to->name, $actor);
            AuditLog::record('assets.transfer_completed', [
                'auditable_type' => AssetTransfer::class,
                'auditable_id' => $transfer->id,
                'tags' => 'assets',
            ]);

            return $transfer->fresh();
        });
    }

    private function assertTenant(AssetTransfer $transfer, User $actor): void
    {
        if ((int) $transfer->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
