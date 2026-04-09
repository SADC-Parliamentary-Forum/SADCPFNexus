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
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    /**
     * Stream a CSV download response from a flat array of rows.
     *
     * @param array<array<string,mixed>> $rows
     */
    private function csvResponse(array $rows, string $filename): StreamedResponse
    {
        $headers = !empty($rows) ? array_keys($rows[0]) : [];

        return response()->streamDownload(function () use ($rows, $headers) {
            $out = fopen('php://output', 'w');
            if ($headers) fputcsv($out, $headers);
            foreach ($rows as $row) {
                fputcsv($out, array_values($row));
            }
            fclose($out);
        }, $filename, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Gate CSV/PDF exports behind the reports.export permission.
     * Returns a 403 JSON response if denied, null if allowed.
     */
    private function gateExport(Request $request): ?JsonResponse
    {
        if ($request->input('format') === 'csv' && !$request->user()->can('reports.export')) {
            return response()->json(['message' => 'You do not have permission to export reports.'], 403);
        }
        return null;
    }

    /**
     * Apply common filters to a query: period, status, and user scoping.
     *
     * @param string $userColumn  The FK column that links to users (e.g. 'requester_id', 'user_id').
     * @param string $dateColumn  The date column to filter on (defaults to 'created_at').
     */
    private function applyCommonFilters(
        Builder $query,
        Request $request,
        string  $userColumn = 'requester_id',
        string  $dateColumn = 'created_at'
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
        if (!$user->can('reports.export')) {
            $query->where($userColumn, $user->id);
        } elseif ($userId = $request->input('user_id')) {
            $query->where($userColumn, (int) $userId);
        }

        // Department filter (join through the user FK)
        if ($deptId = $request->input('department_id')) {
            $query->whereHas('requester', fn($q) => $q->where('department_id', (int) $deptId));
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

        $travelCount   = TravelRequest::where('tenant_id', $tenantId)->count();
        $leaveCount    = LeaveRequest::where('tenant_id', $tenantId)->count();
        $assetCount    = Asset::where('tenant_id', $tenantId)->count();
        $imprestCount  = ImprestRequest::where('tenant_id', $tenantId)->count();
        $procCount     = ProcurementRequest::where('tenant_id', $tenantId)->count();
        $riskCount     = Risk::where('tenant_id', $tenantId)->count();
        $govCount      = GovernanceResolution::where('tenant_id', $tenantId)->count();

        return response()->json([
            'travel_requests_count' => $travelCount,
            'leave_requests_count'  => $leaveCount,
            'asset_count'           => $assetCount,
            'imprest_count'         => $imprestCount,
            'procurement_count'     => $procCount,
            'risk_count'            => $riskCount,
            'governance_count'      => $govCount,
            'report_types' => [
                ['id' => 'travel',          'label' => 'Travel',           'count' => $travelCount],
                ['id' => 'leave',           'label' => 'Leave',            'count' => $leaveCount],
                ['id' => 'dsa',             'label' => 'DSA',              'count' => $travelCount],
                ['id' => 'imprest',         'label' => 'Imprest',          'count' => $imprestCount],
                ['id' => 'procurement',     'label' => 'Procurement',      'count' => $procCount],
                ['id' => 'salary-advances', 'label' => 'Salary Advances',  'count' => 0],
                ['id' => 'hr-timesheets',   'label' => 'HR Timesheets',    'count' => 0],
                ['id' => 'risk',            'label' => 'Risk Register',    'count' => $riskCount],
                ['id' => 'governance',      'label' => 'Governance',       'count' => $govCount],
                ['id' => 'financial',       'label' => 'Financial',        'count' => 0],
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
        $user     = $request->user();
        $tenantId = $user->tenant_id;

        $users = User::where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'department_id'])
            ->map(fn($u) => [
                'id'            => $u->id,
                'name'          => $u->name,
                'email'         => $u->email,
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($t) => [
                'reference'   => $t->reference_number,
                'employee'    => $t->requester?->name,
                'status'      => $t->status,
                'destination' => trim($t->destination_city . ', ' . $t->destination_country, ', '),
                'purpose'     => $t->purpose,
                'departure'   => $t->departure_date?->toDateString(),
                'return'      => $t->return_date?->toDateString(),
                'currency'    => $t->currency ?? 'NAD',
                'dsa_amount'  => $t->estimated_dsa,
                'created_at'  => $t->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'travel-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($t) => [
                'reference'   => $t->reference_number,
                'employee'    => $t->requester?->name,
                'destination' => trim($t->destination_city . ', ' . $t->destination_country, ', '),
                'country'     => $t->destination_country,
                'departure'   => $t->departure_date?->toDateString(),
                'return'      => $t->return_date?->toDateString(),
                'days'        => $t->departure_date && $t->return_date ? $t->departure_date->diffInDays($t->return_date) + 1 : null,
                'dsa_amount'  => $t->estimated_dsa,
                'currency'    => $t->currency ?? 'NAD',
                'status'      => $t->status,
                'created_at'  => $t->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'dsa-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
        $query = LeaveRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($l) => [
                'reference'  => $l->reference_number,
                'employee'   => $l->requester?->name,
                'leave_type' => $l->leave_type,
                'status'     => $l->status,
                'start_date' => $l->start_date,
                'end_date'   => $l->end_date,
                'days'       => $l->days_requested,
                'created_at' => $l->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'leave-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
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

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($a) => [
                'asset_tag'      => $a->asset_tag,
                'name'           => $a->name,
                'category'       => $a->category,
                'status'         => $a->status,
                'condition'      => $a->condition,
                'purchase_value' => $a->purchase_value,
                'current_value'  => $a->current_value,
                'location'       => $a->location,
                'assigned_to'    => $a->assignedUser?->name,
                'created_at'     => $a->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'assets-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
        $query = ImprestRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($i) => [
                'reference'                 => $i->reference_number,
                'employee'                  => $i->requester?->name,
                'purpose'                   => $i->purpose,
                'budget_line'               => $i->budget_line,
                'amount_requested'          => $i->amount_requested,
                'amount_approved'           => $i->amount_approved,
                'amount_liquidated'         => $i->amount_liquidated,
                'currency'                  => $i->currency ?? 'NAD',
                'status'                    => $i->status,
                'expected_liquidation_date' => $i->expected_liquidation_date?->toDateString(),
                'created_at'                => $i->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'imprest-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
        $query = ProcurementRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($p) => [
                'reference'         => $p->reference_number,
                'employee'          => $p->requester?->name,
                'title'             => $p->title,
                'category'          => $p->category,
                'procurement_method'=> $p->procurement_method,
                'estimated_value'   => $p->estimated_value,
                'currency'          => $p->currency ?? 'NAD',
                'status'            => $p->status,
                'required_by_date'  => $p->required_by_date?->toDateString(),
                'created_at'        => $p->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'procurement-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
        $query = SalaryAdvanceRequest::where('tenant_id', $user->tenant_id)
            ->with('requester:id,name,department_id')
            ->orderByDesc('created_at');

        $this->applyCommonFilters($query, $request, 'requester_id');

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($s) => [
                'reference'        => $s->reference_number,
                'employee'         => $s->requester?->name,
                'advance_type'     => $s->advance_type,
                'amount'           => $s->amount,
                'currency'         => $s->currency ?? 'NAD',
                'repayment_months' => $s->repayment_months,
                'purpose'          => $s->purpose,
                'status'           => $s->status,
                'created_at'       => $s->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'salary-advances-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
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

        if (!$user->can('reports.export')) {
            $query->where('user_id', $user->id);
        } elseif ($userId = $request->input('user_id')) {
            $query->where('user_id', (int) $userId);
        }

        if ($deptId = $request->input('department_id')) {
            $query->whereHas('user', fn($q) => $q->where('department_id', (int) $deptId));
        }

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($t) => [
                'employee'       => $t->user?->name,
                'week_start'     => $t->week_start?->toDateString(),
                'week_end'       => $t->week_end?->toDateString(),
                'total_hours'    => $t->total_hours,
                'overtime_hours' => $t->overtime_hours,
                'status'         => $t->status,
                'submitted_at'   => $t->submitted_at?->toDateString(),
                'approved_at'    => $t->approved_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'timesheets-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
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

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($r) => [
                'code'          => $r->risk_code,
                'title'         => $r->title,
                'category'      => $r->category,
                'department'    => $r->department?->name,
                'likelihood'    => $r->likelihood,
                'impact'        => $r->impact,
                'inherent_score'=> $r->inherent_score,
                'risk_level'    => $r->risk_level,
                'owner'         => $r->riskOwner?->name,
                'submitted_by'  => $r->submitter?->name,
                'status'        => $r->status,
                'created_at'    => $r->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'risk-report-' . now()->format('Ymd') . '.csv');
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
        if ($denied = $this->gateExport($request)) return $denied;

        $user  = $request->user();
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

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($g) => [
                'reference'  => $g->reference_number,
                'title'      => $g->title,
                'type'       => $g->type,
                'committee'  => $g->committee,
                'status'     => $g->status,
                'adopted_at' => $g->adopted_at?->toDateString(),
                'created_at' => $g->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'governance-report-' . now()->format('Ymd') . '.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        return response()->json($query->paginate($perPage));
    }
}
