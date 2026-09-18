<?php

namespace App\Http\Controllers\Api\V1\Contracts;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ContractException;
use App\Modules\Contracts\Services\ContractReportService;
use App\Modules\Contracts\Services\ContractService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ContractReportController extends Controller
{
    public function __construct(
        private readonly ContractReportService $reports,
        private readonly ContractService $contracts,
        private readonly \App\Modules\Contracts\Services\ContractAnalyticsService $analytics,
    ) {}

    /** Management analytics for the contract portfolio (PRD §101). */
    public function analytics(Request $request): JsonResponse
    {
        $this->gate($request);

        return response()->json(['data' => $this->analytics->summary($request->user())]);
    }

    private function gate(Request $request): void
    {
        abort_unless(
            $request->user()->hasAnyPermission(['contract.report', 'contract.view_all', 'contract.audit_view'])
            || $request->user()->hasAnyRole(['Procurement Officer']),
            403
        );
    }

    /** Register / financial / compliance / operational reports (JSON|CSV|XLSX|PDF). */
    public function index(Request $request): JsonResponse|StreamedResponse|\Illuminate\Http\Response
    {
        $this->gate($request);

        $type = (string) $request->query('type', 'register');
        $format = (string) $request->query('format', 'json');
        $rows = $this->reports->dataset($type, $request->user(), $request->only(['status']));
        $filename = "contracts-{$type}-".now()->format('Ymd');

        return match ($format) {
            'csv' => $this->csv($rows->all(), $filename),
            'xlsx' => $this->xlsx($rows->all(), $filename),
            'pdf' => $this->pdf($rows->all(), $type, $filename),
            default => response()->json(['data' => $rows, 'type' => $type, 'count' => $rows->count()]),
        };
    }

    /** Central exception register (PRD §99). */
    public function exceptions(Request $request): JsonResponse
    {
        $this->gate($request);

        $query = ContractException::where('tenant_id', $request->user()->tenant_id)
            ->with('contract:id,reference_number,title')
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }
        if ($request->filled('severity')) {
            $query->where('severity', $request->query('severity'));
        }

        return response()->json(['data' => $query->limit(500)->get()]);
    }

    /** Append-only audit trail for a single contract. */
    public function audit(Request $request, Contract $contract): JsonResponse
    {
        $this->gate($request);
        $this->contracts->find($contract->id, $request->user()); // tenant + scope guard

        $events = AuditLog::where('tenant_id', $request->user()->tenant_id)
            ->where('auditable_type', Contract::class)
            ->where('auditable_id', $contract->id)
            ->orderByDesc('created_at')
            ->limit(500)
            ->get(['id', 'event', 'user_id', 'old_values', 'new_values', 'created_at']);

        return response()->json(['data' => $events]);
    }

    // ── Renderers ────────────────────────────────────────────────────────────

    private function csv(array $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows): void {
            $out = fopen('php://output', 'w');
            if ($rows !== []) {
                fputcsv($out, array_keys($rows[0]));
                foreach ($rows as $row) {
                    fputcsv($out, array_map(fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v), $row));
                }
            }
            fclose($out);
        }, "{$filename}.csv", ['Content-Type' => 'text/csv']);
    }

    private function xlsx(array $rows, string $filename): StreamedResponse
    {
        return response()->streamDownload(function () use ($rows): void {
            $writer = new Writer;
            $writer->openToFile('php://output');
            if ($rows !== []) {
                $writer->addRow(Row::fromValues(array_keys($rows[0])));
                foreach ($rows as $row) {
                    $writer->addRow(Row::fromValues(array_map(fn ($v) => is_scalar($v) || $v === null ? $v : json_encode($v), array_values($row))));
                }
            }
            $writer->close();
        }, "{$filename}.xlsx", ['Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']);
    }

    private function pdf(array $rows, string $type, string $filename): \Illuminate\Http\Response
    {
        $headers = $rows !== [] ? array_keys($rows[0]) : [];
        $html = '<h2>Contract '.ucfirst($type).' Report</h2><p>Generated '.now()->toDayDateTimeString().'</p><table border="1" cellspacing="0" cellpadding="4" style="width:100%;font-size:10px;border-collapse:collapse"><thead><tr>';
        foreach ($headers as $h) {
            $html .= '<th>'.e(str_replace('_', ' ', $h)).'</th>';
        }
        $html .= '</tr></thead><tbody>';
        foreach ($rows as $row) {
            $html .= '<tr>';
            foreach ($row as $v) {
                $html .= '<td>'.e(is_scalar($v) || $v === null ? (string) $v : json_encode($v)).'</td>';
            }
            $html .= '</tr>';
        }
        $html .= '</tbody></table>';

        return Pdf::loadHTML($html)->setPaper('a4', 'landscape')->download("{$filename}.pdf");
    }
}
