<?php

namespace App\Modules\Budget\Services;

use App\Models\AuditLog;
use App\Models\BudgetLine;
use App\Models\GlJournal;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Double-entry posting against budget line GL codes. Does not own bank accounts.
 */
class GlPostingService
{
    public function post(User $actor, array $data): GlJournal
    {
        $line = BudgetLine::query()->findOrFail($data['budget_line_id']);
        $budget = $line->budget;
        abort_unless($budget && (int) $budget->tenant_id === (int) $actor->tenant_id, 404);

        $debit = round((float) $data['debit'], 2);
        $credit = round((float) $data['credit'], 2);
        if ($debit <= 0 || $credit <= 0 || abs($debit - $credit) > 0.009) {
            throw ValidationException::withMessages([
                'debit' => ['Journal must be balanced with matching debit and credit amounts.'],
            ]);
        }

        $gl = (string) ($line->gl_account_code ?: $line->account_code ?: $line->code);
        if ($gl === '') {
            throw ValidationException::withMessages([
                'budget_line_id' => ['Budget line has no GL account code.'],
            ]);
        }

        return DB::transaction(function () use ($actor, $data, $line, $debit, $credit, $gl) {
            $journal = GlJournal::query()->create([
                'tenant_id' => $actor->tenant_id,
                'journal_no' => 'GL-'.strtoupper(Str::random(8)),
                'budget_line_id' => $line->id,
                'source_module' => $data['source_module'] ?? 'manual',
                'source_id' => $data['source_id'] ?? null,
                'status' => 'posted',
                'memo' => $data['memo'] ?? null,
                'posted_by' => $actor->id,
                'posted_at' => now(),
            ]);

            $journal->lines()->create([
                'budget_line_id' => $line->id,
                'gl_account_code' => $gl,
                'debit' => $debit,
                'credit' => 0,
                'description' => $data['memo'] ?? 'Debit',
            ]);
            $journal->lines()->create([
                'budget_line_id' => $line->id,
                'gl_account_code' => $gl.'-CR',
                'debit' => 0,
                'credit' => $credit,
                'description' => $data['memo'] ?? 'Credit',
            ]);

            AuditLog::record('budget.gl_journal_posted', [
                'auditable_type' => GlJournal::class,
                'auditable_id' => $journal->id,
                'new_values' => ['journal_no' => $journal->journal_no, 'amount' => $debit],
                'tags' => 'budget,gl',
            ]);

            return $journal->fresh('lines');
        });
    }
}
