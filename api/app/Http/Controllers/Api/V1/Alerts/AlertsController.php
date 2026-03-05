<?php
namespace App\Http\Controllers\Api\V1\Alerts;

use App\Http\Controllers\Controller;
use App\Modules\Alerts\Services\AlertsService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AlertsController extends Controller
{
    public function __construct(private readonly AlertsService $service) {}

    public function summary(Request $request): JsonResponse
    {
        return response()->json($this->service->getSummary($request->user()));
    }
}
