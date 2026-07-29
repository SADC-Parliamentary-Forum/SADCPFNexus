<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Modules\Admin\Services\OperatorCredentialStatusService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OperatorCredentialStatusController extends Controller
{
    public function __construct(private readonly OperatorCredentialStatusService $status) {}

    public function __invoke(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isSystemAdmin(), 403, 'Insufficient privileges.');

        return response()->json([
            'data' => $this->status->status(),
        ]);
    }
}
