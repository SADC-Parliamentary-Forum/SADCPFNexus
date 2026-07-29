<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\PayrollImportBatch;
use App\Modules\Finance\Services\PayslipImportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PayrollImportController extends Controller
{
    public function __construct(private readonly PayslipImportService $imports) {}

    public function index(Request $request): JsonResponse
    {
        $rows = PayrollImportBatch::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->withCount('lines')
            ->orderByDesc('id')
            ->paginate($request->integer('per_page', 25));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period' => ['nullable', 'string', 'max:32'],
            'reference' => ['nullable', 'string', 'max:64'],
            'remote' => ['nullable', 'boolean'],
            'lines' => ['nullable', 'array', 'min:1'],
            'lines.*.employee_number' => ['nullable', 'string', 'max:64'],
            'lines.*.period' => ['nullable', 'string', 'max:32'],
            'lines.*.gross' => ['nullable', 'numeric'],
            'lines.*.deductions' => ['nullable', 'numeric'],
            'lines.*.net' => ['nullable', 'numeric'],
            'lines.*.external_ref' => ['nullable', 'string', 'max:128'],
        ]);

        $batch = $this->imports->import($data, $request->user());

        return response()->json(['message' => 'Payslip import staged as draft.', 'data' => $batch], 201);
    }

    public function show(Request $request, PayrollImportBatch $payrollImportBatch): JsonResponse
    {
        abort_unless((int) $payrollImportBatch->tenant_id === (int) $request->user()->tenant_id, 404);

        return response()->json(['data' => $payrollImportBatch->load('lines')]);
    }

    public function stage(Request $request, PayrollImportBatch $payrollImportBatch): JsonResponse
    {
        $batch = $this->imports->stage($payrollImportBatch, $request->user());

        return response()->json(['message' => 'Import confirmed to staged.', 'data' => $batch]);
    }
}
