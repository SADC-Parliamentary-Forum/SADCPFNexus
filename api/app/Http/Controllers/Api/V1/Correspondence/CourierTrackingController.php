<?php

namespace App\Http\Controllers\Api\V1\Correspondence;

use App\Http\Controllers\Controller;
use App\Models\CorrespondenceDispatch;
use App\Modules\Correspondence\Services\CourierTrackingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CourierTrackingController extends Controller
{
    public function __construct(private readonly CourierTrackingService $tracking) {}

    public function refresh(Request $request, CorrespondenceDispatch $dispatch): JsonResponse
    {
        $dispatch->load('correspondence');
        abort_unless($dispatch->correspondence && (int) $dispatch->correspondence->tenant_id === (int) $request->user()->tenant_id, 404);

        $updated = $this->tracking->refresh($dispatch);

        return response()->json(['message' => 'Tracking refreshed.', 'data' => $updated]);
    }
}
