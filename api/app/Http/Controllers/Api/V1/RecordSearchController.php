<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\RecordSearchService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/** GET /search/records?q= — records the caller can open, matched by reference or title. */
class RecordSearchController extends Controller
{
    public function __construct(private readonly RecordSearchService $search) {}

    public function index(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:2', 'max:100']]);

        return response()->json(['data' => $this->search->search($request->user(), $data['q'])]);
    }
}
