<?php
namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\TravelRequest;
use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class TravelService
{
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = TravelRequest::with(['requester', 'itineraries'])
            ->orderByDesc('created_at');

        if ($user->hasRole('staff')) {
            $query->where('requester_id', $user->id);
        }

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['search'])) {
            $query->where(function ($q) use ($filters) {
                $q->where('reference_number', 'ilike', "%{$filters['search']}%")
                  ->orWhere('purpose', 'ilike', "%{$filters['search']}%")
                  ->orWhere('destination_country', 'ilike', "%{$filters['search']}%");
            });
        }

        return $query->paginate($filters['per_page'] ?? 20);
    }

    public function create(array $data, User $user): TravelRequest
    {
        $travel = TravelRequest::create([
            'tenant_id'           => $user->tenant_id,
            'requester_id'        => $user->id,
            'reference_number'    => 'TRV-' . strtoupper(Str::random(8)),
            'purpose'             => $data['purpose'],
            'status'              => 'draft',
            'departure_date'      => $data['departure_date'],
            'return_date'         => $data['return_date'],
            'destination_country' => $data['destination_country'],
            'destination_city'    => $data['destination_city'] ?? null,
            'estimated_dsa'       => $data['estimated_dsa'] ?? 0,
            'currency'            => $data['currency'] ?? 'USD',
            'justification'       => $data['justification'] ?? null,
        ]);

        if (!empty($data['itineraries'])) {
            foreach ($data['itineraries'] as $leg) {
                $travel->itineraries()->create($leg);
            }
        }

        AuditLog::record('travel.created', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['reference' => $travel->reference_number, 'purpose' => $travel->purpose],
            'tags'           => 'travel',
        ]);

        return $travel->load(['requester', 'itineraries']);
    }

    public function update(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        if (!$travel->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be edited.']);
        }

        $travel->update(array_filter([
            'purpose'             => $data['purpose'] ?? null,
            'departure_date'      => $data['departure_date'] ?? null,
            'return_date'         => $data['return_date'] ?? null,
            'destination_country' => $data['destination_country'] ?? null,
            'destination_city'    => $data['destination_city'] ?? null,
            'estimated_dsa'       => $data['estimated_dsa'] ?? null,
            'currency'            => $data['currency'] ?? null,
            'justification'       => $data['justification'] ?? null,
        ], fn($v) => $v !== null));

        AuditLog::record('travel.updated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh(['requester', 'itineraries']);
    }

    public function submit(TravelRequest $travel, User $user): TravelRequest
    {
        if (!$travel->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be submitted.']);
        }

        $travel->update(['status' => 'submitted', 'submitted_at' => now()]);

        AuditLog::record('travel.submitted', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        return $travel->fresh();
    }

    public function approve(TravelRequest $travel, User $approver): TravelRequest
    {
        if (!$travel->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be approved.']);
        }

        $travel->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        AuditLog::record('travel.approved', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'tags'           => 'travel',
        ]);

        // Add approved mission to the workplan calendar
        $travel->loadMissing('requester');
        WorkplanEvent::updateOrCreate(
            ['linked_module' => 'travel', 'linked_id' => $travel->id],
            [
                'tenant_id'   => $travel->tenant_id,
                'created_by'  => $approver->id,
                'title'       => 'Mission: ' . $travel->purpose . ' — ' . $travel->destination_country,
                'type'        => 'travel',
                'date'        => $travel->departure_date,
                'end_date'    => $travel->return_date,
                'responsible' => $travel->requester?->name,
                'description' => $travel->reference_number,
            ]
        );

        return $travel->fresh(['requester', 'approver']);
    }

    public function reject(TravelRequest $travel, string $reason, User $approver): TravelRequest
    {
        if (!$travel->isSubmitted()) {
            throw ValidationException::withMessages(['status' => 'Only submitted requests can be rejected.']);
        }

        $travel->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        AuditLog::record('travel.rejected', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => 'travel',
        ]);

        return $travel->fresh();
    }

    public function delete(TravelRequest $travel): void
    {
        if (!$travel->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft requests can be deleted.']);
        }
        $travel->delete();
    }
}
