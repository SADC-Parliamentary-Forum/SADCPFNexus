<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Models\ProgrammeBudgetLine;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProgrammeBudgetLineController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    public function store(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'category'       => ['required', 'string', 'max:100'],
            'description'    => ['required', 'string', 'max:500'],
            'amount'         => ['required', 'numeric', 'min:0'],
            'actual_spent'   => ['nullable', 'numeric', 'min:0'],
            'funding_source' => ['nullable', 'string', 'max:50'],
            'account_code'   => ['nullable', 'string', 'max:50'],
        ]);

        $line = $this->service->addBudgetLine($programme, $data);
        return response()->json(['message' => 'Budget line added.', 'data' => $line], 201);
    }

    public function update(Request $request, Programme $programme, ProgrammeBudgetLine $budgetLine): JsonResponse
    {
        $data = $request->validate([
            'category'       => ['sometimes', 'string', 'max:100'],
            'description'    => ['sometimes', 'string', 'max:500'],
            'amount'         => ['sometimes', 'numeric', 'min:0'],
            'actual_spent'   => ['nullable', 'numeric', 'min:0'],
            'funding_source' => ['nullable', 'string', 'max:50'],
            'account_code'   => ['nullable', 'string', 'max:50'],
        ]);

        $line = $this->service->updateBudgetLine($budgetLine, $data);
        return response()->json(['message' => 'Budget line updated.', 'data' => $line]);
    }

    public function destroy(Programme $programme, ProgrammeBudgetLine $budgetLine): JsonResponse
    {
        $this->service->deleteBudgetLine($budgetLine);
        return response()->json(['message' => 'Budget line deleted.']);
    }
}
