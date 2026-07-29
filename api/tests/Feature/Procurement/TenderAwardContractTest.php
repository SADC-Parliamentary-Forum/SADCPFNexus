<?php

namespace Tests\Feature\Procurement;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\Contract;
use App\Models\FinancialYear;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Tender;
use App\Models\User;
use App\Models\Vendor;
use Tests\TestCase;

class TenderAwardContractTest extends TestCase
{
    private function seedBudgetLine(Tenant $tenant, User $actor, string $code = 'ICT-OPS-2026', float $allocated = 1_000_000): BudgetLine
    {
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'Test Budget',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $allocated,
            'created_by' => $actor->id,
        ]);

        return BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => $code,
            'name' => $code,
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
    }

    private function reserveBudget(ProcurementRequest $req, BudgetLine $line, User $actor, float $amount): BudgetReservation
    {
        return BudgetReservation::create([
            'tenant_id' => $req->tenant_id,
            'procurement_request_id' => $req->id,
            'budget_line' => $line->code,
            'budget_line_id' => $line->id,
            'reserved_amount' => $amount,
            'original_amount' => $amount,
            'current_amount' => $amount,
            'currency' => 'NAD',
            'status' => 'confirmed',
            'reserved_by' => $actor->id,
            'source_key' => 'PROCUREMENT:'.$req->id,
        ]);
    }

    /**
     * @return array{0: ProcurementRequest, 1: Tender, 2: ProcurementQuote, 3: User}
     */
    private function makeEvaluatingTender(Tenant $tenant, User $officer, Vendor $vendor, ?User $requester = null): array
    {
        $requester ??= $this->makeUser('staff', $tenant);
        $line = $this->seedBudgetLine($tenant, $officer);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'ICT Support Framework',
            'description' => 'Multi-year ICT support',
            'category' => 'services',
            'estimated_value' => 180_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
            'budget_line' => $line->code,
            'rfq_issued_at' => now()->subDays(10),
            'rfq_deadline' => now()->subDays(1)->toDateString(),
        ]);

        $this->reserveBudget($req, $line, $officer, 180_000);

        $tender = Tender::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number' => 'TND-AWARD-'.uniqid(),
            'title' => $req->title,
            'status' => Tender::STATUS_EVALUATING,
            'sealed_mode' => true,
            'published_at' => now()->subDays(14),
            'closed_at' => now()->subDays(2),
            'bids_opened_at' => now()->subDay(),
            'bids_opened_by' => $officer->id,
            'evaluation_started_at' => now(),
            'created_by' => $officer->id,
        ]);

        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'vendor_name' => $vendor->name,
            'quoted_amount' => 165_000,
            'currency' => 'NAD',
            'submission_channel' => 'system_portal',
            'version' => 1,
            'is_current' => true,
            'compliance_passed' => true,
            'assessed_at' => now(),
            'assessed_by' => $officer->id,
            'quote_date' => now()->toDateString(),
        ]);

        return [$req, $tender, $quote, $requester];
    }

    public function test_tender_status_transitions_through_to_awarded(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $requester = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Acme ICT',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);
        $line = $this->seedBudgetLine($tenant, $officer, 'LIFECYCLE-2026');

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'Lifecycle Tender',
            'description' => 'Status walk',
            'category' => 'goods',
            'estimated_value' => 120_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
            'budget_line' => $line->code,
            'rfq_issued_at' => now(),
            'rfq_deadline' => now()->addDays(7)->toDateString(),
        ]);
        $this->reserveBudget($req, $line, $officer, 120_000);

        $created = $http->postJson('/api/v1/procurement/tenders', [
            'procurement_request_id' => $req->id,
            'title' => $req->title,
            'submission_deadline' => now()->addDays(7)->toDateString(),
        ])->assertCreated();

        $tenderId = $created->json('data.id');
        $this->assertSame(Tender::STATUS_DRAFT, $created->json('data.status'));

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/publish")
            ->assertOk()
            ->assertJsonPath('data.status', Tender::STATUS_PUBLISHED);

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/close")
            ->assertOk()
            ->assertJsonPath('data.status', Tender::STATUS_CLOSED);

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/open-bids")
            ->assertOk()
            ->assertJsonPath('data.status', Tender::STATUS_OPENED);

        $http->postJson("/api/v1/procurement/tenders/{$tenderId}/start-evaluation")
            ->assertOk()
            ->assertJsonPath('data.status', Tender::STATUS_EVALUATING);

        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'vendor_name' => $vendor->name,
            'quoted_amount' => 110_000,
            'currency' => 'NAD',
            'version' => 1,
            'is_current' => true,
            'compliance_passed' => true,
            'assessed_at' => now(),
            'assessed_by' => $officer->id,
            'quote_date' => now()->toDateString(),
        ]);

        $award = $http->postJson("/api/v1/procurement/tenders/{$tenderId}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ])->assertOk();

        $this->assertSame(Tender::STATUS_AWARDED, $award->json('data.status'));
        $this->assertNotEmpty($award->json('data.contract.id'));
        $this->assertSame(Contract::query()->where('tender_id', $tenderId)->count(), 1);
    }

    public function test_award_creates_contract_linked_to_tender_and_budget_line(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'SecureNet',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);

        [$req, $tender, $quote] = $this->makeEvaluatingTender($tenant, $officer, $vendor);

        $res = $http->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addMonths(18)->toDateString(),
            'title' => 'SecureNet ICT Framework Contract',
        ])->assertOk();

        $contractId = $res->json('data.contract.id');
        $contract = Contract::findOrFail($contractId);

        $this->assertSame($tender->id, (int) $contract->tender_id);
        $this->assertSame($vendor->id, (int) $contract->vendor_id);
        $this->assertSame($req->id, (int) $contract->procurement_request_id);
        $this->assertSame('ICT-OPS-2026', $contract->budget_line);
        $this->assertEquals(165000.0, (float) $contract->value);
        $this->assertSame('draft', $contract->status);
        $this->assertSame(Tender::STATUS_AWARDED, $tender->fresh()->status);
        $this->assertSame('awarded', $req->fresh()->status);
    }

    public function test_requester_cannot_award_own_tender_sod(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'SoD Vendor',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);

        // Officer is both requester and awarder — SoD must block.
        [$req, $tender, $quote] = $this->makeEvaluatingTender($tenant, $officer, $vendor, $officer);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['award']);

        $this->assertSame(Tender::STATUS_EVALUATING, $tender->fresh()->status);
        unset($req);
    }

    public function test_award_requires_budget_confirmation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $requester = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'No Budget Co',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'Unfunded Tender',
            'description' => 'Missing reservation',
            'category' => 'goods',
            'estimated_value' => 50_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
            'budget_line' => 'MISSING-LINE',
            'rfq_issued_at' => now()->subDay(),
        ]);

        $tender = Tender::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number' => 'TND-NOBUDGET',
            'title' => $req->title,
            'status' => Tender::STATUS_EVALUATING,
            'created_by' => $officer->id,
        ]);

        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'vendor_name' => $vendor->name,
            'quoted_amount' => 45_000,
            'currency' => 'NAD',
            'version' => 1,
            'is_current' => true,
            'compliance_passed' => true,
            'assessed_at' => now(),
            'assessed_by' => $officer->id,
            'quote_date' => now()->toDateString(),
        ]);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['budget']);
    }

    public function test_award_requires_budget_line(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $requester = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'No Line Co',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'No Budget Line',
            'description' => 'Missing line',
            'category' => 'goods',
            'estimated_value' => 40_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
            'budget_line' => null,
            'rfq_issued_at' => now()->subDay(),
        ]);

        BudgetReservation::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'budget_line' => 'PLACEHOLDER',
            'reserved_amount' => 40_000,
            'current_amount' => 40_000,
            'currency' => 'NAD',
            'status' => 'confirmed',
            'reserved_by' => $officer->id,
        ]);

        $tender = Tender::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number' => 'TND-NOLINE',
            'title' => $req->title,
            'status' => Tender::STATUS_EVALUATING,
            'created_by' => $officer->id,
        ]);

        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'vendor_name' => $vendor->name,
            'quoted_amount' => 35_000,
            'currency' => 'NAD',
            'version' => 1,
            'is_current' => true,
            'compliance_passed' => true,
            'assessed_at' => now(),
            'assessed_by' => $officer->id,
            'quote_date' => now()->toDateString(),
        ]);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['budget_line']);
    }

    public function test_award_blocked_when_reservation_does_not_cover_quote(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $requester = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Short Funds',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);
        $line = $this->seedBudgetLine($tenant, $officer, 'SHORT-2026', 10_000);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'Under-reserved',
            'description' => 'Reservation too small',
            'category' => 'goods',
            'estimated_value' => 50_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
            'budget_line' => $line->code,
            'rfq_issued_at' => now()->subDay(),
        ]);
        // Reservation and line allocation are both below the quote.
        $this->reserveBudget($req, $line, $officer, 5_000);

        $tender = Tender::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number' => 'TND-SHORT',
            'title' => $req->title,
            'status' => Tender::STATUS_EVALUATING,
            'created_by' => $officer->id,
        ]);

        $quote = ProcurementQuote::create([
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'vendor_name' => $vendor->name,
            'quoted_amount' => 45_000,
            'currency' => 'NAD',
            'version' => 1,
            'is_current' => true,
            'compliance_passed' => true,
            'assessed_at' => now(),
            'assessed_by' => $officer->id,
            'quote_date' => now()->toDateString(),
        ]);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['budget']);
    }

    public function test_tender_can_be_cancelled_before_award(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'Cancel Me',
            'description' => 'Will cancel',
            'category' => 'goods',
            'estimated_value' => 50_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'procurement_method' => 'tender',
        ]);

        $tender = Tender::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'reference_number' => 'TND-CANCEL1',
            'title' => $req->title,
            'status' => Tender::STATUS_PUBLISHED,
            'published_at' => now(),
            'created_by' => $officer->id,
        ]);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/cancel", [
            'reason' => 'Budget withdrawn',
        ])->assertOk()
            ->assertJsonPath('data.status', Tender::STATUS_CANCELLED);

        $http->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => 1,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addMonth()->toDateString(),
        ])->assertUnprocessable();
    }

    public function test_staff_cannot_award_tender(): void
    {
        $tenant = Tenant::factory()->create();
        [$httpOfficer, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'V',
            'is_approved' => true,
            'is_active' => true,
            'status' => 'approved',
        ]);
        [$req, $tender, $quote] = $this->makeEvaluatingTender($tenant, $officer, $vendor);

        [$httpStaff] = $this->asStaff($tenant);
        $httpStaff->postJson("/api/v1/procurement/tenders/{$tender->id}/award", [
            'quote_id' => $quote->id,
            'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(),
        ])->assertForbidden();

        unset($httpOfficer, $req);
    }
}
