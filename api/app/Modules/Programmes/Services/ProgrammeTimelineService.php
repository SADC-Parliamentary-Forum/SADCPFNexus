<?php

namespace App\Modules\Programmes\Services;

use App\Models\ApprovalHistory;
use App\Models\ApprovalRequest;
use App\Models\Contract;
use App\Models\MeActivityReport;
use App\Models\ProcurementRequest;
use App\Models\Programme;
use App\Models\PurchaseOrder;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\AccessControl\Services\AccessScopeResolver;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Carbon;

/**
 * End-to-end record for one programme (PIF): its own lifecycle plus linked
 * procurement, purchase orders, contracts, travel and M&E reports, newest first.
 *
 * Access: the programme must be visible under the programme list scope, and
 * every linked record is filtered through its own module's deny-by-default
 * scope (AccessScopeResolver::constrainQuery, as the dashboard does). Records
 * the viewer cannot see are omitted entirely — not even counted.
 *
 * Money: amounts are reported per currency and per definition; nothing is
 * summed across currencies or across definitions.
 */
class ProgrammeTimelineService
{
    private const LIMIT_PER_SOURCE = 100;

    public function __construct(private readonly AccessScopeResolver $scopes) {}

    public function canView(User $user, Programme $programme): bool
    {
        if ((int) $programme->tenant_id !== (int) $user->tenant_id) {
            return false;
        }

        $query = Programme::query()->whereKey($programme->getKey());
        $this->scopes->constrainQuery($query, $user, 'created_by', ['module' => 'programme']);

        return $query->exists();
    }

    /** @return array{programme: array<string, mixed>, events: list<array<string, mixed>>, financials: array<string, mixed>} */
    public function forProgramme(User $user, Programme $programme): array
    {
        $events = array_merge(
            $this->programmeEvents($programme),
            $this->linked($user, $programme, ProcurementRequest::query(), 'procurement', 'requester_id', 'procurement_request',
                fn (ProcurementRequest $r) => ['title' => $r->title, 'amount' => $r->estimated_value, 'currency' => $r->currency, 'path' => '/procurement/'.$r->id]),
            $this->linked($user, $programme, PurchaseOrder::query(), 'procurement', 'created_by', 'purchase_order',
                fn (PurchaseOrder $o) => ['title' => $o->title, 'amount' => $o->total_amount, 'currency' => $o->currency, 'path' => '/procurement/purchase-orders/'.$o->id]),
            $this->linked($user, $programme, Contract::query(), 'procurement', 'created_by', 'contract',
                fn (Contract $c) => ['title' => $c->title, 'amount' => $c->current_value ?? $c->value, 'currency' => $c->currency, 'path' => '/contracts/'.$c->id]),
            $this->linked($user, $programme, TravelRequest::query(), 'travel', 'requester_id', 'travel_request',
                fn (TravelRequest $t) => ['title' => $t->purpose, 'amount' => null, 'currency' => null, 'path' => '/travel/'.$t->id]),
            $this->linked($user, $programme, MeActivityReport::query(), 'mande', 'submitted_by', 'me_report',
                fn (MeActivityReport $m) => ['title' => 'M&E activity report', 'amount' => null, 'currency' => null, 'path' => '/mande/activity-reports/'.$m->id],
                ['owner_columns' => ['submitted_by', 'created_by']]),
        );

        usort($events, fn (array $a, array $b) => strcmp((string) $b['at'], (string) $a['at']));

        return [
            'programme' => [
                'id' => $programme->id,
                'reference' => $programme->reference_number,
                'title' => $programme->title,
                'status' => $programme->status,
                'start_date' => $this->date($programme->start_date),
                'end_date' => $this->date($programme->end_date),
            ],
            'events' => $events,
            'financials' => $this->financials($programme, $events),
        ];
    }

    private function programmeEvents(Programme $programme): array
    {
        $events = [$this->event('programme', $programme->id, 'created', $programme->created_at, $programme->reference_number, $programme->title, $programme->status, '/pif/'.$programme->id)];

        $approval = ApprovalRequest::where('approvable_type', Programme::class)->where('approvable_id', $programme->id)->latest('id')->first();
        if ($approval) {
            foreach (ApprovalHistory::where('approval_request_id', $approval->id)->with('user:id,name')->orderBy('id')->get() as $h) {
                $events[] = $this->event('programme', $programme->id, 'workflow.'.$h->action, $h->created_at,
                    $programme->reference_number, trim(($h->user?->name ?? 'Someone').' — '.str_replace('_', ' ', (string) $h->action)), $programme->status, '/pif/'.$programme->id);
            }
        }

        return $events;
    }

    /**
     * @param  callable(mixed): array{title: ?string, amount: mixed, currency: ?string, path: string}  $describe
     */
    private function linked(User $user, Programme $programme, Builder $query, string $module, string $ownerColumn, string $type, callable $describe, array $options = []): array
    {
        $query->where('tenant_id', $programme->tenant_id)->where('programme_id', $programme->id);
        $this->scopes->constrainQuery($query, $user, $ownerColumn, ['module' => $module] + $options);

        return $query->latest('id')->limit(self::LIMIT_PER_SOURCE)->get()->map(function ($record) use ($type, $describe) {
            $d = $describe($record);

            return $this->event($type, $record->id, 'linked', $record->created_at, $record->reference_number ?? null,
                $d['title'] ?? null, $record->status ?? null, $d['path'], $d['amount'], $d['currency']);
        })->all();
    }

    private function financials(Programme $programme, array $events): array
    {
        $byCurrency = [];
        foreach ($events as $e) {
            if ($e['amount'] === null || $e['currency'] === null) {
                continue;
            }
            $definition = match ($e['type']) {
                'procurement_request' => 'requested_procurement_estimate',
                'purchase_order' => 'purchase_order_value',
                'contract' => 'contract_value',
                default => null,
            };
            if ($definition === null) {
                continue;
            }
            $byCurrency[$e['currency']][$definition] = round(($byCurrency[$e['currency']][$definition] ?? 0) + (float) $e['amount'], 2);
        }

        return [
            'approved_budget' => ['amount' => $programme->total_budget !== null ? (float) $programme->total_budget : null, 'currency' => $programme->primary_currency],
            'linked_values_by_currency' => $byCurrency,
            'definitions' => [
                'requested_procurement_estimate' => 'Sum of estimated values on linked procurement requests you can see. Estimates, not commitments.',
                'purchase_order_value' => 'Sum of total amounts on linked purchase orders you can see (commitments).',
                'contract_value' => 'Sum of current (or original) values of linked contracts you can see.',
                'note' => 'Amounts are not converted or combined across currencies, and figures only include records visible to you, so they are not a budget-versus-actual statement.',
            ],
        ];
    }

    private function date(mixed $value): ?string
    {
        if ($value instanceof DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return $value !== null ? (string) $value : null;
    }

    private function event(string $type, int $id, string $kind, mixed $at, ?string $reference, ?string $title, ?string $status, string $path, mixed $amount = null, ?string $currency = null): array
    {
        return [
            'type' => $type,
            'id' => $id,
            'kind' => $kind,
            'at' => $at ? Carbon::parse($at)->toIso8601String() : null,
            'reference' => $reference,
            'title' => $title,
            'status' => $status,
            'path' => $path,
            'amount' => $amount !== null ? (float) $amount : null,
            'currency' => $currency,
        ];
    }
}
