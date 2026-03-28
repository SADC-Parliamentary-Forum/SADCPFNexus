<?php

namespace Database\Seeders;

use App\Models\DelegatedAuthority;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * Seeds SAAM demo data:
 *  - Two active delegated authorities (one outgoing from SG to HR, one from Finance to Staff)
 *  - One expired delegation for historical record
 *
 * Signature profiles are not seeded (they require image uploads via the UI).
 */
class SaamSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            $this->command->warn('Tenant not found — skipping SaamSeeder.');
            return;
        }

        $sg      = User::where('email', 'sg@sadcpf.org')->first();
        $admin   = User::where('email', 'admin@sadcpf.org')->first();
        $hr      = User::where('email', 'hr@sadcpf.org')->first();
        $finance = User::where('email', 'finance@sadcpf.org')->first();
        $staff   = User::where('email', 'staff@sadcpf.org')->first();
        $thabo   = User::where('email', 'thabo@sadcpf.org')->first();

        $today = Carbon::today();

        $delegations = [
            // Active: SG delegates correspondence approval to HR for annual leave period
            [
                'principal'   => $sg   ?? $admin,
                'delegate'    => $hr   ?? $staff,
                'start_date'  => $today->copy()->subDays(2),
                'end_date'    => $today->copy()->addDays(12),
                'role_scope'  => 'correspondence.approve',
                'reason'      => 'Secretary General on official mission — Addis Ababa, AU Parliament Assembly, 26 Mar – 9 Apr 2026.',
            ],
            // Active: Finance Controller delegates imprest approval to Thabo
            [
                'principal'   => $finance ?? $admin,
                'delegate'    => $thabo  ?? $staff,
                'start_date'  => $today->copy()->subDays(1),
                'end_date'    => $today->copy()->addDays(5),
                'role_scope'  => 'imprest.approve',
                'reason'      => 'Finance Controller attending ACCA training in Johannesburg.',
            ],
            // Expired historical delegation
            [
                'principal'   => $sg   ?? $admin,
                'delegate'    => $hr   ?? $staff,
                'start_date'  => $today->copy()->subDays(45),
                'end_date'    => $today->copy()->subDays(32),
                'role_scope'  => null,
                'reason'      => 'Acting authority during SG participation in Pan-African Parliament session, Midrand.',
            ],
        ];

        $count = 0;
        foreach ($delegations as $d) {
            if (! $d['principal'] || ! $d['delegate']) {
                continue;
            }

            $exists = DelegatedAuthority::where('tenant_id', $tenant->id)
                ->where('principal_user_id', $d['principal']->id)
                ->where('delegate_user_id',  $d['delegate']->id)
                ->where('start_date',        $d['start_date']->toDateString())
                ->exists();

            if (! $exists) {
                DelegatedAuthority::create([
                    'tenant_id'          => $tenant->id,
                    'principal_user_id'  => $d['principal']->id,
                    'delegate_user_id'   => $d['delegate']->id,
                    'start_date'         => $d['start_date'],
                    'end_date'           => $d['end_date'],
                    'role_scope'         => $d['role_scope'],
                    'reason'             => $d['reason'],
                    'created_by'         => $d['principal']->id,
                ]);
                $count++;
            }
        }

        $this->command->info("SAAM: seeded {$count} delegated authority records.");
    }
}
