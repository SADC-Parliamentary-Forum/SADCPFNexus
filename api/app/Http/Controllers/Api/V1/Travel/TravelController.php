<?php
namespace App\Http\Controllers\Api\V1\Travel;

use App\Http\Controllers\Controller;
use App\Models\TravelAmendment;
use App\Models\TravelMission;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Modules\Travel\Services\TravelAnalyticsService;
use App\Modules\Travel\Services\TravelDsaService;
use App\Modules\Travel\Services\TravelMissionService;
use App\Modules\Travel\Services\TravelService;
use App\Modules\Travel\Services\TravelToilService;
use App\Modules\Travel\Services\TravelVisaReminderService;
use App\Services\WorkflowService;
use App\Support\AuthorizesCertificates;
use App\Support\AuthorizesRequestRecords;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class TravelController extends Controller
{
    use AuthorizesCertificates;
    use AuthorizesRequestRecords;

    public function __construct(
        private readonly TravelService $travelService,
        private readonly WorkflowService $workflowService,
        private readonly TravelDsaService $dsaService,
        private readonly TravelToilService $toilService,
        private readonly TravelMissionService $missionService,
        private readonly TravelAnalyticsService $analyticsService,
        private readonly TravelVisaReminderService $visaReminderService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page', 'scope', 'queue']);
        return response()->json($this->travelService->list($filters, $request->user()));
    }

    public function show(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->authorizeRequestView($request->user(), $travelRequest, [
            'Secretary General', 'HR Manager', 'Finance Controller', 'Director', 'Administration Officer', 'HOD',
        ]);

        $travelRequest->load([
            'requester', 'approver', 'itineraries', 'workplanEvent',
            'fundingLines', 'programme', 'mission', 'dsaLines',
            'attachments', 'toilCandidates', 'amendments.creator',
            'preparedBy', 'preparedOnBehalfOf',
            'approvalRequest.workflow.steps',
            'approvalRequest.history.user',
            'directorFinanceConfirmer', 'emergencyAuthoriser',
        ]);

        $approval = $travelRequest->approvalRequest;
        $workflowMeta = $approval
            ? $this->workflowService->snapshot($approval)
            : null;

        return response()->json([
            'data' => $travelRequest,
            'workflow' => $workflowMeta,
            'retirement_overdue' => $travelRequest->isRetirementOverdue(),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'purpose'             => ['required', 'string', 'max:500'],
            'departure_date'      => ['required', 'date', 'after_or_equal:today'],
            'return_date'         => ['required', 'date', 'after_or_equal:departure_date'],
            'destination_country' => ['required', 'string', 'max:100'],
            'destination_city'    => ['nullable', 'string', 'max:100'],
            'estimated_dsa'       => ['nullable', 'numeric', 'min:0'],
            'currency'            => ['nullable', 'string', 'size:3'],
            'justification'       => ['nullable', 'string', 'max:2000'],
            'workplan_event_id'   => ['nullable', 'integer', 'exists:workplan_events,id'],
            'programme_id'        => ['nullable', 'integer', 'exists:programmes,id'],
            'mission_id'          => ['nullable', 'integer', 'exists:travel_missions,id'],
            'host_organization'   => ['nullable', 'string', 'max:255'],
            'budget_line_id'      => ['nullable', 'integer'],
            'cabin_class'         => ['nullable', 'string', 'max:50'],
            'cabin_justification' => ['nullable', 'string', 'max:2000'],
            'route_is_most_economical' => ['nullable', 'boolean'],
            'route_justification' => ['nullable', 'string', 'max:2000'],
            'personal_incremental_cost' => ['nullable', 'numeric', 'min:0'],
            'personal_cost_acknowledged' => ['nullable', 'boolean'],
            'vehicle_type'        => ['nullable', 'string', 'max:100'],
            'driver_required'     => ['nullable', 'boolean'],
            'driver_name'         => ['nullable', 'string', 'max:150'],
            'is_emergency'        => ['nullable', 'boolean'],
            'emergency_reason'    => ['nullable', 'string', 'max:2000'],
            'official_personal_days' => ['nullable', 'array'],
            'funding_details'     => ['nullable', 'array'],
            'funding_lines'       => ['nullable', 'array'],
            'prepared_on_behalf_of' => ['nullable', 'integer', 'exists:users,id'],
            'itineraries'         => ['nullable', 'array'],
            'itineraries.*.from_location'  => ['required_with:itineraries', 'string'],
            'itineraries.*.to_location'    => ['required_with:itineraries', 'string'],
            'itineraries.*.travel_date'    => ['required_with:itineraries', 'date'],
            'itineraries.*.transport_mode' => ['required_with:itineraries', 'string'],
            'itineraries.*.days_count'     => ['nullable', 'integer', 'min:1'],
            'itineraries.*.day_type'       => ['nullable', 'string', 'in:official,personal_extension,personal_stopover'],
        ]);

        $travel = $this->travelService->create($data, $request->user());

        return response()->json(['message' => 'Travel request created.', 'data' => $travel], 201);
    }

    public function update(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->authorizeRequestMutate($request->user(), $travelRequest);

        $data = $request->validate([
            'purpose'             => ['sometimes', 'string', 'max:500'],
            'departure_date'      => ['sometimes', 'date'],
            'return_date'         => ['sometimes', 'date', 'after_or_equal:departure_date'],
            'destination_country' => ['sometimes', 'string', 'max:100'],
            'destination_city'    => ['nullable', 'string', 'max:100'],
            'estimated_dsa'       => ['nullable', 'numeric', 'min:0'],
            'justification'       => ['nullable', 'string', 'max:2000'],
            'workplan_event_id'   => ['nullable', 'integer', 'exists:workplan_events,id'],
            'programme_id'        => ['nullable', 'integer', 'exists:programmes,id'],
            'mission_id'          => ['nullable', 'integer', 'exists:travel_missions,id'],
            'host_organization'   => ['nullable', 'string', 'max:255'],
            'budget_line_id'      => ['nullable', 'integer'],
            'cabin_class'         => ['nullable', 'string', 'max:50'],
            'route_is_most_economical' => ['nullable', 'boolean'],
            'route_justification' => ['nullable', 'string', 'max:2000'],
            'personal_incremental_cost' => ['nullable', 'numeric', 'min:0'],
            'personal_cost_acknowledged' => ['nullable', 'boolean'],
            'vehicle_type'        => ['nullable', 'string', 'max:100'],
            'driver_required'     => ['nullable', 'boolean'],
            'driver_name'         => ['nullable', 'string', 'max:150'],
            'official_personal_days' => ['nullable', 'array'],
            'funding_details'     => ['nullable', 'array'],
            'funding_lines'       => ['nullable', 'array'],
            'is_emergency'        => ['nullable', 'boolean'],
            'emergency_reason'    => ['nullable', 'string', 'max:2000'],
        ]);

        $travel = $this->travelService->update($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Travel request updated.', 'data' => $travel]);
    }

    public function destroy(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->authorizeRequestMutate($request->user(), $travelRequest);
        $this->travelService->delete($travelRequest, $request->user());
        return response()->json(['message' => 'Travel request deleted.']);
    }

    public function submit(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $travel = $this->travelService->submit($travelRequest, $request->user());
        return response()->json(['message' => 'Travel request submitted.', 'data' => $travel]);
    }

    public function approve(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        if ($travelRequest->approvalRequest) {
            $data = $request->validate(['comment' => ['nullable', 'string', 'max:1000']]);
            $result = $this->workflowService->approve(
                $travelRequest->approvalRequest,
                $request->user(),
                $data['comment'] ?? null
            );
            return response()->json([
                'message'            => 'Travel request approved.',
                'data'               => $travelRequest->fresh(['requester', 'approver', 'itineraries', 'approvalRequest']),
                'notified_approvers' => $result['notified_approvers'],
            ]);
        }

        $this->authorizeLegacyApproval($request->user(), $travelRequest, [
            'Secretary General', 'HR Manager',
        ]);
        $travel = $this->travelService->approve($travelRequest, $request->user());
        return response()->json(['message' => 'Travel request approved.', 'data' => $travel]);
    }

    public function reject(Request $request, TravelRequest $travelRequest): JsonResponse
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

        if ($travelRequest->approvalRequest) {
            $this->workflowService->reject($travelRequest->approvalRequest, $request->user(), $reason);
            return response()->json([
                'message' => 'Travel request rejected.',
                'data'    => $travelRequest->fresh(['requester', 'approver', 'approvalRequest']),
            ]);
        }

        $this->authorizeLegacyApproval($request->user(), $travelRequest, [
            'Secretary General', 'HR Manager',
        ]);
        $travel = $this->travelService->reject($travelRequest, $reason, $request->user());
        return response()->json(['message' => 'Travel request rejected.', 'data' => $travel]);
    }

    public function returnForCorrection(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']]);
        abort_unless($travelRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->returnForCorrection(
            $travelRequest->approvalRequest,
            $request->user(),
            $data['comment']
        );
        return response()->json([
            'message' => 'Request returned to requester for correction.',
            'data'    => $travelRequest->fresh(['requester', 'approver', 'approvalRequest']),
        ]);
    }

    public function withdraw(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        abort_unless($travelRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->withdraw($travelRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Travel request withdrawn.',
            'data'    => $travelRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function resubmit(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        abort_unless($travelRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->resubmit($travelRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Travel request resubmitted.',
            'data'    => $travelRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function certificate(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->authorizeCertificateView($request->user(), $travelRequest, [
            'Finance Controller',
            'Secretary General',
            'System Admin',
            'System Administrator',
            'Director',
        ]);

        return response()->json([
            'data' => $travelRequest->load([
                'requester.department',
                'fundingLines',
                'dsaLines',
                'approvalRequest.history.user',
                'approvalRequest.workflow.steps',
            ]),
        ]);
    }

    public function saveDsa(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'rate_type' => ['nullable', 'integer', 'in:1,2,3'],
            'terminal_comms_total' => ['nullable', 'numeric', 'min:0'],
            'lines' => ['nullable', 'array'],
            'lines.*.date' => ['required_with:lines', 'date'],
            'lines.*.daily_rate' => ['nullable', 'numeric'],
            'lines.*.meal_deduction' => ['nullable', 'numeric'],
            'lines.*.adjustments' => ['nullable', 'numeric'],
            'lines.*.rate_type' => ['nullable', 'integer', 'in:1,2,3'],
            'lines.*.is_personal' => ['nullable', 'boolean'],
            'lines.*.destination' => ['nullable', 'string'],
            'lines.*.notes' => ['nullable', 'string'],
        ]);

        $travel = $this->dsaService->calculateAndSave($travelRequest, $data, $request->user());

        return response()->json([
            'message' => 'DSA calculation saved.',
            'data' => $travel,
            'warning' => $travel->getAttribute('dsa_day_variance_warning') ? [
                'expected_official_days' => $travel->getAttribute('dsa_expected_official_days'),
                'payable_line_count' => $travel->getAttribute('dsa_payable_line_count'),
            ] : null,
        ]);
    }

    public function confirmFunds(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate(['remarks' => ['nullable', 'string', 'max:2000']]);
        $travel = $this->travelService->confirmFunds($travelRequest, $request->user(), $data['remarks'] ?? null);
        return response()->json(['message' => 'Funds confirmed by Director Finance.', 'data' => $travel]);
    }

    public function markBooked(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'emergency_commit' => ['nullable', 'boolean'],
            'emergency_reason' => ['nullable', 'string', 'max:2000'],
        ]);
        $travel = $this->travelService->markBooked($travelRequest, $request->user(), $data);
        return response()->json(['message' => 'Travel marked as booked/committed.', 'data' => $travel]);
    }

    public function markReturned(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $travel = $this->travelService->markReturned($travelRequest, $request->user());
        return response()->json(['message' => 'Travel marked returned. TOIL candidates generated if applicable.', 'data' => $travel]);
    }

    public function completeRetirement(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $travel = $this->travelService->completeRetirement($travelRequest, $request->user());
        return response()->json(['message' => 'Travel retirement completed.', 'data' => $travel]);
    }

    public function requestAmendment(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'changes' => ['required', 'array'],
            'reason'  => ['nullable', 'string', 'max:2000'],
        ]);
        $amendment = $this->travelService->createAmendment(
            $travelRequest,
            $data['changes'],
            $request->user(),
            $data['reason'] ?? null
        );
        return response()->json(['message' => 'Amendment submitted.', 'data' => $amendment], 201);
    }

    public function approveAmendment(Request $request, TravelAmendment $amendment): JsonResponse
    {
        $user = $request->user();
        abort_unless(
            $user->can('travel.approve')
                || $user->can('travel.final-approve')
                || $user->isSystemAdmin()
                || $user->hasAnyRole(['Secretary General', 'Director', 'Finance Controller', 'System Admin', 'super-admin']),
            403
        );
        $travel = $this->travelService->approveAmendment($amendment, $user);
        return response()->json(['message' => 'Amendment approved.', 'data' => $travel]);
    }

    public function registerExport(Request $request): JsonResponse
    {
        $rows = $this->travelService->exportRegister($request->user(), $request->only(['status', 'search']));
        return response()->json(['data' => $rows]);
    }

    public function dsaRatesIndex(Request $request): JsonResponse
    {
        return response()->json($this->dsaService->listRates($request->user()->tenant_id, $request->only(['country', 'is_active', 'per_page'])));
    }

    public function dsaRatesStore(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.admin') || $request->user()->can('travel.finance-review') || $request->user()->isSystemAdmin(),
            403
        );
        $data = $request->validate([
            'id' => ['nullable', 'integer'],
            'country' => ['required', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'rate_type' => ['required', 'integer', 'in:1,2,3'],
            'rate_per_day' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'accommodation_component' => ['nullable', 'numeric'],
            'meal_component' => ['nullable', 'numeric'],
            'incidentals_component' => ['nullable', 'numeric'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
            'version' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);
        $rate = $this->dsaService->upsertRate($data, $request->user());
        return response()->json(['message' => 'DSA rate saved.', 'data' => $rate], 201);
    }

    public function toilIndex(Request $request): JsonResponse
    {
        $q = TravelToilCandidate::with(['travelRequest', 'user'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('candidate_date');
        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }
        return response()->json($q->paginate($request->integer('per_page', 20)));
    }

    public function toilAuthoriseOt(Request $request, TravelToilCandidate $candidate): JsonResponse
    {
        return response()->json([
            'message' => 'OT authorised.',
            'data' => $this->toilService->authoriseOt($candidate, $request->user()),
        ]);
    }

    public function toilConfirmDuty(Request $request, TravelToilCandidate $candidate): JsonResponse
    {
        return response()->json([
            'message' => 'Duty confirmed.',
            'data' => $this->toilService->confirmDuty($candidate, $request->user()),
        ]);
    }

    public function toilHrValidate(Request $request, TravelToilCandidate $candidate): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.review-toil')
                || $request->user()->hasAnyRole(['HR Manager', 'HR Administrator'])
                || $request->user()->isSystemAdmin(),
            403
        );
        return response()->json([
            'message' => 'TOIL credited via Leave accrual. No leave request was auto-created.',
            'data' => $this->toilService->hrValidateAndCredit($candidate, $request->user()),
        ]);
    }

    public function toilReject(Request $request, TravelToilCandidate $candidate): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        return response()->json([
            'message' => 'TOIL candidate rejected.',
            'data' => $this->toilService->reject($candidate, $data['reason'], $request->user()),
        ]);
    }

    public function toilExtend(Request $request, TravelToilCandidate $candidate): JsonResponse
    {
        $data = $request->validate(['expires_at' => ['nullable', 'date']]);
        return response()->json([
            'message' => 'TOIL expiry extended by SG.',
            'data' => $this->toilService->extendExpiry($candidate, $request->user(), $data['expires_at'] ?? null),
        ]);
    }

    public function missionsIndex(Request $request): JsonResponse
    {
        return response()->json($this->missionService->list($request->user(), $request->only(['search', 'per_page'])));
    }

    public function missionsShow(Request $request, TravelMission $mission): JsonResponse
    {
        $payload = $this->missionService->showWithReadiness($mission, $request->user());

        return response()->json([
            'data' => array_merge($payload['mission']->toArray(), [
                'summary' => $payload['summary'],
                'travellers' => $payload['travellers'],
            ]),
        ]);
    }

    public function analyticsSummary(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.export')
                || $request->user()->can('travel.view')
                || $request->user()->can('travel.finance-review')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Finance Controller', 'Secretary General', 'Director', 'System Admin']),
            403
        );

        return response()->json(['data' => $this->analyticsService->summary($request->user())]);
    }

    public function updateVisa(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'visa_required' => ['nullable', 'boolean'],
            'visa_status' => ['nullable', 'string', 'in:not_required,pending,appointment_scheduled,submitted,approved,rejected,expired'],
            'visa_expiry_date' => ['nullable', 'date'],
            'visa_appointment_date' => ['nullable', 'date'],
            'visa_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $travel = $this->visaReminderService->updateVisa($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Visa details updated.', 'data' => $travel]);
    }

    public function visaReminders(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.admin-review')
                || $request->user()->can('travel.admin')
                || $request->user()->can('travel.finance-review')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Administration Officer', 'Finance Controller', 'HR Manager', 'System Admin']),
            403
        );

        return response()->json(['data' => $this->visaReminderService->watchlist($request->user())->values()]);
    }

    public function pdf(Request $request, TravelRequest $travelRequest): Response
    {
        $this->authorizeCertificateView($request->user(), $travelRequest, [
            'Finance Controller',
            'Secretary General',
            'System Admin',
            'System Administrator',
            'Director',
            'Administration Officer',
            'HOD',
        ]);

        $pdf = $this->travelService->authorisationPdf($travelRequest);

        return $pdf->download('TRAVEL-'.$travelRequest->reference_number.'.pdf');
    }
}
