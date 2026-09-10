<?php

namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Modules\Leave\Services\LeaveBulkCaptureService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class LeaveBulkCaptureController extends Controller
{
    public function __construct(private readonly LeaveBulkCaptureService $service) {}

    public function template(): Response
    {
        return response(LeaveBulkCaptureService::TEMPLATE_CSV, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="leave-bulk-import-template.csv"',
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required_without:rows', 'file', 'mimes:csv,txt', 'max:4096'],
            'rows' => ['required_without:file', 'array', 'min:1'],
            'rows.*.employee_email' => ['nullable', 'string', 'max:255'],
            'rows.*.employee_name' => ['nullable', 'string', 'max:255'],
            'rows.*.leave_type' => ['nullable', 'string', 'max:40'],
            'rows.*.start_date' => ['nullable', 'date'],
            'rows.*.end_date' => ['nullable', 'date'],
            'rows.*.reason' => ['nullable', 'string', 'max:2000'],
            'submit' => ['nullable', 'boolean'],
        ]);

        $submit = $request->boolean('submit');
        $result = $request->hasFile('file')
            ? $this->service->captureCsv($request->user(), $request->file('file'), $submit)
            : $this->service->captureRows($request->user(), $request->input('rows', []), $submit);

        return response()->json([
            'message' => "Captured {$result['created_count']} leave request(s), {$result['error_count']} row error(s).",
            'data' => $result,
        ]);
    }
}
