<?php

namespace App\Http\Controllers\Api\V1\Notifications;

use App\Http\Controllers\Controller;
use App\Modules\Notifications\Services\ExternalPortalService;
use Illuminate\Http\JsonResponse;

/**
 * Public external recipient portal — tokenised, minimal content, expiry enforced.
 */
class ExternalNotificationPortalController extends Controller
{
    public function show(string $token, ExternalPortalService $portal): JsonResponse
    {
        $result = $portal->resolve($token);
        if (! ($result['ok'] ?? false)) {
            $status = match ($result['code'] ?? '') {
                'expired' => 410,
                'revoked' => 410,
                default => 404,
            };

            return response()->json(['message' => $result['message'] ?? 'Not found'], $status);
        }

        return response()->json(['data' => $result['data']]);
    }
}
