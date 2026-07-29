<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetRevaluation;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssetRevaluationService
{
    public function request(Asset $asset, array $data, User $user): AssetRevaluation
    {
        $this->assertTenant($asset, $user);
        $this->assertCanManage($user);

        if ($asset->isDisposed() || in_array($asset->status, ['pending', 'pending_disposal'], true)) {
            throw ValidationException::withMessages([
                'asset_id' => 'Asset is not eligible for revaluation.',
            ]);
        }

        if (AssetRevaluation::where('asset_id', $asset->id)->where('status', 'pending')->exists()) {
            throw ValidationException::withMessages([
                'asset_id' => 'An open revaluation request already exists for this asset.',
            ]);
        }

        $reval = AssetRevaluation::create([
            'tenant_id' => $asset->tenant_id,
            'asset_id' => $asset->id,
            'reference' => 'REVAL-'.strtoupper(Str::random(8)),
            'status' => 'pending',
            'previous_book_value' => $asset->book_value ?? $asset->purchase_value,
            'proposed_value' => $data['proposed_value'],
            'reason' => $data['reason'],
            'effective_date' => $data['effective_date'],
            'requested_by' => $user->id,
        ]);

        AuditLog::record('assets.revaluation_requested', [
            'auditable_type' => AssetRevaluation::class,
            'auditable_id' => $reval->id,
            'new_values' => [
                'asset_id' => $asset->id,
                'proposed_value' => $data['proposed_value'],
            ],
            'tags' => 'assets',
        ]);

        return $reval->fresh(['asset', 'requester']);
    }

    public function approve(AssetRevaluation $revaluation, User $user, ?string $comments = null): AssetRevaluation
    {
        $this->assertTenantReval($revaluation, $user);
        $this->assertCanApprove($user);

        if ($revaluation->status !== 'pending') {
            throw ValidationException::withMessages(['status' => 'Only pending revaluations can be approved.']);
        }

        return DB::transaction(function () use ($revaluation, $user, $comments) {
            $revaluation->status = 'approved';
            $revaluation->approved_by = $user->id;
            $revaluation->approved_at = now();
            $revaluation->approval_comments = $comments;
            $revaluation->save();

            $asset = $revaluation->asset;
            $asset->book_value = $revaluation->proposed_value;
            $asset->save();

            AuditLog::record('assets.revaluation_approved', [
                'auditable_type' => AssetRevaluation::class,
                'auditable_id' => $revaluation->id,
                'new_values' => [
                    'book_value' => $revaluation->proposed_value,
                    'previous_book_value' => $revaluation->previous_book_value,
                ],
                'tags' => 'assets',
            ]);

            return $revaluation->fresh(['asset', 'requester', 'approver']);
        });
    }

    public function reject(AssetRevaluation $revaluation, User $user, string $reason): AssetRevaluation
    {
        $this->assertTenantReval($revaluation, $user);
        $this->assertCanApprove($user);

        if ($revaluation->status !== 'pending') {
            throw ValidationException::withMessages(['status' => 'Only pending revaluations can be rejected.']);
        }

        $revaluation->status = 'rejected';
        $revaluation->rejected_by = $user->id;
        $revaluation->rejected_at = now();
        $revaluation->rejection_reason = $reason;
        $revaluation->save();

        AuditLog::record('assets.revaluation_rejected', [
            'auditable_type' => AssetRevaluation::class,
            'auditable_id' => $revaluation->id,
            'new_values' => ['reason' => $reason],
            'tags' => 'assets',
        ]);

        return $revaluation->fresh(['asset', 'requester']);
    }

    private function assertTenant(Asset $asset, User $user): void
    {
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertTenantReval(AssetRevaluation $revaluation, User $user): void
    {
        if ((int) $revaluation->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertCanManage(User $user): void
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.manage') && ! $user->hasPermissionTo('assets.dispose')) {
            abort(403, 'Asset revaluation permission required.');
        }
    }

    private function assertCanApprove(User $user): void
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('finance.approve') && ! $user->hasPermissionTo('assets.dispose')) {
            abort(403, 'Asset revaluation approval permission required.');
        }
    }
}
