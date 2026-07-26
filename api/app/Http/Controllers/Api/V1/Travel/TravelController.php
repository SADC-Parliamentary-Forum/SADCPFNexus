<?php
namespace App\Http\Controllers\Api\V1\Travel;

use App\Http\Controllers\Controller;
use App\Models\TravelAmendment;
use App\Models\TravelMission;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Modules\Travel\Services\TravelAnalyticsService;
use App\Modules\Travel\Services\TravelCalendarService;
use App\Modules\Travel\Services\TravelDashboardService;
use App\Modules\Travel\Services\TravelDsaService;
use App\Modules\Travel\Services\TravelFxRateService;
use App\Modules\Travel\Services\TravelHealthService;
use App\Modules\Travel\Services\TravelItineraryParseService;
use App\Modules\Travel\Services\TravelMissionService;
use App\Modules\Travel\Services\TravelPackService;
use App\Modules\Travel\Services\TravelProcurementLinkService;
use App\Modules\Travel\Services\TravelReportsPackService;
use App\Modules\Travel\Services\TravelService;
use App\Modules\Travel\Services\TravelToilService;
use App\Modules\Travel\Services\TravelVisaReminderService;
use App\Modules\Travel\Services\TravelVehicleService;
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
        private readonly TravelItineraryParseService $itineraryParseService,
        private readonly TravelFxRateService $fxRateService,
        private readonly TravelHealthService $healthService,
        private readonly TravelProcurementLinkService $procurementLinkService,
        private readonly TravelDashboardService $dashboardService,
        private readonly TravelCalendarService $calendarService,
        private readonly TravelPackService $packService,
        private readonly TravelReportsPackService $reportsPackService,
        private readonly TravelVehicleService $vehicleService,
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
            'procurementRequest', 'accommodations', 'imprestRequests',
            'vehicleAsset', 'sponsoredDeductionRate', 'budgetReservations',
        ]);

        $approval = $travelRequest->approvalRequest;
        $workflowMeta = $approval
            ? $this->workflowService->snapshot($approval)
            : null;

        $payload = $travelRequest->toArray();
        $payload = $this->healthService->redactForViewer($payload, $request->user(), $travelRequest);
        $payload['procurement_link_suggested'] = $this->fxRateService->procurementLinkSuggested($travelRequest);

        return response()->json([
            'data' => $payload,
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
            'sponsored_deduction_rate_id' => ['nullable', 'integer', 'exists:travel_sponsored_deduction_rates,id'],
            'meals_provided_by_host' => ['nullable', 'boolean'],
            'accommodation_provided_by_host' => ['nullable', 'boolean'],
            'private_vehicle_reason' => ['nullable', 'string', 'max:2000'],
            'private_vehicle_route' => ['nullable', 'string', 'max:500'],
            'estimated_kilometres' => ['nullable', 'numeric', 'min:0'],
            'mileage_rate_per_km' => ['nullable', 'numeric', 'min:0'],
            'equivalent_airfare' => ['nullable', 'numeric', 'min:0'],
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
        $data = $request->validate([
            'acknowledge_conflicts' => ['nullable', 'boolean'],
            'conflict_resolution_note' => ['nullable', 'string', 'max:2000'],
        ]);

        $travel = $this->travelService->submit($travelRequest, $request->user(), $data);
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
            'lines.*.fx_from_currency' => ['nullable', 'string', 'size:3'],
            'lines.*.fx_to_currency' => ['nullable', 'string', 'size:3'],
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
        $data = $request->validate([
            'expires_at' => ['nullable', 'date', 'after:today'],
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        return response()->json([
            'message' => 'TOIL expiry extended by SG.',
            'data' => $this->toilService->extendExpiry(
                $candidate,
                $request->user(),
                $data['expires_at'] ?? null,
                $data['reason'],
            ),
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
            'HR Manager',
            'HR Administrator',
        ]);

        $pdf = $this->travelService->authorisationPdf($travelRequest);

        return $pdf->download('TRAVEL-'.$travelRequest->reference_number.'.pdf');
    }

    public function parseItinerary(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $this->authorizeRequestView($request->user(), $travelRequest, [
            'Secretary General', 'HR Manager', 'Finance Controller', 'Director', 'Administration Officer', 'HOD',
        ]);

        $data = $request->validate([
            'raw_text' => ['required', 'string', 'max:50000'],
        ]);

        return response()->json([
            'data' => $this->itineraryParseService->preview($data['raw_text']),
        ]);
    }

    public function applyItinerary(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'raw_text' => ['required', 'string', 'max:50000'],
        ]);

        $travel = $this->itineraryParseService->apply($travelRequest, $data['raw_text'], $request->user());

        return response()->json(['message' => 'Itinerary legs applied.', 'data' => $travel]);
    }

    public function fxRatesIndex(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.finance-review')
                || $request->user()->can('travel.admin')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasRole('Finance Controller'),
            403
        );

        return response()->json(
            $this->fxRateService->list($request->user()->tenant_id, $request->only(['from_currency', 'to_currency', 'per_page']))
        );
    }

    public function fxRatesStore(Request $request): JsonResponse
    {
        $data = $request->validate([
            'id' => ['nullable', 'integer'],
            'from_currency' => ['required', 'string', 'size:3'],
            'to_currency' => ['required', 'string', 'size:3'],
            'rate' => ['required', 'numeric', 'gt:0'],
            'effective_date' => ['required', 'date'],
            'source' => ['nullable', 'string', 'in:manual,http'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $rate = $this->fxRateService->upsert($data, $request->user());

        return response()->json(['message' => 'FX rate saved.', 'data' => $rate], 201);
    }

    public function updateHealth(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'health_vaccination_required' => ['nullable', 'boolean'],
            'health_vaccination_status' => ['nullable', 'string', 'max:50'],
            'health_prophylaxis_required' => ['nullable', 'boolean'],
            'health_prophylaxis_status' => ['nullable', 'string', 'max:50'],
            'health_estimated_cost' => ['nullable', 'numeric', 'min:0'],
            'health_notes' => ['nullable', 'string', 'max:2000'],
            'health_cleared_at' => ['nullable', 'date'],
        ]);

        $travel = $this->healthService->update($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Health pack updated.', 'data' => $travel]);
    }

    public function updateProcurementLink(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'procurement_request_id' => ['nullable', 'integer', 'exists:procurement_requests,id'],
            'procurement_link_reason' => ['nullable', 'string', 'max:2000'],
            'procurement_link_required' => ['nullable', 'boolean'],
        ]);

        $travel = $this->procurementLinkService->link($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Procurement link updated.', 'data' => $travel]);
    }

    public function dashboardTraveller(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->dashboardService->traveller($request->user())]);
    }

    public function dashboardAdmin(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.admin-review')
                || $request->user()->can('travel.admin')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Administration Officer', 'System Admin', 'HOD', 'Secretary General']),
            403
        );

        return response()->json(['data' => $this->dashboardService->admin($request->user())]);
    }

    public function dashboardFinance(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.finance-review')
                || $request->user()->can('travel.director-finance-confirm')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Finance Controller', 'Director', 'System Admin', 'Secretary General']),
            403
        );

        return response()->json(['data' => $this->dashboardService->finance($request->user())]);
    }

    public function calendar(Request $request): JsonResponse
    {
        $data = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date', 'after_or_equal:from'],
        ]);
        $from = $data['from'] ?? now()->startOfMonth()->toDateString();
        $to = $data['to'] ?? now()->addMonths(2)->endOfMonth()->toDateString();

        return response()->json(['data' => $this->calendarService->events($request->user(), $from, $to)]);
    }

    public function storeAccommodation(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'hotel_name' => ['required', 'string', 'max:255'],
            'country' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'check_in' => ['nullable', 'date'],
            'check_out' => ['nullable', 'date', 'after_or_equal:check_in'],
            'room_type' => ['nullable', 'string', 'max:100'],
            'rate' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'paid_by' => ['nullable', 'string', 'in:sadc_pf,host,donor,self'],
            'confirmation_number' => ['nullable', 'string', 'max:100'],
            'cancellation_deadline' => ['nullable', 'date'],
            'contact' => ['nullable', 'string', 'max:255'],
            'attachment_id' => ['nullable', 'integer', 'exists:attachments,id'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $accommodation = $this->travelService->addAccommodation($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Accommodation recorded.', 'data' => $accommodation], 201);
    }

    public function updateVehicleMileage(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'private_vehicle_reason' => ['nullable', 'string', 'max:2000'],
            'private_vehicle_route' => ['nullable', 'string', 'max:500'],
            'estimated_kilometres' => ['required', 'numeric', 'min:0'],
            'mileage_rate_per_km' => ['required', 'numeric', 'min:0'],
            'equivalent_airfare' => ['nullable', 'numeric', 'min:0'],
        ]);

        $travel = $this->travelService->updateVehicleMileage($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Private vehicle mileage comparison saved.', 'data' => $travel]);
    }

    public function travelPack(Request $request, TravelRequest $travelRequest): Response|\Symfony\Component\HttpFoundation\StreamedResponse
    {
        $this->authorizeRequestView($request->user(), $travelRequest, [
            'Secretary General', 'HR Manager', 'Finance Controller', 'Director', 'Administration Officer', 'HOD',
        ]);

        abort_unless(
            $travelRequest->status === 'approved' && $travelRequest->booking_committed_at,
            422,
            'Travel pack is available after approval and booking.'
        );

        return $this->packService->download($travelRequest);
    }

    public function reportsPack(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.export')
                || $request->user()->can('travel.view')
                || $request->user()->can('travel.finance-review')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Finance Controller', 'Secretary General', 'Director', 'System Admin', 'Administration Officer']),
            403
        );

        return response()->json(['data' => $this->reportsPackService->pack($request->user())]);
    }

    public function reportsPackExport(Request $request): Response
    {
        abort_unless(
            $request->user()->can('travel.export')
                || $request->user()->can('travel.view')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Finance Controller', 'Secretary General', 'Director', 'System Admin', 'Administration Officer']),
            403
        );

        $data = $request->validate([
            'slice' => ['required', 'string'],
            'format' => ['nullable', 'string', 'in:csv'],
        ]);

        return $this->reportsPackService->exportCsv($request->user(), $data['slice']);
    }

    public function cancel(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $travel = $this->travelService->cancel($travelRequest, $request->user(), $data['reason']);

        return response()->json(['message' => 'Travel request cancelled. Budget reservation released if present.', 'data' => $travel]);
    }

    public function updatePersonalDays(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'days' => ['required', 'array', 'min:1'],
            'days.*.date' => ['required', 'date'],
            'days.*.type' => ['required', 'in:official,personal'],
        ]);
        $travel = $this->travelService->updatePersonalDays($travelRequest, $data['days'], $request->user());

        return response()->json(['message' => 'Personal / official days updated.', 'data' => $travel]);
    }

    public function linkImprest(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'amount_requested' => ['nullable', 'numeric', 'min:0.01'],
            'purpose' => ['nullable', 'string', 'max:2000'],
            'budget_line' => ['nullable', 'string', 'max:255'],
            'currency' => ['nullable', 'string', 'size:3'],
            'expected_liquidation_date' => ['nullable', 'date'],
            'justification' => ['nullable', 'string', 'max:5000'],
        ]);
        $imprest = $this->travelService->linkImprest($travelRequest, $data, $request->user());

        return response()->json([
            'message' => 'Imprest draft created and linked to travel.',
            'data' => $imprest,
        ], 201);
    }

    public function travellers(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->travelService->listTravellers($request->user())]);
    }

    public function fleetVehicles(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->vehicleService->listFleet($request->user())]);
    }

    public function assignVehicle(Request $request, TravelRequest $travelRequest): JsonResponse
    {
        $data = $request->validate([
            'vehicle_asset_id' => ['required', 'integer', 'exists:assets,id'],
            'acknowledge_conflicts' => ['nullable', 'boolean'],
            'conflict_resolution_note' => ['nullable', 'string', 'max:2000'],
        ]);
        $travel = $this->vehicleService->assign($travelRequest, $data, $request->user());

        return response()->json(['message' => 'Vehicle assigned.', 'data' => $travel]);
    }

    public function sponsoredRatesIndex(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.finance-review')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Finance Controller', 'System Admin']),
            403
        );

        return response()->json(['data' => $this->dsaService->listSponsoredRates($request->user()->tenant_id)]);
    }

    public function sponsoredRatesStore(Request $request): JsonResponse
    {
        abort_unless(
            $request->user()->can('travel.finance-review')
                || $request->user()->isSystemAdmin()
                || $request->user()->hasAnyRole(['Finance Controller', 'System Admin']),
            403
        );

        $data = $request->validate([
            'id' => ['nullable', 'integer'],
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:64'],
            'meal_deduction_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'accommodation_deduction_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'meal_deduction_fixed' => ['nullable', 'numeric', 'min:0'],
            'accommodation_deduction_fixed' => ['nullable', 'numeric', 'min:0'],
            'notes' => ['nullable', 'string'],
            'is_active' => ['nullable', 'boolean'],
            'effective_from' => ['nullable', 'date'],
            'effective_to' => ['nullable', 'date'],
        ]);

        $rate = $this->dsaService->upsertSponsoredRate($data, $request->user());

        return response()->json(['message' => 'Sponsored deduction rate saved.', 'data' => $rate], empty($data['id']) ? 201 : 200);
    }
}
