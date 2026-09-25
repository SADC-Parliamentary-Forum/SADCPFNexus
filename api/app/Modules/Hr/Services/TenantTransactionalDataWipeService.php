<?php

namespace App\Modules\Hr\Services;

use App\Models\Asset;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Deletes tenant transactional HR/operations data while preserving the fixed asset register
 * and catalogue. Never invokes AssetRegisterClearService.
 */
class TenantTransactionalDataWipeService
{
    /**
     * Child-first delete order for tenant-scoped operational tables (excludes asset register).
     *
     * @var list<string>
     */
    private const WIPE_TABLES = [
        'leave_segments',
        'leave_ledger_entries',
        'leave_lil_linkings',
        'leave_payroll_impacts',
        'toil_extensions',
        'toil_credits',
        'leave_requests',
        'leave_balances',
        'payslip_line_configs',
        'payslips',
        'payroll_import_lines',
        'payroll_import_batches',
        'payroll_export_lines',
        'payroll_export_batches',
        'employee_salary_assignments',
        'employee_schedule_assignments',
        'employee_work_schedules',
        'hr_file_timeline_events',
        'hr_file_documents',
        'hr_personal_files',
        'conduct_records',
        'performance_trackers',
        'appraisal_attachments',
        'appraisals',
        'timesheet_import_rows',
        'timesheet_import_batches',
        'timesheet_entries',
        'timesheets',
        'salary_advance_recoveries',
        'salary_advance_requests',
        'account_invitations',
        'password_histories',
        'user_sessions',
    ];

    /**
     * @param  (callable(string, int): void)|null  $onDeleted
     * @return array{asset_before: int, asset_after: int, users_deleted: int}
     */
    public function wipe(int $tenantId, ?callable $onDeleted = null): array
    {
        $assetBefore = Asset::query()->where('tenant_id', $tenantId)->count();

        DB::transaction(function () use ($tenantId, $onDeleted): void {
            $this->nullAssetCustodians($tenantId);

            foreach (self::WIPE_TABLES as $table) {
                if (! Schema::hasTable($table) || ! Schema::hasColumn($table, 'tenant_id')) {
                    continue;
                }
                $deleted = DB::table($table)->where('tenant_id', $tenantId)->delete();
                if ($deleted > 0 && $onDeleted) {
                    $onDeleted($table, $deleted);
                }
            }

            $this->deleteStaffUsers($tenantId, $onDeleted);
        });

        $assetAfter = Asset::query()->where('tenant_id', $tenantId)->count();

        return [
            'asset_before' => $assetBefore,
            'asset_after' => $assetAfter,
            'users_deleted' => 0,
        ];
    }

    private function nullAssetCustodians(int $tenantId): void
    {
        if (! Schema::hasTable('assets')) {
            return;
        }

        $updates = ['assigned_to' => null];
        if (Schema::hasColumn('assets', 'acknowledged_by')) {
            $updates['acknowledged_by'] = null;
        }
        DB::table('assets')->where('tenant_id', $tenantId)->update($updates);

        if (Schema::hasTable('asset_custodian_mappings') && Schema::hasColumn('asset_custodian_mappings', 'tenant_id')) {
            DB::table('asset_custodian_mappings')->where('tenant_id', $tenantId)->delete();
        }
    }

    private function deleteStaffUsers(int $tenantId, ?callable $onDeleted): void
    {
        $retainedIds = User::query()
            ->where('tenant_id', $tenantId)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin())
            ->pluck('id')
            ->all();

        $query = User::query()->where('tenant_id', $tenantId);
        if ($retainedIds !== []) {
            $query->whereNotIn('id', $retainedIds);
        }

        $toDelete = $query->pluck('id');
        if ($toDelete->isEmpty()) {
            return;
        }

        if (Schema::hasTable('model_has_roles')) {
            DB::table('model_has_roles')
                ->where('model_type', User::class)
                ->whereIn('model_id', $toDelete)
                ->delete();
        }
        if (Schema::hasTable('model_has_permissions')) {
            DB::table('model_has_permissions')
                ->where('model_type', User::class)
                ->whereIn('model_id', $toDelete)
                ->delete();
        }

        $deleted = User::query()->whereIn('id', $toDelete)->delete();
        if ($deleted > 0 && $onDeleted) {
            $onDeleted('users (staff)', $deleted);
        }
    }
}
