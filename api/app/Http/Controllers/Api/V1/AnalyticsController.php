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
    public function summary(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id;

        // Total submissions per module
        $travelCount = TravelRequest::where('tenant_id', $tenantId)->count();
        $leaveCount = LeaveRequest::where('tenant_id', $tenantId)->count();
        $imprestCount = ImprestRequest::where('tenant_id', $tenantId)->count();
        $procurementCount = ProcurementRequest::where('tenant_id', $tenantId)->count();
        $totalCount = $travelCount + $leaveCount + $imprestCount + $procurementCount;

        // Approval rates
        $travelApproved = TravelRequest::where('tenant_id', $tenantId)->whereIn('status', ['approved', 'paid'])->count();
        $leaveApproved = LeaveRequest::where('tenant_id', $tenantId)->whereIn('status', ['approved'])->count();
        $totalSubmitted = TravelRequest::where('tenant_id', $tenantId)->whereNotIn('status', ['draft'])->count()
            + LeaveRequest::where('tenant_id', $tenantId)->whereNotIn('status', ['draft'])->count();
        $totalApproved = $travelApproved + $leaveApproved;
        $approvalRate = $totalSubmitted > 0 ? round(($totalApproved / $totalSubmitted) * 100, 1) : 0;

        // Monthly submissions (last 12 months)
        $monthly = [];
        for ($i = 11; $i >= 0; $i--) {
            $date = now()->subMonths($i);
            $month = $date->format('Y-m');
            $count = TravelRequest::where('tenant_id', $tenantId)->whereYear('created_at', $date->year)->whereMonth('created_at', $date->month)->count()
                + LeaveRequest::where('tenant_id', $tenantId)->whereYear('created_at', $date->year)->whereMonth('created_at', $date->month)->count()
                + ImprestRequest::where('tenant_id', $tenantId)->whereYear('created_at', $date->year)->whereMonth('created_at', $date->month)->count();
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
            ->where('created_at', '>=', now()->subDays(90))
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
                'active_travel' => TravelRequest::where('tenant_id', $tenantId)->whereIn('status', ['approved', 'submitted'])->count(),
            ],
            'by_module' => $byModule,
            'monthly_submissions' => $monthly,
            'activity_heatmap' => $heatmap,
            'recent_activity' => $recentActivity,
        ]);
    }
}
