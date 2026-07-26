<?php

namespace App\Http\Controllers\Api\V1\Budget;

use App\Http\Controllers\Controller;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Modules\Budget\Services\BudgetActualService;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BudgetControlController extends Controller
{
    public function __construct(
        private readonly BudgetAvailabilityService $availability,
        private readonly BudgetCommitmentService $commitments,
        private readonly BudgetActualService $actuals,
    ) {}

    public function financialYears(Request $request): JsonResponse
    {
        $years = FinancialYear::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('starts_on')
            ->get();

        return response()->json(['success' => true, 'data' => $years]);
    }

    public function storeFinancialYear(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:20'],
            'label' => ['required', 'string', 'max:255'],
            'starts_on' => ['required', 'date'],
            'ends_on' => ['required', 'date', 'after:starts_on'],
            'status' => ['nullable', 'in:planned,open,closing,closed,archived'],
        ]);

        $year = FinancialYear::create([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
            'status' => $data['status'] ?? 'planned',
        ]);

        return response()->json(['success' => true, 'data' => $year], 201);
    }

    public function fundingSources(Request $request): JsonResponse
    {
        $sources = FundingSource::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->when($request->boolean('active_only'), fn ($q) => $q->where('is_active', true))
            ->orderBy('name')
            ->get();

        return response()->json(['success' => true, 'data' => $sources]);
    }

    public function storeFundingSource(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:255'],
            'type' => ['required', 'string', 'max:40'],
            'donor' => ['nullable', 'string', 'max:255'],
            'agreement_reference' => ['nullable', 'string', 'max:255'],
            'starts_on' => ['nullable', 'date'],
            'ends_on' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'size:3'],
            'restrictions' => ['nullable', 'array'],
            'reporting_requirements' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $source = FundingSource::create([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
            'currency' => $data['currency'] ?? 'NAD',
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json(['success' => true, 'data' => $source], 201);
    }

    public function lines(Request $request): JsonResponse
    {
        $lines = BudgetLine::query()
            ->with(['budget', 'fundingSource'])
            ->whereHas('budget', fn ($q) => $q->where('tenant_id', $request->user()->tenant_id))
            ->when($request->boolean('active_only', true), fn ($q) => $q->where('is_active', true))
            ->when($request->filled('financial_year_id'), function ($q) use ($request) {
                $q->whereHas('budget', fn ($b) => $b->where('financial_year_id', $request->integer('financial_year_id')));
            })
            ->when($request->filled('q'), function ($q) use ($request) {
                $term = '%'.$request->string('q').'%';
                $q->where(function ($inner) use ($term) {
                    $inner->where('code', 'ilike', $term)
                        ->orWhere('name', 'ilike', $term)
                        ->orWhere('category', 'ilike', $term)
                        ->orWhere('description', 'ilike', $term);
                });
            })
            ->orderBy('code')
            ->paginate($request->integer('per_page', 50));

        return response()->json(['success' => true, 'data' => $lines]);
    }

    public function availability(Request $request, BudgetLine $budgetLine): JsonResponse
    {
        $this->assertLineTenant($request, $budgetLine);
        $check = $this->availability->check(
            $budgetLine->id,
            $request->filled('amount') ? (float) $request->input('amount') : null,
        );

        return response()->json(['success' => true, 'data' => $check]);
    }

    public function checkAvailability(Request $request): JsonResponse
    {
        $data = $request->validate([
            'budget_line_id' => ['required', 'integer', 'exists:budget_lines,id'],
            'amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $line = BudgetLine::findOrFail($data['budget_line_id']);
        $this->assertLineTenant($request, $line);

        return response()->json([
            'success' => true,
            'data' => $this->availability->check(
                $line->id,
                isset($data['amount']) ? (float) $data['amount'] : null,
            ),
        ]);
    }

    public function reserve(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);

        $data = $request->validate([
            'budget_line_id' => ['required', 'integer', 'exists:budget_lines,id'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'source_type' => ['required', 'string', 'max:40'],
            'source_id' => ['required', 'integer'],
            'source_key' => ['required', 'string', 'max:120'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],
            'programme_id' => ['nullable', 'integer'],
            'procurement_request_id' => ['nullable', 'integer'],
            'travel_request_id' => ['nullable', 'integer'],
            'confirm' => ['nullable', 'boolean'],
        ]);

        $line = BudgetLine::findOrFail($data['budget_line_id']);
        $this->assertLineTenant($request, $line);

        $commitment = $this->commitments->reserve([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
            'confirm' => $data['confirm'] ?? true,
        ], $request->user());

        return response()->json(['success' => true, 'data' => $commitment], 201);
    }

    public function confirm(Request $request, BudgetReservation $commitment): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertCommitmentTenant($request, $commitment);
        $commitment = $this->commitments->confirm($commitment, $request->user(), $request->input('reason'));

        return response()->json(['success' => true, 'data' => $commitment]);
    }

    public function adjust(Request $request, BudgetReservation $commitment): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertCommitmentTenant($request, $commitment);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0'],
            'reason' => ['nullable', 'string'],
        ]);
        $commitment = $this->commitments->adjust($commitment, (float) $data['amount'], $request->user(), $data['reason'] ?? null);

        return response()->json(['success' => true, 'data' => $commitment]);
    }

    public function transfer(Request $request, BudgetReservation $commitment): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertCommitmentTenant($request, $commitment);
        $data = $request->validate([
            'source_type' => ['required', 'string', 'max:40'],
            'source_id' => ['required', 'integer'],
            'source_key' => ['required', 'string', 'max:120'],
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'budget_line_id' => ['nullable', 'integer', 'exists:budget_lines,id'],
            'currency' => ['nullable', 'string', 'size:3'],
            'notes' => ['nullable', 'string'],
            'idempotency_key' => ['nullable', 'string', 'max:120'],
            'programme_id' => ['nullable', 'integer'],
            'procurement_request_id' => ['nullable', 'integer'],
            'travel_request_id' => ['nullable', 'integer'],
        ]);

        $child = $this->commitments->transfer($commitment, $data, $request->user());

        return response()->json(['success' => true, 'data' => $child], 201);
    }

    public function release(Request $request, BudgetReservation $commitment): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertCommitmentTenant($request, $commitment);
        $commitment = $this->commitments->release($commitment, $request->user(), $request->input('reason'));

        return response()->json(['success' => true, 'data' => $commitment]);
    }

    public function consume(Request $request, BudgetReservation $commitment): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $this->assertCommitmentTenant($request, $commitment);
        $data = $request->validate([
            'amount' => ['required', 'numeric', 'min:0.01'],
            'reason' => ['nullable', 'string'],
        ]);
        $commitment = $this->commitments->consume($commitment, (float) $data['amount'], $request->user(), $data['reason'] ?? null);

        return response()->json(['success' => true, 'data' => $commitment]);
    }

    public function postActual(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $data = $request->validate([
            'budget_line_id' => ['required', 'integer', 'exists:budget_lines,id'],
            'accounting_reference' => ['required', 'string', 'max:120'],
            'transaction_date' => ['required', 'date'],
            'amount' => ['required', 'numeric', 'min:0.01'],
            'currency' => ['nullable', 'string', 'size:3'],
            'posting_date' => ['nullable', 'date'],
            'vendor_payee' => ['nullable', 'string', 'max:255'],
            'description' => ['nullable', 'string'],
            'financial_year_id' => ['nullable', 'integer'],
        ]);

        $line = BudgetLine::findOrFail($data['budget_line_id']);
        $this->assertLineTenant($request, $line);

        $actual = $this->actuals->post([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
        ], $request->user());

        return response()->json(['success' => true, 'data' => $actual], 201);
    }

    public function importActuals(Request $request): JsonResponse
    {
        $this->authorizeFinanceWrite($request);
        $request->validate(['file' => ['required', 'file', 'mimes:csv,txt']]);

        $result = $this->actuals->importCsv(
            $request->file('file'),
            (int) $request->user()->tenant_id,
            $request->user(),
        );

        return response()->json(['success' => true, 'data' => $result]);
    }

    private function authorizeFinanceWrite(Request $request): void
    {
        $user = $request->user();
        if (
            ! $user->can('finance.create')
            && ! $user->can('finance.admin')
            && ! $user->can('procurement.manage_budget')
            && ! $user->hasRole('Finance Controller')
        ) {
            abort(403);
        }
    }

    private function assertLineTenant(Request $request, BudgetLine $line): void
    {
        $line->loadMissing('budget');
        if ((int) $line->budget?->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }

    private function assertCommitmentTenant(Request $request, BudgetReservation $commitment): void
    {
        if ((int) $commitment->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
