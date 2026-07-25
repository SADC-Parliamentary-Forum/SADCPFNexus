<?php

namespace App\Http\Controllers\Api\V1\MAndE;

use App\Http\Controllers\Controller;
use App\Modules\MAndE\Services\MeImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class MeImportController extends Controller
{
    public function __construct(private readonly MeImportService $service) {}

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:4096'],
        ]);

        return response()->json([
            'data' => $this->service->preview($request->file('file'), $request->user()),
        ]);
    }

    public function commit(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt,xlsx,xls', 'max:4096'],
        ]);

        $result = $this->service->commit($request->file('file'), $request->user());

        return response()->json([
            'message' => "Import finished: {$result['created']} created, {$result['skipped']} skipped.",
            'data'    => $result,
        ]);
    }
}
