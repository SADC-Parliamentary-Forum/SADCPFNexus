<?php

namespace App\Jobs;

use App\Http\Controllers\Api\V1\ReportsController;
use App\Models\User;
use App\Modules\Reports\Services\ReportManagementService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Barryvdh\DomPDF\Facade\Pdf;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;
use Throwable;

class GenerateScheduledReportJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;

    public function __construct(public readonly int $exportEventId) {}

    public function handle(ReportManagementService $reports): void
    {
        $event = DB::table('report_export_events')->where('id', $this->exportEventId)->first();
        if (! $event || $event->status !== 'queued') {
            return;
        }

        DB::table('report_export_events')->where('id', $event->id)->update([
            'status' => 'processing',
            'updated_at' => now(),
        ]);

        $owner = User::find($event->requested_by);
        if (! $owner || ! $owner->can('reports.export')) {
            $this->failEvent('The schedule owner no longer has report export permission.');
            return;
        }

        try {
            $filters = is_string($event->filters) ? (json_decode($event->filters, true) ?: []) : ($event->filters ?? []);
            $request = Request::create('/api/v1/reports/' . $event->report_key, 'GET', array_merge($filters, ['format' => 'csv', 'per_page' => 1000]));
            $request->setUserResolver(fn () => $owner);
            $request->attributes->set('scheduled_export_event_id', $event->id);

            $method = match ($event->report_key) {
                'travel' => 'travel',
                'leave' => 'leave',
                'dsa' => 'dsa',
                'assets' => 'assets',
                'stock' => 'stock',
                'imprest' => 'imprest',
                'procurement' => 'procurement',
                'salary-advances' => 'salaryAdvances',
                'hr-timesheets' => 'hrTimesheets',
                'risk' => 'risk',
                'governance' => 'governance',
                default => null,
            };
            abort_if(! $method, 422, 'The scheduled report type is not supported.');

            $previousRequest = app()->bound('request') ? app('request') : null;
            app()->instance('request', $request);
            try {
                $response = app(ReportsController::class)->{$method}($request);
                abort_unless($response instanceof StreamedResponse, 422, 'The scheduled report did not return tabular data.');

                ob_start();
                $response->sendContent();
                $contents = (string) ob_get_clean();
            } finally {
                if ($previousRequest) {
                    app()->instance('request', $previousRequest);
                }
            }
            $rows = $this->parseCsv($contents);
            [$path, $payload] = $this->render($event, $owner, $rows, $contents);
            Storage::disk('local')->put($path, $payload);
            $reports->completeExport($owner->tenant_id, $event->id, max(count($rows) - 1, 0), hash('sha256', $payload), $path);
        } catch (Throwable $exception) {
            $this->failEvent($exception->getMessage());
            throw $exception;
        }
    }

    private function failEvent(string $message): void
    {
        DB::table('report_export_events')->where('id', $this->exportEventId)->update([
            'status' => 'failed',
            'reason' => mb_substr($message, 0, 255),
            'updated_at' => now(),
        ]);
    }

    /** @return list<list<string>> */
    private function parseCsv(string $contents): array
    {
        $rows = [];
        $handle = fopen('php://memory', 'r+');
        fwrite($handle, $contents);
        rewind($handle);
        while (($row = fgetcsv($handle)) !== false) {
            if ($row === [null]) {
                continue;
            }
            $rows[] = array_map(static fn ($value) => (string) ($value ?? ''), $row);
        }
        fclose($handle);

        return $rows;
    }

    /** @param list<list<string>> $rows @return array{0:string,1:string} */
    private function render(object $event, User $owner, array $rows, string $csv): array
    {
        $base = 'scheduled-reports/' . $owner->tenant_id . '/' . $event->reference;

        return match (strtolower((string) $event->format)) {
            'pdf' => [$base . '.pdf', Pdf::loadView('reports.scheduled', [
                'title' => $event->report_key,
                'reference' => $event->reference,
                'rows' => $rows,
                'generatedAt' => now()->utc()->toIso8601String(),
            ])->output()],
            'xlsx' => [$base . '.xlsx', $this->xlsx($rows)],
            default => [$base . '.csv', $csv],
        };
    }

    /** @param list<list<string>> $rows */
    private function xlsx(array $rows): string
    {
        $path = tempnam(sys_get_temp_dir(), 'nexus-report-');
        abort_unless($path !== false, 500, 'Unable to create a temporary report file.');
        $writer = new Writer();
        $writer->openToFile($path);
        foreach ($rows as $row) {
            $writer->addRow(Row::fromValues($row));
        }
        $writer->close();
        $contents = (string) file_get_contents($path);
        @unlink($path);

        return $contents;
    }
}
