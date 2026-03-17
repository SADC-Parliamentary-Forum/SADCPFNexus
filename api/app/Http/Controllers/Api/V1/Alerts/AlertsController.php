<?php
namespace App\Http\Controllers\Api\V1\Alerts;

use App\Http\Controllers\Controller;
use App\Modules\Alerts\Services\AlertsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class AlertsController extends Controller
{
    public function __construct(private readonly AlertsService $service) {}

    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated.'], 401);
        }

        try {
            return response()->json($this->service->getSummary($user));
        } catch (\Throwable $e) {
            Log::error('Alerts summary failed', [
                'user_id' => $user->id,
                'message' => $e->getMessage(),
                'exception' => get_class($e),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            return response()->json([
                'away_today' => [],
                'active_missions' => [],
                'upcoming_deadlines' => [],
                'events_this_week' => [],
                'un_days_upcoming' => [],
            ], 200);
        }
    }
}
