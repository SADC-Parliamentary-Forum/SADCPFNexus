<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\Contract;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tender;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TenderService
{
    public function __construct(private readonly ProcurementService $procurementService) {}

    public function create(array $data, User $actor): Tender
    {
        $request = ProcurementRequest::query()
            ->where('tenant_id', $actor->tenant_id)
            ->findOrFail($data['procurement_request_id']);

        if (Tender::where('procurement_request_id', $request->id)->exists()) {
            throw ValidationException::withMessages([
                'procurement_request_id' => 'A tender already exists for this procurement request.',
            ]);
        }

        $tender = Tender::create([
            'tenant_id'              => $actor->tenant_id,
            'procurement_request_id' => $request->id,
            'tender_committee_id'    => $data['tender_committee_id'] ?? null,
            'title'                  => $data['title'],
            'notice'                 => $data['notice'] ?? null,
            'status'                 => Tender::STATUS_DRAFT,
            'sealed_mode'            => $data['sealed_mode'] ?? true,
            'submission_deadline'    => $data['submission_deadline'] ?? null,
            'technical_weight'       => $data['technical_weight'] ?? 80,
            'financial_weight'       => $data['financial_weight'] ?? 20,
            'min_technical_score'    => $data['min_technical_score'] ?? 70,
            'created_by'             => $actor->id,
        ]);

        if (($request->procurement_method ?? '') !== 'tender') {
            $request->update(['procurement_method' => 'tender']);
        }

        AuditLog::record('procurement.tender_created', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'tags'           => ['procurement', 'tender'],
        ]);

        return $tender->fresh(['procurementRequest', 'committee']);
    }

    public function publish(Tender $tender, User $actor): Tender
    {
        $this->assertTenant($tender, $actor);
        if ($tender->status !== Tender::STATUS_DRAFT) {
            throw ValidationException::withMessages(['status' => 'Only draft tenders can be published.']);
        }

        $this->procurementService->assertSplitAuthorisedIfRequired($tender->procurementRequest);

        $tender->update([
            'status'       => Tender::STATUS_PUBLISHED,
            'published_at' => now(),
        ]);

        if ($tender->submission_deadline && blank($tender->procurementRequest->rfq_deadline)) {
            $tender->procurementRequest->update([
                'rfq_deadline'  => $tender->submission_deadline,
                'rfq_issued_at' => now(),
                'rfq_issued_by' => $actor->id,
            ]);
        }

        AuditLog::record('procurement.tender_published', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'tags'           => ['procurement', 'tender'],
        ]);

        return $tender->fresh(['procurementRequest', 'committee']);
    }

    public function close(Tender $tender, User $actor): Tender
    {
        $this->assertTenant($tender, $actor);
        if ($tender->status !== Tender::STATUS_PUBLISHED) {
            throw ValidationException::withMessages(['status' => 'Only published tenders can be closed.']);
        }

        $tender->update([
            'status'    => Tender::STATUS_CLOSED,
            'closed_at' => now(),
        ]);

        return $tender->fresh(['procurementRequest', 'committee']);
    }

    public function openBids(Tender $tender, User $actor): Tender
    {
        $this->assertTenant($tender, $actor);
        if ($tender->status !== Tender::STATUS_CLOSED) {
            throw ValidationException::withMessages(['status' => 'Bids can only be opened after the tender is closed.']);
        }

        $tender->update([
            'status'         => Tender::STATUS_OPENED,
            'bids_opened_at' => now(),
            'bids_opened_by' => $actor->id,
        ]);

        AuditLog::record('procurement.tender_bids_opened', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'tags'           => ['procurement', 'tender'],
        ]);

        return $tender->fresh(['procurementRequest', 'committee']);
    }

    public function startEvaluation(Tender $tender, User $actor): Tender
    {
        $this->assertTenant($tender, $actor);
        if ($tender->status !== Tender::STATUS_OPENED) {
            throw ValidationException::withMessages(['status' => 'Evaluation can start only after bids are opened.']);
        }

        $tender->update([
            'status'                => Tender::STATUS_EVALUATING,
            'evaluation_started_at' => now(),
        ]);

        return $tender->fresh(['procurementRequest', 'committee']);
    }

    /**
     * SoD recommend only — never awards. A different user must call award().
     *
     * @param  array{quote_id:int,notes?:string}  $data
     */
    public function recommendAward(Tender $tender, array $data, User $actor): Tender
    {
        $this->assertTenant($tender, $actor);
        if (! in_array($tender->status, [Tender::STATUS_EVALUATING, Tender::STATUS_OPENED], true)) {
            throw ValidationException::withMessages([
                'status' => 'Only opened or evaluating tenders can receive an award recommendation.',
            ]);
        }

        $request = $tender->procurementRequest;
        if (! $request || (int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        /** @var ProcurementQuote|null $quote */
        $quote = $request->quotes()->whereKey($data['quote_id'])->first();
        if (! $quote) {
            throw ValidationException::withMessages([
                'quote_id' => 'The selected quote does not belong to this tender request.',
            ]);
        }

        $tender->award_recommendation = [
            'quote_id' => (int) $quote->id,
            'recommended_by' => $actor->id,
            'recommended_at' => now()->toIso8601String(),
            'notes' => $data['notes'] ?? null,
            'awards' => false,
        ];
        $tender->save();

        AuditLog::record('procurement.award_recommended', [
            'auditable_type' => Tender::class,
            'auditable_id' => $tender->id,
            'new_values' => ['quote_id' => $quote->id, 'recommended_by' => $actor->id],
            'tags' => 'procurement,sod',
        ]);

        return $tender->fresh();
    }

    /**
     * Award an evaluating tender to an assessed quote and stage a draft contract.
     * Does not invent pricing — contract value comes from the quote.
     *
     * @param  array{quote_id:int,start_date:string,end_date:string,title?:string,notes?:string}  $data
     * @return array{tender: Tender, contract: Contract}
     */
    public function award(Tender $tender, array $data, User $actor): array
    {
        $this->assertTenant($tender, $actor);

        $recommendation = is_array($tender->award_recommendation) ? $tender->award_recommendation : [];
        $recommendedBy = (int) ($recommendation['recommended_by'] ?? 0);
        if ($recommendedBy > 0 && $recommendedBy === (int) $actor->id) {
            throw ValidationException::withMessages([
                'quote_id' => 'The officer who recommended this award cannot award it. A different user must complete the award.',
            ]);
        }

        if ($tender->status !== Tender::STATUS_EVALUATING) {
            throw ValidationException::withMessages([
                'status' => 'Only tenders in evaluation can be awarded.',
            ]);
        }

        $request = $tender->procurementRequest;
        if (! $request || (int) $request->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }

        /** @var ProcurementQuote|null $quote */
        $quote = $request->quotes()->whereKey($data['quote_id'])->first();
        if (! $quote) {
            throw ValidationException::withMessages([
                'quote_id' => 'The selected quote does not belong to this tender request.',
            ]);
        }
        if (! $quote->vendor_id) {
            throw ValidationException::withMessages([
                'quote_id' => 'Only quotes from registered suppliers can be awarded.',
            ]);
        }
        if (! $quote->assessed_at || $quote->compliance_passed !== true) {
            throw ValidationException::withMessages([
                'quote_id' => 'Only assessed and compliant quotes can be awarded.',
            ]);
        }

        // SoD, budget line, confirmed reservation, and availability cover.
        $this->procurementService->assertAwardGates($request, $actor, (float) $quote->quoted_amount);

        return DB::transaction(function () use ($tender, $request, $quote, $data, $actor) {
            $this->procurementService->adjustCommitmentToAwardAmount($request, (float) $quote->quoted_amount, $actor);
            $tender->update(['status' => Tender::STATUS_AWARDED]);

            if ($request->status !== 'awarded') {
                $request->update([
                    'status'           => 'awarded',
                    'awarded_quote_id' => $quote->id,
                    'awarded_at'       => now(),
                    'award_notes'      => $data['notes'] ?? null,
                ]);
                $request->quotes()->where('id', '!=', $quote->id)->update(['is_recommended' => false]);
                $quote->update(['is_recommended' => true]);
            }

            $existing = Contract::query()
                ->where('tenant_id', $actor->tenant_id)
                ->where('tender_id', $tender->id)
                ->first();

            if ($existing) {
                $contract = $existing;
            } else {
                $contract = Contract::create([
                    'tenant_id'              => $actor->tenant_id,
                    'procurement_request_id' => $request->id,
                    'tender_id'              => $tender->id,
                    'vendor_id'              => $quote->vendor_id,
                    'title'                  => $data['title'] ?? ($tender->title.' — '.$quote->vendor_name),
                    'description'            => $data['notes'] ?? null,
                    'start_date'             => $data['start_date'],
                    'end_date'               => $data['end_date'],
                    'value'                  => $quote->quoted_amount,
                    'currency'               => $quote->currency ?? $request->currency ?? 'NAD',
                    'budget_line'            => $request->budget_line,
                    'status'                 => 'draft',
                    'created_by'             => $actor->id,
                ]);
            }

            AuditLog::record('procurement.tender_awarded', [
                'auditable_type' => Tender::class,
                'auditable_id'   => $tender->id,
                'new_values'     => [
                    'quote_id'    => $quote->id,
                    'contract_id' => $contract->id,
                    'vendor_id'   => $quote->vendor_id,
                    'value'       => $quote->quoted_amount,
                ],
                'tags' => ['procurement', 'tender', 'contract'],
            ]);

            return [
                'tender'   => $tender->fresh(['procurementRequest', 'committee']),
                'contract' => $contract->fresh(['vendor', 'procurementRequest']),
            ];
        });
    }

    public function cancel(Tender $tender, string $reason, User $actor): Tender
    {
        $this->assertTenant($tender, $actor);

        if (in_array($tender->status, [Tender::STATUS_AWARDED, Tender::STATUS_CANCELLED], true)) {
            throw ValidationException::withMessages([
                'status' => 'Awarded or already cancelled tenders cannot be cancelled.',
            ]);
        }

        $tender->update(['status' => Tender::STATUS_CANCELLED]);

        AuditLog::record('procurement.tender_cancelled', [
            'auditable_type' => Tender::class,
            'auditable_id'   => $tender->id,
            'new_values'     => ['reason' => $reason],
            'tags'           => ['procurement', 'tender'],
        ]);

        return $tender->fresh(['procurementRequest', 'committee']);
    }

    private function assertTenant(Tender $tender, User $actor): void
    {
        if ((int) $tender->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
