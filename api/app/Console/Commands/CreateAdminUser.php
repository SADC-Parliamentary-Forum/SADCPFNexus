<?php

namespace App\Console\Commands;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;

class CreateAdminUser extends Command
{
    protected $signature   = 'app:create-admin';
    protected $description = 'Interactively create the System Admin user (production setup)';

    public function handle(): int
    {
        $this->info('=== SADCPF Nexus — Create System Admin ===');
        $this->newLine();

        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            $this->error('Tenant not found. Run the production seeder first: php artisan db:seed --class=ProductionSeeder');
            return self::FAILURE;
        }

        $adminRole = Role::where('name', 'System Admin')->where('guard_name', 'sanctum')->first();
        if (! $adminRole) {
            $this->error('System Admin role not found. Run the production seeder first: php artisan db:seed --class=ProductionSeeder');
            return self::FAILURE;
        }

        // Email
        $email = $this->ask('Admin email address');
        $emailValidation = Validator::make(['email' => $email], ['email' => 'required|email']);
        if ($emailValidation->fails()) {
            $this->error('Invalid email address.');
            return self::FAILURE;
        }

        if (User::where('email', $email)->exists()) {
            $this->error("A user with email [{$email}] already exists.");
            return self::FAILURE;
        }

        // Name
        $name = $this->ask('Full name', 'System Administrator');

        // Password (hidden, confirmed)
        $password = $this->secret('Password (min 12 chars, mixed case, number, symbol)');
        $passwordValidation = Validator::make(
            ['password' => $password],
            ['password' => ['required', 'min:12', 'regex:/[A-Z]/', 'regex:/[a-z]/', 'regex:/[0-9]/', 'regex:/[@$!%*?&#^()_+\-=\[\]{};\':"\\|,.<>\/?]/']],
            [
                'password.min'   => 'Password must be at least 12 characters.',
                'password.regex' => 'Password must contain uppercase, lowercase, a number, and a symbol.',
            ]
        );
        if ($passwordValidation->fails()) {
            foreach ($passwordValidation->errors()->all() as $error) {
                $this->error($error);
            }
            return self::FAILURE;
        }

        $confirm = $this->secret('Confirm password');
        if ($password !== $confirm) {
            $this->error('Passwords do not match.');
            return self::FAILURE;
        }

        // Create user
        $osgDept = Department::where('tenant_id', $tenant->id)->where('code', 'OSG')->first();

        // Generate a unique employee number
        $empNumber = 'SADCPF-001';
        $suffix = 1;
        while (User::where('employee_number', $empNumber)->exists()) {
            $suffix++;
            $empNumber = 'SADCPF-' . str_pad($suffix, 3, '0', STR_PAD_LEFT);
        }

        $admin = User::create([
            'tenant_id'       => $tenant->id,
            'department_id'   => $osgDept?->id,
            'name'            => $name,
            'email'           => $email,
            'password'        => Hash::make($password),
            'employee_number' => $empNumber,
            'job_title'       => 'System Administrator',
            'classification'  => 'SECRET',
            'mfa_enabled'     => true,
            'is_active'       => true,
        ]);

        $admin->syncRoles([$adminRole]);

        $this->newLine();
        $this->info("System Admin created successfully.");
        $this->table(['Field', 'Value'], [
            ['Email', $email],
            ['Name', $name],
            ['Role', 'System Admin'],
            ['MFA', 'Enabled'],
        ]);
        $this->newLine();
        $this->warn('Keep these credentials secure. Do not share them over unencrypted channels.');

        return self::SUCCESS;
    }
}
