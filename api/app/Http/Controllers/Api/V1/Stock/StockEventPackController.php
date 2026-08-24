<?php

namespace App\Http\Controllers\Api\V1\Stock;

use App\Http\Controllers\Controller;
use App\Models\StockEventPack;
use App\Modules\Stock\Services\StockEventPackService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockEventPackController extends Controller
{
    public function __construct(private readonly StockEventPackService $packs) {}

    public function index(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->packs->list($request->user())]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'event_type' => ['nullable', 'string', 'max:64'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.stock_item_id' => ['required', 'integer'],
            'lines.*.quantity' => ['required', 'integer', 'min:1'],
            'lines.*.notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $pack = $this->packs->create($data, $request->user());

        return response()->json(['message' => 'Event pack saved. Instantiate creates a draft stock request only.', 'data' => $pack], 201);
    }

    public function instantiate(Request $request, StockEventPack $eventPack): JsonResponse
    {
        $data = $request->validate([
            'purpose' => ['nullable', 'string', 'max:500'],
            'department_id' => ['nullable', 'integer'],
        ]);

        $row = $this->packs->instantiate($eventPack, $request->user(), $data);

        return response()->json(['message' => 'Draft stock request created from event pack. Not issued.', 'data' => $row], 201);
    }

    public function duplicate(Request $request, StockEventPack $eventPack): JsonResponse
    {
        $row = $this->packs->duplicate($eventPack, $request->user());

        return response()->json(['message' => 'Event pack copied. Instantiate still drafts a request only.', 'data' => $row], 201);
    }

    public function barcodeLookup(Request $request): JsonResponse
    {
        $data = $request->validate([
            'barcodes' => ['required', 'array', 'min:1', 'max:200'],
            'barcodes.*' => ['string', 'max:128'],
        ]);

        return response()->json(['data' => $this->packs->barcodeLookup($request->user(), $data['barcodes'])]);
    }
}
