<?php

namespace App\Http\Controllers\Api\V1\Inventory;

use App\Http\Controllers\Controller;
use App\Modules\Inventory\Services\UnifiedInventoryRegisterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class UnifiedInventoryController extends Controller
{
    public function index(Request $request, UnifiedInventoryRegisterService $register): JsonResponse
    {
        $user = $request->user();
        if (
            ! $user->isSystemAdmin()
            && ! $user->can('assets.view')
            && ! $user->can('stock.view')
            && ! $user->can('procurement.view')
        ) {
            abort(403);
        }

        $page = $register->list($user, $request->integer('per_page', 50));

        return response()->json([
            'data' => $page->items(),
            'meta' => [
                'total' => $page->total(),
                'current_page' => $page->currentPage(),
            ],
        ]);
    }
}
