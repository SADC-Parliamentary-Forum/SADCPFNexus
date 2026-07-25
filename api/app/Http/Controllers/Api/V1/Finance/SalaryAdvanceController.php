<?php

namespace App\Http\Controllers\Api\V1\Finance;

use App\Http\Controllers\Controller;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use App\Modules\Finance\Services\SalaryAdvanceService;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use App\Support\AuthorizesCertificates;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class SalaryAdvanceController extends Controller
{
    use AuthorizesCertificates;

    public function __construct(
        protected NotificationService $notificationService,
        protected WorkflowService $workflowService,
        protected SalaryAdvanceService $salaryAdvanceService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $filters = $request->only(['status', 'per_page', 'queue']);
        $query = SalaryAdvanceRequest::with(['requester', 'balanceRegister'])->orderByDesc('created_at');

        $canQueue = $this->salaryAdvanceService->hasSalaryAdvancePermission($user, 'salary_advance.view')
            || $this->salaryAdvanceService->hasSalaryAdvancePermission($user, 'salary_advance.certify')
            || $user->hasAnyRole(['Finance Controller', 'Secretary General', 'Director']);

        $queue = $filters['queue'] ?? null;

        // Employee history: own closed/recovered/rejected advances
        if ($queue === 'history') {
            $query->where('requester_id', $user->id)
                ->whereIn('status', ['closed', 'recovered', 'rejected', 'withdrawn', 'cancelled', 'not_eligible']);
        } elseif ($queue === 'mine' || ($queue === null && !$canQueue)) {
            $query->where('requester_id', $user->id);
        } elseif (!empty($queue) && $canQueue) {
            match ($queue) {
                'certify' => $query->whereIn('status', ['submitted', 'resubmitted']),
                'pending_approval' => $query->whereIn('status', ['finance_certified']),
                'payment' => $query->whereIn('status', ['approved_for_payment', 'approved']),
                'recovery' => $query->whereIn('status', ['paid', 'recovery_scheduled', 'reconciliation_required']),
                'reconciliation' => $query->where('status', 'reconciliation_required'),
                'outstanding' => $query->whereHas('balanceRegister', function ($q) {
                    $q->where('module_type', 'salary_advance')
                        ->where('status', '!=', 'closed')
                        ->where('balance', '>', 0);
                }),
                'register' => $query, // full tenant register
                default => null,
            };
            $query->where('tenant_id', $user->tenant_id);
        } else {
            $query->where('requester_id', $user->id);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        return response()->json($query->paginate($filters['per_page'] ?? 20));
    }

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->salaryAdvanceService->financeDashboard($request->user()),
        ]);
    }

    public function employeeSummary(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->salaryAdvanceService->employeeSummary($request->user()),
        ]);
    }

    public function reconciliations(Request $request): JsonResponse
    {
        return response()->json(
            $this->salaryAdvanceService->listReconciliations(
                $request->user(),
                $request->only(['status', 'per_page'])
            )
        );
    }

    public function resolveReconciliation(
        Request $request,
        SalaryAdvanceRequest $salaryAdvanceRequest,
        int $reconciliation
    ): JsonResponse {
        abort_unless(
            $this->salaryAdvanceService->canAccessAdvance($request->user(), $salaryAdvanceRequest),
            403
        );

        $data = $request->validate([
            'resolution_notes' => ['required', 'string', 'max:2000'],
            'outcome'          => ['nullable', 'string', 'in:balanced,written_off,adjusted,other'],
        ]);

        $recon = \App\Models\SalaryAdvanceReconciliation::findOrFail($reconciliation);
        $resolved = $this->salaryAdvanceService->resolveReconciliation(
            $salaryAdvanceRequest,
            $recon,
            $request->user(),
            $data
        );

        return response()->json(['message' => 'Reconciliation resolved.', 'data' => $resolved]);
    }

    public function policies(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->salaryAdvanceService->listPolicies($request->user()),
        ]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        $data = $request->validate([
            'version'                        => ['required', 'string', 'max:32'],
            'effective_from'                 => ['required', 'date'],
            'effective_to'                   => ['nullable', 'date', 'after:effective_from'],
            'max_salary_percentage'          => ['nullable', 'numeric', 'min:1', 'max:100'],
            'salary_basis'                   => ['nullable', 'string', 'in:net_confirmed,gross,basic'],
            'max_concurrent_advances'        => ['nullable', 'integer', 'min:1', 'max:1'],
            'full_repayment_required'        => ['nullable', 'boolean'],
            'recovery_rule'                  => ['nullable', 'string', 'in:full_eom'],
            'final_approver_role'            => ['nullable', 'string', 'max:64'],
            'finance_certification_required' => ['nullable', 'boolean'],
            'admin_review_required'          => ['nullable', 'boolean'],
            'change_reason'                  => ['required', 'string', 'max:500'],
            'configuration'                  => ['nullable', 'array'],
        ]);

        // v1 lock: do not allow enabling consolidation via policy UI
        $data['max_concurrent_advances'] = 1;
        $data['salary_basis'] = $data['salary_basis'] ?? 'net_confirmed';
        if (($data['salary_basis'] ?? '') !== 'net_confirmed') {
            // Accept storage of future basis values only when explicitly admin — still lock runtime to net in Phase 2
            $data['salary_basis'] = 'net_confirmed';
        }
        $data['recovery_rule'] = 'full_eom';
        $data['full_repayment_required'] = true;

        $policy = $this->salaryAdvanceService->createPolicyVersion($request->user(), $data);

        return response()->json(['message' => 'New policy version activated.', 'data' => $policy], 201);
    }

    public function payrollIntegration(Request $request): JsonResponse
    {
        abort_unless(
            $this->salaryAdvanceService->hasSalaryAdvancePermission($request->user(), 'salary_advance.view')
                || $request->user()->hasRole('Finance Controller'),
            403
        );

        return response()->json([
            'data' => $this->salaryAdvanceService->payrollIntegrationStub(),
        ]);
    }

    public function policyExceptions(Request $request): JsonResponse
    {
        return response()->json(
            $this->salaryAdvanceService->listPolicyExceptions(
                $request->user(),
                $request->only(['status', 'employee_id', 'per_page'])
            )
        );
    }

    public function storePolicyException(Request $request): JsonResponse
    {
        $data = $request->validate([
            'employee_id'       => ['required', 'integer', 'exists:users,id'],
            'exception_type'    => ['required', 'string', 'in:outstanding_balance,max_percentage,concurrent,other'],
            'reason'            => ['required', 'string', 'max:500'],
            'justification'     => ['required', 'string', 'max:5000'],
            'effective_from'    => ['required', 'date'],
            'effective_to'      => ['nullable', 'date', 'after_or_equal:effective_from'],
            'linked_advance_id' => ['nullable', 'integer', 'exists:salary_advance_requests,id'],
            'policy_version_id' => ['nullable', 'integer', 'exists:salary_advance_policy_versions,id'],
        ]);

        $exception = $this->salaryAdvanceService->createPolicyException($request->user(), $data);

        return response()->json([
            'message' => 'Policy exception recorded (pending approval). Does not silently override eligibility.',
            'data'    => $exception,
        ], 201);
    }

    public function approvePolicyException(Request $request, int $exception): JsonResponse
    {
        $model = \App\Models\SalaryAdvancePolicyException::findOrFail($exception);
        $data = $request->validate([
            'decision_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $approved = $this->salaryAdvanceService->approvePolicyException($model, $request->user(), $data);

        return response()->json([
            'message' => 'Policy exception approved. Eligibility rules remain enforced unless a future controlled apply path is used.',
            'data'    => $approved,
        ]);
    }

    public function revokePolicyException(Request $request, int $exception): JsonResponse
    {
        $model = \App\Models\SalaryAdvancePolicyException::findOrFail($exception);
        $data = $request->validate([
            'decision_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $revoked = $this->salaryAdvanceService->revokePolicyException($model, $request->user(), $data);

        return response()->json([
            'message' => 'Policy exception revoked.',
            'data'    => $revoked,
        ]);
    }

    public function eligibility(Request $request): JsonResponse
    {
        return response()->json($this->salaryAdvanceService->eligibility($request->user()));
    }

    public function show(SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        abort_unless(
            $this->salaryAdvanceService->canAccessAdvance(request()->user(), $salaryAdvanceRequest),
            403
        );

        return response()->json(['data' => $salaryAdvanceRequest->load([
            'requester', 'approver', 'payslip', 'policyVersion',
            'financeReviews.reviewer', 'financeCertifiedBy',
            'approvalRequest.workflow.steps',
            'approvalRequest.history.user',
            'balanceRegister.transactions',
            'personnelFile', 'personnelFileDocument',
        ])]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'advance_type'                  => ['required', 'string', 'in:rental,medical,school,funeral,other'],
            'amount'                        => ['required', 'numeric', 'min:1'],
            'currency'                      => ['nullable', 'string', 'size:3'],
            'repayment_months'              => ['nullable', 'integer', 'min:1', 'max:24'],
            'purpose'                       => ['required', 'string', 'max:500'],
            'justification'                 => ['required', 'string', 'max:2000'],
            'deduction_authority_confirmed' => ['nullable', 'boolean'],
        ]);

        $user = $request->user();
        $policy = $this->salaryAdvanceService->activePolicy($user->tenant_id);
        $repaymentMonths = $policy->recovery_rule === 'full_eom' ? 1 : ($data['repayment_months'] ?? 1);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id'                        => $user->tenant_id,
            'requester_id'                     => $user->id,
            'reference_number'                 => 'ADV-' . strtoupper(Str::random(8)),
            'advance_type'                     => $data['advance_type'],
            'amount'                           => $data['amount'],
            'currency'                         => $data['currency'] ?? 'NAD',
            'repayment_months'                 => $repaymentMonths,
            'purpose'                          => $data['purpose'],
            'justification'                    => $data['justification'],
            'status'                           => 'draft',
            'deduction_authority_confirmed'    => (bool) ($data['deduction_authority_confirmed'] ?? false),
            'deduction_authority_version'      => !empty($data['deduction_authority_confirmed'])
                ? SalaryAdvanceRequest::DEDUCTION_AUTHORITY_VERSION
                : null,
            'deduction_authority_confirmed_at' => !empty($data['deduction_authority_confirmed']) ? now() : null,
            'policy_version_id'                => $policy->id,
            'salary_basis'                     => $policy->salary_basis,
        ]);

        return response()->json(['message' => 'Salary advance request created.', 'data' => $advance->load('requester')], 201);
    }

    public function update(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if ($salaryAdvanceRequest->requester_id !== $request->user()->id) {
            abort(403);
        }
        if (!in_array($salaryAdvanceRequest->status, ['draft', 'finance_returned', 'returned_for_correction'], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft or returned requests can be edited.']);
        }

        $data = $request->validate([
            'advance_type'                  => ['sometimes', 'string', 'in:rental,medical,school,funeral,other'],
            'amount'                        => ['sometimes', 'numeric', 'min:1'],
            'repayment_months'              => ['sometimes', 'integer', 'min:1', 'max:24'],
            'purpose'                       => ['sometimes', 'string', 'max:500'],
            'justification'                 => ['sometimes', 'string', 'max:2000'],
            'deduction_authority_confirmed' => ['sometimes', 'boolean'],
        ]);

        $policy = $this->salaryAdvanceService->activePolicy($request->user()->tenant_id);
        if ($policy->recovery_rule === 'full_eom') {
            $data['repayment_months'] = 1;
        }

        if (array_key_exists('deduction_authority_confirmed', $data) && $data['deduction_authority_confirmed']) {
            $data['deduction_authority_version'] = SalaryAdvanceRequest::DEDUCTION_AUTHORITY_VERSION;
            $data['deduction_authority_confirmed_at'] = now();
        }

        $salaryAdvanceRequest->update(array_filter($data, fn ($v) => $v !== null));

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
        $data = $request->validate([
            'deduction_authority_confirmed' => ['nullable', 'boolean'],
        ]);

        $advance = $this->salaryAdvanceService->submit(
            $salaryAdvanceRequest,
            $request->user(),
            (bool) ($data['deduction_authority_confirmed'] ?? false)
        );

        return response()->json(['message' => 'Submitted.', 'data' => $advance]);
    }

    public function financeCertify(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'confirmed_net_salary'           => ['required', 'numeric', 'min:0'],
            'confirmed_gross_salary'         => ['nullable', 'numeric', 'min:0'],
            'recommended_amount'             => ['nullable', 'numeric', 'min:1'],
            'intended_recovery_payroll_date' => ['required', 'date'],
            'eligible'                       => ['required', 'boolean'],
            'comments'                       => ['nullable', 'string', 'max:2000'],
            'worksheet'                      => ['nullable', 'array'],
        ]);

        if (!$data['eligible']) {
            throw ValidationException::withMessages([
                'eligible' => ['Use mark-not-eligible when the applicant is not eligible.'],
            ]);
        }

        $advance = $this->salaryAdvanceService->financeCertify($salaryAdvanceRequest, $request->user(), $data);

        return response()->json(['message' => 'Finance certified.', 'data' => $advance]);
    }

    public function financeReturn(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'reason'  => ['required', 'string', 'max:2000'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $advance = $this->salaryAdvanceService->financeReturn(
            $salaryAdvanceRequest,
            $request->user(),
            $data['reason'] ?? $data['comment']
        );

        return response()->json(['message' => 'Returned to requester.', 'data' => $advance]);
    }

    public function markNotEligible(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);

        $advance = $this->salaryAdvanceService->markNotEligible(
            $salaryAdvanceRequest,
            $request->user(),
            $data['reason']
        );

        return response()->json(['message' => 'Marked not eligible.', 'data' => $advance]);
    }

    public function approve(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'comment'          => ['nullable', 'string', 'max:1000'],
            'approved_amount'  => ['nullable', 'numeric', 'min:0'],
        ]);

        if ($salaryAdvanceRequest->approvalRequest) {
            if (isset($data['approved_amount'])) {
                $this->applyApprovedAmount($salaryAdvanceRequest, (float) $data['approved_amount']);
            }
            $result = $this->workflowService->approve(
                $salaryAdvanceRequest->approvalRequest,
                $request->user(),
                $data['comment'] ?? null
            );

            return response()->json([
                'message'            => 'Approved.',
                'data'               => $salaryAdvanceRequest->fresh(['requester', 'approver', 'approvalRequest']),
                'notified_approvers' => $result['notified_approvers'],
            ]);
        }

        // Legacy direct-approval path when no workflow is configured.
        $this->authorizeLegacySalaryAdvanceAction($request->user(), $salaryAdvanceRequest);

        $policy = $this->salaryAdvanceService->activePolicy($salaryAdvanceRequest->tenant_id);
        if ($policy->finance_certification_required
            && !in_array($salaryAdvanceRequest->status, ['finance_certified'], true)) {
            throw ValidationException::withMessages([
                'status' => ['Finance certification is required before final approval.'],
            ]);
        }

        if (!in_array($salaryAdvanceRequest->status, ['submitted', 'finance_certified', 'resubmitted'], true)) {
            throw ValidationException::withMessages(['status' => 'Request cannot be approved in its current status.']);
        }
        if ((int) $salaryAdvanceRequest->requester_id === (int) $request->user()->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request.',
            ]);
        }

        if (isset($data['approved_amount'])) {
            $this->applyApprovedAmount($salaryAdvanceRequest, (float) $data['approved_amount']);
        }

        $salaryAdvanceRequest->onWorkflowApproved($request->user());

        return response()->json([
            'message' => 'Approved.',
            'data'    => $salaryAdvanceRequest->fresh(['requester', 'approver']),
        ]);
    }

    public function reject(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'reason'  => ['nullable', 'string', 'max:1000'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $reason = $data['reason'] ?? $data['comment'] ?? null;
        if (!$reason) {
            throw ValidationException::withMessages(['comment' => ['The comment field is required.']]);
        }

        if ($salaryAdvanceRequest->approvalRequest) {
            $this->workflowService->reject($salaryAdvanceRequest->approvalRequest, $request->user(), $reason);

            return response()->json([
                'message' => 'Rejected.',
                'data'    => $salaryAdvanceRequest->fresh(['requester', 'approvalRequest']),
            ]);
        }

        $this->authorizeLegacySalaryAdvanceAction($request->user(), $salaryAdvanceRequest);

        if (!in_array($salaryAdvanceRequest->status, ['submitted', 'finance_certified', 'resubmitted'], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted or certified requests can be rejected.']);
        }
        if ((int) $salaryAdvanceRequest->requester_id === (int) $request->user()->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot reject your own request.',
            ]);
        }
        $salaryAdvanceRequest->onWorkflowRejected($request->user(), $reason);

        return response()->json(['message' => 'Rejected.', 'data' => $salaryAdvanceRequest->fresh('requester')]);
    }

    public function returnForCorrection(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']]);
        abort_unless($salaryAdvanceRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->returnForCorrection(
            $salaryAdvanceRequest->approvalRequest,
            $request->user(),
            $data['comment']
        );

        return response()->json([
            'message' => 'Request returned to requester for correction.',
            'data'    => $salaryAdvanceRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function withdraw(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        abort_unless($salaryAdvanceRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->withdraw($salaryAdvanceRequest->approvalRequest, $request->user());

        return response()->json([
            'message' => 'Salary advance request withdrawn.',
            'data'    => $salaryAdvanceRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function resubmit(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        if (in_array($salaryAdvanceRequest->status, ['finance_returned', 'returned_for_correction'], true)
            && !$salaryAdvanceRequest->approvalRequest) {
            $data = $request->validate([
                'deduction_authority_confirmed' => ['nullable', 'boolean'],
            ]);
            $advance = $this->salaryAdvanceService->submit(
                $salaryAdvanceRequest,
                $request->user(),
                (bool) ($data['deduction_authority_confirmed'] ?? $salaryAdvanceRequest->deduction_authority_confirmed)
            );

            return response()->json(['message' => 'Salary advance request resubmitted.', 'data' => $advance]);
        }

        abort_unless($salaryAdvanceRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->resubmit($salaryAdvanceRequest->approvalRequest, $request->user());

        return response()->json([
            'message' => 'Salary advance request resubmitted.',
            'data'    => $salaryAdvanceRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function recordPayment(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'payment_reference' => ['required', 'string', 'max:100'],
            'payment_method'    => ['required', 'string', 'max:64'],
            'payment_date'      => ['nullable', 'date'],
        ]);

        $advance = $this->salaryAdvanceService->recordPayment($salaryAdvanceRequest, $request->user(), $data);

        return response()->json(['message' => 'Payment recorded.', 'data' => $advance]);
    }

    public function scheduleRecovery(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'intended_recovery_payroll_date' => ['nullable', 'date'],
        ]);

        $advance = $this->salaryAdvanceService->scheduleRecovery($salaryAdvanceRequest, $request->user(), $data);

        return response()->json(['message' => 'Recovery scheduled.', 'data' => $advance]);
    }

    public function recordRecovery(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $data = $request->validate([
            'amount'        => ['required', 'numeric', 'min:0.01'],
            'reference_doc' => ['required', 'string', 'max:120'],
            'notes'         => ['nullable', 'string', 'max:2000'],
        ]);

        $advance = $this->salaryAdvanceService->recordRecovery($salaryAdvanceRequest, $request->user(), $data);

        return response()->json(['message' => 'Recovery recorded.', 'data' => $advance]);
    }

    public function close(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $advance = $this->salaryAdvanceService->close($salaryAdvanceRequest, $request->user());

        return response()->json(['message' => 'Advance closed.', 'data' => $advance]);
    }

    public function ledger(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        abort_unless(
            $this->salaryAdvanceService->canAccessAdvance($request->user(), $salaryAdvanceRequest),
            403
        );

        return response()->json(['data' => $this->salaryAdvanceService->ledger($salaryAdvanceRequest)]);
    }

    public function pdf(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): Response
    {
        abort_unless(
            $this->salaryAdvanceService->canAccessAdvance($request->user(), $salaryAdvanceRequest),
            403
        );

        $pdf = $this->salaryAdvanceService->form002Pdf($salaryAdvanceRequest);

        return $pdf->download('FORM-002-' . $salaryAdvanceRequest->reference_number . '.pdf');
    }

    public function certificate(Request $request, SalaryAdvanceRequest $salaryAdvanceRequest): JsonResponse
    {
        $this->authorizeCertificateView($request->user(), $salaryAdvanceRequest, [
            'Finance Controller',
            'Secretary General',
            'Director',
            'System Admin',
            'System Administrator',
        ]);

        return response()->json([
            'data' => $salaryAdvanceRequest->load([
                'requester.department',
                'approvalRequest.history.user',
                'approvalRequest.workflow.steps',
            ]),
        ]);
    }

    private function applyApprovedAmount(SalaryAdvanceRequest $advance, float $approvedAmount): void
    {
        $max = (float) ($advance->max_eligible_amount ?? $advance->amount);
        if ($approvedAmount > $max + 0.00001) {
            throw ValidationException::withMessages([
                'approved_amount' => ['Approved amount cannot exceed policy maximum of ' . number_format($max, 2) . '.'],
            ]);
        }
        $advance->update(['approved_amount' => $approvedAmount, 'amount' => $approvedAmount]);
    }

    private function authorizeLegacySalaryAdvanceAction(User $actor, SalaryAdvanceRequest $advance): void
    {
        if ((int) $advance->requester_id === (int) $actor->id) {
            abort(403, 'You cannot act on your own salary advance.');
        }

        $allowed = $actor->isSystemAdmin()
            || $this->salaryAdvanceService->hasSalaryAdvancePermission($actor, 'salary_advance.approve')
            || $actor->hasAnyRole(['Finance Controller', 'Secretary General', 'Director']);

        abort_unless($allowed, 403, 'Only authorised approvers may approve salary advances when no workflow is configured.');
    }
}
