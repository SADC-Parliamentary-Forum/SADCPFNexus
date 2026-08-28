<?php

namespace App\Http\Controllers\Api\V1\ParliamentConnect;

use App\Http\Controllers\Controller;
use App\Modules\ParliamentConnect\Services\ParliamentConnectFeedService;
use Illuminate\Http\JsonResponse;

class ParliamentConnectController extends Controller
{
    public function feed(ParliamentConnectFeedService $feed): JsonResponse
    {
        return response()->json(['data' => $feed->feed()]);
    }
}
