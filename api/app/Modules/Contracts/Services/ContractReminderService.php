<?php

namespace App\Modules\Contracts\Services;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;

/**
 * Contract reminder & escalation engine (PRD §64–§66). Scanned daily by the
 * contracts:send-reminders command. Emits signature, expiry and deliverable
 * reminders at configured windows and escalates overdue items. Every dispatch
 * carries an idempotency key so a window fires once (and overdue escalations
 * fire at most once per day) regardless of how often the command runs.
 */
class ContractReminderService
{
    /** Days before end date at which to remind (PRD §65). */
    private const EXPIRY_WINDOWS = [120, 90, 60, 30, 14, 7];

    /** Days before deliverable due date. */
    private const DELIVERABLE_WINDOWS = [7, 3, 0];

    /** Days before the signature deadline. */
    private const SIGNATURE_WINDOWS = [5, 2, 1, 0];

    private const LIVE_STATUSES = ['ACTIVE', 'FULLY_EXECUTED'];

    private const AWAITING_SIGNATURE = ['SENT_FOR_SIGNATURE', 'PARTIALLY_SIGNED', 'APPROVED_FOR_SIGNATURE'];

    public function __construct(private readonly NotificationService $notifications) {}

    /** @return int number of notifications dispatched (deduped by idempotency) */
    public function run(?int $tenantId = null, ?Carbon $asOf = null): int
    {
        $asOf = ($asOf ?? now())->copy()->startOfDay();

        return $this->expiryReminders($tenantId, $asOf)
            + $this->deliverableReminders($tenantId, $asOf)
            + $this->signatureReminders($tenantId, $asOf);
    }

    private function baseQuery(?int $tenantId)
    {
        return Contract::query()->when($tenantId !== null, fn ($q) => $q->where('tenant_id', $tenantId));
    }

    private function expiryReminders(?int $tenantId, Carbon $asOf): int
    {
        $sent = 0;
        $contracts = $this->baseQuery($tenantId)
            ->whereIn('contract_status', self::LIVE_STATUSES)
            ->whereNotNull('end_date')
            ->get();

        foreach ($contracts as $c) {
            $days = (int) $asOf->diffInDays($c->end_date->copy()->startOfDay(), false);
            $recipients = $this->contractRecipients($c);

            if (in_array($days, self::EXPIRY_WINDOWS, true)) {
                $sent += $this->dispatchAll($recipients, 'contract.expiry_reminder', [
                    'reference' => $c->reference_number, 'title' => $c->title,
                    'end_date' => $c->end_date->toDateString(), 'days' => $days,
                ], $c, "contract.expiry_reminder:{$c->id}:{$days}");
            } elseif ($days < 0) {
                $sent += $this->dispatchAll($recipients, 'contract.escalation', [
                    'reference' => $c->reference_number, 'title' => $c->title,
                    'issue' => 'This active contract has passed its end date without close-out.',
                ], $c, "contract.escalation:expiry:{$c->id}:{$asOf->toDateString()}");
            }
        }

        return $sent;
    }

    private function deliverableReminders(?int $tenantId, Carbon $asOf): int
    {
        $sent = 0;
        $contractIds = $this->baseQuery($tenantId)->pluck('id');
        $deliverables = ContractDeliverable::query()
            ->whereIn('contract_id', $contractIds)
            ->whereNotNull('due_date')
            ->whereNotIn('status', ['accepted', 'completed', 'waived', 'rejected'])
            ->with('contract')
            ->get();

        foreach ($deliverables as $d) {
            if ($d->contract === null) {
                continue;
            }
            $days = (int) $asOf->diffInDays($d->due_date->copy()->startOfDay(), false);
            $recipients = $this->deliverableRecipients($d);

            if (in_array($days, self::DELIVERABLE_WINDOWS, true)) {
                $sent += $this->dispatchAll($recipients, 'contract.deliverable_reminder', [
                    'reference' => $d->contract->reference_number, 'deliverable' => $d->name,
                    'due_date' => $d->due_date->toDateString(), 'days' => $days,
                ], $d->contract, "contract.deliverable_reminder:{$d->id}:{$days}");
            } elseif ($days < 0) {
                $sent += $this->dispatchAll($recipients, 'contract.escalation', [
                    'reference' => $d->contract->reference_number, 'title' => $d->contract->title,
                    'issue' => "Deliverable \"{$d->name}\" is overdue (due {$d->due_date->toDateString()}).",
                ], $d->contract, "contract.escalation:deliverable:{$d->id}:{$asOf->toDateString()}");
            }
        }

        return $sent;
    }

    private function signatureReminders(?int $tenantId, Carbon $asOf): int
    {
        $sent = 0;
        $contracts = $this->baseQuery($tenantId)
            ->whereIn('contract_status', self::AWAITING_SIGNATURE)
            ->whereNotNull('signature_deadline')
            ->get();

        foreach ($contracts as $c) {
            $days = (int) $asOf->diffInDays($c->signature_deadline->copy()->startOfDay(), false);
            $recipients = $this->contractRecipients($c);

            if (in_array($days, self::SIGNATURE_WINDOWS, true)) {
                $sent += $this->dispatchAll($recipients, 'contract.signature_reminder', [
                    'reference' => $c->reference_number, 'title' => $c->title,
                    'deadline' => $c->signature_deadline->toDateString(), 'days' => $days,
                ], $c, "contract.signature_reminder:{$c->id}:{$days}");
            } elseif ($days < 0) {
                $sent += $this->dispatchAll($recipients, 'contract.escalation', [
                    'reference' => $c->reference_number, 'title' => $c->title,
                    'issue' => 'The signature deadline has passed without full execution.',
                ], $c, "contract.escalation:signature:{$c->id}:{$asOf->toDateString()}");
            }
        }

        return $sent;
    }

    /** @return Collection<int, User> */
    private function contractRecipients(Contract $c): Collection
    {
        return User::query()
            ->whereIn('id', array_filter([$c->contract_owner_id, $c->procurement_officer_id]))
            ->where('tenant_id', $c->tenant_id)
            ->get()
            ->unique('id')
            ->values();
    }

    /** @return Collection<int, User> */
    private function deliverableRecipients(ContractDeliverable $d): Collection
    {
        $ids = array_filter([
            $d->internal_reviewer_id ?? null,
            $d->contract->contract_owner_id ?? null,
            $d->contract->procurement_officer_id ?? null,
        ]);

        return User::query()
            ->whereIn('id', $ids)
            ->where('tenant_id', $d->contract->tenant_id)
            ->get()
            ->unique('id')
            ->values();
    }

    private function dispatchAll(Collection $recipients, string $trigger, array $vars, Contract $contract, string $keyBase): int
    {
        $sent = 0;
        foreach ($recipients as $user) {
            $this->notifications->dispatch($user, $trigger, array_merge(['name' => $user->name], $vars), [
                'module' => 'contracts',
                'record_id' => $contract->id,
                'url' => '/contracts/'.$contract->id,
                'idempotency_key' => $keyBase.':user:'.$user->id,
            ]);
            $sent++;
        }

        return $sent;
    }
}
