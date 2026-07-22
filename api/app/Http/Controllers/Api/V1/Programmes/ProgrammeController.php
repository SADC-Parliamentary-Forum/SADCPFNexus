<?php
namespace App\Http\Controllers\Api\V1\Programmes;

use App\Http\Controllers\Controller;
use App\Models\Programme;
use App\Modules\Programmes\Services\ProgrammeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ProgrammeController extends Controller
{
    public function __construct(private readonly ProgrammeService $service) {}

    /**
     * Resolves what a field's value will be *after* this request is applied:
     * the request's value if the request touches the field, otherwise the
     * existing Programme's current value (only meaningful on update — $programme
     * is null on store(), where nothing exists yet so the request is authoritative).
     *
     * Without this, a PUT that updates one half of a conditional pair (e.g. only
     * 'conflict_details' without resending 'conflict_declared') would see the
     * companion field as null/absent in the request and silently skip the
     * requiredIf check, even though the DB row already has it set — the same
     * class of bug fixed for 'owner_name' (ProgrammeDocumentController) and
     * 'departure_date' (ProgrammeArrivalDepartureController) in earlier tasks.
     */
    private function resulting(Request $request, ?Programme $programme, string $field)
    {
        if ($request->has($field)) {
            return $request->input($field);
        }
        return $programme?->{$field};
    }

    private function resultingBool(Request $request, ?Programme $programme, string $field): bool
    {
        return (bool) $this->resulting($request, $programme, $field);
    }

    /** @return array<int, mixed> */
    private function resultingArray(Request $request, ?Programme $programme, string $field): array
    {
        $value = $this->resulting($request, $programme, $field);
        return is_array($value) ? $value : [];
    }

    /**
     * Builds the validation rules for the new PIF sections (venue, budget/
     * participant provisions, personnel/consultants, interpretation, support
     * services, conflict of interest). Shared by store() (where $programme is
     * null) and update() (where $programme is the route-bound model, used to
     * resolve conditional companion fields the request doesn't resend).
     */
    private function sectionRules(Request $request, ?Programme $programme): array
    {
        return [
            // Venue
            'venue_country'                     => ['nullable', 'string', 'max:255'],
            'venue_city'                         => ['nullable', 'string', 'max:255'],
            'venue_proposed_hotel'               => ['nullable', 'string', 'max:255'],
            'venue_accommodation_required'       => ['nullable', 'boolean'],
            'venue_accommodation_count'          => [
                Rule::requiredIf(fn () =>
                    ($request->has('venue_accommodation_required') || $request->has('venue_accommodation_count'))
                    && $this->resultingBool($request, $programme, 'venue_accommodation_required')),
                'nullable', 'integer', 'min:1',
            ],
            'venue_conferencing_required'        => ['nullable', 'boolean'],
            'venue_conferencing_participants'    => [
                Rule::requiredIf(fn () =>
                    ($request->has('venue_conferencing_required') || $request->has('venue_conferencing_participants'))
                    && $this->resultingBool($request, $programme, 'venue_conferencing_required')),
                'nullable', 'integer', 'min:1',
            ],
            'venue_quotation_attached'           => ['nullable', 'boolean'],
            'venue_hotel_quotation_attached'     => ['nullable', 'boolean'],
            'venue_accessibility_requirements'   => ['nullable', 'string'],
            'venue_security_considerations'      => ['nullable', 'string'],
            'venue_comments'                     => ['nullable', 'string'],
            // Budget / participant provisions (Finance-only fields intentionally excluded)
            'proposed_dsa_rate'                  => ['nullable', 'numeric', 'min:0'],
            'original_budget_rate'               => ['nullable', 'numeric', 'min:0'],
            'dsa_variance_reason'                => [
                Rule::requiredIf(function () use ($request, $programme) {
                    if (!$request->has('proposed_dsa_rate') && !$request->has('original_budget_rate') && !$request->has('dsa_variance_reason')) {
                        return false;
                    }
                    $proposed = $this->resulting($request, $programme, 'proposed_dsa_rate');
                    $original = $this->resulting($request, $programme, 'original_budget_rate');
                    if ($proposed === null || $proposed === '' || $original === null || $original === '') {
                        return false;
                    }
                    return (float) $proposed !== (float) $original;
                }),
                'nullable', 'string',
            ],
            'proposed_participants'              => ['nullable', 'integer', 'min:0'],
            'budgeted_participants'               => ['nullable', 'integer', 'min:0'],
            'participants_variance_reason'       => [
                Rule::requiredIf(function () use ($request, $programme) {
                    if (!$request->has('proposed_participants') && !$request->has('budgeted_participants') && !$request->has('participants_variance_reason')) {
                        return false;
                    }
                    $proposed = $this->resulting($request, $programme, 'proposed_participants');
                    $budgeted = $this->resulting($request, $programme, 'budgeted_participants');
                    if ($proposed === null || $proposed === '' || $budgeted === null || $budgeted === '') {
                        return false;
                    }
                    return (int) $proposed !== (int) $budgeted;
                }),
                'nullable', 'string',
            ],
            'proposed_funding_difference'        => ['nullable', 'numeric', 'min:0'],
            'estimated_activity_amount'          => ['nullable', 'numeric', 'min:0'],
            // Consultants
            'secretariat_staff_required'         => ['nullable', 'boolean'],
            'secretariat_staff_count'            => ['nullable', 'integer', 'min:0'],
            'consultants_required'               => ['nullable', 'boolean'],
            'consultants_count'                  => ['nullable', 'integer', 'min:0'],
            'consultants_rate'                   => ['nullable', 'numeric', 'min:0'],
            'resource_persons_required'          => ['nullable', 'boolean'],
            'resource_persons_count'             => ['nullable', 'integer', 'min:0'],
            'resource_persons_rate'              => ['nullable', 'numeric', 'min:0'],
            'rapporteurs_required'               => ['nullable', 'boolean'],
            'rapporteurs_count'                  => ['nullable', 'integer', 'min:0'],
            'rapporteurs_rate'                   => ['nullable', 'numeric', 'min:0'],
            'media_liaison_required'             => ['nullable', 'boolean'],
            'media_liaison_count'                => ['nullable', 'integer', 'min:0'],
            'local_support_required'             => ['nullable', 'boolean'],
            'local_support_count'                => ['nullable', 'integer', 'min:0'],
            'local_support_rate'                 => ['nullable', 'numeric', 'min:0'],
            'personnel_comments'                 => ['nullable', 'string'],
            // Interpretation
            'interpretation_required'            => ['nullable', 'boolean'],
            'en_fr_required'                     => ['nullable', 'boolean'],
            'en_fr_interpreters_count'           => [
                Rule::requiredIf(fn () =>
                    ($request->has('en_fr_required') || $request->has('en_fr_interpreters_count'))
                    && $this->resultingBool($request, $programme, 'en_fr_required')),
                'nullable', 'integer', 'min:1',
            ],
            'en_pt_required'                     => ['nullable', 'boolean'],
            'en_pt_interpreters_count'           => [
                Rule::requiredIf(fn () =>
                    ($request->has('en_pt_required') || $request->has('en_pt_interpreters_count'))
                    && $this->resultingBool($request, $programme, 'en_pt_required')),
                'nullable', 'integer', 'min:1',
            ],
            'fr_pt_required'                     => ['nullable', 'boolean'],
            'fr_pt_interpreters_count'           => [
                Rule::requiredIf(fn () =>
                    ($request->has('fr_pt_required') || $request->has('fr_pt_interpreters_count'))
                    && $this->resultingBool($request, $programme, 'fr_pt_required')),
                'nullable', 'integer', 'min:1',
            ],
            'interpreter_rate'                   => ['nullable', 'numeric', 'min:0'],
            'interpreter_source'                 => ['nullable', 'string', Rule::in(['internal', 'supplier', 'partner', 'other'])],
            'interpreter_source_other_note'      => [
                Rule::requiredIf(fn () =>
                    ($request->has('interpreter_source') || $request->has('interpreter_source_other_note'))
                    && $this->resulting($request, $programme, 'interpreter_source') === 'other'),
                'nullable', 'string',
            ],
            'interpretation_equipment_required'  => ['nullable', 'boolean'],
            'translation_required'               => ['nullable', 'boolean'],
            'languages_required'                 => [
                Rule::requiredIf(fn () =>
                    ($request->has('translation_required') || $request->has('languages_required'))
                    && $this->resultingBool($request, $programme, 'translation_required')),
                'nullable', 'array',
            ],
            'languages_required.*'               => ['string', 'max:100'],
            'interpretation_comments'            => ['nullable', 'string'],
            // Support services
            'support_services'                   => ['nullable', 'array'],
            'support_services.*'                 => ['string'],
            'support_services_other_note'        => [
                Rule::requiredIf(fn () =>
                    ($request->has('support_services') || $request->has('support_services_other_note'))
                    && in_array('other', $this->resultingArray($request, $programme, 'support_services'), true)),
                'nullable', 'string',
            ],
            // Conflict of interest — conflict_declared_by/at deliberately absent (server-side only)
            'conflict_declared'                  => ['nullable', 'boolean'],
            'conflict_details'                   => [
                Rule::requiredIf(fn () =>
                    ($request->has('conflict_declared') || $request->has('conflict_details'))
                    && $this->resultingBool($request, $programme, 'conflict_declared')),
                'nullable', 'string',
            ],
            'conflict_mitigation'                => [
                Rule::requiredIf(fn () =>
                    ($request->has('conflict_declared') || $request->has('conflict_mitigation'))
                    && $this->resultingBool($request, $programme, 'conflict_declared')),
                'nullable', 'string',
            ],
        ];
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'search', 'per_page']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(Programme $programme): JsonResponse
    {
        return response()->json($this->service->get($programme));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'                     => ['required', 'string', 'max:500'],
            'strategic_pillar'          => ['nullable', 'string', 'max:255'],
            'strategic_pillars'         => ['nullable', 'array'],
            'strategic_pillars.*'       => ['string', 'max:255'],
            'implementing_department'   => ['nullable', 'string', 'max:255'],
            'implementing_departments'  => ['nullable', 'array'],
            'implementing_departments.*'=> ['string', 'max:255'],
            'background'                => ['nullable', 'string'],
            'overall_objective'         => ['nullable', 'string'],
            'primary_currency'          => ['nullable', 'string', 'size:3'],
            'base_currency'             => ['nullable', 'string', 'size:3'],
            'exchange_rate'             => ['nullable', 'numeric', 'min:0'],
            'contingency_pct'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'total_budget'               => ['nullable', 'numeric', 'min:0'],
            'funding_source'            => ['nullable', 'string', 'max:255'],
            'funding_sources'           => ['nullable', 'array'],
            'funding_sources.*.name'    => ['required', 'string', 'max:255'],
            'funding_sources.*.budget_amount' => ['nullable', 'numeric', 'min:0'],
            'funding_sources.*.pays_for'=> ['nullable', 'string', 'max:1000'],
            'responsible_officer_id'    => ['nullable', 'integer', 'exists:users,id'],
            'responsible_officer_ids'   => ['nullable', 'array'],
            'responsible_officer_ids.*' => ['integer', 'exists:users,id'],
            'start_date'                => ['nullable', 'date'],
            'end_date'                  => ['nullable', 'date', 'after_or_equal:start_date'],
            'travel_required'           => ['nullable', 'boolean'],
            'delegates_count'            => ['nullable', 'integer', 'min:0'],
            'procurement_required'      => ['nullable', 'boolean'],
            'strategic_alignment'       => ['nullable', 'array'],
            'supporting_departments'    => ['nullable', 'array'],
            'specific_objectives'       => ['nullable', 'array'],
            'expected_outputs'         => ['nullable', 'array'],
            'target_beneficiaries'     => ['nullable', 'array'],
            'member_states'             => ['nullable', 'array'],
            'travel_services'          => ['nullable', 'array'],
            'media_options'             => ['nullable', 'array'],
            'activities'                => ['nullable', 'array'],
            'milestones'                => ['nullable', 'array'],
            'deliverables'              => ['nullable', 'array'],
            'budget_lines'              => ['nullable', 'array'],
            'procurement_items'         => ['nullable', 'array'],
        ] + $this->sectionRules($request, null));

        $programme = $this->service->create($data, $request->user());
        return response()->json(['message' => 'Programme created.', 'data' => $programme], 201);
    }

    public function update(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate([
            'title'                     => ['sometimes', 'string', 'max:500'],
            'strategic_pillar'          => ['nullable', 'string', 'max:255'],
            'strategic_pillars'         => ['nullable', 'array'],
            'strategic_pillars.*'       => ['string', 'max:255'],
            'implementing_department'   => ['nullable', 'string', 'max:255'],
            'implementing_departments'  => ['nullable', 'array'],
            'implementing_departments.*'=> ['string', 'max:255'],
            'background'                => ['nullable', 'string'],
            'overall_objective'         => ['nullable', 'string'],
            'primary_currency'          => ['nullable', 'string', 'size:3'],
            'base_currency'             => ['nullable', 'string', 'size:3'],
            'exchange_rate'             => ['nullable', 'numeric', 'min:0'],
            'contingency_pct'            => ['nullable', 'numeric', 'min:0', 'max:100'],
            'total_budget'               => ['nullable', 'numeric', 'min:0'],
            'funding_source'            => ['nullable', 'string', 'max:255'],
            'funding_sources'           => ['nullable', 'array'],
            'funding_sources.*.name'    => ['required', 'string', 'max:255'],
            'funding_sources.*.budget_amount' => ['nullable', 'numeric', 'min:0'],
            'funding_sources.*.pays_for'=> ['nullable', 'string', 'max:1000'],
            'responsible_officer_id'    => ['nullable', 'integer', 'exists:users,id'],
            'responsible_officer_ids'    => ['nullable', 'array'],
            'responsible_officer_ids.*' => ['integer', 'exists:users,id'],
            'start_date'                => ['nullable', 'date'],
            'end_date'                  => ['nullable', 'date'],
            'travel_required'           => ['nullable', 'boolean'],
            'delegates_count'            => ['nullable', 'integer', 'min:0'],
            'procurement_required'      => ['nullable', 'boolean'],
        ] + $this->sectionRules($request, $programme));

        $programme = $this->service->update($programme, $data, $request->user());
        return response()->json(['message' => 'Programme updated.', 'data' => $programme]);
    }

    public function destroy(Programme $programme): JsonResponse
    {
        $this->service->delete($programme);
        return response()->json(['message' => 'Programme deleted.']);
    }

    public function submit(Request $request, Programme $programme): JsonResponse
    {
        $result = $this->service->submit($programme, $request->user());
        return response()->json(['message' => 'Programme submitted.', 'data' => $result]);
    }

    public function approve(Request $request, Programme $programme): JsonResponse
    {
        $result = $this->service->approve($programme, $request->user());
        return response()->json(['message' => 'Programme approved.', 'data' => $result]);
    }

    public function reject(Request $request, Programme $programme): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $result = $this->service->reject($programme, $data['reason'], $request->user());
        return response()->json(['message' => 'Programme rejected.', 'data' => $result]);
    }
}
