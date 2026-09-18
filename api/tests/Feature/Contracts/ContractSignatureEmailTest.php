<?php

namespace Tests\Feature\Contracts;

use App\Mail\ContractSignatureRequestMail;
use App\Models\Contract;
use App\Models\ContractSignatory;
use App\Models\Tenant;
use App\Models\Vendor;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Tests\TestCase;

/**
 * The counterparty is emailed a secure signing link when a contract is sent for
 * signature (and on demand), with a supplier-registration path.
 */
class ContractSignatureEmailTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contractAwaitingCounterparty(): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Lingua', 'contact_email' => 'party@example.test', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'counterparty_name' => 'Lingua',
            'title' => 'Interpretation', 'start_date' => now()->addWeek()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 900, 'current_value' => 900, 'currency' => 'USD',
            'contract_status' => 'SENT_FOR_SIGNATURE', 'status' => 'draft', 'signature_status' => 'awaiting',
        ]);
        ContractSignatory::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'party' => 'counterparty',
            'sign_order' => 2, 'method' => 'electronic', 'status' => 'pending',
            'signer_name' => 'Jane Interpreter', 'signer_email' => 'party@example.test',
            'token' => Str::random(48), 'token_expires_at' => now()->addDays(14),
        ]);

        return $contract;
    }

    public function test_resend_emails_counterparty_signing_link(): void
    {
        Mail::fake();
        $contract = $this->contractAwaitingCounterparty();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/resend-signature-email")->assertOk()->assertJsonPath('sent', true);

        Mail::assertSent(ContractSignatureRequestMail::class, function (ContractSignatureRequestMail $mail) {
            return $mail->hasTo('party@example.test')
                && str_contains($mail->signUrl, '/contract-signature/')
                && str_contains($mail->supplierRegisterUrl, '/supplier');
        });
    }

    public function test_resend_without_counterparty_email_reports_no_send(): void
    {
        Mail::fake();
        $contract = $this->contractAwaitingCounterparty();
        $contract->signatories()->where('party', 'counterparty')->update(['signer_email' => null]);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/resend-signature-email")->assertStatus(422)->assertJsonPath('sent', false);
        Mail::assertNothingSent();
    }
}
