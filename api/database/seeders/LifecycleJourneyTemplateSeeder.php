<?php

namespace Database\Seeders;

use App\Models\Lifecycle\LifecycleJourneyTemplate;
use App\Models\Lifecycle\LifecycleJourneyTemplateVersion;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

class LifecycleJourneyTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::query()->first();
        if (! $tenant) {
            return;
        }

        $publisher = User::where('tenant_id', $tenant->id)->first();
        $publisherId = $publisher?->id;

        $templates = [
            [
                'code' => 'onboarding-local',
                'name' => 'Local staff onboarding',
                'lifecycle_type' => 'onboarding',
                'definition' => self::buildOnboardingDefinition('local'),
            ],
            [
                'code' => 'onboarding-regional',
                'name' => 'Regional staff onboarding',
                'lifecycle_type' => 'onboarding',
                'definition' => self::buildOnboardingDefinition('regional'),
            ],
            [
                'code' => 'separation-resignation',
                'name' => 'Resignation separation',
                'lifecycle_type' => 'separation',
                'definition' => self::buildSeparationDefinition('resignation'),
            ],
            [
                'code' => 'separation-end-of-contract',
                'name' => 'End of contract separation',
                'lifecycle_type' => 'separation',
                'definition' => self::buildSeparationDefinition('end_of_contract'),
            ],
        ];

        foreach ($templates as $tpl) {
            $template = LifecycleJourneyTemplate::firstOrCreate(
                ['tenant_id' => $tenant->id, 'code' => $tpl['code']],
                [
                    'name' => $tpl['name'],
                    'lifecycle_type' => $tpl['lifecycle_type'],
                    'status' => 'active',
                    'created_by' => $publisherId,
                ]
            );

            $existing = LifecycleJourneyTemplateVersion::where('template_id', $template->id)
                ->where('status', 'published')
                ->first();

            if ($existing) {
                continue;
            }

            LifecycleJourneyTemplateVersion::create([
                'tenant_id' => $tenant->id,
                'template_id' => $template->id,
                'version_number' => 1,
                'status' => 'published',
                'definition' => $tpl['definition'],
                'published_at' => now(),
                'published_by' => $publisherId,
                'created_by' => $publisherId,
            ]);
        }
    }

    public static function buildOnboardingDefinition(string $category): array
    {
        return [
            'employee_category' => $category,
            'stages' => [
                [
                    'key' => 'employee',
                    'name' => 'Employee tasks',
                    'sort_order' => 1,
                    'parallel_group' => null,
                    'tasks' => [
                        [
                            'key' => 'submit_documents',
                            'title' => 'Submit personal documents',
                            'assignee_role' => 'employee',
                            'mandatory' => true,
                            'due_offset_days' => 5,
                            'due_anchor' => 'case_start',
                            'spawn_assignment' => true,
                        ],
                        [
                            'key' => 'policy_acknowledgement',
                            'title' => 'Acknowledge HR policies',
                            'assignee_role' => 'employee',
                            'mandatory' => true,
                            'due_offset_days' => 7,
                            'due_anchor' => 'case_start',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'finance',
                    'name' => 'Finance setup',
                    'sort_order' => 2,
                    'parallel_group' => 'departments',
                    'tasks' => [
                        [
                            'key' => 'payroll_setup',
                            'title' => 'Set up payroll record',
                            'assignee_role' => 'finance',
                            'department_slug' => 'finance',
                            'mandatory' => true,
                            'due_offset_days' => 3,
                            'due_anchor' => 'case_start',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'ict',
                    'name' => 'ICT provisioning',
                    'sort_order' => 3,
                    'parallel_group' => 'departments',
                    'tasks' => [
                        [
                            'key' => 'ict_account',
                            'title' => 'Provision ICT account and laptop',
                            'assignee_role' => 'ict',
                            'department_slug' => 'ict',
                            'mandatory' => true,
                            'due_offset_days' => 3,
                            'due_anchor' => 'case_start',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'admin',
                    'name' => 'Administration',
                    'sort_order' => 4,
                    'parallel_group' => 'departments',
                    'tasks' => [
                        [
                            'key' => 'access_badge',
                            'title' => 'Issue access badge',
                            'assignee_role' => 'admin',
                            'department_slug' => 'admin',
                            'mandatory' => true,
                            'due_offset_days' => 5,
                            'due_anchor' => 'case_start',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'regional_briefing',
                    'name' => 'Regional briefing',
                    'sort_order' => 5,
                    'parallel_group' => null,
                    'condition' => ['field' => 'employee_category', 'operator' => 'eq', 'value' => 'regional'],
                    'tasks' => [
                        [
                            'key' => 'regional_orientation',
                            'title' => 'Complete regional orientation',
                            'assignee_role' => 'hr',
                            'department_slug' => 'hr',
                            'mandatory' => false,
                            'optional_group' => 'orientation',
                            'due_offset_days' => 10,
                            'due_anchor' => 'case_start',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
            ],
        ];
    }

    public static function buildSeparationDefinition(string $reason): array
    {
        return [
            'separation_reason' => $reason,
            'stages' => [
                [
                    'key' => 'employee',
                    'name' => 'Employee handover',
                    'sort_order' => 1,
                    'tasks' => [
                        [
                            'key' => 'handover_pack',
                            'title' => 'Submit handover pack',
                            'assignee_role' => 'employee',
                            'mandatory' => true,
                            'due_offset_days' => -7,
                            'due_anchor' => 'last_working_day',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'finance_clearance',
                    'name' => 'Finance clearance',
                    'sort_order' => 2,
                    'parallel_group' => 'clearance',
                    'tasks' => [
                        [
                            'key' => 'finance_clearance',
                            'title' => 'Finance clearance',
                            'assignee_role' => 'finance',
                            'department_slug' => 'finance',
                            'mandatory' => true,
                            'due_offset_days' => 0,
                            'due_anchor' => 'last_working_day',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'ict_clearance',
                    'name' => 'ICT clearance',
                    'sort_order' => 3,
                    'parallel_group' => 'clearance',
                    'tasks' => [
                        [
                            'key' => 'ict_clearance',
                            'title' => 'ICT asset return and account closure',
                            'assignee_role' => 'ict',
                            'department_slug' => 'ict',
                            'mandatory' => true,
                            'due_offset_days' => 0,
                            'due_anchor' => 'last_working_day',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
                [
                    'key' => 'hr_final',
                    'name' => 'HR final clearance',
                    'sort_order' => 4,
                    'tasks' => [
                        [
                            'key' => 'hr_final_clearance',
                            'title' => 'Final HR clearance',
                            'assignee_role' => 'hr',
                            'department_slug' => 'hr',
                            'mandatory' => true,
                            'due_offset_days' => 1,
                            'due_anchor' => 'last_working_day',
                            'spawn_assignment' => true,
                        ],
                    ],
                ],
            ],
        ];
    }
}
