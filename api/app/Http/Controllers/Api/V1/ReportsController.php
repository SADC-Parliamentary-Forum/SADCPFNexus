<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\Department;
use App\Models\GovernanceResolution;
use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\Risk;
use App\Models\SalaryAdvanceRequest;
use App\Models\Timesheet;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use App\Modules\Reports\Services\ReportManagementService;
use Barryvdh\DomPDF\Facade\Pdf;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use OpenSpout\Common\Entity\Row;
use OpenSpout\Writer\XLSX\Writer;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    /**
     * Stream a CSV download response from a flat array of rows.
     *
     * @param  array<array<string,mixed>>  $rows
     */
    private function csvResponse(array $rows, string $filename): Response|StreamedResponse
    {
        $headers = ! empty($rows) ? array_keys($rows[0]) : [];

        $format = strtolower((string) request()->input('format', 'csv'));
        if ($format === 'pdf') {
            $payload = Pdf::loadView('reports.scheduled', [
                'title' => pathinfo($filename, PATHINFO_FILENAME),
                'reference' => request()->attributes->get('report_export_event_id', 'interactive'),
                'rows' => array_merge([$headers], array_map(static fn (array $row) => array_values($row), $rows)),
                'generatedAt' => now()->utc()->toIso8601String(),
            ])->output();
            $this->completeInteractiveExport($payload, count($rows));

            return response($payload, 200, [
                'Content-Type' => 'application/pdf',
                'Content-Disposition' => 'attachment; filename="'.pathinfo($filename, PATHINFO_FILENAME).'.pdf"',
            ]);
        }

        if ($format === 'xlsx') {
            $path = tempnam(sys_get_temp_dir(), 'nexus-report-');
            abort_unless($path !== false, 500, 'Unable to create a temporary report file.');
            $writer = new Writer;
            $writer->openToFile($path);
            if ($headers) {
                $writer->addRow(Row::fromValues($headers));
            }
            foreach ($rows as $row) {
                $writer->addRow(Row::fromValues(array_map(static fn ($value) => is_scalar($value) || $value === null ? (string) ($value ?? '') : json_encode($value), array_values($row))));
            }
            $writer->close();
            $this->completeInteractiveExport((string) file_get_contents($path), count($rows));

            return response()->download($path, pathinfo($filename, PATHINFO_FILENAME).'.xlsx', [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ])->deleteFileAfterSend(true);
        }

        $this->completeInteractiveExport(json_encode($rows, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), count($rows));

        return response()->streamDownload(function () use ($rows, $headers) {
            $out = fopen('php://output', 'w');
            if ($headers) {
                fputcsv($out, $headers);
            }
            foreach ($rows as $row) {
                fputcsv($out, array_values($row));
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="'.$filename.'"',
        ]);
    }

    private function completeInteractiveExport(string $payload, int $rows): void
    {
        $exportId = request()->attributes->get('report_export_event_id');
        if (is_numeric($exportId)) {
            app(ReportManagementService::class)->completeExport(
                (int) request()->user()->tenant_id,
                (int) $exportId,
                $rows,
                hash('sha256', $payload),
            );
        }
    }

    /**
     * Gate generated exports behind the reports.export permission.
     * Returns a 403 JSON response if denied, null if allowed.
     */
    private function gateExport(Request $request): ?JsonResponse
    {
        $format = strtolower((string) $request->input('format', ''));
        if (in_array($format, ['csv', 'pdf', 'xlsx'], true)
            && ! app(PolicyDecisionPoint::class)->can($request->user(), 'reports.export')) {
            return response()->json(['message' => 'You do not have permission to export reports.'], 403);
        }
        if (in_array($format, ['csv', 'pdf', 'xlsx'], true) && ! $request->attributes->has('scheduled_export_event_id')) {
            $exportId = app(ReportManagementService::class)->recordExport(
                (int) $request->user()->tenant_id,
                basename($request->path()),
                $format,
                $request->except(['password', 'token', 'secret']),
                $request->user(),
            );
            if ($exportId) {
                $request->attributes->set('report_export_event_id', $exportId);
            }
        }

        return null;
    }

    private function wantsExport(Request $request): bool
    {
        return in_array(strtolower((string) $request->input('format', '')), ['csv', 'pdf', 'xlsx'], true);
    }

    /**
     * Apply common filters to a query: period, status, and user scoping.
     *
     * @param  string  $userColumn  The FK column that links to users (e.g. 'requester_id', 'user_id').
     * @param  string  $dateColumn  The date column to filter on (defaults to 'created_at').
     */
    private function applyCommonFilters(
        Builder $query,
        Request $request,
        string $userColumn = 'requester_id',
        string $dateColumn = 'created_at'
    ): Builder {
        $user = $request->user();

        // Period filters
        if ($from = $request->input('period_from')) {
            $query->whereDate($dateColumn, '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate($dateColumn, '<=', $to);
        }

        // Status filter
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        // User / staff scoping:
        // - Users without reports.export see only their own data.
        // - Managers/admins with reports.export can filter by any user_id.
        if (! app(PolicyDecisionPoint::class)->can($user, 'reports.export')) {
            $query->where($userColumn, $user->id);
        } elseif ($userId = $request->input('user_id')) {
            $query->where($userColumn, (int) $userId);
        }

        // Department filter (join through the user FK)
        if ($deptId = $request->input('department_id')) {
            $query->whereHas('requester', fn ($q) => $q->where('department_id', (int) $deptId));
        }

        return $query;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Hub summary
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Summary counts for reports hub (travel, leave, etc.).
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;
        $organisationScope = app(PolicyDecisionPoint::class)->can($user, 'reports.export');

        $travelCount = TravelRequest::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where('requester_id', $user->id))->count();
        $leaveCount = LeaveRequest::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where('requester_id', $user->id))->count();
        $assetCount = Asset::where('tenant_id', $tenantId)->count();
        $imprestCount = ImprestRequest::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where('requester_id', $user->id))->count();
        $procCount = ProcurementRequest::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where('requester_id', $user->id))->count();
        $salaryCount = SalaryAdvanceRequest::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where('requester_id', $user->id))->count();
        $timesheetCount = Timesheet::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where('user_id', $user->id))->count();
        $riskCount = Risk::where('tenant_id', $tenantId)->when(! $organisationScope, fn ($q) => $q->where(function ($nested) use ($user) {
            $nested->where('risk_owner_id', $user->id)->orWhere('submitted_by', $user->id);
        }))->count();
        $govCount = GovernanceResolution::where('tenant_id', $tenantId)->count();

        return response()->json([
            'travel_requests_count' => $travelCount,
            'leave_requests_count' => $leaveCount,
            'asset_count' => $assetCount,
            'imprest_count' => $imprestCount,
            'procurement_count' => $procCount,
            'risk_count' => $riskCount,
            'governance_count' => $govCount,
            'report_types' => [
                ['id' => 'travel',          'label' => 'Travel',           'count' => $travelCount],
                ['id' => 'leave',           'label' => 'Leave',            'count' => $leaveCount],
                ['id' => 'dsa',             'label' => 'DSA',              'count' => $travelCount],
                ['id' => 'imprest',         'label' => 'Imprest',          'count' => $imprestCount],
                ['id' => 'procurement',     'label' => 'Procurement',      'count' => $procCount],
                ['id' => 'salary-advances', 'label' => 'Salary Advances',  'count' => $salaryCount],
                ['id' => 'hr-timesheets',   'label' => 'HR Timesheets',    'count' => $timesheetCount],
                ['id' => 'risk',            'label' => 'Risk Register',    'count' => $riskCount],
                ['id' => 'governance',      'label' => 'Governance',       'count' => $govCount],
                ['id' => 'financial',       'label' => 'Financial',        'count' => $salaryCount + $procCount + $imprestCount],
                ['id' => 'assets',          'label' => 'Assets',           'count' => $assetCount],
            ],
        ]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Filter helper data endpoints
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Return users list for the staff filter dropdown (scoped to tenant).
     */
    public function reportUsers(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $users = User::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'department_id'])
            ->map(fn ($u) => [
                'id' => $u->id,
                'name' => $u->name,
                'email' => $u->email,
                'department_id' => $u->department_id,
            ]);

        return response()->json(['data' => $users]);
    }

    /**
     * Return departments list for the department filter dropdown.
     */
    public function reportDepartments(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        $departments = Department::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name', 'code']);

        return response()->json(['data' => $departments]);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Travel
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Travel requests report. Filters: period_from, period_to, user_id, department_id, status, per_page, format=csv.
     */
    public function travel(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($t) => [
                'reference' => $t->reference_number,
                'employee' => $t->requester?->name,
                'status' => $t->status,
                'destination' => trim($t->destination_city.', '.$t->destination_country, ', '),
                'purpose' => $t->purpose,
                'departure' => $t->departure_date?->toDateString(),
                'return' => $t->return_date?->toDateString(),
                'currency' => $t->currency ?? 'NAD',
                'dsa_amount' => $t->estimated_dsa,
                'created_at' => $t->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'travel-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // DSA
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * DSA / travel allowances report. Filters: period_from, period_to, user_id, department_id, status, per_page, format=csv.
     */
    public function dsa(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($t) => [
                'reference' => $t->reference_number,
                'employee' => $t->requester?->name,
                'destination' => trim($t->destination_city.', '.$t->destination_country, ', '),
                'country' => $t->destination_country,
                'departure' => $t->departure_date?->toDateString(),
                'return' => $t->return_date?->toDateString(),
                'days' => $t->departure_date && $t->return_date ? $t->departure_date->diffInDays($t->return_date) + 1 : null,
                'dsa_amount' => $t->estimated_dsa,
                'currency' => $t->currency ?? 'NAD',
                'status' => $t->status,
                'created_at' => $t->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'dsa-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Leave
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Leave requests report. Filters: period_from, period_to, user_id, department_id, status, per_page, format=csv.
     */
    public function leave(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = LeaveRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($l) => [
                'reference' => $l->reference_number,
                'employee' => $l->requester?->name,
                'leave_type' => $l->leave_type,
                'status' => $l->status,
                'start_date' => $l->start_date,
                'end_date' => $l->end_date,
                'days' => $l->days_requested,
                'created_at' => $l->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'leave-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Assets
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Asset register report. Filters: category, period_from, period_to, department_id, per_page, format=csv.
     */
    public function assets(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = Asset::where('tenant_id', $user->tenant_id)->orderBy('name');

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }
        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($a) => [
                'asset_tag' => $a->asset_tag,
                'name' => $a->name,
                'category' => $a->category,
                'status' => $a->status,
                'condition' => $a->condition,
                'purchase_value' => $a->purchase_value,
                'current_value' => $a->current_value,
                'location' => $a->location,
                'assigned_to' => $a->assignedUser?->name,
                'created_at' => $a->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'assets-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 100), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Stock / Consumables Register (PRD §24)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Consumables / stock report. Filters: category_id, status, low_stock, format=csv.
     * Kept separate from the asset register.
     */
    public function stock(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = \App\Models\StockItem::where('tenant_id', $user->tenant_id)
            ->with(['category:id,name,code', 'vendor:id,name'])
            ->orderBy('name');

        if ($categoryId = $request->input('category_id')) {
            $query->where('stock_category_id', $categoryId);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($request->boolean('low_stock')) {
            $query->lowStock();
        }

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($i) => [
                'item_code' => $i->item_code,
                'name' => $i->name,
                'category' => $i->category?->name,
                'unit' => $i->unit,
                'current_balance' => $i->current_balance,
                'reorder_level' => $i->reorder_level,
                'low_stock' => $i->is_low_stock ? 'YES' : 'no',
                'unit_cost' => $i->unit_cost,
                'stock_value' => $i->stock_value,
                'storage_location' => $i->storage_location,
                'supplier' => $i->vendor?->name,
                'status' => $i->status,
            ])->toArray();

            return $this->csvResponse($rows, 'stock-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 100), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Imprest
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Imprest requests report. Filters: period_from, period_to, user_id, department_id, status, per_page, format=csv.
     */
    public function imprest(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = ImprestRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($i) => [
                'reference' => $i->reference_number,
                'employee' => $i->requester?->name,
                'purpose' => $i->purpose,
                'budget_line' => $i->budget_line,
                'amount_requested' => $i->amount_requested,
                'amount_approved' => $i->amount_approved,
                'amount_liquidated' => $i->amount_liquidated,
                'currency' => $i->currency ?? 'NAD',
                'status' => $i->status,
                'expected_liquidation_date' => $i->expected_liquidation_date?->toDateString(),
                'created_at' => $i->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'imprest-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Procurement
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Procurement requests report. Filters: period_from, period_to, user_id, department_id, status, per_page, format=csv.
     */
    public function procurement(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = ProcurementRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($p) => [
                'reference' => $p->reference_number,
                'employee' => $p->requester?->name,
                'title' => $p->title,
                'category' => $p->category,
                'procurement_method' => $p->procurement_method,
                'estimated_value' => $p->estimated_value,
                'currency' => $p->currency ?? 'NAD',
                'status' => $p->status,
                'required_by_date' => $p->required_by_date?->toDateString(),
                'created_at' => $p->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'procurement-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Salary Advances
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Salary advance requests report. Filters: period_from, period_to, user_id, department_id, status, per_page, format=csv.
     */
    public function salaryAdvances(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = SalaryAdvanceRequest::where('tenant_id', $user->tenant_id)
            ->with(['requester:id,name,department_id', 'balanceRegister'])
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($pack = $request->input('pack')) {
            match ($pack) {
                'outstanding' => $query->whereHas('balanceRegister', fn ($q) => $q
                    ->where('module_type', 'salary_advance')
                    ->where('status', '!=', 'closed')
                    ->where('balance', '>', 0)),
                'recovery' => $query->whereIn('status', ['paid', 'recovery_scheduled', 'reconciliation_required', 'recovered', 'closed']),
                'register' => null,
                default => null,
            };
        }

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($s) => [
                'reference' => $s->reference_number,
                'employee' => $s->requester?->name,
                'advance_type' => $s->advance_type,
                'amount' => $s->amount,
                'approved_amount' => $s->approved_amount,
                'currency' => $s->currency ?? 'NAD',
                'repayment_months' => $s->repayment_months,
                'purpose' => $s->purpose,
                'status' => $s->status,
                'payment_status' => $s->payment_status,
                'recovery_status' => $s->recovery_status,
                'outstanding' => $s->balanceRegister?->balance,
                'paid_at' => $s->paid_at?->toDateString(),
                'closed_at' => $s->closed_at?->toDateString(),
                'created_at' => $s->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'salary-advances-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // HR Timesheets
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * HR timesheets report. Filters: period_from, period_to (on week_start), user_id, department_id, status, per_page, format=csv.
     */
    public function hrTimesheets(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = Timesheet::where('tenant_id', $user->tenant_id)
            ->with('user:id,name,department_id')
            ->orderByDesc('week_start');

        // Timesheets use user_id, not requester_id; date column is week_start
        // Apply period on week_start
        if ($from = $request->input('period_from')) {
            $query->whereDate('week_start', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('week_start', '<=', $to);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }

        if (! app(PolicyDecisionPoint::class)->can($user, 'reports.export')) {
            $query->where('user_id', $user->id);
        } elseif ($userId = $request->input('user_id')) {
            $query->where('user_id', (int) $userId);
        }

        if ($deptId = $request->input('department_id')) {
            $query->whereHas('user', fn ($q) => $q->where('department_id', (int) $deptId));
        }

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($t) => [
                'employee' => $t->user?->name,
                'week_start' => $t->week_start?->toDateString(),
                'week_end' => $t->week_end?->toDateString(),
                'total_hours' => $t->total_hours,
                'overtime_hours' => $t->overtime_hours,
                'status' => $t->status,
                'submitted_at' => $t->submitted_at?->toDateString(),
                'approved_at' => $t->approved_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'timesheets-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Risk Register
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Risk register report. Filters: period_from, period_to, department_id, status, per_page, format=csv.
     */
    public function risk(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = Risk::where('tenant_id', $user->tenant_id)
            ->with('submitter:id,name', 'riskOwner:id,name', 'department:id,name')
            ->orderByDesc('created_at');

        // Period on created_at
        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($deptId = $request->input('department_id')) {
            $query->where('department_id', (int) $deptId);
        }

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($r) => [
                'code' => $r->risk_code,
                'title' => $r->title,
                'category' => $r->category,
                'department' => $r->department?->name,
                'likelihood' => $r->likelihood,
                'impact' => $r->impact,
                'inherent_score' => $r->inherent_score,
                'risk_level' => $r->risk_level,
                'owner' => $r->riskOwner?->name,
                'submitted_by' => $r->submitter?->name,
                'status' => $r->status,
                'created_at' => $r->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'risk-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Governance
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Governance resolutions report. Filters: period_from, period_to (on adopted_at), status, committee, per_page, format=csv.
     */
    public function governance(Request $request): JsonResponse|StreamedResponse
    {
        if ($denied = $this->gateExport($request)) {
            return $denied;
        }

        $user = $request->user();
        $query = GovernanceResolution::where('tenant_id', $user->tenant_id)
            ->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }
        if ($status = $request->input('status')) {
            $query->where('status', $status);
        }
        if ($committee = $request->input('committee')) {
            $query->where('committee', $committee);
        }

        if ($this->wantsExport($request)) {
            $rows = $query->get()->map(fn ($g) => [
                'reference' => $g->reference_number,
                'title' => $g->title,
                'type' => $g->type,
                'committee' => $g->committee,
                'status' => $g->status,
                'adopted_at' => $g->adopted_at?->toDateString(),
                'created_at' => $g->created_at?->toDateString(),
            ])->toArray();

            return $this->csvResponse($rows, 'governance-report-'.now()->format('Ymd').'.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);

        return response()->json($query->paginate($perPage));
    }
}
