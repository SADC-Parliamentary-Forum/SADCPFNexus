<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementQuote;
use App\Models\RfqInvitation;
use App\Models\Vendor;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ExternalRfqController extends Controller
{
    public function show(string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);

        return response()->json([
            'data' => [
                'invitation' => $invitation->load(['quote']),
                'request'    => $invitation->procurementRequest()->with(['items', 'supplierCategories'])->first(),
                'can_submit' => !$invitation->response_expires_at || now()->lt($invitation->response_expires_at),
            ],
        ]);
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $invitation = $this->resolveInvitation($token);
        $procurementRequest = $invitation->procurementRequest;

        if ($procurementRequest->status === 'awarded') {
            abort(422, 'This RFQ has already been awarded.');
        }
        if ($procurementRequest->rfq_deadline && now()->isAfter($procurementRequest->rfq_deadline->endOfDay())) {
            abort(422, 'The RFQ deadline has passed.');
        }
        if ($invitation->response_expires_at && now()->isAfter($invitation->response_expires_at)) {
            abort(422, 'This invitation has expired.');
        }

        $data = $request->validate([
            'vendor_name'    => ['required', 'string', 'max:300'],
            'quoted_amount'  => ['required', 'numeric', 'min:0.01'],
            'currency'       => ['nullable', 'string', 'size:3'],
            'quote_date'     => ['nullable', 'date'],
            'notes'          => ['nullable', 'string', 'max:2000'],
        ]);

        $matchedVendor = Vendor::query()
            ->where('tenant_id', $invitation->tenant_id)
            ->where('contact_email', $invitation->invited_email)
            ->first();

        $quote = ProcurementQuote::updateOrCreate(
            ['rfq_invitation_id' => $invitation->id],
            [
                'procurement_request_id' => $procurementRequest->id,
                'vendor_id'              => $matchedVendor?->id,
                'vendor_name'            => $data['vendor_name'],
                'quoted_amount'          => $data['quoted_amount'],
                'currency'               => $data['currency'] ?? $procurementRequest->currency,
                'submission_channel'     => 'email_link',
                'notes'                  => $data['notes'] ?? null,
                'quote_date'             => $data['quote_date'] ?? now()->toDateString(),
                'is_recommended'         => false,
            ]
        );

        $invitation->update([
            'status'       => 'responded',
            'responded_at' => now(),
        ]);

        return response()->json(['message' => 'Quote submitted.', 'data' => $quote], 201);
    }

    private function resolveInvitation(string $token): RfqInvitation
    {
        return RfqInvitation::query()
            ->where('response_token', $token)
            ->where('invitation_type', 'email')
            ->with('procurementRequest')
            ->firstOrFail();
    }
}
