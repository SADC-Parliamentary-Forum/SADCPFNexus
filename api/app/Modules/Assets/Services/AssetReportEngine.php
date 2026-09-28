<?php

namespace App\Modules\Assets\Services;

use App\Models\AuditLog;
use App\Models\User;
use App\Modules\Assets\Export\AssetReportWorkbook;
use App\Modules\Assets\Reporting\AssetReportCatalogue;
use App\Modules\Assets\Reporting\SpreadsheetSafety;
use App\Modules\Reports\Services\ReportManagementService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class AssetReportEngine
{
    public const READY = AssetReportCatalogue::READY;

    public function __construct(
        private readonly AssetAssignedToUserReportService $assigned,
        private readonly AssetCustodyReportService $custody,
        private readonly AssetInventoryReportService $inventory,
        private readonly AssetFinanceReportService $finance,
        private readonly AssetVerificationReportService $verification,
        private readonly AssetLifecycleReportService $lifecycle,
    ) {}

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    public function run(User $actor, string $reportId, array $params = []): array
    {
        $meta = AssetReportCatalogue::find($reportId);
        abort_unless($meta, 404, 'Unknown report.');
        abort_unless(
            in_array($reportId, self::READY, true),
            422,
            $meta['blocked_reason'] ?? 'This report is catalogued but not yet implemented.',
        );

        $payload = match ($reportId) {
            'R01', 'R02' => $this->assignedPayload($actor, $reportId, $params),
            'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10' => $this->custody->build($actor, $reportId, $params),
            'R11', 'R12', 'R13', 'R14', 'R15', 'R16', 'R17', 'R18', 'R19', 'R20' => $this->inventory->build($actor, $reportId, $params),
            'R21', 'R22', 'R23', 'R24', 'R25', 'R26', 'R27', 'R28', 'R29' => $this->finance->build($actor, $reportId, $params),
            'R31', 'R32', 'R33', 'R34', 'R35', 'R36', 'R37', 'R38' => $this->verification->build($actor, $reportId, $params),
            'R39', 'R40', 'R41', 'R42', 'R43', 'R44', 'R45', 'R46', 'R47', 'R48', 'R49', 'R50', 'R51', 'R52' => $this->lifecycle->build($actor, $reportId, $params),
            default => abort(404, 'Unknown report.'),
        };

        $runId = 'FAR-'.$reportId.'-'.now()->format('Ymd').'-'.Str::upper(Str::random(6));
        $asOf = $params['as_of'] ?? now()->toIso8601String();
        $payload['run'] = [
            'report_id' => $reportId,
            'report_run_id' => $runId,
            'template_version' => AssetReportCatalogue::TEMPLATE_VERSION,
            'parameters' => array_filter([
                'user_id' => $params['user_id'] ?? $this->resolveStaffId($actor, $params),
                'staff_number' => $params['staff_number'] ?? $params['employee_number'] ?? null,
                'asset_id' => $params['asset_id'] ?? null,
                'mode' => $params['mode'] ?? ($reportId === 'R02' ? 'current' : null),
                'as_of' => $asOf,
                'department' => $params['department'] ?? null,
                'from' => $params['from'] ?? null,
                'to' => $params['to'] ?? null,
                'campaign_id' => $params['campaign_id'] ?? null,
            ], fn ($value) => $value !== null && $value !== ''),
            'data_as_of' => $asOf,
            'generated_at' => now()->toIso8601String(),
            'generated_by' => [
                'id' => $actor->id,
                'name' => $actor->name,
                'email' => $actor->email,
            ],
            'official' => false,
            'checksum' => null,
        ];
        $payload['title'] ??= $meta['name'];
        $payload['ready'] = true;

        AuditLog::record('assets.report.viewed', [
            'tenant_id' => $actor->tenant_id,
            'user_id' => $actor->id,
            'auditable_type' => User::class,
            'auditable_id' => $actor->id,
            'new_values' => [
                'report_id' => $reportId,
                'report_run_id' => $runId,
                'parameters' => $payload['run']['parameters'],
            ],
        ]);

        return $payload;
    }

    /**
     * @param  array<string, mixed>  $params
     */
    public function export(User $actor, string $reportId, array $params, string $format, bool $official = false): StreamedResponse
    {
        abort_unless(in_array($format, ['pdf', 'xlsx', 'csv'], true), 422, 'Unsupported export format.');
        $payload = $this->run($actor, $reportId, $params);
        $payload['run']['official'] = $official;
        $payload['columns'] ??= $this->defaultColumns($payload);
        $checksum = hash('sha256', json_encode([
            $payload['run']['report_run_id'],
            $payload['run']['parameters'],
            $payload['data'],
            $payload['totals'],
        ], JSON_THROW_ON_ERROR));
        $payload['run']['checksum'] = $checksum;

        $event = $official ? 'assets.report.exported' : 'assets.report.exported';
        if ($format === 'pdf' && ($params['intent'] ?? null) === 'print') {
            $event = 'assets.report.printed';
        }
        AuditLog::record($event, [
            'tenant_id' => $actor->tenant_id,
            'user_id' => $actor->id,
            'auditable_type' => User::class,
            'auditable_id' => $actor->id,
            'new_values' => [
                'report_id' => $reportId,
                'report_run_id' => $payload['run']['report_run_id'],
                'format' => $format,
                'official' => $official,
                'checksum' => $checksum,
            ],
        ]);

        $filename = SpreadsheetSafety::filename(
            $payload['title'] ?? $reportId,
            (string) ($payload['scope']['staff_number'] ?? $payload['scope']['department'] ?? $payload['run']['parameters']['mode'] ?? 'organisation'),
            $payload['run']['report_run_id'],
            $format,
        );

        $binary = $this->render($payload, $format);
        if ($official) {
            $this->persistOfficial($actor, $payload, $format, $filename, $binary, $checksum);
        }

        return response()->streamDownload(function () use ($binary) {
            echo $binary;
        }, $filename, [
            'Content-Type' => match ($format) {
                'pdf' => 'application/pdf',
                'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                default => 'text/csv; charset=UTF-8',
            },
            'X-Report-Id' => $reportId,
            'X-Report-Run-Id' => $payload['run']['report_run_id'],
            'X-Report-Checksum' => $checksum,
        ]);
    }

    /**
     * Staff identity is user id or employee/staff number within the actor tenant.
     *
     * @param  array<string, mixed>  $params
     */
    public function resolveStaffId(User $actor, array $params): ?int
    {
        if (! empty($params['user_id'])) {
            $match = User::query()
                ->where('tenant_id', $actor->tenant_id)
                ->whereKey((int) $params['user_id'])
                ->value('id');

            return $match ? (int) $match : null;
        }

        $number = trim((string) ($params['staff_number'] ?? $params['employee_number'] ?? ''));
        if ($number === '') {
            return null;
        }

        $match = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->where('employee_number', $number)
            ->value('id');

        return $match ? (int) $match : null;
    }

    /**
     * @param  array<string, mixed>  $params
     * @return array<string, mixed>
     */
    private function assignedPayload(User $actor, string $reportId, array $params): array
    {
        $staffId = $this->resolveStaffId($actor, $params);
        abort_unless($staffId !== null, 422, 'Staff member is required.');
        $mode = $reportId === 'R02' ? 'current' : ($params['mode'] ?? 'current');
        $result = $this->assigned->run($actor, $staffId, $mode, $params['as_of'] ?? null);
        $showFinance = isset($result['data'][0]['book_value']) || isset($result['data'][0]['purchase_value']);
        $exceptions = [];
        foreach ($result['data'] as $row) {
            if (($row['acknowledgement_status'] ?? '') === 'pending') {
                $exceptions[] = $row + ['reason' => 'pending_acknowledgement'];
            }
            if (! empty($row['overdue'])) {
                $exceptions[] = $row + ['reason' => 'overdue_loan'];
            }
            if (in_array($row['asset_status'] ?? '', ['missing', 'stolen', 'damaged'], true)) {
                $exceptions[] = $row + ['reason' => $row['asset_status']];
            }
        }

        return [
            'title' => $reportId === 'R02' ? 'User asset statement' : 'Assets assigned to a specific user',
            'scope' => [
                'custodian' => $result['custodian']['name'] ?? null,
                'staff_number' => $result['custodian']['employee_number'] ?? null,
                'department' => $result['custodian']['department'] ?? null,
            ],
            'custodian' => $result['custodian'],
            'columns' => $this->assignedColumns($showFinance),
            'data' => $result['data'],
            'totals' => $result['totals'],
            'exceptions' => $exceptions,
            'declaration' => $reportId === 'R02'
                ? 'I confirm that I have received and remain accountable for the assets listed, except any exceptions recorded above.'
                : null,
        ];
    }

    /**
     * @return list<array{key:string,label:string,type:string}>
     */
    private function assignedColumns(bool $showFinance): array
    {
        $columns = [
            ['key' => 'asset_tag', 'label' => 'Tag', 'type' => 'text'],
            ['key' => 'description', 'label' => 'Description', 'type' => 'text'],
            ['key' => 'class', 'label' => 'Class', 'type' => 'text'],
            ['key' => 'serial_number', 'label' => 'Serial', 'type' => 'text'],
            ['key' => 'assignment_type', 'label' => 'Assignment type', 'type' => 'text'],
            ['key' => 'issue_date', 'label' => 'Issue date', 'type' => 'date'],
            ['key' => 'expected_return', 'label' => 'Expected return', 'type' => 'date'],
            ['key' => 'location', 'label' => 'Location', 'type' => 'text'],
            ['key' => 'condition', 'label' => 'Condition', 'type' => 'text'],
            ['key' => 'acknowledgement_status', 'label' => 'Acknowledgement', 'type' => 'text'],
            ['key' => 'asset_status', 'label' => 'Status', 'type' => 'text'],
        ];
        if ($showFinance) {
            $columns[] = ['key' => 'book_value', 'label' => 'Net book value', 'type' => 'number'];
        }

        return $columns;
    }

    /**
     * @param  array<string, mixed>  $payload
     * @return list<array{key:string,label:string,type:string}>
     */
    private function defaultColumns(array $payload): array
    {
        $first = $payload['data'][0] ?? [];

        return array_map(fn (string $key) => [
            'key' => $key,
            'label' => $key,
            'type' => is_numeric($first[$key] ?? null) ? 'number' : 'text',
        ], array_keys($first));
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function render(array $payload, string $format): string
    {
        if ($format === 'pdf') {
            $orientation = ($payload['run']['report_id'] ?? '') === 'R02' ? 'portrait' : 'landscape';

            return Pdf::loadView('pdf.asset_report', [
                'title' => $payload['title'],
                'run' => $payload['run'],
                'scope' => $payload['scope'] ?? [],
                'columns' => $payload['columns'],
                'data' => $payload['data'],
                'totals' => $payload['totals'] ?? [],
                'exceptions' => $payload['exceptions'] ?? [],
                'declaration' => $payload['declaration'] ?? null,
            ])->setPaper('a4', $orientation)->output();
        }

        if ($format === 'xlsx') {
            $tmp = tempnam(sys_get_temp_dir(), 'farxlsx');
            (new AssetReportWorkbook($payload))->write($tmp);
            $binary = (string) file_get_contents($tmp);
            @unlink($tmp);

            return $binary;
        }

        $out = fopen('php://temp', 'r+');
        fwrite($out, "\xEF\xBB\xBF");
        fputcsv($out, array_map(fn (array $col) => $col['label'], $payload['columns']));
        foreach ($payload['data'] as $row) {
            fputcsv($out, array_map(
                fn (array $col) => SpreadsheetSafety::formulaSafe(isset($row[$col['key']]) ? (string) $row[$col['key']] : ''),
                $payload['columns'],
            ));
        }
        rewind($out);
        $csv = stream_get_contents($out) ?: '';
        fclose($out);

        return $csv;
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function persistOfficial(User $actor, array $payload, string $format, string $filename, string $binary, string $checksum): void
    {
        $path = 'official-reports/'.$actor->tenant_id.'/'.$payload['run']['report_run_id'].'.'.$format;
        Storage::disk('local')->put($path, $binary);

        $reports = app(ReportManagementService::class);
        $id = $reports->recordExport(
            (int) $actor->tenant_id,
            'far.'.$payload['run']['report_id'],
            $format,
            $payload['run']['parameters'],
            $actor,
            count($payload['data'] ?? []),
        );
        if ($id) {
            $reports->completeExport((int) $actor->tenant_id, $id, count($payload['data'] ?? []), $checksum, $path);
        }
    }
}
