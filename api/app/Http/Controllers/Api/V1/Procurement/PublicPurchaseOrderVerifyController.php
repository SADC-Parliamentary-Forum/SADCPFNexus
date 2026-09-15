<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Modules\Documents\Services\PurchaseOrderDocumentService;
use Illuminate\Http\JsonResponse;

class PublicPurchaseOrderVerifyController extends Controller
{
    public function __construct(private readonly PurchaseOrderDocumentService $documents) {}

    public function show(string $token): JsonResponse
    {
        return response()->json(['data' => $this->documents->publicVerify($token)]);
    }
}
