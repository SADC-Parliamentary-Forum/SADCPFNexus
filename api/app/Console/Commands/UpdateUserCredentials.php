<?php

namespace App\Console\Commands;

use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;

class UpdateUserCredentials extends Command
{
    protected $signature   = 'app:update-user';
    protected $description = 'Update email, name, and/or password for an existing user';

    public function handle(): int
    {
        $this->info('=== SADCPF Nexus — Update User Credentials ===');
        $this->newLine();

        // Look up user
        $lookup = $this->ask('Current email address of the user to update');
        $user   = User::where('email', $lookup)->first();

        if (! $user) {
            $this->error("No user found with email [{$lookup}].");
            return self::FAILURE;
        }

        $this->line("Found: <info>{$user->name}</info> ({$user->email})");
        $roles = $user->getRoleNames()->implode(', ') ?: '—';
        $this->line("Roles: {$roles}");
        $this->newLine();

        $updated = [];

        // --- New email ---
        if ($this->confirm('Update email address?', false)) {
            $newEmail = $this->ask('New email address');
            $v = Validator::make(['email' => $newEmail], ['email' => 'required|email']);
            if ($v->fails()) {
                $this->error('Invalid email address.');
                return self::FAILURE;
            }
            if (User::where('email', $newEmail)->where('id', '!=', $user->id)->exists()) {
                $this->error("Email [{$newEmail}] is already taken by another user.");
                return self::FAILURE;
            }
            $user->email = $newEmail;
            $updated[]   = ['Field', 'email', 'New value', $newEmail];
        }

        // --- New name ---
        if ($this->confirm('Update full name?', false)) {
            $newName = $this->ask('New full name', $user->name);
            if (trim($newName) === '') {
                $this->error('Name cannot be empty.');
                return self::FAILURE;
            }
            $user->name = trim($newName);
            $updated[]  = ['Field', 'name', 'New value', $user->name];
        }

        // --- New password ---
        if ($this->confirm('Update password?', false)) {
            $password = $this->secret('New password (min 12 chars, mixed case, number, symbol)');
            $v = Validator::make(
                ['password' => $password],
                ['password' => ['required', 'min:12', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'regex:/[@$!%*?&#^()_+\-=\[\]{};\':"\\|,.<>\/?]/']],
                [
                    'password.min'   => 'Password must be at least 12 characters.',
                    'password.regex' => 'Password must contain uppercase, lowercase, a number, and a symbol.',
                ]
            );
            if ($v->fails()) {
                foreach ($v->errors()->all() as $error) {
                    $this->error($error);
                }
                return self::FAILURE;
            }

            $confirm = $this->secret('Confirm new password');
            if ($password !== $confirm) {
                $this->error('Passwords do not match.');
                return self::FAILURE;
            }

            $user->password = Hash::make($password);
            $updated[]      = ['Field', 'password', 'New value', '(hidden)'];
        }

        if (empty($updated)) {
            $this->warn('No changes made.');
            return self::SUCCESS;
        }

        $user->save();

        $this->newLine();
        $this->info('User updated successfully.');
        $this->table(['', 'Field', '', 'New Value'], $updated);
        $this->newLine();
        $this->warn('Keep these credentials secure.');

        return self::SUCCESS;
    }
}
