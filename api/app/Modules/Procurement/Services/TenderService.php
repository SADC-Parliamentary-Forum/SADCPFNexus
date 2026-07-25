<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\ProcurementRequest;
use App\Models\Tender;
use App\Models\User;
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

    private function assertTenant(Tender $tender, User $actor): void
    {
        if ((int) $tender->tenant_id !== (int) $actor->tenant_id) {
            abort(404);
        }
    }
}
