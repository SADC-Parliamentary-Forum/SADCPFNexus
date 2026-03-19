<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\Budget;
use App\Models\BudgetLine;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class BudgetController extends Controller
{
    public function index(Request $request)
    {
        $tenantId = $request->user()->tenant_id;
        
        $budgets = Budget::with('lines', 'creator')
            ->where('tenant_id', $tenantId)
            ->when($request->year, fn($q, $y) => $q->where('year', $y))
            ->when($request->type, fn($q, $t) => $q->where('type', $t))
            ->orderBy('year', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data'    => $budgets
        ]);
    }

    public function show(Request $request, Budget $budget)
    {
        if ($budget->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        return response()->json([
            'success' => true,
            'data'    => $budget->load('lines', 'creator')
        ]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'year'         => ['required', 'string', 'size:4'],
            'name'         => ['required', 'string', 'max:255'],
            'type'         => ['required', 'in:core,project'],
            'currency'     => ['required', 'string', 'size:3'],
            'description'  => ['nullable', 'string'],
            'lines'        => ['required', 'array', 'min:1'],
            'lines.*.category'         => ['required', 'string'],
            'lines.*.description'      => ['nullable', 'string'],
            'lines.*.account_code'     => ['nullable', 'string'],
            'lines.*.amount_allocated' => ['required', 'numeric', 'min:0'],
        ]);

        $budget = DB::transaction(function () use ($data, $request) {
            $totalAmount = collect($data['lines'])->sum('amount_allocated');

            $budget = Budget::create([
                'tenant_id'    => $request->user()->tenant_id,
                'created_by'   => $request->user()->id,
                'year'         => $data['year'],
                'name'         => $data['name'],
                'type'         => $data['type'],
                'currency'     => $data['currency'],
                'description'  => $data['description'] ?? null,
                'total_amount' => $totalAmount,
            ]);

            foreach ($data['lines'] as $line) {
                $budget->lines()->create([
                    'category'         => $line['category'],
                    'description'      => $line['description'] ?? null,
                    'account_code'     => $line['account_code'] ?? null,
                    'amount_allocated' => $line['amount_allocated'],
                    'amount_spent'     => 0,
                ]);
            }

            return $budget;
        });

        return response()->json([
            'success' => true,
            'message' => 'Budget created successfully.',
            'data'    => $budget->load('lines')
        ], 201);
    }

    public function update(Request $request, Budget $budget)
    {
        if ($budget->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $data = $request->validate([
            'year'        => ['sometimes', 'string', 'size:4'],
            'name'        => ['sometimes', 'string', 'max:255'],
            'type'        => ['sometimes', 'in:core,project'],
            'currency'    => ['sometimes', 'string', 'size:3'],
            'description' => ['nullable', 'string'],
        ]);

        $budget->update($data);

        return response()->json([
            'success' => true,
            'message' => 'Budget updated successfully.',
            'data'    => $budget->load('lines')
        ]);
    }

    public function destroy(Request $request, Budget $budget)
    {
        if ($budget->tenant_id !== $request->user()->tenant_id) {
            abort(403);
        }

        $budget->lines()->delete();
        $budget->delete();

        return response()->json(['success' => true, 'message' => 'Budget deleted successfully.']);
    }
}
