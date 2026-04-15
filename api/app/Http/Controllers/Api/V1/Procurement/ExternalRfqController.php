<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementQuote;
use App\Models\RfqInvitation;
use App\Models\User;
use App\Models\Vendor;
use App\Services\NotificationService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;

class ExternalRfqController extends Controller
{
    public function __construct(private readonly NotificationService $notifications) {}

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

        $this->notifyProcurementOfQuoteSubmission(
            tenantId: $invitation->tenant_id,
            reference: $procurementRequest->reference_number,
            title: $procurementRequest->title,
            supplier: $data['vendor_name'],
            amount: number_format((float) $quote->quoted_amount, 2) . ' ' . $quote->currency,
            url: '/procurement/rfq/' . $procurementRequest->id
        );

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

    private function procurementRecipients(int $tenantId): Collection
    {
        return User::query()
            ->with(['roles.permissions', 'permissions'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $user) => $user->isSystemAdmin() || $user->hasAnyPermission(['procurement.manage_vendors', 'procurement.admin']))
            ->values();
    }

    private function notifyProcurementOfQuoteSubmission(
        int $tenantId,
        string $reference,
        string $title,
        string $supplier,
        string $amount,
        string $url
    ): void {
        foreach ($this->procurementRecipients($tenantId) as $recipient) {
            $this->notifications->dispatch(
                $recipient,
                'supplier.quote_submitted',
                [
                    'name'      => $recipient->name,
                    'reference' => $reference,
                    'title'     => $title,
                    'supplier'  => $supplier,
                    'amount'    => $amount,
                ],
                ['module' => 'procurement', 'url' => $url]
            );
        }
    }
}
