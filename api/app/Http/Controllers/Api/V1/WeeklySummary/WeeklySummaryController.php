<?php

namespace App\Http\Controllers\Api\V1\WeeklySummary;

use App\Http\Controllers\Controller;
use App\Jobs\RunWeeklySummaryBatchJob;
use App\Models\WeeklySummaryPreference;
use App\Models\WeeklySummaryReport;
use App\Models\WeeklySummaryRun;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WeeklySummaryController extends Controller
{
    // ── Preferences ─────────────────────────────────────────────────────────

    public function getPreferences(Request $request): JsonResponse
    {
        $pref = WeeklySummaryPreference::firstOrCreate(
            ['user_id' => $request->user()->id],
            ['enabled' => true, 'detail_mode' => 'standard']
        );

        return response()->json(['data' => $pref]);
    }

    public function updatePreferences(Request $request): JsonResponse
    {
        $data = $request->validate([
            'enabled'     => ['boolean'],
            'detail_mode' => ['in:compact,standard,detailed'],
        ]);

        $pref = WeeklySummaryPreference::updateOrCreate(
            ['user_id' => $request->user()->id],
            $data
        );

        return response()->json(['data' => $pref, 'message' => 'Preferences updated.']);
    }

    // ── Reports (user's own) ─────────────────────────────────────────────────

    public function listReports(Request $request): JsonResponse
    {
        $reports = WeeklySummaryReport::where('user_id', $request->user()->id)
            ->orderByDesc('period_start')
            ->paginate(20);

        return response()->json($reports);
    }

    public function showReport(Request $request, WeeklySummaryReport $report): JsonResponse
    {
        $user = $request->user();

        // Staff may only see their own reports; admins and managers may see all in tenant
        $isAdmin = $user->hasAnyRole(['System Admin', 'HR Manager', 'Finance Controller', 'Secretary General']);

        if (!$isAdmin && $report->user_id !== $user->id) {
            return response()->json(['message' => 'Forbidden.'], 403);
        }

        if ($report->tenant_id !== $user->tenant_id) {
            return response()->json(['message' => 'Not found.'], 404);
        }

        $report->load('user');

        return response()->json(['data' => $report]);
    }

    // ── Admin: Runs ──────────────────────────────────────────────────────────

    public function listRuns(Request $request): JsonResponse
    {
        $runs = WeeklySummaryRun::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('period_start')
            ->paginate(20);

        return response()->json($runs);
    }

    public function triggerRun(Request $request): JsonResponse
    {
        RunWeeklySummaryBatchJob::dispatch();

        return response()->json(['message' => 'Weekly summary run queued.'], 202);
    }
}
