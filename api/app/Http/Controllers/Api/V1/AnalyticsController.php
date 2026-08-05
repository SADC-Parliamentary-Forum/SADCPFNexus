<?php
namespace App\Http\Controllers\Api\V1;
use App\Http\Controllers\Controller;
use App\Models\TravelRequest;
use App\Models\LeaveRequest;
use App\Models\ImprestRequest;
use App\Models\ProcurementRequest;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AnalyticsController extends Controller
{
    /**
     * Map module slug → [Eloquent model class, date column for period filter].
     */
    private static array $moduleMap = [
        'travel'      => [TravelRequest::class,    'created_at'],
        'leave'       => [LeaveRequest::class,      'created_at'],
        'imprest'     => [ImprestRequest::class,    'created_at'],
        'procurement' => [ProcurementRequest::class,'created_at'],
    ];

    /**
     * Per-module drill-down: monthly breakdown, status distribution, top requesters.
     * GET /analytics/module/{module}?period_from=Y-m-d&period_to=Y-m-d&months=12
     */
    public function byModule(Request $request, string $module): JsonResponse
    {
        if (!array_key_exists($module, self::$moduleMap)) {
            return response()->json(['message' => 'Unknown module. Valid: ' . implode(', ', array_keys(self::$moduleMap))], 422);
        }

        [$modelClass, $dateCol] = self::$moduleMap[$module];
        $tenantId   = $request->user()->tenant_id;
        $periodFrom = $request->input('period_from');
        $periodTo   = $request->input('period_to');
        $months     = max(1, min((int) $request->input('months', 12), 24));

        $baseQuery = $modelClass::where('tenant_id', $tenantId);
        if ($periodFrom) $baseQuery->whereDate($dateCol, '>=', $periodFrom);
        if ($periodTo)   $baseQuery->whereDate($dateCol, '<=', $periodTo);

        // Monthly breakdown
        $monthly = [];
        for ($i = $months - 1; $i >= 0; $i--) {
            $date  = now()->subMonths($i);
            $q     = clone $baseQuery;
            $count = $q->whereYear($dateCol, $date->year)->whereMonth($dateCol, $date->month)->count();
            $monthly[] = ['month' => $date->format('Y-m'), 'label' => $date->format('M y'), 'count' => $count];
        }

        // Status distribution
        $statusDist = (clone $baseQuery)
            ->select('status', DB::raw('COUNT(*) as count'))
            ->groupBy('status')
            ->orderByDesc('count')
            ->pluck('count', 'status');

        // Top 5 requesters — resolve user names via a separate lookup to avoid aliased-column eager-load issues
        $requesterCol = 'requester_id';
        $topRaw = (clone $baseQuery)
            ->select($requesterCol, DB::raw('COUNT(*) as count'))
            ->groupBy($requesterCol)
            ->orderByDesc('count')
            ->limit(5)
            ->get();

        $userIds = $topRaw->pluck($requesterCol)->filter()->unique()->values();
        $userNames = \App\Models\User::whereIn('id', $userIds)->pluck('name', 'id');

        $topRequesters = $topRaw->map(fn($r) => [
            'user_id' => $r->{$requesterCol},
            'name'    => $userNames[$r->{$requesterCol}] ?? 'Unknown',
            'count'   => (int) $r->count,
        ]);

        return response()->json([
            'module'          => $module,
            'total'           => (clone $baseQuery)->count(),
            'monthly'         => $monthly,
            'status_dist'     => $statusDist,
            'top_requesters'  => $topRequesters,
            'period_from'     => $periodFrom,
            'period_to'       => $periodTo,
        ]);
    }

    /**
     * Resolve the [start, end] Carbon range for a period token (MTD/QTD/YTD).
     */
    private static function periodRange(string $period): array
    {
        $now = now();
        return match (strtoupper($period)) {
            'MTD' => [$now->copy()->startOfMonth(), $now->copy()->endOfDay()],
            'QTD' => [$now->copy()->startOfQuarter(), $now->copy()->endOfDay()],
            default => [$now->copy()->startOfYear(), $now->copy()->endOfDay()], // YTD
        };
    }

    /**
     * Apply the tenant, optional period, and optional department scope to a request-model query.
     */
    private static function scopeQuery($query, int $tenantId, ?array $range, ?string $department)
    {
        $query->where('tenant_id', $tenantId);
        if ($range) {
            $query->whereBetween('created_at', $range);
        }
        if ($department && strtolower($department) !== 'all') {
            $query->whereHas('requester.department', function ($q) use ($department) {
                $q->where('name', $department);
            });
        }
        return $query;
    }

    public function summary(Request $request): JsonResponse
    {
        $tenantId   = $request->user()->tenant_id;
        $periodParm = $request->input('period');
        $department = $request->input('dept') ?? $request->input('department');
        $range      = $periodParm ? self::periodRange((string) $periodParm) : null;

        // Total submissions per module
        $travelCount = self::scopeQuery(TravelRequest::query(), $tenantId, $range, $department)->count();
        $leaveCount = self::scopeQuery(LeaveRequest::query(), $tenantId, $range, $department)->count();
        $imprestCount = self::scopeQuery(ImprestRequest::query(), $tenantId, $range, $department)->count();
        $procurementCount = self::scopeQuery(ProcurementRequest::query(), $tenantId, $range, $department)->count();
        $totalCount = $travelCount + $leaveCount + $imprestCount + $procurementCount;

        // Approval rates
        $travelApproved = self::scopeQuery(TravelRequest::query(), $tenantId, $range, $department)->whereIn('status', ['approved', 'paid'])->count();
        $leaveApproved = self::scopeQuery(LeaveRequest::query(), $tenantId, $range, $department)->whereIn('status', ['approved'])->count();
        $totalSubmitted = self::scopeQuery(TravelRequest::query(), $tenantId, $range, $department)->whereNotIn('status', ['draft'])->count()
            + self::scopeQuery(LeaveRequest::query(), $tenantId, $range, $department)->whereNotIn('status', ['draft'])->count();
        $totalApproved = $travelApproved + $leaveApproved;
        $approvalRate = $totalSubmitted > 0 ? round(($totalApproved / $totalSubmitted) * 100, 1) : 0;

        // Monthly submissions (last 12 months, clipped to the selected period when narrower)
        $monthly = [];
        for ($i = 11; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $month = $date->format('Y-m');
            if ($range && ($date->endOfMonth()->lt($range[0]) || $date->startOfMonth()->gt($range[1]))) {
                $monthly[] = ['month' => $month, 'label' => $date->format('M'), 'count' => 0];
                continue;
            }
            $count = self::scopeQuery(TravelRequest::query(), $tenantId, null, $department)->whereYear('created_at', $date->year)->whereMonth('created_at', $date->month)->count()
                + self::scopeQuery(LeaveRequest::query(), $tenantId, null, $department)->whereYear('created_at', $date->year)->whereMonth('created_at', $date->month)->count()
                + self::scopeQuery(ImprestRequest::query(), $tenantId, null, $department)->whereYear('created_at', $date->year)->whereMonth('created_at', $date->month)->count();
            $monthly[] = ['month' => $month, 'label' => $date->format('M'), 'count' => $count];
        }

        // By module
        $byModule = [
            ['module' => 'Travel',      'label' => 'Travel',      'count' => $travelCount],
            ['module' => 'Leave',       'label' => 'Leave',       'count' => $leaveCount],
            ['module' => 'Imprest',     'label' => 'Imprest',     'count' => $imprestCount],
            ['module' => 'Procurement', 'label' => 'Procurement', 'count' => $procurementCount],
        ];

        // Activity heatmap from audit logs (day_of_week 0=Sun..6=Sat, hour 0-23)
        $heatmapRaw = AuditLog::where('tenant_id', $tenantId)
            ->where('created_at', '>=', $range ? $range[0] : now()->subDays(90))
            ->select(
                DB::raw('EXTRACT(DOW FROM created_at) as dow'),
                DB::raw('EXTRACT(HOUR FROM created_at) as hour'),
                DB::raw('COUNT(*) as cnt')
            )
            ->groupBy('dow', 'hour')
            ->get();

        $heatmap = [];
        foreach ($heatmapRaw as $row) {
            $heatmap[] = ['day' => (int)$row->dow, 'hour' => (int)$row->hour, 'count' => (int)$row->cnt];
        }

        // Recent audit activity
        $recentActivity = AuditLog::where('tenant_id', $tenantId)
            ->with('user:id,name,email')
            ->orderByDesc('created_at')
            ->limit(8)
            ->get()
            ->map(fn($l) => [
                'id' => $l->id,
                'event' => $l->event,
                'user' => $l->user?->name ?? 'System',
                'module' => $l->tags ?? class_basename($l->auditable_type ?? ''),
                'timestamp' => $l->created_at?->diffForHumans(),
            ]);

        return response()->json([
            'kpi' => [
                'total_submissions' => $totalCount,
                'approval_rate_pct' => $approvalRate,
                'active_travel' => self::scopeQuery(TravelRequest::query(), $tenantId, $range, $department)->whereIn('status', ['approved', 'submitted'])->count(),
            ],
            'by_module' => $byModule,
            'monthly_submissions' => $monthly,
            'activity_heatmap' => $heatmap,
            'recent_activity' => $recentActivity,
        ]);
    }
}
