<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\BudgetFxRate;
use App\Modules\Budget\Services\BudgetFxConversionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetFxRateController extends Controller
{
    public function __construct(private readonly BudgetFxConversionService $fx) {}

    public function index(Request $request): JsonResponse
    {
        $rows = BudgetFxRate::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('effective_date')
            ->paginate($request->integer('per_page', 50));

        return response()->json($rows);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'base_currency' => ['required', 'string', 'size:3'],
            'quote_currency' => ['required', 'string', 'size:3'],
            'rate' => ['required', 'numeric', 'gt:0'],
            'effective_date' => ['required', 'date'],
            'source' => ['nullable', 'string', 'max:32'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $row = BudgetFxRate::create([
            'tenant_id' => $request->user()->tenant_id,
            'base_currency' => strtoupper($data['base_currency']),
            'quote_currency' => strtoupper($data['quote_currency']),
            'rate' => $data['rate'],
            'effective_date' => $data['effective_date'],
            'source' => $data['source'] ?? 'manual',
            'notes' => $data['notes'] ?? null,
            'created_by' => $request->user()->id,
        ]);

        return response()->json(['data' => $row], 201);
    }

    public function convert(Request $request): JsonResponse
    {
        $data = $request->validate([
            'amount' => ['required', 'numeric'],
            'from' => ['required', 'string', 'size:3'],
            'to' => ['required', 'string', 'size:3'],
            'as_of' => ['nullable', 'date'],
        ]);

        $result = $this->fx->convert(
            (int) $request->user()->tenant_id,
            $data['amount'],
            $data['from'],
            $data['to'],
            $data['as_of'] ?? null
        );

        return response()->json(['data' => $result]);
    }
}
