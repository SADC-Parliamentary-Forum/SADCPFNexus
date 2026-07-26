<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\ProcurementRequest;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Validation\ValidationException;

class TravelProcurementLinkService
{
    public function link(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        if (! $user->isSystemAdmin()
            && (int) $travel->requester_id !== (int) $user->id
            && ! $user->can('travel.admin')
            && ! $user->can('travel.admin-review')
            && ! $user->can('travel.finance-review')
            && ! $user->hasAnyRole(['Administration Officer', 'Finance Controller', 'Procurement Officer'])) {
            abort(403, 'Not authorised to link procurement.');
        }

        $procId = $data['procurement_request_id'] ?? null;

        if ($procId !== null) {
            $proc = ProcurementRequest::where('tenant_id', $travel->tenant_id)->find($procId);
            if (! $proc) {
                throw ValidationException::withMessages([
                    'procurement_request_id' => 'Procurement request not found in this tenant.',
                ]);
            }
        }

        $travel->update([
            'procurement_request_id' => $procId,
            'procurement_link_reason' => $data['procurement_link_reason'] ?? $travel->procurement_link_reason,
            'procurement_link_required' => (bool) ($data['procurement_link_required'] ?? false),
        ]);

        AuditLog::record('travel.procurement_linked', [
            'auditable_type' => TravelRequest::class,
            'auditable_id' => $travel->id,
            'new_values' => [
                'procurement_request_id' => $procId,
                'procurement_link_required' => (bool) ($data['procurement_link_required'] ?? false),
                'reason' => $data['procurement_link_reason'] ?? null,
            ],
        ]);

        return $travel->fresh(['procurementRequest']);
    }
}
