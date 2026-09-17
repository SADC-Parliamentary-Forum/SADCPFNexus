<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;

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
            ->with(['vendor', 'procurementRequest'])
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

        return $contract->load(['vendor', 'procurementRequest', 'purchaseOrder', 'createdBy', 'milestones']);
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
        if (! empty($filters['status'])) {
            $column = $this->hasColumn('contract_status') ? 'contract_status' : 'status';
            $query->where($column, $filters['status']);
        }

        if (! empty($filters['vendor_id'])) {
            $query->where('vendor_id', (int) $filters['vendor_id']);
        }

        if (isset($filters['search']) && trim((string) $filters['search']) !== '') {
            $term = '%'.trim((string) $filters['search']).'%';
            $query->where(function (Builder $q) use ($term): void {
                $q->where('reference_number', 'ilike', $term)
                    ->orWhere('title', 'ilike', $term);
            });
        }
    }

    private function hasColumn(string $column): bool
    {
        return \Illuminate\Support\Facades\Schema::hasColumn('contracts', $column);
    }
}
