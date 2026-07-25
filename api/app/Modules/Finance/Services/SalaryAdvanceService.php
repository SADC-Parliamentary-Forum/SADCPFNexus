<?php

namespace App\Modules\Finance\Services;

use App\Models\BalanceRegister;
use App\Models\Payslip;
use App\Models\SalaryAdvanceFinanceReview;
use App\Models\SalaryAdvancePolicyVersion;
use App\Models\SalaryAdvanceRequest;
use App\Models\User;
use App\Services\WorkflowService;
use Barryvdh\DomPDF\Facade\Pdf;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SalaryAdvanceService
{
    public function __construct(
        protected BalanceRegisterService $balanceRegisterService,
        protected WorkflowService $workflowService,
    ) {}

    public function activePolicy(?int $tenantId = null): SalaryAdvancePolicyVersion
    {
        $policy = SalaryAdvancePolicyVersion::activeFor($tenantId);
        if (!$policy) {
            throw ValidationException::withMessages([
                'policy' => ['No active salary advance policy is configured.'],
            ]);
        }

        return $policy;
    }

    public function latestConfirmedPayslip(User $user): ?Payslip
    {
        return Payslip::where('user_id', $user->id)
            ->where('confirmation_status', 'confirmed')
            ->orderByDesc('period_year')
            ->orderByDesc('period_month')
            ->first();
    }

    /**
     * v1: max = policy% of confirmed net. Gross/basic reserved for future policy versions.
     */
    public function maxEligible(SalaryAdvancePolicyVersion $policy, Payslip $payslip): float
    {
        $basisAmount = match ($policy->salary_basis) {
            'gross', 'basic' => (float) $payslip->gross_amount, // future modes only
            default          => (float) $payslip->net_amount,   // net_confirmed (v1)
        };

        return round($basisAmount * ((float) $policy->max_salary_percentage / 100), 2);
    }

    public function intendedRecoveryPayrollDate(?Carbon $from = null): Carbon
    {
        $from ??= Carbon::now();

        return $from->copy()->addMonthNoOverflow()->endOfMonth()->startOfDay();
    }

    public function outstandingBalance(User $user): float
    {
        return (float) BalanceRegister::query()
            ->where('employee_id', $user->id)
            ->where('module_type', 'salary_advance')
            ->where('status', '!=', 'closed')
            ->where('balance', '>', 0)
            ->sum('balance');
    }

    public function hasActiveAdvance(User $user, ?int $exceptId = null): bool
    {
        $q = SalaryAdvanceRequest::query()
            ->where('requester_id', $user->id)
            ->whereIn('status', SalaryAdvanceRequest::ACTIVE_STATUSES);

        if ($exceptId) {
            $q->where('id', '!=', $exceptId);
        }

        return $q->exists();
    }

    public function exposureSummary(User $user): array
    {
        $outstanding = $this->outstandingBalance($user);
        $hasActive = $this->hasActiveAdvance($user);
        $active = SalaryAdvanceRequest::query()
            ->where('requester_id', $user->id)
            ->whereIn('status', SalaryAdvanceRequest::ACTIVE_STATUSES)
            ->orderByDesc('created_at')
            ->first();

        $reasons = [];
        if ($outstanding > 0) {
            $reasons[] = 'outstanding_balance';
        }
        if ($hasActive) {
            $reasons[] = 'active_advance';
        }

        return [
            'has_outstanding_balance' => $outstanding > 0,
            'outstanding_balance'     => $outstanding,
            'has_active_advance'      => $hasActive,
            'active_advance'          => $active ? [
                'id'               => $active->id,
                'reference_number' => $active->reference_number,
                'status'           => $active->status,
                'amount'           => (float) $active->amount,
            ] : null,
            'blocked'                 => $outstanding > 0 || $hasActive,
            'reasons'                 => $reasons,
        ];
    }

    public function eligibility(User $user): array
    {
        $policy = $this->activePolicy($user->tenant_id);
        $payslip = $this->latestConfirmedPayslip($user);
        $exposure = $this->exposureSummary($user);

        if (!$payslip) {
            return [
                'eligible'     => false,
                'reason'       => 'no_confirmed_payslip',
                'net_salary'   => null,
                'gross_salary' => null,
                'max_eligible' => null,
                'salary_basis' => $policy->salary_basis,
                'payslip'      => null,
                'exposure'     => $exposure,
                'policy'       => $this->policyPayload($policy),
                'intended_recovery_payroll_date' => $this->intendedRecoveryPayrollDate()->toDateString(),
            ];
        }

        $maxEligible = $this->maxEligible($policy, $payslip);
        $eligible = !$exposure['blocked'];

        return [
            'eligible'     => $eligible,
            'reason'       => $eligible ? null : ($exposure['reasons'][0] ?? 'blocked'),
            'net_salary'   => (float) $payslip->net_amount,
            'gross_salary' => (float) $payslip->gross_amount,
            'max_eligible' => $maxEligible,
            'salary_basis' => $policy->salary_basis,
            'payslip'      => [
                'id'           => $payslip->id,
                'period_month' => $payslip->period_month,
                'period_year'  => $payslip->period_year,
                'currency'     => $payslip->currency,
            ],
            'exposure'     => $exposure,
            'policy'       => $this->policyPayload($policy),
            'intended_recovery_payroll_date' => $this->intendedRecoveryPayrollDate()->toDateString(),
        ];
    }

    public function assertCanSubmit(User $user, ?int $exceptId = null): void
    {
        $exposure = $this->exposureSummary($user);
        // When checking exceptId, recompute active without that draft
        if ($exceptId) {
            $outstanding = $this->outstandingBalance($user);
            $hasActive = $this->hasActiveAdvance($user, $exceptId);
            if ($outstanding > 0 || $hasActive) {
                throw ValidationException::withMessages([
                    'advance' => ['You have an outstanding salary advance that must be fully repaid before submitting a new request.'],
                ]);
            }

            return;
        }

        if ($exposure['blocked']) {
            throw ValidationException::withMessages([
                'advance' => ['You have an outstanding salary advance that must be fully repaid before submitting a new request.'],
            ]);
        }
    }

    public function submit(SalaryAdvanceRequest $advance, User $user, bool $deductionAuthorityConfirmed): SalaryAdvanceRequest
    {
        if ($advance->requester_id !== $user->id) {
            abort(403);
        }
        if (!in_array($advance->status, ['draft', 'finance_returned', 'returned_for_correction'], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft or returned requests can be submitted.']);
        }
        if (!$deductionAuthorityConfirmed && !$advance->deduction_authority_confirmed) {
            throw ValidationException::withMessages([
                'deduction_authority_confirmed' => ['You must confirm payroll deduction authority before submitting.'],
            ]);
        }

        return DB::transaction(function () use ($advance, $user, $deductionAuthorityConfirmed) {
            SalaryAdvanceRequest::where('requester_id', $user->id)->lockForUpdate()->get();
            $this->assertCanSubmit($user, $advance->id);

            $policy = $this->activePolicy($user->tenant_id);
            $payslip = $this->latestConfirmedPayslip($user);
            if (!$payslip) {
                throw ValidationException::withMessages([
                    'amount' => ['No confirmed payslip on file. Please contact HR to confirm your salary before submitting an advance request.'],
                ]);
            }

            $maxEligible = $this->maxEligible($policy, $payslip);
            if ((float) $advance->amount > $maxEligible) {
                throw ValidationException::withMessages([
                    'amount' => [
                        'The advance amount exceeds ' . $policy->max_salary_percentage
                        . '% of your confirmed net salary. Maximum eligible: '
                        . $advance->currency . ' ' . number_format($maxEligible, 2) . '.',
                    ],
                ]);
            }

            $repaymentMonths = $policy->recovery_rule === 'full_eom' ? 1 : (int) ($advance->repayment_months ?: 1);

            $advance->update([
                'payslip_id'                       => $payslip->id,
                'net_salary_at_request'            => (float) $payslip->net_amount,
                'gross_salary_at_request'          => (float) $payslip->gross_amount,
                'max_eligible_amount'              => $maxEligible,
                'eligibility_status'               => 'eligible',
                'policy_version_id'                => $policy->id,
                'salary_basis'                     => $policy->salary_basis,
                'repayment_months'                 => $repaymentMonths,
                'intended_recovery_payroll_date'   => $this->intendedRecoveryPayrollDate()->toDateString(),
                'deduction_authority_confirmed'    => true,
                'deduction_authority_version'      => SalaryAdvanceRequest::DEDUCTION_AUTHORITY_VERSION,
                'deduction_authority_confirmed_at' => now(),
                'status'                           => 'submitted',
                'submitted_at'                     => now(),
                'payment_status'                   => 'not_prepared',
                'recovery_status'                  => 'not_scheduled',
            ]);

            // Workflow starts after Finance certify (Finance-first).
            return $advance->fresh(['requester', 'policyVersion']);
        });
    }

    public function financeCertify(SalaryAdvanceRequest $advance, User $actor, array $data): SalaryAdvanceRequest
    {
        $this->assertCanCertify($actor, $advance);

        if (!in_array($advance->status, ['submitted', 'resubmitted'], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted advances can be certified.']);
        }

        $policy = $advance->policyVersion ?? $this->activePolicy($advance->tenant_id);
        $net = (float) ($data['confirmed_net_salary'] ?? $advance->net_salary_at_request);
        $max = round($net * ((float) $policy->max_salary_percentage / 100), 2);
        $recommended = (float) ($data['recommended_amount'] ?? $advance->amount);
        if ($recommended > $max) {
            throw ValidationException::withMessages([
                'recommended_amount' => ['Recommended amount exceeds policy maximum of ' . number_format($max, 2) . '.'],
            ]);
        }

        return DB::transaction(function () use ($advance, $actor, $data, $policy, $net, $max, $recommended) {
            SalaryAdvanceFinanceReview::create([
                'salary_advance_request_id'      => $advance->id,
                'reviewed_by'                    => $actor->id,
                'outcome'                        => 'certified',
                'salary_basis'                   => $policy->salary_basis,
                'confirmed_net_salary'           => $net,
                'confirmed_gross_salary'         => $data['confirmed_gross_salary'] ?? $advance->gross_salary_at_request,
                'max_eligible_amount'            => $max,
                'recommended_amount'             => $recommended,
                'intended_recovery_payroll_date' => $data['intended_recovery_payroll_date'],
                'eligible'                       => true,
                'comments'                       => $data['comments'] ?? null,
                'worksheet'                      => $data['worksheet'] ?? null,
            ]);

            $advance->update([
                'status'                         => 'finance_certified',
                'finance_certified_at'           => now(),
                'finance_certified_by'           => $actor->id,
                'net_salary_at_request'          => $net,
                'max_eligible_amount'            => $max,
                'intended_recovery_payroll_date' => $data['intended_recovery_payroll_date'],
                'amount'                         => $recommended,
            ]);

            // Initiate Principal → SG workflow after certify.
            if (!$advance->approvalRequest) {
                $this->workflowService->initiate($advance->fresh(), 'salary_advance', $advance->requester);
            }

            return $advance->fresh(['requester', 'financeReviews', 'approvalRequest']);
        });
    }

    public function financeReturn(SalaryAdvanceRequest $advance, User $actor, string $reason): SalaryAdvanceRequest
    {
        $this->assertCanCertify($actor, $advance);

        if (!in_array($advance->status, ['submitted', 'resubmitted'], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted advances can be returned by Finance.']);
        }

        SalaryAdvanceFinanceReview::create([
            'salary_advance_request_id' => $advance->id,
            'reviewed_by'               => $actor->id,
            'outcome'                   => 'returned',
            'return_reason'             => $reason,
            'comments'                  => $reason,
        ]);

        $advance->update(['status' => 'finance_returned']);

        return $advance->fresh(['requester', 'financeReviews']);
    }

    public function markNotEligible(SalaryAdvanceRequest $advance, User $actor, string $reason): SalaryAdvanceRequest
    {
        $this->assertCanCertify($actor, $advance);

        if (!in_array($advance->status, ['submitted', 'resubmitted'], true)) {
            throw ValidationException::withMessages(['status' => 'Only submitted advances can be marked not eligible.']);
        }

        SalaryAdvanceFinanceReview::create([
            'salary_advance_request_id' => $advance->id,
            'reviewed_by'               => $actor->id,
            'outcome'                   => 'not_eligible',
            'eligible'                  => false,
            'not_eligible_reason'       => $reason,
            'comments'                  => $reason,
        ]);

        $advance->update([
            'status'              => 'not_eligible',
            'not_eligible_reason' => $reason,
        ]);

        return $advance->fresh(['requester', 'financeReviews']);
    }

    public function recordPayment(SalaryAdvanceRequest $advance, User $actor, array $data): SalaryAdvanceRequest
    {
        $this->assertCanPay($actor, $advance);

        if (!in_array($advance->status, ['approved_for_payment', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => 'Only advances approved for payment can be paid.']);
        }
        if ($advance->status === 'paid' || $advance->payment_status === 'paid') {
            throw ValidationException::withMessages(['payment' => ['This advance has already been paid.']]);
        }

        return DB::transaction(function () use ($advance, $actor, $data) {
            $amount = $advance->payableAmount();

            // Ensure full-EOM register shape before create.
            if ($advance->repayment_months != 1) {
                $advance->update(['repayment_months' => 1]);
            }

            $register = $this->balanceRegisterService->createFromSalaryAdvance($advance->fresh(), $actor);

            // Opening balance already set to approved amount; post disbursement as verified trail
            // by adjusting: createFromSalaryAdvance sets balance=amount without a txn.
            // Post a disbursement that nets correctly: set balance to 0 first then disburse,
            // OR create disbursement with special handling.
            // Spec: balance after payment = amount. createFromSalaryAdvance already sets balance=amount.
            // Add an explicit disbursement txn without double-counting by resetting then posting.
            $register->update(['balance' => 0, 'total_processed' => 0]);
            $this->balanceRegisterService->createTransaction($register->fresh(), [
                'type'          => 'disbursement',
                'amount'        => $amount,
                'reference_doc' => $data['payment_reference'] ?? null,
                'notes'         => 'Salary advance payment recorded',
            ], $actor);

            $advance->update([
                'status'            => 'paid',
                'payment_status'    => 'paid',
                'paid_at'           => $data['payment_date'] ?? now(),
                'payment_reference' => $data['payment_reference'] ?? null,
                'payment_method'    => $data['payment_method'] ?? null,
                'approved_amount'   => $amount,
            ]);

            return $advance->fresh(['requester', 'balanceRegister']);
        });
    }

    public function scheduleRecovery(SalaryAdvanceRequest $advance, User $actor, array $data): SalaryAdvanceRequest
    {
        $this->assertCanRecover($actor, $advance);

        if (!in_array($advance->status, ['paid', 'recovery_scheduled'], true)) {
            throw ValidationException::withMessages(['status' => 'Only paid advances can be scheduled for recovery.']);
        }

        $date = $data['intended_recovery_payroll_date']
            ?? ($advance->intended_recovery_payroll_date?->toDateString()
                ?? $this->intendedRecoveryPayrollDate()->toDateString());

        $advance->update([
            'status'                         => 'recovery_scheduled',
            'recovery_status'                => 'scheduled',
            'intended_recovery_payroll_date' => $date,
        ]);

        return $advance->fresh();
    }

    public function recordRecovery(SalaryAdvanceRequest $advance, User $actor, array $data): SalaryAdvanceRequest
    {
        $this->assertCanRecover($actor, $advance);

        if (!in_array($advance->status, ['paid', 'recovery_scheduled', 'reconciliation_required'], true)) {
            throw ValidationException::withMessages(['status' => 'Advance is not in a recoverable state.']);
        }

        $register = BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->first();

        if (!$register) {
            throw ValidationException::withMessages(['register' => ['No balance register exists for this advance.']]);
        }

        $amount = (float) $data['amount'];
        if ($amount <= 0) {
            throw ValidationException::withMessages(['amount' => ['Recovery amount must be greater than zero.']]);
        }

        return DB::transaction(function () use ($advance, $actor, $data, $register, $amount) {
            $this->balanceRegisterService->createTransaction($register, [
                'type'          => 'recovery',
                'amount'        => $amount,
                'reference_doc' => $data['reference_doc'] ?? null,
                'notes'         => $data['notes'] ?? 'Payroll recovery',
            ], $actor);

            $register->refresh();
            $recovered = (float) ($advance->recovered_amount ?? 0) + $amount;
            $balance = (float) $register->balance;

            if ($balance <= 0.00001) {
                $advance->update([
                    'status'           => 'closed',
                    'recovery_status'  => 'recovered',
                    'recovered_amount' => $recovered,
                    'closed_at'        => now(),
                ]);
                $register->update(['status' => 'closed', 'balance' => 0]);
            } else {
                $advance->update([
                    'status'           => 'reconciliation_required',
                    'recovery_status'  => 'partial',
                    'recovered_amount' => $recovered,
                ]);
            }

            return $advance->fresh(['requester', 'balanceRegister']);
        });
    }

    public function close(SalaryAdvanceRequest $advance, User $actor): SalaryAdvanceRequest
    {
        $this->assertCanRecover($actor, $advance);

        $register = BalanceRegister::where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->first();

        if ($register && (float) $register->balance > 0.00001) {
            throw ValidationException::withMessages([
                'balance' => ['Cannot close while outstanding balance remains.'],
            ]);
        }

        $advance->update([
            'status'          => 'closed',
            'recovery_status' => 'recovered',
            'closed_at'       => now(),
        ]);

        if ($register) {
            $register->update(['status' => 'closed']);
        }

        return $advance->fresh();
    }

    public function ledger(SalaryAdvanceRequest $advance): array
    {
        $register = BalanceRegister::with(['transactions.createdBy', 'employee'])
            ->where('source_request_type', SalaryAdvanceRequest::class)
            ->where('source_request_id', $advance->id)
            ->first();

        return [
            'register'     => $register,
            'transactions' => $register?->transactions ?? [],
            'balance'      => $register ? (float) $register->balance : 0,
        ];
    }

    public function form002Pdf(SalaryAdvanceRequest $advance)
    {
        $advance->load([
            'requester.department',
            'approver',
            'payslip',
            'policyVersion',
            'financeReviews.reviewer',
            'financeCertifiedBy',
            'approvalRequest.history.user',
            'approvalRequest.workflow.steps',
            'balanceRegister.transactions',
        ]);

        return Pdf::loadView('pdf.salary_advance_form_002', [
            'advance' => $advance,
            'ledger'  => $this->ledger($advance),
        ]);
    }

    public function canAccessAdvance(User $actor, SalaryAdvanceRequest $advance): bool
    {
        if ((int) $advance->requester_id === (int) $actor->id) {
            return true;
        }

        // Elevated SA / finance actors may view tenant advances (not plain staff view/create).
        if ($this->hasSalaryAdvancePermission($actor, 'salary_advance.certify')
            || $this->hasSalaryAdvancePermission($actor, 'salary_advance.approve')
            || $this->hasSalaryAdvancePermission($actor, 'salary_advance.pay')
            || $this->hasSalaryAdvancePermission($actor, 'salary_advance.recover')
            || $this->hasSalaryAdvancePermission($actor, 'salary_advance.admin')
            || $actor->hasAnyRole([
                'Finance Controller',
                'Secretary General',
                'Director',
                'External Auditor',
                'Internal Auditor',
                'System Admin',
                'System Administrator',
            ])
            || $actor->isSystemAdmin()) {
            return true;
        }

        return false;
    }

    public function hasSalaryAdvancePermission(User $actor, string $permission): bool
    {
        $fallbacks = [
            'salary_advance.view'    => ['finance.view'],
            'salary_advance.create'  => ['finance.create'],
            'salary_advance.certify' => ['finance.approve'],
            'salary_advance.approve' => ['finance.approve'],
            'salary_advance.pay'     => ['finance.approve', 'finance.admin'],
            'salary_advance.recover' => ['finance.approve', 'finance.admin'],
            'salary_advance.export'  => ['finance.export'],
            'salary_advance.admin'   => ['finance.admin'],
        ];

        if ($actor->can($permission)) {
            return true;
        }

        foreach ($fallbacks[$permission] ?? [] as $legacy) {
            if ($actor->can($legacy)) {
                return true;
            }
        }

        return false;
    }

    private function assertCanCertify(User $actor, SalaryAdvanceRequest $advance): void
    {
        if ((int) $advance->requester_id === (int) $actor->id) {
            abort(403, 'You cannot certify your own salary advance.');
        }

        $allowed = $this->hasSalaryAdvancePermission($actor, 'salary_advance.certify')
            || $actor->hasRole('Finance Controller');

        abort_unless($allowed, 403, 'Only Finance may certify salary advances.');
    }

    private function assertCanPay(User $actor, SalaryAdvanceRequest $advance): void
    {
        if ((int) $advance->requester_id === (int) $actor->id) {
            abort(403, 'You cannot record payment on your own salary advance.');
        }

        $allowed = $this->hasSalaryAdvancePermission($actor, 'salary_advance.pay')
            || $actor->hasRole('Finance Controller');

        abort_unless($allowed, 403, 'Only Finance may record salary advance payments.');
    }

    private function assertCanRecover(User $actor, SalaryAdvanceRequest $advance): void
    {
        $allowed = $this->hasSalaryAdvancePermission($actor, 'salary_advance.recover')
            || $actor->hasRole('Finance Controller');

        abort_unless($allowed, 403, 'Only Finance may record salary advance recoveries.');
    }

    private function policyPayload(SalaryAdvancePolicyVersion $policy): array
    {
        return [
            'id'                             => $policy->id,
            'version'                        => $policy->version,
            'max_salary_percentage'          => (float) $policy->max_salary_percentage,
            'salary_basis'                   => $policy->salary_basis,
            'max_concurrent_advances'        => (int) $policy->max_concurrent_advances,
            'full_repayment_required'        => (bool) $policy->full_repayment_required,
            'recovery_rule'                  => $policy->recovery_rule,
            'finance_certification_required' => (bool) $policy->finance_certification_required,
            'admin_review_required'          => (bool) $policy->admin_review_required,
        ];
    }
}
