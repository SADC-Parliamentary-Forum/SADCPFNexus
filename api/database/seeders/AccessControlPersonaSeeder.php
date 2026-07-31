<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * Pilot persona fixtures for Access Control Phase 7 sign-off.
 * Deterministic emails under @sadcpf.local — safe for worktree/dev, not live secrets.
 *
 * Personas: Employee, Supervisor, HR, Finance, Programme, Procurement feature-only
 * evaluator, SG Office, ICT Admin, Access Admin, Internal Auditor.
 *
 * Password: set ACCESS_CONTROL_PERSONA_PASSWORD in local .env (never commit real secrets).
 * If unset, a per-email local hash is used (operators cannot know it — set the env for pilot logins).
 */
class AccessControlPersonaSeeder extends Seeder
{
    /**
     * @return array<string, array{email: string, name: string, role: string, persona: string}>
     */
    public static function personaMap(): array
    {
        return [
            'employee' => [
                'persona' => 'Employee',
                'email' => 'persona.employee@sadcpf.local',
                'name' => 'Pilot Employee',
                'role' => 'staff',
            ],
            'supervisor' => [
                'persona' => 'Supervisor',
                'email' => 'persona.supervisor@sadcpf.local',
                'name' => 'Pilot Supervisor',
                'role' => 'HOD',
            ],
            'hr' => [
                'persona' => 'HR',
                'email' => 'persona.hr@sadcpf.local',
                'name' => 'Pilot HR Officer',
                'role' => 'HR Manager',
            ],
            'finance' => [
                'persona' => 'Finance',
                'email' => 'persona.finance@sadcpf.local',
                'name' => 'Pilot Finance Officer',
                'role' => 'Finance Controller',
            ],
            'programme' => [
                'persona' => 'Programme',
                'email' => 'persona.programme@sadcpf.local',
                'name' => 'Pilot Programme Officer',
                'role' => 'Programme Officer',
            ],
            'procurement_evaluator' => [
                'persona' => 'Procurement feature-only evaluator',
                'email' => 'persona.proc-eval@sadcpf.local',
                'name' => 'Pilot Committee Evaluator',
                'role' => 'Procurement Evaluation Committee Member',
            ],
            'sg_office' => [
                'persona' => 'SG Office',
                'email' => 'persona.sg-office@sadcpf.local',
                'name' => 'Pilot SG Office',
                'role' => 'Administration Officer',
            ],
            'ict_admin' => [
                'persona' => 'ICT Admin',
                'email' => 'persona.ict@sadcpf.local',
                'name' => 'Pilot ICT Admin',
                'role' => 'ICT Platform Administrator',
            ],
            'access_admin' => [
                'persona' => 'Access Admin',
                'email' => 'persona.access-admin@sadcpf.local',
                'name' => 'Pilot Access Admin',
                'role' => 'Security and Access Administrator',
            ],
            'internal_auditor' => [
                'persona' => 'Internal Auditor',
                'email' => 'persona.auditor@sadcpf.local',
                'name' => 'Pilot Internal Auditor',
                'role' => 'Internal Auditor',
            ],
        ];
    }

    public function run(): void
    {
        $tenant = Tenant::query()->first() ?? Tenant::factory()->create([
            'name' => 'SADC PF Pilot Tenant',
            'slug' => 'sadcpf-pilot-'.Str::lower(Str::random(4)),
        ]);

        $configuredPassword = env('ACCESS_CONTROL_PERSONA_PASSWORD');

        foreach (self::personaMap() as $key => $meta) {
            $passwordMaterial = is_string($configuredPassword) && $configuredPassword !== ''
                ? $configuredPassword
                : hash('sha256', 'persona-local|'.$meta['email'].'|'.(string) config('app.key'));

            $user = User::query()->firstOrCreate(
                ['email' => $meta['email']],
                [
                    'tenant_id' => $tenant->id,
                    'name' => $meta['name'],
                    'password' => Hash::make($passwordMaterial),
                    'is_active' => true,
                    'account_status' => User::STATUS_ACTIVE,
                    'email_verified_at' => now(),
                ]
            );

            if ((int) $user->tenant_id !== (int) $tenant->id) {
                $user->update(['tenant_id' => $tenant->id]);
            }

            try {
                $user->syncRoles([$meta['role']]);
            } catch (\Throwable $e) {
                // Role may be template-only and not yet migrated in some envs.
                $this->command?->warn("Persona {$key}: could not assign role {$meta['role']}: ".$e->getMessage());
            }
        }
    }
}
