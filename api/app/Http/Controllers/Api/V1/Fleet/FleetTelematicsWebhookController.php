<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Modules\Fleet\Telematics\TelematicsSyncService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Authenticated webhook intake for vendor push updates.
 * Token from FLEET_TELEMATICS_WEBHOOK_TOKEN — never auto-creates vehicles.
 */
class FleetTelematicsWebhookController extends Controller
{
    public function __construct(private readonly TelematicsSyncService $sync) {}

    public function __invoke(Request $request): JsonResponse
    {
        $expected = trim((string) config('fleet_telematics.webhook_token', ''));
        if ($expected === '') {
            return response()->json(['message' => 'Telematics webhook is not configured.'], 401);
        }

        $provided = $this->extractToken($request);
        if ($provided === '' || ! hash_equals($expected, $provided)) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $payload = $request->all();
        $result = $this->sync->applyWebhookPayload($payload);

        $status = $result['status'] === 'error' ? 422 : 200;

        return response()->json([
            'message' => $result['message'],
            'data' => [
                'status' => $result['status'],
                'updated' => $result['updated'],
            ],
        ], $status);
    }

    private function extractToken(Request $request): string
    {
        $header = (string) $request->header('Authorization', '');
        if (preg_match('/^\s*Bearer\s+(.+)\s*$/i', $header, $m)) {
            return trim($m[1]);
        }

        $alt = trim((string) $request->header('X-Telematics-Token', ''));
        if ($alt !== '') {
            return $alt;
        }

        return trim((string) $request->input('token', ''));
    }
}
