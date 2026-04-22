<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\BalanceRegister;
use App\Models\BalanceTransaction;
use App\Modules\Finance\Services\BalanceRegisterService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class BalanceRegisterController extends Controller
{
    public function __construct(protected BalanceRegisterService $service) {}

    public function dashboard(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json(['data' => $this->service->dashboard($user)]);
    }

    public function exceptions(Request $request): JsonResponse
    {
        $user   = $request->user();
        $result = $this->service->exceptions($user);
        return response()->json($result);
    }

    public function index(Request $request): JsonResponse
    {
        $user    = $request->user();
        $filters = $request->only(['module_type', 'status', 'employee_id', 'per_page']);
        $result  = $this->service->list($filters, $user);
        return response()->json($result);
    }

    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'module_type'        => 'required|in:salary_advance,imprest',
            'employee_id'        => 'required|integer|exists:users,id',
            'source_request_id'  => 'required|integer',
            'approved_amount'    => 'required|numeric|min:0.01',
            'installment_amount' => 'nullable|numeric|min:0.01',
            'recovery_start_date'=> 'nullable|date',
            'estimated_payoff_date' => 'nullable|date',
        ]);

        $register = $this->service->createManual($request->all(), $request->user());
        return response()->json(['data' => $register, 'message' => 'Balance register created.'], 201);
    }

    public function show(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);
        $balanceRegister->load([
            'employee', 'createdBy', 'lockedBy',
            'transactions.createdBy', 'transactions.verification.verifier',
            'transactions.acknowledgement',
            'acknowledgements.employee',
        ]);
        return response()->json(['data' => $balanceRegister]);
    }

    public function update(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);
        abort_if($balanceRegister->isLocked(), 422, 'Register is locked and cannot be modified.');

        $request->validate([
            'recovery_start_date'   => 'nullable|date',
            'estimated_payoff_date' => 'nullable|date',
            'installment_amount'    => 'nullable|numeric|min:0',
        ]);

        $balanceRegister->update($request->only(['recovery_start_date', 'estimated_payoff_date', 'installment_amount']));
        return response()->json(['data' => $balanceRegister->fresh(), 'message' => 'Register updated.']);
    }

    public function lock(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);
        $register = $this->service->lockPeriod($balanceRegister, $request->user());
        return response()->json(['data' => $register, 'message' => 'Register period locked.']);
    }

    public function unlock(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);
        $register = $this->service->unlockPeriod($balanceRegister, $request->user());
        return response()->json(['data' => $register, 'message' => 'Register period unlocked.']);
    }

    public function acknowledge(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);

        $request->validate([
            'status'         => 'required|in:confirmed,disputed',
            'dispute_reason' => 'nullable|string|max:1000',
        ]);

        $ack = $this->service->acknowledge($balanceRegister, $request->only(['status', 'dispute_reason']), $request->user());
        return response()->json(['data' => $ack, 'message' => 'Acknowledgement recorded.']);
    }

    public function transactions(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);

        $txns = $balanceRegister->transactions()
            ->with(['createdBy', 'verification.verifier', 'acknowledgement.employee'])
            ->paginate($request->integer('per_page', 20));

        return response()->json($txns);
    }

    public function storeTransaction(Request $request, BalanceRegister $balanceRegister): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);

        $request->validate([
            'type'                    => 'required|in:disbursement,recovery,adjustment,write_off',
            'amount'                  => 'required|numeric|min:0.01',
            'reference_doc'           => 'nullable|string|max:200',
            'notes'                   => 'nullable|string|max:2000',
            'supporting_document_path'=> 'nullable|string|max:500',
        ]);

        $txn = $this->service->createTransaction($balanceRegister, $request->all(), $request->user());
        return response()->json(['data' => $txn, 'message' => 'Transaction recorded and pending verification.'], 201);
    }

    public function getVerification(Request $request, BalanceRegister $balanceRegister, BalanceTransaction $balanceTransaction): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);
        abort_if((int) $balanceTransaction->register_id !== (int) $balanceRegister->id, 404);

        $balanceTransaction->load(['register', 'createdBy', 'verification.verifier', 'acknowledgement']);
        return response()->json(['data' => $balanceTransaction]);
    }

    public function storeVerification(Request $request, BalanceRegister $balanceRegister, BalanceTransaction $balanceTransaction): JsonResponse
    {
        abort_if((int) $balanceRegister->tenant_id !== (int) $request->user()->tenant_id, 403);
        abort_if((int) $balanceTransaction->register_id !== (int) $balanceRegister->id, 404);

        $request->validate([
            'status'   => 'required|in:approved,rejected,correction_requested',
            'comments' => 'nullable|string|max:1000',
        ]);

        $verification = $this->service->verifyTransaction($balanceTransaction, $request->only(['status', 'comments']), $request->user());
        return response()->json(['data' => $verification, 'message' => 'Verification recorded.']);
    }
}
