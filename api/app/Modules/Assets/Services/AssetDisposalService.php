<?php

namespace App\Modules\Assets\Services;

use App\Models\Asset;
use App\Models\AssetDisposal;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class AssetDisposalService
{
    public function request(Asset $asset, array $data, User $user): AssetDisposal
    {
        $this->assertTenant($asset, $user);
        $this->assertCanDispose($user);

        if ($asset->isDisposed() || $asset->status === 'pending') {
            throw ValidationException::withMessages([
                'asset_id' => 'Asset is not eligible for disposal.',
            ]);
        }

        if (AssetDisposal::where('asset_id', $asset->id)->whereNotIn('status', ['completed', 'rejected'])->exists()) {
            throw ValidationException::withMessages([
                'asset_id' => 'An open disposal request already exists for this asset.',
            ]);
        }

        return DB::transaction(function () use ($asset, $data, $user) {
            $disposal = AssetDisposal::create([
                'tenant_id' => $asset->tenant_id,
                'asset_id' => $asset->id,
                'reference' => 'DISP-'.strtoupper(Str::random(8)),
                'status' => 'draft',
                'reason' => $data['reason'],
                'method' => $data['method'] ?? null,
                'justification' => $data['justification'],
                'estimated_value' => $data['estimated_value'] ?? null,
                'requested_by' => $user->id,
            ]);

            $asset->status = 'pending_disposal';
            $asset->save();

            AuditLog::record('assets.disposal_requested', [
                'auditable_type' => AssetDisposal::class,
                'auditable_id' => $disposal->id,
                'new_values' => ['asset_id' => $asset->id, 'reason' => $data['reason']],
                'tags' => 'assets',
            ]);

            return $disposal->fresh();
        });
    }

    public function recommend(AssetDisposal $disposal, User $user, ?string $comments = null): AssetDisposal
    {
        $this->assertTenantDisposal($disposal, $user);
        $this->assertCanDispose($user);

        if ($disposal->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft disposals can be HOD-recommended.']);
        }

        $disposal->status = 'recommended';
        $disposal->hod_recommended_by = $user->id;
        $disposal->hod_recommended_at = now();
        $disposal->hod_comments = $comments;
        $disposal->save();

        AuditLog::record('assets.disposal_recommended', [
            'auditable_type' => AssetDisposal::class,
            'auditable_id' => $disposal->id,
            'tags' => 'assets',
        ]);

        return $disposal->fresh();
    }

    public function financeReview(AssetDisposal $disposal, User $user, ?string $comments = null): AssetDisposal
    {
        $this->assertTenantDisposal($disposal, $user);
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('finance.approve') && ! $user->hasPermissionTo('assets.dispose')) {
            abort(403, 'Finance review permission required.');
        }

        if ($disposal->status !== 'recommended') {
            throw ValidationException::withMessages(['status' => 'Disposal must be HOD-recommended before Finance review.']);
        }

        $disposal->status = 'finance_reviewed';
        $disposal->finance_reviewed_by = $user->id;
        $disposal->finance_reviewed_at = now();
        $disposal->finance_comments = $comments;
        $disposal->save();

        AuditLog::record('assets.disposal_finance_reviewed', [
            'auditable_type' => AssetDisposal::class,
            'auditable_id' => $disposal->id,
            'tags' => 'assets',
        ]);

        return $disposal->fresh();
    }

    public function approve(AssetDisposal $disposal, User $user): AssetDisposal
    {
        $this->assertTenantDisposal($disposal, $user);
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.dispose')) {
            abort(403, 'Disposal approval permission required.');
        }

        if ($disposal->status !== 'finance_reviewed') {
            throw ValidationException::withMessages(['status' => 'Disposal must complete Finance review before approval.']);
        }

        $disposal->status = 'approved';
        $disposal->approved_by = $user->id;
        $disposal->approved_at = now();
        $disposal->save();

        AuditLog::record('assets.disposal_approved', [
            'auditable_type' => AssetDisposal::class,
            'auditable_id' => $disposal->id,
            'tags' => 'assets',
        ]);

        return $disposal->fresh();
    }

    public function complete(AssetDisposal $disposal, User $user, array $data = []): AssetDisposal
    {
        $this->assertTenantDisposal($disposal, $user);
        $this->assertCanDispose($user);

        if ($disposal->status !== 'approved') {
            throw ValidationException::withMessages(['status' => 'Only approved disposals can be completed.']);
        }

        return DB::transaction(function () use ($disposal, $user, $data) {
            $disposal->status = 'completed';
            $disposal->completed_at = now();
            $disposal->method = $data['method'] ?? $disposal->method;
            $disposal->proceeds = $data['proceeds'] ?? $disposal->proceeds;
            $disposal->accounting_reference = $data['accounting_reference'] ?? $disposal->accounting_reference;
            $disposal->save();

            $asset = $disposal->asset;
            $finalStatus = match ($disposal->method) {
                'sale' => 'sold',
                'donation' => 'donated_out',
                'scrap' => 'scrapped',
                'write_off' => 'written_off',
                default => 'disposed',
            };
            $asset->status = $finalStatus;
            $asset->assigned_to = null;
            $asset->save();

            AuditLog::record('assets.disposal_completed', [
                'auditable_type' => AssetDisposal::class,
                'auditable_id' => $disposal->id,
                'new_values' => [
                    'asset_status' => $finalStatus,
                    'proceeds' => $disposal->proceeds,
                    'accounting_reference' => $disposal->accounting_reference,
                    'completed_by' => $user->id,
                ],
                'tags' => 'assets',
            ]);

            return $disposal->fresh(['asset']);
        });
    }

    private function assertTenant(Asset $asset, User $user): void
    {
        if ((int) $asset->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertTenantDisposal(AssetDisposal $disposal, User $user): void
    {
        if ((int) $disposal->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertCanDispose(User $user): void
    {
        if (! $user->isSystemAdmin() && ! $user->hasPermissionTo('assets.admin') && ! $user->hasPermissionTo('assets.dispose') && ! $user->hasPermissionTo('assets.manage')) {
            abort(403, 'Disposal permission required.');
        }
    }
}
