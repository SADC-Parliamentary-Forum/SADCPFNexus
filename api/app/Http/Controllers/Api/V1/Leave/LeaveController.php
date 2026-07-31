<?php
namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\OvertimeAccrual;
use App\Models\ToilCredit;
use App\Modules\Leave\Services\LeaveBalanceService;
use App\Modules\Leave\Services\LeaveCalendarPrivacyService;
use App\Modules\Leave\Services\LeavePolicyService;
use App\Modules\Leave\Services\LeaveService;
use App\Modules\Leave\Services\LeaveToilCreditService;
use App\Support\AuthorizesCertificates;
use App\Support\AuthorizesRequestRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class LeaveController extends Controller
{
    use AuthorizesCertificates;
    use AuthorizesRequestRecords;

    public function __construct(
        private readonly LeaveService $leaveService,
        private readonly LeavePolicyService $policyService,
        private readonly LeaveBalanceService $balanceService,
        private readonly LeaveToilCreditService $toilCreditService,
        private readonly LeaveCalendarPrivacyService $calendarPrivacy,
        private readonly \App\Services\WorkflowService $workflowService,
        private readonly \App\Services\DelegationService $delegationService,
    ) {}

    /** Leave balances for the current user (annual days, LIL hours, and used days per leave type). */
    public function balances(Request $request): JsonResponse
    {
        $user = $request->user();
        $year = (int) date('Y');
        $policy = $this->policyService->activePolicyForTenant($user->tenant_id);
        $balance = LeaveBalance::where('user_id', $user->id)
            ->where('period_year', $year)
            ->first();

        // Compute used days per leave type from approved/submitted leave requests this year
        $usedByType = LeaveRequest::where('requester_id', $user->id)
            ->whereYear('start_date', $year)
            ->whereIn('status', ['approved', 'submitted'])
            ->selectRaw('leave_type, COALESCE(SUM(days_requested), 0)::int AS days_used')
            ->groupBy('leave_type')
            ->pluck('days_used', 'leave_type');

        $ledgerBalances = $policy->types
            ->map(fn ($type) => $this->balanceService->balanceFor($user, $type->code))
            ->values();

        return response()->json([
            'annual_balance_days'      => $balance ? (int) $balance->annual_balance_days : 0,
            'lil_hours_available'      => $balance ? (float) $balance->lil_hours_available : 0,
            'sick_leave_used_days'     => (int) ($usedByType['sick'] ?? ($balance?->sick_leave_used_days ?? 0)),
            'special_leave_days_used'  => (int) ($usedByType['special'] ?? 0),
            'maternity_leave_days_used'=> (int) ($usedByType['maternity'] ?? 0),
            'paternity_leave_days_used'=> (int) ($usedByType['paternity'] ?? 0),
            'period_year'              => $year,
            'data'                     => $ledgerBalances,
        ]);
    }

    public function types(Request $request): JsonResponse
    {
        $policy = $this->policyService->activePolicyForTenant($request->user()->tenant_id);

        return response()->json([
            'policy' => $policy,
            'data' => $policy->types()->where('is_active', true)->orderBy('name')->get(),
        ]);
    }

    public function policies(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('hr.admin')
            || $request->user()->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin']),
            403
        );

        return response()->json([
            'data' => $this->policyService->listPolicies($request->user()),
        ]);
    }

    public function activePolicy(Request $request): JsonResponse
    {
        $policy = $this->policyService->activePolicyForTenant($request->user()->tenant_id);

        return response()->json([
            'data' => [
                'policy' => $policy,
                'stages' => $this->policyService->resolveApprovalStages($policy, $request->user()),
                'workflow_mode' => $this->policyService->workflowMode($policy),
            ],
        ]);
    }

    public function storePolicy(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('hr.admin')
            || $request->user()->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin']),
            403
        );

        $data = $request->validate([
            'version' => ['nullable', 'string', 'max:40'],
            'name' => ['nullable', 'string', 'max:120'],
            'effective_from' => ['nullable', 'date'],
            'workflow_mode' => ['required', 'string', 'in:standard,finance_first,director_principal'],
            'admin_review_required' => ['nullable', 'boolean'],
            'principal_role' => ['nullable', 'string', 'max:80'],
            'final_approver_role' => ['nullable', 'string', 'max:80'],
            'change_reason' => ['required', 'string', 'max:500'],
            'rules' => ['nullable', 'array'],
        ]);

        $policy = $this->policyService->createPolicyVersion($request->user(), $data);

        return response()->json(['data' => $policy], 201);
    }

    /**
     * Team leave calendar with medical privacy masking for non-HR viewers.
     */
    public function teamCalendar(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->can('leave.approve')
                || $user->can('hr.admin')
                || $user->can('hr.view')
                || $user->hasAnyRole(['HOD', 'HR Manager', 'HR Administrator', 'Secretary General', 'System Admin']),
            403
        );

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'department_id' => ['nullable', 'integer'],
            'status' => ['nullable', 'string', 'in:approved,submitted,certified,recommended'],
        ]);

        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->endOfMonth()->toDateString();
        $statuses = isset($data['status'])
            ? [$data['status']]
            : ['approved'];

        $query = LeaveRequest::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', $statuses)
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->with(['requester:id,name,department_id,job_title'])
            ->orderBy('start_date');

        if (! empty($data['department_id'])) {
            $query->whereHas('requester', fn ($q) => $q->where('department_id', $data['department_id']));
        } elseif ($user->department_id && ! $user->hasAnyRole(['HR Manager', 'HR Administrator', 'Secretary General', 'System Admin'])) {
            $query->whereHas('requester', fn ($q) => $q->where('department_id', $user->department_id));
        }

        $rows = $query->get()->map(
            fn (LeaveRequest $leave) => $this->calendarPrivacy->present($leave, $user)
        );

        return response()->json([
            'from' => $from,
            'to' => $to,
            'privacy' => [
                'medical_masked_for_viewer' => ! $this->calendarPrivacy->canViewUnmaskedMedical($user),
            ],
            'data' => $rows,
        ]);
    }

    /**
     * Personal leave calendar (own requests, unmasked).
     */
    public function myCalendar(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);

        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->endOfMonth()->toDateString();

        $rows = LeaveRequest::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted', 'certified', 'recommended', 'draft'])
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->with(['requester:id,name,department_id,job_title'])
            ->orderBy('start_date')
            ->get()
            ->map(fn (LeaveRequest $leave) => $this->calendarPrivacy->present($leave, $user, forceOwn: true));

        return response()->json(['from' => $from, 'to' => $to, 'data' => $rows]);
    }

    /**
     * HR leave register CSV export (approved/submitted/rejected in range).
     */
    public function registerExport(Request $request): Response
    {
        $user = $request->user();
        abort_unless(
            $user->can('hr.admin')
                || $user->can('hr.view')
                || $user->can('leave.approve')
                || $user->hasAnyRole(['HR Manager', 'HR Administrator', 'Secretary General', 'System Admin']),
            403
        );

        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
            'status' => ['nullable', 'string'],
            'department_id' => ['nullable', 'integer'],
        ]);

        $from = $data['from'] ?? now()->startOfYear()->toDateString();
        $to = $data['to'] ?? now()->endOfYear()->toDateString();

        $query = LeaveRequest::query()
            ->where('tenant_id', $user->tenant_id)
            ->whereDate('start_date', '<=', $to)
            ->whereDate('end_date', '>=', $from)
            ->with(['requester:id,name,employee_number,department_id,job_title'])
            ->orderBy('start_date');

        if (! empty($data['status'])) {
            $query->where('status', $data['status']);
        }
        if (! empty($data['department_id'])) {
            $query->whereHas('requester', fn ($q) => $q->where('department_id', $data['department_id']));
        }

        $rows = $query->get();
        $csv = "reference,employee,employee_number,leave_type,start_date,end_date,days,status,recommended_at,approved_at\n";
        foreach ($rows as $leave) {
            $csv .= implode(',', [
                $this->csvEscape($leave->reference_number),
                $this->csvEscape($leave->requester?->name),
                $this->csvEscape((string) ($leave->requester?->employee_number ?? '')),
                $this->csvEscape($leave->leave_type),
                $leave->start_date?->toDateString(),
                $leave->end_date?->toDateString(),
                $leave->days_requested,
                $leave->status,
                optional($leave->recommended_at)?->toDateString(),
                optional($leave->approved_at)?->toDateString(),
            ])."\n";
        }

        return response($csv, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="leave-register.csv"',
        ]);
    }

    private function csvEscape(?string $value): string
    {
        $value = (string) ($value ?? '');
        if (str_contains($value, ',') || str_contains($value, '"') || str_contains($value, "\n")) {
            return '"'.str_replace('"', '""', $value).'"';
        }

        return $value;
    }

    public function preview(Request $request): JsonResponse
    {
        $data = $request->validate([
            'segments' => ['required', 'array', 'min:1'],
            'segments.*.leave_type' => ['required', 'string', 'max:40'],
            'segments.*.start_date' => ['required', 'date', 'after_or_equal:today'],
            'segments.*.end_date' => ['required', 'date'],
            'segments.*.day_part' => ['nullable', 'string', 'in:full,morning,afternoon'],
            'segments.*.amount_requested' => ['nullable', 'numeric', 'min:0.5'],
            'segments.*.source_type' => ['nullable', 'string', 'max:191'],
            'segments.*.source_id' => ['nullable', 'integer'],
            'segments.*.document_status' => ['nullable', 'string', 'in:complete,missing,not_required,restricted,provided,uploaded'],
            'segments.*.comments' => ['nullable', 'string', 'max:1000'],
        ]);

        $segments = $this->leaveService->previewSegments($request->user(), $data['segments']);

        return response()->json([
            'data' => [
                'segments' => $segments,
                'total_working_days' => round((float) collect($segments)->sum('amount_requested'), 2),
            ],
        ]);
    }

    /** Return LIL accruals: overtime accruals + days from approved Travel Requisitions that fell on weekend or Namibia public holiday. */
    public function lilAccruals(Request $request): JsonResponse
    {
        $user = $request->user();

        $overtime = OvertimeAccrual::where('user_id', $user->id)
            ->where('is_linked', false)
            ->orderByDesc('accrual_date')
            ->get();

        $data = [];

        foreach ($overtime as $r) {
            $data[] = [
                'id'          => 'overtime-' . $r->id,
                'source_type' => 'overtime',
                'code'        => $r->code,
                'description' => $r->description ?? $r->code,
                'hours'       => (float) $r->hours,
                'date'        => $r->accrual_date->format('Y-m-d'),
                'approved_by' => $r->approved_by_name,
                'is_verified' => $r->is_verified,
            ];
        }

        $travelLil = $this->leaveService->getLilAccrualsFromApprovedTravel($user);
        foreach ($travelLil as $item) {
            $data[] = $item;
        }

        usort($data, fn ($a, $b) => strcmp($b['date'], $a['date']));

        return response()->json(['data' => $data]);
    }

    public function toil(Request $request): JsonResponse
    {
        $user = $request->user();
        $canSeeTenant = $user->can('hr.admin') || $user->can('leave.approve') || $user->hasAnyRole([
            'HR Manager',
            'HR Administrator',
            'Secretary General',
            'System Admin',
            'System Administrator',
        ]);

        $credits = ToilCredit::with(['user:id,name,email', 'extensions'])
            ->where('tenant_id', $user->tenant_id)
            ->when(! $canSeeTenant, fn ($query) => $query->where('user_id', $user->id))
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->get()
            ->map(function (ToilCredit $credit) {
                return array_merge($credit->toArray(), [
                    'duty_date' => $credit->duty_date?->toDateString(),
                    'accrual_date' => $credit->accrual_date?->toDateString(),
                    'expiry_date' => $credit->expiry_date?->toDateString(),
                    'days_until_expiry' => now()->startOfDay()->diffInDays($credit->expiry_date, false),
                ]);
            })
            ->values();

        return response()->json(['data' => $credits]);
    }

    public function extendToil(Request $request, ToilCredit $toilCredit): JsonResponse
    {
        abort_unless((int) $toilCredit->tenant_id === (int) $request->user()->tenant_id, 404);

        $data = $request->validate([
            'requested_expiry_date' => ['required', 'date', 'after:today'],
            'reason' => ['required', 'string', 'max:2000'],
            'comments' => ['nullable', 'string', 'max:2000'],
        ]);

        $isOwner = (int) $toilCredit->user_id === (int) $request->user()->id;
        $canRequest = $isOwner
            || $request->user()->can('hr.admin')
            || $request->user()->hasAnyRole(['HR Manager', 'HR Administrator', 'Secretary General', 'System Admin', 'System Administrator']);

        abort_unless($canRequest, 403, 'You are not authorised to request a TOIL extension for this credit.');

        $extension = $this->toilCreditService->requestOrApproveExtension(
            $toilCredit,
            $request->user(),
            $data['requested_expiry_date'],
            $data['reason'],
            $data['comments'] ?? null
        );

        return response()->json([
            'message' => $extension->status === 'approved' ? 'TOIL extension approved.' : 'TOIL extension requested.',
            'data' => [
                'extension' => $extension,
                'credit' => $this->serialiseToilCredit($toilCredit->fresh('extensions')),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function serialiseToilCredit(ToilCredit $credit): array
    {
        return array_merge($credit->toArray(), [
            'duty_date' => $credit->duty_date?->toDateString(),
            'accrual_date' => $credit->accrual_date?->toDateString(),
            'expiry_date' => $credit->expiry_date?->toDateString(),
            'days_until_expiry' => now()->startOfDay()->diffInDays($credit->expiry_date, false),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'leave_type', 'per_page', 'queue']);
        return response()->json($this->leaveService->list($filters, $request->user()));
    }

    public function show(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        // Safe 404: leave is HR-sensitive — do not confirm existence to unauthorised callers.
        $this->authorizeRequestView($request->user(), $leaveRequest, [
            'HR Manager', 'HR Administrator', 'Secretary General',
        ], safeNotFound: true);

        return response()->json($leaveRequest->load(['requester', 'approver', 'policyVersion', 'segments.type', 'lilLinkings', 'approvalRequest.workflow.steps', 'approvalRequest.history.user']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'leave_type'  => ['required_without:segments', 'string', 'in:annual,sick,lil,special,maternity,paternity,compassionate,study,unpaid,home'],
            'start_date'  => ['required_without:segments', 'date', 'after_or_equal:today'],
            'end_date'    => ['required_without:segments', 'date', 'after_or_equal:start_date'],
            'reason'      => ['nullable', 'string', 'max:2000'],
            'leave_address' => ['nullable', 'string', 'max:2000'],
            'contact_number' => ['nullable', 'string', 'max:80'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
            'handover_required' => ['nullable', 'boolean'],
            'handover_notes' => ['nullable', 'string', 'max:2000'],
            'segments' => ['nullable', 'array', 'min:1'],
            'segments.*.leave_type' => ['required_with:segments', 'string', 'max:40'],
            'segments.*.start_date' => ['required_with:segments', 'date', 'after_or_equal:today'],
            'segments.*.end_date' => ['required_with:segments', 'date'],
            'segments.*.day_part' => ['nullable', 'string', 'in:full,morning,afternoon'],
            'segments.*.amount_requested' => ['nullable', 'numeric', 'min:0.5'],
            'segments.*.source_type' => ['nullable', 'string', 'max:191'],
            'segments.*.source_id' => ['nullable', 'integer'],
            'segments.*.document_status' => ['nullable', 'string', 'in:complete,missing,not_required,restricted,provided,uploaded'],
            'segments.*.comments' => ['nullable', 'string', 'max:1000'],
            'lil_linkings'               => ['nullable', 'array'],
            'lil_linkings.*.source_id'           => ['nullable', 'string', 'max:64'],
            'lil_linkings.*.accrual_code'        => ['required_with:lil_linkings', 'string'],
            'lil_linkings.*.accrual_description' => ['required_with:lil_linkings', 'string'],
            'lil_linkings.*.hours'               => ['required_with:lil_linkings', 'numeric', 'min:0.5'],
            'lil_linkings.*.accrual_date'        => ['required_with:lil_linkings', 'date'],
            'lil_linkings.*.approved_by_name'    => ['nullable', 'string'],
            'prepared_on_behalf_of'              => ['nullable', 'integer', 'exists:users,id'],
            'acknowledge_conflicts'              => ['nullable', 'boolean'],
            'conflict_resolution_note'           => ['nullable', 'string', 'max:2000'],
        ]);

        $actor       = $request->user();
        $onBehalfOf  = $data['prepared_on_behalf_of'] ?? null;
        $delegation  = $this->delegationService->authorise($actor, $onBehalfOf, 'leave', 'draft');

        // When acting on behalf of a principal, the leave belongs to the
        // principal (their balance) — the actor is recorded as the preparer.
        $ownerId    = $this->delegationService->ownerId($actor, $onBehalfOf);
        $ownerUser  = $ownerId === $actor->id ? $actor : \App\Models\User::find($ownerId);

        $leave = $this->leaveService->create($data, $ownerUser);

        $this->delegationService->stampPreparation($leave, $actor, $onBehalfOf, 'leave', 'draft', $delegation);
        if ($onBehalfOf) {
            $leave->save();
        }

        return response()->json(['message' => 'Leave request created.', 'data' => $leave->fresh(['requester', 'preparedBy', 'preparedOnBehalfOf', 'policyVersion', 'segments.type'])], 201);
    }

    public function update(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorizeRequestMutate($request->user(), $leaveRequest);
        $data = $request->validate([
            'leave_type' => ['sometimes', 'string', 'in:annual,sick,lil,special,maternity,paternity,compassionate,study,unpaid,home'],
            'start_date' => ['sometimes', 'date'],
            'end_date'   => ['sometimes', 'date', 'after_or_equal:start_date'],
            'reason'     => ['nullable', 'string', 'max:2000'],
            'leave_address' => ['nullable', 'string', 'max:2000'],
            'contact_number' => ['nullable', 'string', 'max:80'],
            'emergency_contact' => ['nullable', 'string', 'max:255'],
            'handover_required' => ['nullable', 'boolean'],
            'handover_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $leave = $this->leaveService->update($leaveRequest, $data, $request->user());
        return response()->json(['message' => 'Leave request updated.', 'data' => $leave]);
    }

    public function destroy(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorizeRequestMutate($request->user(), $leaveRequest);
        if (!$leaveRequest->isDraft()) {
            return response()->json(['message' => 'Only draft requests can be deleted.'], 422);
        }
        $leaveRequest->delete();
        return response()->json(['message' => 'Leave request deleted.']);
    }

    public function submit(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $leave = $this->leaveService->submit($leaveRequest, $request->user());
        return response()->json(['message' => 'Leave request submitted.', 'data' => $leave]);
    }

    public function recommend(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string', 'in:recommend,not_recommend,return'],
            'comment' => ['nullable', 'string', 'max:2000'],
        ]);

        $leave = $this->leaveService->recommend(
            $leaveRequest,
            $request->user(),
            $data['action'],
            $data['comment'] ?? null
        );

        return response()->json(['message' => 'Leave recommendation recorded.', 'data' => $leave]);
    }

    public function certify(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate([
            'action' => ['required', 'string', 'in:certify,certify_with_condition,return,mark_ineligible'],
            'comment' => ['nullable', 'string', 'max:2000'],
            'segments' => ['nullable', 'array'],
            'segments.*.id' => ['nullable', 'integer'],
            'segments.*.segment_id' => ['nullable', 'integer'],
            'segments.*.eligible_days' => ['nullable', 'numeric', 'min:0'],
            'segments.*.document_status' => ['nullable', 'string', 'in:complete,missing,not_required,restricted'],
            'segments.*.comments' => ['nullable', 'string', 'max:1000'],
        ]);

        $leave = $this->leaveService->certify(
            $leaveRequest,
            $request->user(),
            $data['action'],
            $data['segments'] ?? [],
            $data['comment'] ?? null
        );

        return response()->json(['message' => 'Leave certification recorded.', 'data' => $leave]);
    }

    public function approve(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate([
            'comment'         => ['nullable', 'string', 'max:1000'],
            'override_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $overrideReason = $data['override_reason'] ?? null;

        if (!$leaveRequest->approvalRequest) {
            $this->authorizeLegacyApproval($request->user(), $leaveRequest, [
                'HR Manager', 'HR Administrator', 'Secretary General',
            ]);
            $leave = $this->leaveService->approve($leaveRequest, $request->user(), $overrideReason);
            return response()->json(['message' => 'Leave request approved.', 'data' => $leave]);
        }

        $this->leaveService->validateLeaveBalance($leaveRequest, $overrideReason);

        $result = $this->workflowService->approve(
            $leaveRequest->approvalRequest,
            $request->user(),
            $data['comment'] ?? null
        );

        return response()->json([
            'message'            => 'Leave request approved.',
            'data'               => $leaveRequest->fresh(['requester', 'approver', 'approvalRequest']),
            'notified_approvers' => $result['notified_approvers'],
        ]);
    }

    public function reject(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate([
            'reason'  => ['nullable', 'string', 'max:1000'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $reason = $data['reason'] ?? $data['comment'] ?? null;
        if (!$reason) {
            return response()->json([
                'message' => 'The comment field is required.',
                'errors'  => ['comment' => ['The comment field is required.']],
            ], 422);
        }

        if (!$leaveRequest->approvalRequest) {
            $this->authorizeLegacyApproval($request->user(), $leaveRequest, [
                'HR Manager', 'HR Administrator', 'Secretary General',
            ]);
            $leave = $this->leaveService->reject($leaveRequest, $reason, $request->user());
            return response()->json(['message' => 'Leave request rejected.', 'data' => $leave]);
        }

        $this->workflowService->reject($leaveRequest->approvalRequest, $request->user(), $reason);

        return response()->json(['message' => 'Leave request rejected.', 'data' => $leaveRequest->fresh(['requester', 'approver', 'approvalRequest'])]);
    }

    public function returnForCorrection(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']]);
        abort_unless($leaveRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->returnForCorrection(
            $leaveRequest->approvalRequest,
            $request->user(),
            $data['comment']
        );
        return response()->json([
            'message' => 'Request returned to requester for correction.',
            'data'    => $leaveRequest->fresh(['requester', 'approver', 'approvalRequest']),
        ]);
    }

    public function withdraw(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        abort_unless($leaveRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->withdraw($leaveRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Leave request withdrawn.',
            'data'    => $leaveRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function resubmit(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        abort_unless($leaveRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->resubmit($leaveRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Leave request resubmitted.',
            'data'    => $leaveRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function certificate(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $this->authorizeCertificateView($request->user(), $leaveRequest, [
            'HR Manager',
            'HR Administrator',
            'Secretary General',
            'System Admin',
            'System Administrator',
        ]);

        return response()->json([
            'data' => $leaveRequest->load([
                'requester.department',
                'approvalRequest.history.user',
                'approvalRequest.workflow.steps',
            ]),
        ]);
    }

    public function pdf(Request $request, LeaveRequest $leaveRequest): Response
    {
        $this->authorizeRequestView($request->user(), $leaveRequest, [
            'HOD',
            'HR Manager',
            'HR Administrator',
            'Secretary General',
            'System Admin',
            'System Administrator',
        ]);

        $pdf = $this->leaveService->form005Pdf($leaveRequest);

        return $pdf->download('FORM-005-' . $leaveRequest->reference_number . '.pdf');
    }
}
