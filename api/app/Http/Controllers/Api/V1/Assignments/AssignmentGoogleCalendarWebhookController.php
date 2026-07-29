<?php

namespace App\Http\Controllers\Api\V1\Assignments;

use App\Http\Controllers\Controller;
use App\Modules\Assignments\Services\AssignmentGoogleCalendarSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Google Calendar push-notification webhook.
 * Auth via GOOGLE_CALENDAR_WEBHOOK_SECRET (X-Goog-Channel-Token).
 */
class AssignmentGoogleCalendarWebhookController extends Controller
{
    public function __construct(private readonly AssignmentGoogleCalendarSyncService $sync) {}

    public function __invoke(Request $request): JsonResponse
    {
        $expected = trim((string) config('services.google.calendar_webhook_secret', ''));
        if ($expected === '') {
            return response()->json(['message' => 'Google Calendar webhook is not configured.'], 401);
        }

        $provided = trim((string) (
            $request->header('X-Goog-Channel-Token')
            ?: $request->input('token', '')
        ));

        if ($provided === '' || ! hash_equals($expected, $provided)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $result = $this->sync->handleWebhookNotification([
            'X-Goog-Channel-ID' => (string) $request->header('X-Goog-Channel-ID', ''),
            'X-Goog-Resource-ID' => (string) $request->header('X-Goog-Resource-ID', ''),
            'X-Goog-Message-Number' => (string) $request->header('X-Goog-Message-Number', ''),
            'X-Goog-Resource-State' => (string) $request->header('X-Goog-Resource-State', ''),
        ]);

        return response()->json([
            'message' => $result['message'] ?? 'ok',
            'data' => $result,
        ]);
    }
}
