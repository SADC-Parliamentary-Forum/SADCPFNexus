<?php

namespace App\Http\Controllers\Api\V1\Fleet;

use App\Http\Controllers\Controller;
use App\Modules\Fleet\Services\FleetUtilisationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FleetUtilisationController extends Controller
{
    public function __construct(private readonly FleetUtilisationService $utilisation) {}

    public function __invoke(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($user->isSystemAdmin() || $user->can('assets.view') || $user->can('assets.manage') || $user->can('assets.admin'), 403);

        $data = $request->validate([
            'from' => ['required', 'date'],
            'to' => ['required', 'date'],
        ]);

        return response()->json([
            'data' => $this->utilisation->report((int) $user->tenant_id, $data['from'], $data['to']),
        ]);
    }
}
