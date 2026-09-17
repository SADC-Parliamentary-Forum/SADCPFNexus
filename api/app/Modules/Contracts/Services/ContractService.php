<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\ContractFundingSource;
use App\Models\ContractObligation;
use App\Models\ContractParty;
use App\Models\ProcurementRequest;
use App\Models\Programme;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

/**
 * Read/query surface for the Contract Register.
 *
 * WS0 provides tenant-scoped listing, record-level scoping (own vs view_all)
 * and the shared filter set. Lifecycle mutations (create/submit/approve/sign/
 * amend/close) are layered on in later workstreams.
 */
class ContractService
{
    /**
     * Roles that may always see the full tenant register even without the
     * explicit contract.view_all permission (defence in depth / legacy parity).
     *
     * @var list<string>
     */
    private const REGISTER_WIDE_ROLES = [
        'System Admin', 'Secretary General', 'Procurement Officer',
        'Finance Controller', 'Internal Auditor', 'External Auditor',
    ];

    /**
     * Return a filtered, tenant + record scoped contract register page.
     *
     * @param  array<string, mixed>  $filters
     */
    public function list(array $filters, User $user): LengthAwarePaginator
    {
        $query = Contract::query()
            ->where('tenant_id', $user->tenant_id)
            ->with(['vendor', 'procurementRequest', 'type', 'contractOwner'])
            ->orderByDesc('created_at');

        $this->constrainToViewable($query, $user);
        $this->applyFilters($query, $filters);

        $perPage = (int) ($filters['per_page'] ?? 25);
        $perPage = max(1, min($perPage, 500));

        return $query->paginate($perPage);
    }

    /**
     * Load a single contract for the given user or fail with 404 for
     * cross-tenant / non-viewable records (never 403 — avoid enumeration).
     */
    public function find(int $id, User $user): Contract
    {
        $query = Contract::query()->where('tenant_id', $user->tenant_id)->whereKey($id);
        $this->constrainToViewable($query, $user);

        /** @var Contract|null $contract */
        $contract = $query->first();
        abort_if($contract === null, 404);

        return $contract->load([
            'vendor', 'procurementRequest', 'purchaseOrder', 'createdBy', 'milestones',
            'type', 'department', 'contractOwner', 'procurementOfficer', 'programme',
            'counterparty', 'fundingSources', 'deliverables', 'obligations',
            'paymentSchedules', 'documentVersions', 'signatories', 'amendments', 'exceptions',
            'complianceDocuments',
        ]);
    }

    /**
     * Active contract categories for the tenant (creation wizard + filters).
     *
     * @return \Illuminate\Support\Collection<int, \App\Models\ContractType>
     */
    public function types(User $user)
    {
        return \App\Models\ContractType::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name')
            ->get();
    }

    /**
     * Create a contract from the full wizard payload, persisting counterparty,
     * deliverables, obligations and funding split, with financial auto-calc.
     *
     * @param  array<string, mixed>  $data
     */
    public function create(array $data, User $user): Contract
    {
        return DB::transaction(function () use ($data, $user): Contract {
            $value = $this->resolveValue($data);

            $counterpartyType = $data['counterparty_type'] ?? (! empty($data['vendor_id']) ? 'organisation' : 'individual');

            $contract = Contract::create([
                'tenant_id' => $user->tenant_id,
                'created_by' => $user->id,
                'origin_type' => $data['origin_type'] ?? 'standalone',
                'origin_reference' => $data['origin_reference'] ?? null,
                'procurement_request_id' => $data['procurement_request_id'] ?? null,
                'tender_id' => $data['tender_id'] ?? null,
                'purchase_order_id' => $data['purchase_order_id'] ?? null,
                'type_id' => $data['type_id'] ?? null,
                'vendor_id' => $data['vendor_id'] ?? null,
                'counterparty_type' => $counterpartyType,
                'counterparty_name' => $data['counterparty_name'] ?? null,
                'department_id' => $data['department_id'] ?? null,
                'contract_owner_id' => $data['contract_owner_id'] ?? null,
                'procurement_officer_id' => $data['procurement_officer_id'] ?? $user->id,
                'programme_id' => $data['programme_id'] ?? null,
                'project_id' => $data['project_id'] ?? null,
                'donor' => $data['donor'] ?? null,
                'funding_source_id' => $data['funding_source_id'] ?? null,
                'funding_source' => $data['funding_source'] ?? null,
                'procurement_method' => $data['procurement_method'] ?? null,
                'award_reference' => $data['award_reference'] ?? null,
                'tor_reference' => $data['tor_reference'] ?? null,
                'short_description' => $data['short_description'] ?? null,
                'title' => $data['title'],
                'description' => $data['description'] ?? null,
                'start_date' => $data['start_date'],
                'end_date' => $data['end_date'],
                'preparation_date' => $data['preparation_date'] ?? now()->toDateString(),
                'agreement_date' => $data['agreement_date'] ?? null,
                'effective_date' => $data['effective_date'] ?? null,
                'service_start_date' => $data['service_start_date'] ?? $data['start_date'],
                'service_end_date' => $data['service_end_date'] ?? $data['end_date'],
                'signature_deadline' => $data['signature_deadline'] ?? null,
                'renewal_decision_date' => $data['renewal_decision_date'] ?? null,
                'notice_period_days' => $data['notice_period_days'] ?? null,
                'closeout_target_date' => $data['closeout_target_date'] ?? null,
                'rate' => $data['rate'] ?? null,
                'rate_basis' => $data['rate_basis'] ?? null,
                'units' => $data['units'] ?? null,
                'value' => $value,
                'original_value' => $value,
                'current_value' => $value,
                'ceiling_value' => $data['ceiling_value'] ?? $value,
                'currency' => $data['currency'] ?? 'NAD',
                'budget_currency' => $data['budget_currency'] ?? null,
                'conversion_reference' => $data['conversion_reference'] ?? null,
                'converted_value' => $data['converted_value'] ?? null,
                'budget_line' => $data['budget_line'] ?? null,
                'scope' => $data['scope'] ?? null,
                'contract_status' => 'DRAFT',
                'status' => 'draft',
            ]);

            // Individual counterparty detail snapshot.
            if ($counterpartyType === 'individual' && ! empty($data['counterparty'])) {
                $cp = $data['counterparty'];
                ContractParty::create([
                    'tenant_id' => $user->tenant_id,
                    'contract_id' => $contract->id,
                    'party_role' => 'counterparty',
                    'type' => 'individual',
                    'title' => $cp['title'] ?? null,
                    'first_name' => $cp['first_name'] ?? null,
                    'surname' => $cp['surname'] ?? null,
                    'full_legal_name' => $cp['full_legal_name'] ?? trim(($cp['first_name'] ?? '').' '.($cp['surname'] ?? '')) ?: null,
                    'email' => $cp['email'] ?? null,
                    'phone' => $cp['phone'] ?? null,
                    'id_reference' => $cp['id_reference'] ?? null,
                    'nationality' => $cp['nationality'] ?? null,
                    'address' => $cp['address'] ?? null,
                    'profession' => $cp['profession'] ?? null,
                    'organisation' => $cp['organisation'] ?? null,
                    'tax_reference' => $cp['tax_reference'] ?? null,
                ]);
                if (empty($contract->counterparty_name)) {
                    $contract->update(['counterparty_name' => $contract->counterparty()->value('full_legal_name')]);
                }
            }

            foreach (($data['deliverables'] ?? []) as $i => $d) {
                ContractDeliverable::create([
                    'tenant_id' => $user->tenant_id,
                    'contract_id' => $contract->id,
                    'number' => $d['number'] ?? ($i + 1),
                    'name' => $d['name'],
                    'description' => $d['description'] ?? null,
                    'acceptance_criteria' => $d['acceptance_criteria'] ?? null,
                    'responsible_party' => $d['responsible_party'] ?? 'counterparty',
                    'due_date' => $d['due_date'] ?? null,
                    'status' => 'not_started',
                    'sort_order' => $i,
                ]);
            }

            foreach (($data['obligations'] ?? []) as $o) {
                ContractObligation::create([
                    'tenant_id' => $user->tenant_id,
                    'contract_id' => $contract->id,
                    'obligation' => $o['obligation'],
                    'responsible_party' => $o['responsible_party'] ?? 'sadcpf',
                    'due_date' => $o['due_date'] ?? null,
                    'status' => 'open',
                ]);
            }

            foreach (($data['funding_sources'] ?? []) as $f) {
                ContractFundingSource::create([
                    'tenant_id' => $user->tenant_id,
                    'contract_id' => $contract->id,
                    'funding_source_id' => $f['funding_source_id'] ?? null,
                    'donor' => $f['donor'] ?? null,
                    'project_id' => $f['project_id'] ?? null,
                    'budget_line' => $f['budget_line'] ?? null,
                    'amount' => $f['amount'] ?? null,
                    'percentage' => $f['percentage'] ?? null,
                    'currency' => $f['currency'] ?? ($data['currency'] ?? 'NAD'),
                ]);
            }

            return $contract->fresh();
        });
    }

    /**
     * Nexus calculates totals where rate x units are known so staff never type
     * a value that can be derived (PRD §20).
     *
     * @param  array<string, mixed>  $data
     */
    private function resolveValue(array $data): float
    {
        if (isset($data['rate'], $data['units']) && $data['rate'] !== null && $data['units'] !== null) {
            return round((float) $data['rate'] * (float) $data['units'], 2);
        }

        return (float) ($data['value'] ?? 0);
    }

    /**
     * Prepopulate contract fields from an approved Procurement award or PIF so
     * controlled institutional data is never re-keyed (PRD §15/§61 & AT §115).
     *
     * @return array<string, mixed>
     */
    public function prefill(string $originType, int $originId, User $user): array
    {
        if ($originType === 'procurement') {
            /** @var ProcurementRequest|null $pr */
            $pr = ProcurementRequest::where('tenant_id', $user->tenant_id)
                ->with(['awardedQuote'])->find($originId);
            abort_if($pr === null, 404);

            $vendorId = optional($pr->awardedQuote)->vendor_id;
            $awardValue = (float) (optional($pr->awardedQuote)->quoted_amount ?? $pr->estimated_value ?? 0);

            return [
                'origin_type' => 'procurement',
                'origin_id' => $pr->id,
                'procurement_request_id' => $pr->id,
                'title' => $pr->title,
                'award_reference' => $pr->reference_number,
                'procurement_method' => $pr->category,
                'vendor_id' => $vendorId,
                'counterparty_type' => 'organisation',
                'value' => $awardValue,
                'currency' => $pr->currency ?? 'NAD',
                'budget_line' => $pr->budget_line,
                'programme_id' => $pr->programme_id,
                'locked_fields' => ['award_reference', 'procurement_request_id', 'value'],
            ];
        }

        if ($originType === 'pif') {
            /** @var Programme|null $prog */
            $prog = Programme::where('tenant_id', $user->tenant_id)->find($originId);
            abort_if($prog === null, 404);

            return [
                'origin_type' => 'pif',
                'origin_id' => $prog->id,
                'programme_id' => $prog->id,
                'title' => $prog->title,
                'award_reference' => $prog->reference_number,
                'rate' => $prog->interpreter_rate ?? $prog->consultants_rate ?? null,
                'rate_basis' => 'per day',
                'currency' => 'USD',
                'counterparty_type' => 'individual',
                'locked_fields' => ['programme_id'],
            ];
        }

        abort(422, 'Unsupported origin type for prefill.');
    }

    /**
     * Document-readiness checklist (PRD §35). Returns each check with a pass
     * flag and whether it blocks submission.
     *
     * @return array{ready: bool, checks: list<array{key:string,label:string,passed:bool,blocking:bool}>}
     */
    public function readiness(Contract $contract): array
    {
        $contract->loadMissing(['type', 'templateVersion', 'procurementRequest.awardedQuote']);

        $checks = [
            ['key' => 'counterparty', 'label' => 'Counterparty complete', 'passed' => $this->counterpartyComplete($contract), 'blocking' => true],
            ['key' => 'dates', 'label' => 'Start and end dates set', 'passed' => $contract->start_date !== null && $contract->end_date !== null, 'blocking' => true],
            ['key' => 'value', 'label' => 'Contract value is positive', 'passed' => (float) $contract->current_value > 0, 'blocking' => true],
            ['key' => 'type', 'label' => 'Contract type selected', 'passed' => $contract->type_id !== null, 'blocking' => true],
            ['key' => 'template', 'label' => 'Contract document generated', 'passed' => $contract->current_document_version_id !== null, 'blocking' => true],
            ['key' => 'tor', 'label' => 'TOR / scope attached', 'passed' => ! empty($contract->tor_reference) || ! empty($contract->scope), 'blocking' => false],
        ];

        // When linked to a procurement award, the contract amount must match it.
        if ($contract->procurement_request_id !== null) {
            $awardValue = (float) (
                optional($contract->procurementRequest?->awardedQuote)->quoted_amount
                ?? optional($contract->procurementRequest)->estimated_value
                ?? 0
            );
            if ($awardValue > 0) {
                $checks[] = [
                    'key' => 'award_match',
                    'label' => 'Contract amount matches award',
                    'passed' => abs((float) $contract->current_value - $awardValue) < 0.01,
                    'blocking' => true,
                ];
            }
        }

        $ready = collect($checks)->every(fn ($c) => ! $c['blocking'] || $c['passed']);

        return ['ready' => $ready, 'checks' => $checks];
    }

    private function counterpartyComplete(Contract $contract): bool
    {
        if ($contract->counterparty_type === 'organisation') {
            return $contract->vendor_id !== null;
        }

        return ! empty($contract->counterparty_name) || $contract->counterparty()->exists();
    }

    public function canViewAll(User $user): bool
    {
        return $user->hasAnyPermission(['contract.view_all', 'contract.audit_view'])
            || $user->hasAnyRole(self::REGISTER_WIDE_ROLES);
    }

    /**
     * Deny-by-default record scoping: users without register-wide access only
     * see contracts they created, own, or administer.
     */
    private function constrainToViewable(Builder $query, User $user): void
    {
        if ($this->canViewAll($user)) {
            return;
        }

        $query->where(function (Builder $q) use ($user): void {
            $q->where('created_by', $user->id);

            foreach (['contract_owner_id', 'procurement_officer_id'] as $column) {
                if ($this->hasColumn($column)) {
                    $q->orWhere($column, $user->id);
                }
            }
        });
    }

    /**
     * @param  array<string, mixed>  $filters
     */
    private function applyFilters(Builder $query, array $filters): void
    {
        // Status may be a legacy value (draft/active/…) or a lifecycle value
        // (DRAFT/IN_REVIEW/…). Match either, case-insensitively.
        if (! empty($filters['status'])) {
            $status = (string) $filters['status'];
            $query->where(function (Builder $q) use ($status): void {
                $q->where('status', $status)
                    ->orWhereRaw('lower(contract_status) = ?', [strtolower($status)]);
            });
        }

        if (! empty($filters['contract_status'])) {
            $query->whereRaw('lower(contract_status) = ?', [strtolower((string) $filters['contract_status'])]);
        }

        if (! empty($filters['vendor_id'])) {
            $query->where('vendor_id', (int) $filters['vendor_id']);
        }

        if (! empty($filters['type_id'])) {
            $query->where('type_id', (int) $filters['type_id']);
        }

        if (! empty($filters['department_id'])) {
            $query->where('department_id', (int) $filters['department_id']);
        }

        if (! empty($filters['contract_owner_id'])) {
            $query->where('contract_owner_id', (int) $filters['contract_owner_id']);
        }

        if (! empty($filters['origin_type'])) {
            $query->where('origin_type', (string) $filters['origin_type']);
        }

        if (isset($filters['expiring_within_days']) && $filters['expiring_within_days'] !== '') {
            $days = max(0, (int) $filters['expiring_within_days']);
            $query->whereNotNull('end_date')
                ->whereBetween('end_date', [now()->toDateString(), now()->addDays($days)->toDateString()]);
        }

        if (isset($filters['search']) && trim((string) $filters['search']) !== '') {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function (Builder $q) use ($term): void {
                $q->where('reference_number', 'ilike', $term)
                    ->orWhere('title', 'ilike', $term)
                    ->orWhere('counterparty_name', 'ilike', $term);
            });
        }
    }

    private function hasColumn(string $column): bool
    {
        return \Illuminate\Support\Facades\Schema::hasColumn('contracts', $column);
    }
}
