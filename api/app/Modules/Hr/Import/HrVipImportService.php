<?php

namespace App\Modules\Hr\Import;

use App\Models\Asset;
use App\Models\HrVipImportBatch;
use App\Models\HrVipImportFile;
use App\Models\User;
use App\Modules\Finance\Import\Parsers\SageVipPayslipPdfParser;
use App\Modules\Finance\Import\Parsers\SageVipRemunerationListParser;
use App\Modules\Finance\Import\Parsers\SageVipTwelveMonthXlsParser;
use App\Modules\Hr\Import\Parsers\SageVipBirthdayListParser;
use App\Modules\Hr\Import\Parsers\SageVipEmployeeBasicParser;
use App\Modules\Hr\Import\Parsers\SageVipEmployeeReconParser;
use App\Modules\Hr\Import\Parsers\SageVipLeaveBasicParser;
use App\Modules\Hr\Import\Parsers\SageVipLeaveDetailParser;
use App\Modules\Hr\Import\Parsers\SageVipLeaveHistoryParser;
use App\Modules\Hr\Import\Parsers\SageVipLeaveProvisionParser;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class HrVipImportService
{
    public function __construct(
        private readonly HrVipImportCommitService $commitService,
        private readonly SageVipEmployeeBasicParser $employeeBasic = new SageVipEmployeeBasicParser,
        private readonly SageVipBirthdayListParser $birthdays = new SageVipBirthdayListParser,
        private readonly SageVipEmployeeReconParser $recon = new SageVipEmployeeReconParser,
        private readonly SageVipLeaveBasicParser $leaveBasic = new SageVipLeaveBasicParser,
        private readonly SageVipLeaveDetailParser $leaveDetail = new SageVipLeaveDetailParser,
        private readonly SageVipLeaveHistoryParser $leaveHistory = new SageVipLeaveHistoryParser,
        private readonly SageVipLeaveProvisionParser $leaveProvision = new SageVipLeaveProvisionParser,
        private readonly SageVipPayslipPdfParser $payslips = new SageVipPayslipPdfParser,
        private readonly SageVipRemunerationListParser $remuneration = new SageVipRemunerationListParser,
        private readonly SageVipTwelveMonthXlsParser $twelveMonth = new SageVipTwelveMonthXlsParser,
    ) {}

    public function createBatch(User $actor): HrVipImportBatch
    {
        return HrVipImportBatch::create([
            'tenant_id' => $actor->tenant_id,
            'created_by' => $actor->id,
            'batch_number' => 'HRVIP-'.now()->format('Ymd').'-'.Str::upper(Str::random(6)),
            'status' => HrVipImportBatch::STATUS_DRAFT,
            'asset_count_before' => Asset::query()->where('tenant_id', $actor->tenant_id)->count(),
        ]);
    }

    /**
     * @param  array<int, UploadedFile>  $files
     */
    public function ingest(HrVipImportBatch $batch, array $files, User $actor): HrVipImportBatch
    {
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        if ($batch->status === HrVipImportBatch::STATUS_COMMITTED) {
            throw ValidationException::withMessages(['batch' => 'Batch already committed.']);
        }

        $parsed = [
            'employees' => [],
            'birthdays' => [],
            'recon' => [],
            'leave_balances' => [],
            'leave_transactions' => [],
            'leave_history' => [],
            'leave_provision' => [],
            'payslips' => [],
            'remuneration' => [],
            'twelve_month' => [],
        ];

        // Roles that are legitimately reference attachments with no structured rows to parse —
        // everything else must actually yield rows, or the filename-based guess was wrong.
        $attachmentRoles = ['attachment', 'payslip_definition', 'twelve_month_pdf_attachment', 'payslip_xlsx_attachment'];

        DB::transaction(function () use ($batch, $files, &$parsed, $attachmentRoles): void {
            foreach ($files as $upload) {
                $role = $this->detectRole($upload->getClientOriginalName());
                $path = $upload->store('hr-vip-imports/'.$batch->id, 'local');
                $full = Storage::disk('local')->path($path);

                $rowsParsed = 0;
                if (! in_array($role, $attachmentRoles, true)) {
                    $before = $this->countParsedRows($parsed);
                    $this->parseInto($role, $full, $parsed);
                    $rowsParsed = $this->countParsedRows($parsed) - $before;
                }

                // The filename matched a known pattern but the content didn't parse into any
                // rows — do not silently trust the filename (instruction: "a filename ... is not
                // proof that ... values exist"). Flag for manual classification instead.
                $effectiveRole = (! in_array($role, $attachmentRoles, true) && $rowsParsed === 0)
                    ? 'needs_manual_classification'
                    : $role;

                HrVipImportFile::create([
                    'import_batch_id' => $batch->id,
                    'role' => $effectiveRole,
                    'original_filename' => $upload->getClientOriginalName(),
                    'storage_path' => $path,
                    'file_hash' => hash_file('sha256', $full) ?: null,
                    'mime' => $upload->getMimeType(),
                    'size_bytes' => $upload->getSize() ?: 0,
                ]);
            }
        });

        $employees = $this->mergeEmployees($parsed);
        $staged = [
            'employees' => $employees,
            'leave_balances' => $parsed['leave_balances'],
            'leave_transactions' => $parsed['leave_transactions'],
            'leave_history' => $parsed['leave_history'],
            'leave_provision' => $parsed['leave_provision'],
            'payslips' => $parsed['payslips'],
            'remuneration' => $parsed['remuneration'],
            'twelve_month' => $parsed['twelve_month'],
        ];

        $preview = $this->buildPreview($staged, $actor);

        $batch->update([
            'staged' => $staged,
            'preview' => $preview,
            'status' => HrVipImportBatch::STATUS_STAGED,
        ]);

        return $batch->fresh(['files']);
    }

    public function preview(HrVipImportBatch $batch, User $actor): array
    {
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        if (! is_array($batch->staged)) {
            throw ValidationException::withMessages(['batch' => 'Batch has not been staged.']);
        }

        return $this->buildPreview($batch->staged, $actor);
    }

    public function commit(HrVipImportBatch $batch, User $actor): HrVipImportBatch
    {
        abort_unless((int) $batch->tenant_id === (int) $actor->tenant_id, 404);
        $preview = $this->preview($batch, $actor);
        if (($preview['blocking_errors'] ?? []) !== []) {
            throw ValidationException::withMessages([
                'commit' => 'Preview has unmatched employee codes; fix sources before commit.',
                'errors' => $preview['blocking_errors'],
            ]);
        }

        $summary = $this->commitService->commit($batch, $actor, $batch->staged ?? []);
        $assetAfter = Asset::query()->where('tenant_id', $actor->tenant_id)->count();

        $batch->update([
            'status' => HrVipImportBatch::STATUS_COMMITTED,
            'commit_summary' => $summary,
            'asset_count_after' => $assetAfter,
            'committed_at' => now(),
        ]);

        return $batch->fresh(['files']);
    }

    /**
     * @param  array<string, mixed>  $parsed
     */
    private function countParsedRows(array $parsed): int
    {
        return array_sum(array_map('count', $parsed));
    }

    /**
     * @param  array<string, mixed>  $parsed
     */
    private function parseInto(string $role, string $path, array &$parsed): void
    {
        match ($role) {
            'employee_basic' => $parsed['employees'] = array_merge($parsed['employees'], $this->employeeBasic->parseFile($path)),
            'birthday_list' => $parsed['birthdays'] = $this->birthdays->parseFile($path),
            'employee_recon' => $parsed['recon'] = $this->recon->parseFile($path),
            'leave_basic' => $parsed['leave_balances'] = array_merge($parsed['leave_balances'], $this->leaveBasic->parseFile($path)),
            'leave_detail' => $parsed['leave_transactions'] = array_merge($parsed['leave_transactions'], $this->leaveDetail->parseFile($path)),
            'leave_history' => $parsed['leave_history'] = array_merge($parsed['leave_history'], $this->leaveHistory->parseFile($path)),
            'leave_provision' => $parsed['leave_provision'] = array_merge($parsed['leave_provision'], $this->leaveProvision->parseFile($path)),
            'payslip_pdf' => $parsed['payslips'] = array_merge($parsed['payslips'], $this->payslips->parseFile($path)),
            'remuneration_list' => $parsed['remuneration'] = array_merge($parsed['remuneration'], $this->remuneration->parseFile($path)),
            'twelve_month_xls' => $parsed['twelve_month'] = array_merge($parsed['twelve_month'], $this->twelveMonth->parseFile($path)),
            default => null,
        };
    }

    private function detectRole(string $filename): string
    {
        $lower = strtolower($filename);

        return match (true) {
            str_contains($lower, 'employeebasic') => 'employee_basic',
            str_contains($lower, 'birthday') => 'birthday_list',
            str_contains($lower, 'recon') => 'employee_recon',
            str_contains($lower, 'leavebasic') => 'leave_basic',
            str_contains($lower, 'leave_detail') || str_contains($lower, 'detail1') => 'leave_detail',
            str_contains($lower, 'leavehistory') => 'leave_history',
            str_contains($lower, 'leaveprovision') => 'leave_provision',
            str_contains($lower, 'payslip') && str_ends_with($lower, '.pdf') => 'payslip_pdf',
            str_contains($lower, 'remuneration') => 'remuneration_list',
            str_contains($lower, '12month') && str_ends_with($lower, '.xls') => 'twelve_month_xls',
            str_contains($lower, 'payslipdef') => 'payslip_definition',
            str_contains($lower, '12month') && str_ends_with($lower, '.pdf') => 'twelve_month_pdf_attachment',
            str_contains($lower, 'payslip') && str_ends_with($lower, '.xlsx') => 'payslip_xlsx_attachment',
            default => 'attachment',
        };
    }

    /**
     * @param  array<string, mixed>  $parsed
     * @return list<array<string, mixed>>
     */
    private function mergeEmployees(array $parsed): array
    {
        $byCode = [];
        foreach ($parsed['employees'] as $row) {
            $byCode[$row['employee_code']] = $row;
        }
        foreach ($parsed['birthdays'] as $code => $meta) {
            $byCode[$code] = array_merge($byCode[$code] ?? ['employee_code' => $code, 'display_name' => $meta['display_name'] ?? ''], $meta);
        }
        foreach ($parsed['recon'] as $code => $status) {
            $byCode[$code] = array_merge($byCode[$code] ?? ['employee_code' => $code], ['employment_status' => $status]);
        }

        return array_values($byCode);
    }

    /**
     * @param  array<string, mixed>  $staged
     * @return array<string, mixed>
     */
    private function buildPreview(array $staged, User $actor): array
    {
        $codes = collect($staged['employees'] ?? [])->pluck('employee_code')->filter()->unique()->values();
        $knownUsers = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->whereIn('employee_number', $codes)
            ->pluck('employee_number')
            ->all();
        $knownSet = array_fill_keys($knownUsers, true);

        $referenced = collect()
            ->merge(collect($staged['leave_balances'] ?? [])->pluck('employee_code'))
            ->merge(collect($staged['leave_transactions'] ?? [])->pluck('employee_code'))
            ->merge(collect($staged['leave_provision'] ?? [])->pluck('employee_code'))
            ->merge(collect($staged['payslips'] ?? [])->pluck('employee_code'))
            ->merge(collect($staged['remuneration'] ?? [])->pluck('employee_code'))
            ->filter()
            ->unique()
            ->values();

        // A code referenced only in leave/payroll data (a legacy employee absent from the
        // current master, e.g. SAD016) is NOT a blocking error — it becomes a reviewed legacy
        // profile on commit (instruction §5: "never discard their history"). Blocking here would
        // make the whole historical batch unimportable over one absent identity.
        $employeeCodes = $codes->all();
        $legacyOnly = [];
        foreach ($referenced as $code) {
            if (! in_array($code, $employeeCodes, true)) {
                $legacyOnly[] = ['employee_code' => $code, 'message' => 'Not in employee master — will be imported as a reviewed legacy profile.'];
            }
        }

        $willCreate = [];
        foreach ($codes as $code) {
            if (! isset($knownSet[$code])) {
                $willCreate[] = $code;
            }
        }

        return [
            'employee_count' => $codes->count(),
            'employees_to_create' => $willCreate,
            'legacy_profile_candidates' => $legacyOnly,
            'leave_transaction_count' => count($staged['leave_transactions'] ?? []),
            'leave_balance_rows' => count($staged['leave_balances'] ?? []),
            'payslip_count' => count($staged['payslips'] ?? []),
            'asset_count' => Asset::query()->where('tenant_id', $actor->tenant_id)->count(),
            'blocking_errors' => [],
            'ready' => $codes->count() > 0 || $referenced->count() > 0,
        ];
    }
}
