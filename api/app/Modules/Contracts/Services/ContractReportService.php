<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Collection;

/**
 * Contract reporting datasets (PRD §100). Each report returns a normalised
 * collection of rows; the controller renders JSON / CSV / XLSX / PDF.
 */
class ContractReportService
{
    public function __construct(private readonly ContractService $contracts) {}

    private function base(User $user): Builder
    {
        $query = Contract::query()->where('tenant_id', $user->tenant_id)->with(['vendor', 'type', 'department']);
        // Reports respect record scoping for non-privileged users.
        if (! $this->contracts->canViewAll($user)) {
            $query->where('created_by', $user->id);
        }

        return $query;
    }

    /** @return Collection<int, array<string, mixed>> */
    public function register(User $user, array $filters = []): Collection
    {
        $q = $this->base($user)->orderBy('reference_number');
        if (! empty($filters['status'])) {
            $q->where(fn ($w) => $w->where('status', $filters['status'])->orWhereRaw('lower(contract_status) = ?', [strtolower((string) $filters['status'])]));
        }

        return $q->get()->map(fn (Contract $c) => [
            'reference' => $c->reference_number,
            'title' => $c->title,
            'type' => optional($c->type)->name,
            'counterparty' => $c->display_counterparty,
            'department' => optional($c->department)->name,
            'status' => $c->contract_status ?? $c->status,
            'signature_status' => $c->signature_status,
            'currency' => $c->currency,
            'original_value' => (float) $c->original_value,
            'current_value' => (float) $c->current_value,
            'start_date' => optional($c->start_date)->toDateString(),
            'end_date' => optional($c->end_date)->toDateString(),
            'health' => $c->health_status,
        ]);
    }

    /** @return Collection<int, array<string, mixed>> */
    public function financial(User $user): Collection
    {
        return $this->base($user)->get()->map(fn (Contract $c) => [
            'reference' => $c->reference_number,
            'department' => optional($c->department)->name,
            'donor' => $c->donor,
            'currency' => $c->currency,
            'original_value' => (float) $c->original_value,
            'current_value' => (float) $c->current_value,
            'ceiling_value' => (float) $c->ceiling_value,
            'variance' => round((float) $c->current_value - (float) $c->original_value, 2),
        ]);
    }

    /** @return Collection<int, array<string, mixed>> */
    public function compliance(User $user): Collection
    {
        return $this->base($user)->get()->map(function (Contract $c) {
            $retrospective = ($c->service_start_date ?? $c->start_date)
                && ($c->service_start_date ?? $c->start_date)->lt(now())
                && ! in_array($c->lifecycle(), ['FULLY_EXECUTED', 'ACTIVE', 'COMPLETED', 'CLOSED'], true);

            return [
                'reference' => $c->reference_number,
                'title' => $c->title,
                'is_legacy' => (bool) $c->is_legacy,
                'unsigned' => $c->signature_status !== 'signed',
                'retrospective' => (bool) $retrospective,
                'status' => $c->contract_status ?? $c->status,
            ];
        });
    }

    /** @return Collection<int, array<string, mixed>> */
    public function operational(User $user): Collection
    {
        $days = (int) now()->diffInDays(now());

        return $this->base($user)->get()->map(fn (Contract $c) => [
            'reference' => $c->reference_number,
            'title' => $c->title,
            'end_date' => optional($c->end_date)->toDateString(),
            'days_to_expiry' => $c->end_date ? (int) round(now()->diffInDays($c->end_date, false)) : null,
            'expiring_soon' => (bool) $c->is_expiring_soon,
            'expired' => (bool) $c->is_expired,
            'amendments' => $c->amendments()->count(),
        ]);
    }

    public function dataset(string $type, User $user, array $filters = []): Collection
    {
        return match ($type) {
            'financial' => $this->financial($user),
            'compliance' => $this->compliance($user),
            'operational' => $this->operational($user),
            default => $this->register($user, $filters),
        };
    }
}
