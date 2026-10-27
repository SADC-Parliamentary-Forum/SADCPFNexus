<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Services\ActionQueueService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * GET /me/action-queue — everything currently waiting on the signed-in user,
 * across modules. Always scoped to the caller; there is no way to request
 * another user's queue.
 */
class ActionQueueController extends Controller
{
    public function __construct(private readonly ActionQueueService $queue) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json($this->queue->forUser($request->user()));
    }
}
