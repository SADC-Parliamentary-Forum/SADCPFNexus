<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;

class AuditPasswordAlgorithms extends Command
{
    protected $signature = 'auth:audit-password-algorithms {--reset-legacy : Mark non-Argon2id accounts for a normal password reset}';

    protected $description = 'Audit stored user password hash algorithms and optionally flag legacy hashes for reset';

    public function handle(): int
    {
        $legacy = User::query()
            ->whereNotNull('password')
            ->get(['id', 'email', 'password', 'must_reset_password']);

        $legacy = $legacy->filter(static fn (User $user): bool => ! str_starts_with((string) $user->password, '$argon2id$'));
        $this->info('Argon2id accounts: ' . (User::query()->count() - $legacy->count()));
        $this->warn('Legacy/non-Argon2id accounts: ' . $legacy->count());

        if ($this->option('reset-legacy') && $legacy->isNotEmpty()) {
            User::query()
                ->whereIn('id', $legacy->pluck('id'))
                ->update(['must_reset_password' => true]);
            $this->info('Legacy accounts flagged for password reset. No passwords were changed.');
        }

        foreach ($legacy as $user) {
            $this->line($user->id . ' ' . $user->email);
        }

        return $legacy->isEmpty() ? self::SUCCESS : self::FAILURE;
    }
}
