<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelAmendment;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Models\User;
use Carbon\Carbon;

class TravelDashboardService
{
    public function __construct(
        private readonly TravelAnalyticsService $analyticsService,
    ) {}

    public function traveller(User $user): array
    {
        $base = TravelRequest::query()
            ->where('tenant_id', $user->tenant_id)
            ->where(function ($q) use ($user) {
                $q->where('requester_id', $user->id)
                    ->orWhere('prepared_by', $user->id)
                    ->orWhere('prepared_on_behalf_of', $user->id);
            });

        $today = Carbon::today();

        return [
            'drafts' => (clone $base)->where('status', 'draft')->count(),
            'pending_approvals' => (clone $base)->whereIn('status', ['submitted', 'resubmitted'])->count(),
            'upcoming' => (clone $base)->where('status', 'approved')
                ->whereDate('departure_date', '>', $today->toDateString())->count(),
            'current_trip' => (clone $base)->where('status', 'approved')
                ->whereDate('departure_date', '<=', $today->toDateString())
                ->whereDate('return_date', '>=', $today->toDateString())->count(),
            'retirement_due' => (clone $base)->whereNotNull('returned_at')
                ->where(function ($q) {
                    $q->whereNull('retirement_status')
                        ->orWhereNotIn('retirement_status', ['completed', 'retired']);
                })->count(),
            'historical' => (clone $base)->whereIn('status', ['approved', 'cancelled', 'rejected'])
                ->whereDate('return_date', '<', $today->toDateString())->count(),
            'toil_pending' => TravelToilCandidate::query()
                ->where('tenant_id', $user->tenant_id)
                ->where('user_id', $user->id)
                ->whereNotIn('status', [
                    TravelToilCandidate::STATUS_CREDITED,
                    TravelToilCandidate::STATUS_REJECTED,
                    TravelToilCandidate::STATUS_LAPSED,
                ])->count(),
            'documents_pending' => (clone $base)->where('status', 'approved')
                ->whereNull('booking_committed_at')->count(),
        ];
    }

    public function admin(User $user): array
    {
        $tenantId = $user->tenant_id;
        $today = Carbon::today();
        $soon = $today->copy()->addDays(14);

        $approved = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved');

        return [
            'new_approved' => (clone $approved)->where('approved_at', '>=', $today->copy()->subDays(7))->count(),
            'needs_itinerary' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('status', ['submitted', 'resubmitted', 'approved'])
                ->whereDoesntHave('itineraries')->count(),
            'vehicle_requests' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('vehicle_type')
                ->where('vehicle_type', '!=', '')
                ->whereIn('status', ['submitted', 'resubmitted', 'approved'])->count(),
            'bookings_pending' => (clone $approved)->whereNull('booking_committed_at')->count(),
            'visas_pending' => (clone $approved)
                ->where('visa_required', true)
                ->where(function ($q) {
                    $q->whereNull('visa_status')->orWhereIn('visa_status', ['pending', 'appointment_scheduled', 'submitted']);
                })->count(),
            'tickets_pending' => (clone $approved)->whereNull('booking_committed_at')->count(),
            'accommodation_pending' => (clone $approved)
                ->whereDoesntHave('accommodations')->count(),
            'departing_soon' => (clone $approved)
                ->whereDate('departure_date', '>=', $today->toDateString())
                ->whereDate('departure_date', '<=', $soon->toDateString())->count(),
            'amendments_open' => TravelAmendment::query()
                ->whereHas('travelRequest', fn ($q) => $q->where('tenant_id', $tenantId))
                ->whereIn('status', ['pending', 'submitted'])->count(),
            'cancellations' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->where('status', 'cancelled')->count(),
            'missions' => \App\Models\TravelMission::where('tenant_id', $tenantId)->count(),
            'readiness_issues' => (clone $approved)->whereNull('booking_committed_at')->count(),
        ];
    }

    public function finance(User $user): array
    {
        $tenantId = $user->tenant_id;
        $analytics = $this->analyticsService->summary($user);

        return [
            'dsa_pending' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereIn('status', ['submitted', 'resubmitted', 'approved'])
                ->where(function ($q) {
                    $q->whereNull('finance_status')->orWhere('finance_status', '!=', 'dsa_calculated');
                })->count(),
            'funds_confirmation_pending' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('finance_status')
                ->whereNull('director_finance_confirmed_at')->count(),
            'approved_payments' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->where('status', 'approved')
                ->whereNotNull('director_finance_confirmed_at')->count(),
            'travel_advances' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereHas('imprestRequests')->count(),
            'travel_retirements' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('returned_at')->count(),
            'outstanding_imprest' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereHas('imprestRequests', function ($q) {
                    $q->whereNotIn('status', ['retired', 'closed', 'rejected']);
                })->count(),
            'overdue_retirement' => TravelRequest::query()
                ->where('tenant_id', $tenantId)
                ->whereNotNull('returned_at')
                ->whereNotNull('retirement_due_at')
                ->whereDate('retirement_due_at', '<', Carbon::today()->toDateString())
                ->where(function ($q) {
                    $q->whereNull('retirement_status')
                        ->orWhereNotIn('retirement_status', ['completed', 'retired']);
                })->count(),
            'cost_by_programme' => $analytics['cost_by_programme'],
            'cost_by_donor' => $analytics['cost_by_funding_agency'],
            'commitments' => [
                'finance_dsa_total' => $analytics['totals']['finance_dsa_total'] ?? 0,
                'estimated_dsa_total' => $analytics['totals']['estimated_dsa_total'] ?? 0,
            ],
        ];
    }
}
