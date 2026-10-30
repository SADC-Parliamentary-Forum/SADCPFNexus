<?php

namespace App\Services;

use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\Programme;
use App\Models\TravelRequest;
use App\Models\User;
use App\Models\Vendor;
use App\Modules\AccessControl\Services\AccessScopeResolver;
use App\Modules\Correspondence\Services\CorrespondenceRegisterService;
use Illuminate\Database\Eloquent\Builder;
use Throwable;

/**
 * Permission-filtered record search behind GlobalSearch: request references,
 * suppliers, programmes and correspondence.
 *
 * Database-backed on purpose: each module is queried through the same
 * deny-by-default scope its own list uses (AccessScopeResolver::constrainQuery
 * or the module's accessibleQuery), so search can never return a record the
 * user could not open. The provisioned Meilisearch instance is not used: it
 * has no indexes, and adopting it would require replicating every module's
 * access rules as index filters.
 */
class RecordSearchService
{
    private const PER_MODULE = 5;

    public function __construct(
        private readonly AccessScopeResolver $scopes,
        private readonly CorrespondenceRegisterService $correspondence,
    ) {}

    /** @return list<array{module: string, id: int, reference: ?string, title: ?string, status: ?string, path: string}> */
    public function search(User $user, string $term): array
    {
        $term = trim($term);
        if (mb_strlen($term) < 2) {
            return [];
        }
        $like = '%'.addcslashes(mb_substr($term, 0, 100), '\\%_').'%';

        $results = [];
        foreach ($this->sources($user) as $module => [$query, $fields, $describe]) {
            try {
                $rows = $query
                    ->where('tenant_id', $user->tenant_id)
                    ->where(function (Builder $q) use ($fields, $like) {
                        foreach ($fields as $i => $field) {
                            $i === 0 ? $q->where($field, 'ilike', $like) : $q->orWhere($field, 'ilike', $like);
                        }
                    })
                    ->latest('id')
                    ->limit(self::PER_MODULE)
                    ->get();
                foreach ($rows as $row) {
                    $results[] = ['module' => $module, 'id' => (int) $row->id] + $describe($row);
                }
            } catch (Throwable $e) {
                report($e);
            }
        }

        return $results;
    }

    /** @return array<string, array{0: Builder, 1: list<string>, 2: callable}> */
    private function sources(User $user): array
    {
        $scoped = function (Builder $query, string $owner, string $module) use ($user): Builder {
            return $this->scopes->constrainQuery($query, $user, $owner, ['module' => $module]);
        };

        $sources = [
            'travel' => [$scoped(TravelRequest::query(), 'requester_id', 'travel'), ['reference_number', 'purpose'],
                fn ($r) => ['reference' => $r->reference_number, 'title' => $r->purpose, 'status' => $r->status, 'path' => '/travel/'.$r->id]],
            'leave' => [$scoped(LeaveRequest::query(), 'requester_id', 'leave'), ['reference_number'],
                fn ($r) => ['reference' => $r->reference_number, 'title' => ucfirst(str_replace('_', ' ', (string) $r->leave_type)).' leave', 'status' => $r->status, 'path' => '/leave/'.$r->id]],
            'procurement' => [$scoped(ProcurementRequest::query(), 'requester_id', 'procurement'), ['reference_number', 'title'],
                fn ($r) => ['reference' => $r->reference_number, 'title' => $r->title, 'status' => $r->status, 'path' => '/procurement/'.$r->id]],
            'programmes' => [$scoped(Programme::query(), 'created_by', 'programme'), ['reference_number', 'title'],
                fn ($r) => ['reference' => $r->reference_number, 'title' => $r->title, 'status' => $r->status, 'path' => '/pif/'.$r->id]],
        ];

        // Supplier records have no owner: only users who may view the vendor register.
        if ($user->isSystemAdmin() || $user->hasAnyPermission(['procurement.view', 'procurement.admin', 'procurement.supplier.read', 'procurement.manage_vendors'])) {
            $sources['suppliers'] = [Vendor::query(), ['name', 'registration_number'],
                fn ($r) => ['reference' => $r->registration_number, 'title' => $r->name, 'status' => $r->status, 'path' => '/procurement/vendors/'.$r->id]];
        }

        if ($user->isSystemAdmin() || $user->hasAnyPermission(['correspondence.view'])) {
            $sources['correspondence'] = [$this->correspondence->accessibleQuery($user), ['reference_number', 'subject', 'title'],
                fn ($r) => ['reference' => $r->reference_number, 'title' => $r->subject ?? $r->title, 'status' => $r->status, 'path' => '/correspondence/'.$r->id]];
        }

        return $sources;
    }
}
