<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalaryAdvanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'per_page']);
        $query = SalaryAdvanceRequest::with(['requester'])
            ->where('requester_id', $request->user()->id)
            ->orderByDesc('created_at');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        $paginated = $query->paginate($filters['per_page'] ?? 20);
        return response()->json($paginated);
    }

    public function show(SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->requester_id !== request()->user()->id) {
            abort(403);
        }
        return response()->json($salaryAdvanceRequest->load(['requester', 'approver']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'advance_type'      => ['required', 'string', 'in:rental,medical,school,funeral,other'],
            'amount'            => ['required', 'numeric', 'min:1'],
            'currency'          => ['nullable', 'string', 'size:3'],
            'repayment_months'  => ['nullable', 'integer', 'min:1', 'max:24'],
            'purpose'           => ['required', 'string', 'max:500'],
            'justification'     => ['required', 'string', 'max:2000'],
        ]);

        $user = $request->user();
        $advance = SalaryAdvanceRequest::create([
            'tenant_id'         => $user->tenant_id,
            'requester_id'      => $user->id,
            'reference_number'  => 'ADV-' . strtoupper(Str::random(8)),
            'advance_type'      => $data['advance_type'],
            'amount'            => $data['amount'],
            'currency'          => $data['currency'] ?? 'NAD',
            'repayment_months'  => $data['repayment_months'] ?? 6,
            'purpose'           => $data['purpose'],
            'justification'     => $data['justification'],
            'status'            => 'draft',
        ]);

        return response()->json(['message' => 'Salary advance request created.', 'data' => $advance->load('requester')], 201);
    }

    public function update(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->requester_id !== $request->user()->id) {
            abort(403);
        }
        if ($salaryAdvanceRequest->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        $data = $request->validate([
            'advance_type'     => ['sometimes', 'string', 'in:rental,medical,school,funeral,other'],
            'amount'           => ['sometimes', 'numeric', 'min:1'],
            'repayment_months'  => ['sometimes', 'integer', 'min:1', 'max:24'],
            'purpose'           => ['sometimes', 'string', 'max:500'],
            'justification'     => ['sometimes', 'string', 'max:2000'],
        ]);

        $salaryAdvanceRequest->update(array_filter($data, fn($v) => $v !== null));
        return response()->json(['message' => 'Updated.', 'data' => $salaryAdvanceRequest->fresh('requester')]);
    }

    public function destroy(SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->requester_id !== request()->user()->id) {
            abort(403);
        }
        if ($salaryAdvanceRequest->status !== 'draft') {
            return response()->json(['message' => 'Only draft requests can be deleted.'], 422);
        }
        $salaryAdvanceRequest->delete();
        return response()->json(['message' => 'Deleted.']);
    }

    public function submit(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->requester_id !== $request->user()->id) {
            abort(403);
        }
        if ($salaryAdvanceRequest->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }
        $salaryAdvanceRequest->update(['status' => 'submitted', 'submitted_at' => now()]);
        return response()->json(['message' => 'Submitted.', 'data' => $salaryAdvanceRequest->fresh('requester')]);
    }

    public function approve(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }
        if ((int) $salaryAdvanceRequest->requester_id === (int) $request->user()->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request. Requests must go through the workflow before the Secretary General approves.',
            ]);
        }
        $salaryAdvanceRequest->update([
            'status'      => 'approved',
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
        ]);
        return response()->json(['message' => 'Approved.', 'data' => $salaryAdvanceRequest->fresh(['requester', 'approver'])]);
    }

    public function reject(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        if ($salaryAdvanceRequest->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }
        $salaryAdvanceRequest->update([
            'status'            => 'rejected',
            'rejection_reason'  => $data['reason'],
        ]);
        return response()->json(['message' => 'Rejected.', 'data' => $salaryAdvanceRequest->fresh('requester')]);
    }
}
