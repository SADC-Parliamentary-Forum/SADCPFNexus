<?php

namespace App\Modules\Correspondence\Services;

use App\Models\AuditLog;
use App\Models\Correspondence;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class CorrespondenceRetentionService
{
    public const POLICIES = [
        'general_3y',
        'financial_7y',
        'hr_permanent',
        'legal_hold_only',
        'custom',
    ];

    public function updateRetention(Correspondence $letter, array $data, User $user): Correspondence
    {
        $this->assertCanManage($user);
        $this->assertTenant($letter, $user);

        $legalHold = array_key_exists('legal_hold', $data) ? (bool) $data['legal_hold'] : (bool) $letter->legal_hold;

        if ($legalHold && empty($data['legal_hold_reason'] ?? $letter->legal_hold_reason)) {
            throw ValidationException::withMessages([
                'legal_hold_reason' => 'A reason is required when placing a legal hold.',
            ]);
        }

        $letter->retention_policy = $data['retention_policy'] ?? $letter->retention_policy;
        $letter->retain_until = $data['retain_until'] ?? $letter->retain_until;

        if ($legalHold && ! $letter->legal_hold) {
            $letter->legal_hold = true;
            $letter->legal_hold_reason = $data['legal_hold_reason'] ?? $letter->legal_hold_reason;
            $letter->legal_hold_set_by = $user->id;
            $letter->legal_hold_set_at = now();
        } elseif ($legalHold) {
            $letter->legal_hold_reason = $data['legal_hold_reason'] ?? $letter->legal_hold_reason;
        } elseif ($letter->legal_hold && array_key_exists('legal_hold', $data) && ! $legalHold) {
            $letter->legal_hold = false;
            $letter->legal_hold_reason = null;
            $letter->legal_hold_set_by = null;
            $letter->legal_hold_set_at = null;
        }

        $letter->save();

        AuditLog::record('correspondence.retention_updated', [
            'auditable_type' => Correspondence::class,
            'auditable_id' => $letter->id,
            'new_values' => [
                'retention_policy' => $letter->retention_policy,
                'retain_until' => $letter->retain_until?->toDateString(),
                'legal_hold' => $letter->legal_hold,
            ],
            'tags' => 'correspondence',
        ]);

        return $letter->fresh();
    }

    public function releaseHold(Correspondence $letter, User $user): Correspondence
    {
        $this->assertCanManage($user);
        $this->assertTenant($letter, $user);

        $letter->legal_hold = false;
        $letter->legal_hold_reason = null;
        $letter->legal_hold_set_by = null;
        $letter->legal_hold_set_at = null;
        $letter->save();

        AuditLog::record('correspondence.legal_hold_released', [
            'auditable_type' => Correspondence::class,
            'auditable_id' => $letter->id,
            'tags' => 'correspondence',
        ]);

        return $letter->fresh();
    }

    public function purge(Correspondence $letter, User $user): Correspondence
    {
        $this->assertCanManage($user);
        $this->assertTenant($letter, $user);

        if ($letter->legal_hold) {
            throw ValidationException::withMessages([
                'legal_hold' => 'Cannot purge correspondence under legal hold. Release the hold first.',
            ]);
        }

        if ($letter->retain_until && $letter->retain_until->isFuture()) {
            throw ValidationException::withMessages([
                'retain_until' => 'Retention period has not elapsed (retain until '.$letter->retain_until->toDateString().').',
            ]);
        }

        if (! $letter->retain_until && $letter->retention_policy !== 'custom') {
            throw ValidationException::withMessages([
                'retain_until' => 'Set a retain-until date before purging, or confirm retention has elapsed.',
            ]);
        }

        $letter->purged_at = now();
        $letter->purged_by = $user->id;
        $letter->save();
        $letter->delete();

        AuditLog::record('correspondence.purged', [
            'auditable_type' => Correspondence::class,
            'auditable_id' => $letter->id,
            'new_values' => ['purged_by' => $user->id],
            'tags' => 'correspondence',
        ]);

        return $letter;
    }

    private function assertTenant(Correspondence $letter, User $user): void
    {
        if ((int) $letter->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
    }

    private function assertCanManage(User $user): void
    {
        if (
            ! $user->isSystemAdmin()
            && ! $user->hasPermissionTo('correspondence.manage-retention')
            && ! $user->hasPermissionTo('correspondence.admin')
        ) {
            abort(403, 'Correspondence retention permission required.');
        }
    }
}
