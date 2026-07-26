<?php

namespace App\Console\Commands;

use App\Models\TravelRequest;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Console\Command;

/**
 * Marks overdue travel retirements and notifies traveller + finance.
 * Scheduled daily via routes/console.php.
 */
class TravelMarkOverdueRetirements extends Command
{
    protected $signature = 'travel:mark-overdue-retirements {--tenant=}';

    protected $description = 'Mark overdue travel retirements and notify traveller/finance';

    public function handle(NotificationService $notif): int
    {
        $query = TravelRequest::query()
            ->with('requester')
            ->whereNotNull('returned_at')
            ->whereNotNull('retirement_due_at')
            ->whereDate('retirement_due_at', '<', now()->toDateString())
            ->where(function ($q) {
                $q->whereNull('retirement_status')
                    ->orWhereNotIn('retirement_status', ['completed', 'retired', 'overdue']);
            })
            ->whereNotIn('status', ['cancelled', 'withdrawn', 'rejected']);

        if ($tenant = $this->option('tenant')) {
            $query->where('tenant_id', $tenant);
        }

        $marked = 0;

        foreach ($query->get() as $travel) {
            $travel->update(['retirement_status' => 'overdue']);
            $marked++;

            if ($travel->requester) {
                $notif->dispatch($travel->requester, 'travel.retirement_overdue', [
                    'name' => $travel->requester->name,
                    'reference' => $travel->reference_number,
                    'due_date' => $travel->retirement_due_at?->toDateString(),
                ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/'.$travel->id]);
            }

            $financeUsers = User::role(['Finance Controller', 'Director'])
                ->where('tenant_id', $travel->tenant_id)
                ->get();
            $notif->dispatchToMany($financeUsers, 'travel.retirement_overdue', [
                'name' => 'Finance',
                'reference' => $travel->reference_number,
                'due_date' => $travel->retirement_due_at?->toDateString(),
            ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/'.$travel->id]);
        }

        // Also nudge pending (not yet overdue) within 2 working days of due date
        $dueSoon = TravelRequest::query()
            ->with('requester')
            ->where('retirement_status', 'pending')
            ->whereNotNull('retirement_due_at')
            ->whereDate('retirement_due_at', '>=', now()->toDateString())
            ->whereDate('retirement_due_at', '<=', now()->addDays(2)->toDateString())
            ->get();

        $reminded = 0;
        foreach ($dueSoon as $travel) {
            if (! $travel->requester) {
                continue;
            }
            $notif->dispatch($travel->requester, 'travel.retirement_due', [
                'name' => $travel->requester->name,
                'reference' => $travel->reference_number,
                'due_date' => $travel->retirement_due_at?->toDateString(),
            ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/'.$travel->id]);
            $reminded++;
        }

        $this->info("Overdue marked: {$marked}; due-soon reminders: {$reminded}.");

        return self::SUCCESS;
    }
}
