<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\EmployeeSalaryAssignment;
use App\Models\Payslip;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalaryAdvanceController extends Controller
{
    public function __construct(
        protected NotificationService $notificationService,
        protected WorkflowService     $workflowService,
    ) {}
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

    public function eligibility(Request $request): JsonResponse
    {
        $user = $request->user();
        $payslip = Payslip::where('user_id', $user->id)
            ->where('confirmation_status', 'confirmed')
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->first();

        if (!$payslip) {
            return response()->json([
                'eligible'     => false,
                'reason'       => 'no_confirmed_payslip',
                'net_salary'   => null,
                'gross_salary' => null,
                'max_eligible' => null,
                'payslip'      => null,
            ]);
        }

        $maxEligible = round((float) $payslip->net_amount * 0.5, 2);

        return response()->json([
            'eligible'     => true,
            'net_salary'   => (float) $payslip->net_amount,
            'gross_salary' => (float) $payslip->gross_amount,
            'max_eligible' => $maxEligible,
            'payslip'      => [
                'id'           => $payslip->id,
                'period_month' => $payslip->period_month,
                'period_year'  => $payslip->period_year,
                'currency'     => $payslip->currency,
            ],
        ]);
    }

    public function show(SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->requester_id !== request()->user()->id) {
            abort(403);
        }
        return response()->json(['data' => $salaryAdvanceRequest->load(['requester', 'approver', 'payslip'])]);
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
        $salaryAdvanceRequest->forceDelete();
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

        $user = $request->user();

        // Block submission when an approved (outstanding) advance already exists.
        $hasOutstanding = SalaryAdvanceRequest::where('requester_id', $user->id)
            ->where('status', 'approved')
            ->where('id', '!=', $salaryAdvanceRequest->id)
            ->exists();
        if ($hasOutstanding) {
            throw ValidationException::withMessages([
                'advance' => ['You have an outstanding salary advance that must be fully repaid before submitting a new request.'],
            ]);
        }

        // Enforce 50% of confirmed net salary cap.
        $payslip = Payslip::where('user_id', $user->id)
            ->where('confirmation_status', 'confirmed')
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->first();

        if (!$payslip) {
            throw ValidationException::withMessages([
                'amount' => ['No confirmed payslip on file. Please contact HR to confirm your salary before submitting an advance request.'],
            ]);
        }

        $maxEligible = round((float) $payslip->net_amount * 0.5, 2);

        if ((float) $salaryAdvanceRequest->amount > $maxEligible) {
            throw ValidationException::withMessages([
                'amount' => [
                    'The advance amount exceeds 50% of your confirmed net salary. Maximum eligible: '
                    . $salaryAdvanceRequest->currency . ' ' . number_format($maxEligible, 2) . '.',
                ],
            ]);
        }

        // Store salary snapshot for audit.
        $salaryAdvanceRequest->update([
            'payslip_id'             => $payslip->id,
            'net_salary_at_request'  => (float) $payslip->net_amount,
            'gross_salary_at_request'=> (float) $payslip->gross_amount,
            'max_eligible_amount'    => $maxEligible,
            'eligibility_status'     => 'eligible',
            'status'                 => 'submitted',
            'submitted_at'           => now(),
        ]);

        // Initiate workflow — will notify first-step approvers with email action buttons.
        $this->workflowService->initiate($salaryAdvanceRequest, 'salary_advance', $request->user());

        return response()->json(['message' => 'Submitted.', 'data' => $salaryAdvanceRequest->fresh('requester')]);
    }

    public function approve(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($request->user()->hasRole('staff')) {
            abort(403);
        }
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

        $salaryAdvanceRequest->loadMissing('requester');
        if ($salaryAdvanceRequest->requester) {
            $this->notificationService->dispatch(
                $salaryAdvanceRequest->requester,
                'salary_advance.approved',
                [
                    'name'      => $salaryAdvanceRequest->requester->name,
                    'reference' => $salaryAdvanceRequest->reference_number,
                    'amount'    => number_format((float) $salaryAdvanceRequest->amount, 2) . ' ' . $salaryAdvanceRequest->currency,
                ],
                ['module' => 'salary_advance', 'record_id' => $salaryAdvanceRequest->id, 'url' => '/finance/salary-advance/' . $salaryAdvanceRequest->id]
            );
        }

        return response()->json(['message' => 'Approved.', 'data' => $salaryAdvanceRequest->fresh(['requester', 'approver'])]);
    }

    public function reject(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($request->user()->hasRole('staff')) {
            abort(403);
        }
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $reason = $data['reason'] ?? $data['comment'] ?? null;
        if (!$reason) {
            throw ValidationException::withMessages(['comment' => ['The comment field is required.']]);
        }
        if ($salaryAdvanceRequest->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }
        $salaryAdvanceRequest->update([
            'status'            => 'rejected',
            'rejection_reason'  => $reason,
        ]);

        $salaryAdvanceRequest->loadMissing('requester');
        if ($salaryAdvanceRequest->requester) {
            $this->notificationService->dispatch(
                $salaryAdvanceRequest->requester,
                'salary_advance.rejected',
                [
                    'name'      => $salaryAdvanceRequest->requester->name,
                    'reference' => $salaryAdvanceRequest->reference_number,
                    'comment'   => $reason,
                ],
                ['module' => 'salary_advance', 'record_id' => $salaryAdvanceRequest->id, 'url' => '/finance/salary-advance/' . $salaryAdvanceRequest->id]
            );
        }

        return response()->json(['message' => 'Rejected.', 'data' => $salaryAdvanceRequest->fresh('requester')]);
    }
}
