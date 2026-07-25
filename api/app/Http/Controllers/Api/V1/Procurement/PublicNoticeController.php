<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Modules\Procurement\Services\PublicNoticeBoardService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublicNoticeController extends Controller
{
    public function __construct(private readonly PublicNoticeBoardService $notices) {}

    /** Unauthenticated public tender/RFQ notice board. */
    public function publicIndex(): JsonResponse
    {
        return response()->json([
            'data' => $this->notices->publishedNotices(),
        ]);
    }

    /** Authenticated staff notice board (same public fields, tenant-scoped). */
    public function staffIndex(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole([
            'Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General', 'super-admin',
        ]) && !$request->user()->hasAnyPermission(['procurement.view', 'procurement.admin'])) {
            abort(403);
        }

        return response()->json([
            'data' => $this->notices->publishedNotices((int) $request->user()->tenant_id),
        ]);
    }
}
