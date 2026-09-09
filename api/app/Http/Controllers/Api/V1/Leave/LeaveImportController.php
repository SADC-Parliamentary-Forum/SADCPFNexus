<?php

namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Modules\Leave\Services\LeaveImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LeaveImportController extends Controller
{
    public function __construct(private readonly LeaveImportService $service) {}

    public function template(): Response
    {
        return response(LeaveImportService::TEMPLATE_CSV, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="leave-import-template.csv"',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:4096'],
            'commit' => ['sometimes', 'boolean'],
        ]);

        $commit = $request->boolean('commit');
        $result = $this->service->import($request->file('file'), $request->user(), $commit);

        $message = $commit
            ? "Import finished: {$result['created']} leave rows created, {$result['skipped']} skipped, {$result['balances']} balances updated."
            : 'Preview complete. No records were written.';

        return response()->json([
            'message' => $message,
            'data' => $result,
        ]);
    }
}
