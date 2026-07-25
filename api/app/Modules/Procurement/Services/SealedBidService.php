<?php

namespace App\Modules\Procurement\Services;

use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tender;
use Illuminate\Support\Collection;

class SealedBidService
{
    public function isFinanciallySealed(ProcurementRequest $request): bool
    {
        $tender = $request->relationLoaded('tender')
            ? $request->tender
            : $request->tender()->first();

        if ($tender instanceof Tender) {
            return $tender->isSealed();
        }

        // RFQ sealed until deadline passes when method is tender without tender row yet
        if ($request->procurement_method === 'tender' && $request->rfq_deadline) {
            return ! now()->isAfter($request->rfq_deadline->endOfDay());
        }

        return false;
    }

    public function redactQuotes(Collection $quotes, ProcurementRequest $request): Collection
    {
        $sealed = $this->isFinanciallySealed($request);

        return $quotes->map(function (ProcurementQuote $quote) use ($sealed) {
            $payload = $quote->toArray();
            $payload['financials_sealed'] = $sealed;
            if ($sealed) {
                unset($payload['quoted_amount']);
            }

            return $payload;
        })->values();
    }

    public function assertSubmissionsOpen(ProcurementRequest $request): void
    {
        $tender = $request->tender()->first();
        if ($tender instanceof Tender) {
            if (in_array($tender->status, [Tender::STATUS_CLOSED, Tender::STATUS_OPENED, Tender::STATUS_EVALUATING, Tender::STATUS_AWARDED, Tender::STATUS_CANCELLED], true)) {
                abort(422, 'The tender submission window is closed.');
            }
            if ($tender->isPastDeadline()) {
                abort(422, 'The tender deadline has passed.');
            }
        }

        if ($request->rfq_deadline && now()->isAfter($request->rfq_deadline->endOfDay())) {
            abort(422, 'The RFQ deadline has passed.');
        }
    }

    /**
     * Create a versioned replacement for an existing portal quote.
     */
    public function replaceOrCreatePortalQuote(
        ProcurementRequest $request,
        int $invitationId,
        array $attributes
    ): ProcurementQuote {
        $this->assertSubmissionsOpen($request);

        $current = ProcurementQuote::query()
            ->where('rfq_invitation_id', $invitationId)
            ->where('is_current', true)
            ->latest('id')
            ->first();

        if (!$current) {
            return ProcurementQuote::create(array_merge($attributes, [
                'rfq_invitation_id'      => $invitationId,
                'procurement_request_id' => $request->id,
                'version'                => 1,
                'is_current'             => true,
            ]));
        }

        $current->update(['is_current' => false]);

        return ProcurementQuote::create(array_merge($attributes, [
            'rfq_invitation_id'      => $invitationId,
            'procurement_request_id' => $request->id,
            'version'                => ((int) $current->version) + 1,
            'supersedes_quote_id'    => $current->id,
            'is_current'             => true,
        ]));
    }
}
