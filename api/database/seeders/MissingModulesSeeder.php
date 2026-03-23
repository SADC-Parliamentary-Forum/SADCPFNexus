<?php

namespace Database\Seeders;

use App\Models\MeetingActionItem;
use App\Models\MeetingMinutes;
use App\Models\MeetingType;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetProject;
use App\Models\User;
use App\Models\Vendor;
use App\Models\WorkAssignment;
use App\Models\WorkplanEvent;
use Carbon\Carbon;
use Illuminate\Database\Seeder;

/**
 * Seeds all modules that were missing from previous seeders:
 *  - MeetingTypes
 *  - WorkAssignments (hr/work_assignments, linked to demo users)
 *  - Vendors + ProcurementQuotes (linked to existing procurement requests)
 *  - MeetingMinutes + MeetingActionItems
 *  - Timesheet Phase-1 field upgrades (work_bucket, activity_type, project_id)
 *  - Current-week draft timesheet for the staff user
 */
class MissingModulesSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            $this->command->warn('Tenant not found — skipping MissingModulesSeeder.');
            return;
        }

        $admin   = User::where('email', 'admin@sadcpf.org')->first();
        $staff   = User::where('email', 'staff@sadcpf.org')->first();
        $hr      = User::where('email', 'hr@sadcpf.org')->first();
        $finance = User::where('email', 'finance@sadcpf.org')->first();
        $maria   = User::where('email', 'maria@sadcpf.org')->first();
        $john    = User::where('email', 'john@sadcpf.org')->first();
        $thabo   = User::where('email', 'thabo@sadcpf.org')->first();

        $approver = $admin ?? $hr;

        $this->seedMeetingTypes($tenant);
        $this->seedWorkAssignments($tenant, $admin, $staff, $hr, $maria, $john, $thabo);
        $this->seedVendorsAndQuotes($tenant, $finance ?? $admin);
        $this->seedMeetingMinutes($tenant, $admin, $staff, $hr, $maria, $john, $thabo);
        $this->upgradeTimesheetEntries($tenant);
        $this->seedCurrentWeekDraft($tenant, $staff, $approver);
    }

    /* ─── Meeting Types ─────────────────────────────────────────── */

    private function seedMeetingTypes(Tenant $tenant): void
    {
        $types = [
            ['name' => 'Plenary Session',           'description' => 'Full plenary assembly of all member parliaments.',                       'sort_order' => 1],
            ['name' => 'Executive Committee',        'description' => 'ExCo governance and oversight meetings.',                                'sort_order' => 2],
            ['name' => 'Finance Sub-Committee',      'description' => 'Budget review and financial oversight sessions.',                        'sort_order' => 3],
            ['name' => 'Standing Committee',         'description' => 'Thematic standing committee sittings.',                                  'sort_order' => 4],
            ['name' => 'Management Meeting',         'description' => 'Internal management coordination meeting.',                              'sort_order' => 5],
            ['name' => 'Departmental Meeting',       'description' => 'Intra-department coordination and planning.',                            'sort_order' => 6],
            ['name' => 'Stakeholder Engagement',     'description' => 'External stakeholder and partner engagement sessions.',                  'sort_order' => 7],
            ['name' => 'Capacity Building Workshop', 'description' => 'Training and capacity development sessions.',                            'sort_order' => 8],
            ['name' => 'Procurement Evaluation',     'description' => 'Bid evaluation and procurement committee meetings.',                     'sort_order' => 9],
            ['name' => 'Board Meeting',              'description' => 'Governance board and advisory committee sessions.',                      'sort_order' => 10],
        ];

        foreach ($types as $type) {
            MeetingType::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $type['name']],
                ['description' => $type['description'], 'sort_order' => $type['sort_order']]
            );
        }

        $this->command->info('MeetingTypes: seeded ' . count($types) . ' types.');
    }

    /* ─── Work Assignments ──────────────────────────────────────── */

    private function seedWorkAssignments(
        Tenant $tenant,
        ?User $admin,
        ?User $staff,
        ?User $hr,
        ?User $maria,
        ?User $john,
        ?User $thabo
    ): void {
        $assigner = $hr ?? $admin;
        if (! $assigner || ! $staff) {
            return;
        }

        $today = Carbon::today();

        $assignments = [
            [
                'title'           => 'Prepare Q1 2026 HR Activity Report',
                'description'     => 'Compile key HR metrics, recruitment activity, leave utilisation, and training stats for Q1 2026.',
                'priority'        => 'high',
                'status'          => 'active',
                'assigned_to'     => $staff->id,
                'assigned_by'     => $assigner->id,
                'due_date'        => $today->copy()->addDays(7),
                'started_at'      => $today->copy()->subDays(5),
                'estimated_hours' => 12,
                'timesheet_linked'=> true,
            ],
            [
                'title'           => 'Update Employee Onboarding Checklist',
                'description'     => 'Review and update the standard onboarding checklist to reflect the new IT provisioning process and orientation schedule.',
                'priority'        => 'medium',
                'status'          => 'active',
                'assigned_to'     => $maria ? $maria->id : $staff->id,
                'assigned_by'     => $assigner->id,
                'due_date'        => $today->copy()->addDays(14),
                'started_at'      => $today->copy()->subDays(2),
                'estimated_hours' => 6,
                'timesheet_linked'=> true,
            ],
            [
                'title'           => 'Annual Leave Policy Review',
                'description'     => 'Review and propose amendments to the annual leave policy in line with Labour Act updates.',
                'priority'        => 'high',
                'status'          => 'completed',
                'assigned_to'     => $hr ? $hr->id : $staff->id,
                'assigned_by'     => $admin ? $admin->id : $assigner->id,
                'due_date'        => $today->copy()->subDays(10),
                'started_at'      => $today->copy()->subDays(30),
                'completed_at'    => $today->copy()->subDays(10),
                'estimated_hours' => 16,
                'actual_hours'    => 14,
                'timesheet_linked'=> true,
                'completion_notes'=> 'Policy reviewed and submitted to management for approval.',
            ],
            [
                'title'           => 'Coordinate Finance Sub-Committee Preparations',
                'description'     => 'Compile meeting packs, liaise with committee members, and arrange logistics for the March Finance Sub-Committee session.',
                'priority'        => 'critical',
                'status'          => 'active',
                'assigned_to'     => $thabo ? $thabo->id : $staff->id,
                'assigned_by'     => $assigner->id,
                'due_date'        => $today->copy()->addDays(3),
                'started_at'      => $today->copy()->subDays(7),
                'estimated_hours' => 20,
                'timesheet_linked'=> false,
            ],
            [
                'title'           => 'Procurement Register Reconciliation',
                'description'     => 'Reconcile the Q1 procurement register against approved purchase orders and flag discrepancies.',
                'priority'        => 'medium',
                'status'          => 'active',
                'assigned_to'     => $john ? $john->id : $staff->id,
                'assigned_by'     => $assigner->id,
                'due_date'        => $today->copy()->addDays(5),
                'started_at'      => $today->copy()->subDays(3),
                'estimated_hours' => 8,
                'timesheet_linked'=> true,
            ],
            [
                'title'           => 'Draft Performance Review Framework 2026',
                'description'     => 'Develop a new competency-based performance review framework aligned with the strategic plan 2026-2030.',
                'priority'        => 'high',
                'status'          => 'active',
                'assigned_to'     => $staff->id,
                'assigned_by'     => $assigner->id,
                'due_date'        => $today->copy()->addDays(21),
                'started_at'      => $today->copy()->subDays(1),
                'estimated_hours' => 24,
                'timesheet_linked'=> true,
            ],
        ];

        $count = 0;
        foreach ($assignments as $data) {
            $existing = WorkAssignment::where('tenant_id', $tenant->id)
                ->where('title', $data['title'])
                ->exists();
            if (! $existing) {
                WorkAssignment::create(array_merge($data, ['tenant_id' => $tenant->id]));
                $count++;
            }
        }

        $this->command->info("WorkAssignments: seeded {$count} assignments.");
    }

    /* ─── Vendors + Procurement Quotes ─────────────────────────── */

    private function seedVendorsAndQuotes(Tenant $tenant, ?User $creator): void
    {
        if (! $creator) {
            return;
        }

        $vendors = [
            [
                'name'                => 'TechBridge Solutions',
                'registration_number' => 'CC/2020/01234',
                'contact_email'       => 'procurement@techbridge.na',
                'contact_phone'       => '+264 61 301 000',
                'address'             => '12 Independence Ave, Windhoek',
                'is_approved'         => true,
                'is_active'           => true,
            ],
            [
                'name'                => 'OfficeMax Namibia',
                'registration_number' => 'CC/2018/05678',
                'contact_email'       => 'sales@officemax.na',
                'contact_phone'       => '+264 61 220 445',
                'address'             => '34 Sam Nujoma Drive, Windhoek',
                'is_approved'         => true,
                'is_active'           => true,
            ],
            [
                'name'                => 'AfriTech Communications',
                'registration_number' => 'CC/2019/09871',
                'contact_email'       => 'quotes@afritech.co.za',
                'contact_phone'       => '+27 11 456 7890',
                'address'             => '15 Jan Smuts Ave, Johannesburg',
                'is_approved'         => true,
                'is_active'           => true,
            ],
            [
                'name'                => 'Premier Event Solutions',
                'registration_number' => 'CC/2021/04321',
                'contact_email'       => 'events@premiersa.co.za',
                'contact_phone'       => '+27 21 555 0022',
                'address'             => '7 Buitenkant St, Cape Town',
                'is_approved'         => false,
                'is_active'           => true,
            ],
            [
                'name'                => 'Namib Catering Services',
                'registration_number' => 'CC/2017/11223',
                'contact_email'       => 'info@namibcatering.na',
                'contact_phone'       => '+264 61 302 112',
                'address'             => '88 Robert Mugabe Ave, Windhoek',
                'is_approved'         => true,
                'is_active'           => true,
            ],
        ];

        $createdVendors = [];
        foreach ($vendors as $v) {
            $vendor = Vendor::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $v['name']],
                $v
            );
            $createdVendors[$v['name']] = $vendor;
        }

        $this->command->info('Vendors: seeded ' . count($createdVendors) . ' vendors.');

        // Attach quotes to existing procurement requests
        $requests = ProcurementRequest::where('tenant_id', $tenant->id)->take(3)->get();
        $quoteCount = 0;

        foreach ($requests as $idx => $req) {
            if (ProcurementQuote::where('procurement_request_id', $req->id)->exists()) {
                continue;
            }

            $vendorList = array_values($createdVendors);
            $base       = 50000 + ($idx * 15000);
            $currency   = 'NAD';

            // 3 competing quotes per request
            $quotes = [
                [
                    'vendor_id'       => $vendorList[0]->id,
                    'vendor_name'     => $vendorList[0]->name,
                    'quoted_amount'   => $base * 0.97,
                    'is_recommended'  => false,
                    'notes'           => 'Lowest bid, standard lead time.',
                    'quote_date'      => Carbon::today()->subDays(10),
                ],
                [
                    'vendor_id'       => $vendorList[1]->id,
                    'vendor_name'     => $vendorList[1]->name,
                    'quoted_amount'   => $base,
                    'is_recommended'  => true,
                    'notes'           => 'Best value: competitive price, strong references, ISO-certified.',
                    'quote_date'      => Carbon::today()->subDays(9),
                ],
                [
                    'vendor_id'       => $vendorList[2]->id,
                    'vendor_name'     => $vendorList[2]->name,
                    'quoted_amount'   => $base * 1.08,
                    'is_recommended'  => false,
                    'notes'           => 'Higher price but offers extended warranty.',
                    'quote_date'      => Carbon::today()->subDays(8),
                ],
            ];

            foreach ($quotes as $q) {
                ProcurementQuote::create(array_merge($q, [
                    'procurement_request_id' => $req->id,
                    'currency'               => $currency,
                ]));
                $quoteCount++;
            }
        }

        $this->command->info("ProcurementQuotes: seeded {$quoteCount} quotes.");
    }

    /* ─── Meeting Minutes + Action Items ────────────────────────── */

    private function seedMeetingMinutes(
        Tenant $tenant,
        ?User $admin,
        ?User $staff,
        ?User $hr,
        ?User $maria,
        ?User $john,
        ?User $thabo
    ): void {
        $creator  = $admin ?? $staff;
        $recorder = $hr ?? $staff;
        if (! $creator || ! $staff) {
            return;
        }

        $today = Carbon::today();

        $minutes = [
            [
                'title'        => 'Management Meeting — March 2026',
                'meeting_date' => $today->copy()->subDays(7),
                'location'     => 'SADC-PF Board Room, Windhoek',
                'meeting_type' => 'management',
                'status'       => 'approved',
                'chairperson'  => $admin ? $admin->name : 'System Administrator',
                'attendees'    => array_values(array_filter([
                    $admin ? $admin->name : null,
                    $hr ? $hr->name : null,
                    $maria ? $maria->name : null,
                    $john ? $john->name : null,
                ])),
                'apologies'    => $thabo ? [$thabo->name] : [],
                'notes'        => "1. Review of Q4 2025 performance targets — all departments met core KPIs.\n2. Budget utilisation at 78% — on track for year-end.\n3. Staff welfare update: HR to circulate revised leave policy draft by end of month.\n4. ICT infrastructure upgrade approved in principle — procurement to commence Q2.\n5. Next meeting scheduled for April 2026.",
                'action_items' => [
                    [
                        'description'      => 'Circulate revised leave policy draft to all staff',
                        'responsible_id'   => $hr ? $hr->id : $staff->id,
                        'responsible_name' => $hr ? $hr->name : $staff->name,
                        'deadline'         => $today->copy()->addDays(7),
                        'status'           => 'pending',
                    ],
                    [
                        'description'      => 'Initiate ICT procurement request and obtain three quotes',
                        'responsible_id'   => $john ? $john->id : $staff->id,
                        'responsible_name' => $john ? $john->name : $staff->name,
                        'deadline'         => $today->copy()->addDays(14),
                        'status'           => 'in_progress',
                    ],
                    [
                        'description'      => 'Prepare Q1 2026 budget variance report for Finance Sub-Committee',
                        'responsible_id'   => $thabo ? $thabo->id : $staff->id,
                        'responsible_name' => $thabo ? $thabo->name : $staff->name,
                        'deadline'         => $today->copy()->addDays(3),
                        'status'           => 'pending',
                    ],
                ],
            ],
            [
                'title'        => 'Finance Sub-Committee — Q1 2026 Review',
                'meeting_date' => $today->copy()->subDays(14),
                'location'     => 'Conference Room B, SADC-PF Secretariat',
                'meeting_type' => 'finance',
                'status'       => 'approved',
                'chairperson'  => $admin ? $admin->name : 'Chairperson',
                'attendees'    => array_values(array_filter([
                    $admin ? $admin->name : null,
                    $hr ? $hr->name : null,
                    $john ? $john->name : null,
                ])),
                'apologies'    => [],
                'notes'        => "1. Q4 2025 expenditure presented — surplus of NAD 320,000 carried forward.\n2. Q1 2026 budget allocation approved as presented.\n3. Discretionary fund request for capacity building workshop (NAD 85,000) approved.\n4. Audit findings from external auditor reviewed — management responses accepted.\n5. Next quarterly review in June 2026.",
                'action_items' => [
                    [
                        'description'      => 'Process carry-forward surplus to Q2 budget lines',
                        'responsible_id'   => $staff->id,
                        'responsible_name' => $staff->name,
                        'deadline'         => $today->copy()->addDays(5),
                        'status'           => 'completed',
                        'notes'            => 'Processed and confirmed by Finance Controller.',
                    ],
                    [
                        'description'      => 'Submit procurement request for capacity building workshop venue',
                        'responsible_id'   => $john ? $john->id : $staff->id,
                        'responsible_name' => $john ? $john->name : $staff->name,
                        'deadline'         => $today->copy()->addDays(10),
                        'status'           => 'pending',
                    ],
                ],
            ],
            [
                'title'        => 'HR Departmental Meeting — Staff Welfare & Development',
                'meeting_date' => $today->copy()->subDays(3),
                'location'     => 'HR Office, SADC-PF Secretariat',
                'meeting_type' => 'departmental',
                'status'       => 'draft',
                'chairperson'  => $hr ? $hr->name : 'HR Manager',
                'attendees'    => array_values(array_filter([
                    $hr ? $hr->name : null,
                    $staff ? $staff->name : null,
                    $maria ? $maria->name : null,
                ])),
                'apologies'    => [],
                'notes'        => "1. Leave utilisation review — staff encouraged to take outstanding annual leave.\n2. Training calendar 2026 presented — sign-up sheets to be circulated.\n3. Performance tracker updates: all staff on track.\n4. Employee wellness initiative: counselling services available.\n5. New onboarding checklist to be rolled out from April.",
                'action_items' => [
                    [
                        'description'      => 'Circulate training sign-up sheet to all staff',
                        'responsible_id'   => $hr ? $hr->id : $staff->id,
                        'responsible_name' => $hr ? $hr->name : $staff->name,
                        'deadline'         => $today->copy()->addDays(2),
                        'status'           => 'pending',
                    ],
                    [
                        'description'      => 'Update onboarding checklist and share with department heads',
                        'responsible_id'   => $maria ? $maria->id : $staff->id,
                        'responsible_name' => $maria ? $maria->name : $staff->name,
                        'deadline'         => $today->copy()->addDays(14),
                        'status'           => 'pending',
                    ],
                ],
            ],
        ];

        $minCount    = 0;
        $actionCount = 0;

        foreach ($minutes as $m) {
            $actionItems = $m['action_items'];
            unset($m['action_items']);

            $existing = MeetingMinutes::where('tenant_id', $tenant->id)
                ->where('title', $m['title'])
                ->first();

            if (! $existing) {
                $minute = MeetingMinutes::create(array_merge($m, [
                    'tenant_id'  => $tenant->id,
                    'created_by' => $creator->id,
                ]));

                foreach ($actionItems as $ai) {
                    MeetingActionItem::create(array_merge($ai, [
                        'meeting_minutes_id' => $minute->id,
                    ]));
                    $actionCount++;
                }

                $minCount++;
            }
        }

        $this->command->info("MeetingMinutes: seeded {$minCount} records, {$actionCount} action items.");
    }

    /* ─── Upgrade Existing Timesheet Entries ─────────────────────  */

    private function upgradeTimesheetEntries(Tenant $tenant): void
    {
        $projects = TimesheetProject::where('tenant_id', $tenant->id)->pluck('id')->toArray();
        if (empty($projects)) {
            return;
        }

        $buckets = [
            ['bucket' => 'delivery',       'activity' => 'Task Execution'],
            ['bucket' => 'meeting',         'activity' => 'Team Meeting'],
            ['bucket' => 'delivery',       'activity' => 'Reporting'],
            ['bucket' => 'communication',  'activity' => 'Stakeholder Liaison'],
            ['bucket' => 'administration', 'activity' => 'HR/Leave Admin'],
            ['bucket' => 'delivery',       'activity' => 'Planning'],
            ['bucket' => 'meeting',         'activity' => 'Committee'],
            ['bucket' => 'delivery',       'activity' => 'Documentation'],
        ];

        $updated = 0;
        TimesheetEntry::whereNull('work_bucket')
            ->whereHas('timesheet', fn($q) => $q->where('tenant_id', $tenant->id))
            ->each(function (TimesheetEntry $entry) use ($projects, $buckets, &$updated) {
                $pick = $buckets[$entry->id % count($buckets)];
                $entry->update([
                    'work_bucket'  => $pick['bucket'],
                    'activity_type'=> $pick['activity'],
                    'project_id'   => $projects[$entry->id % count($projects)],
                ]);
                $updated++;
            });

        $this->command->info("TimesheetEntries: upgraded {$updated} entries with Phase-1 fields.");
    }

    /* ─── Current-week Draft Timesheet ──────────────────────────── */

    private function seedCurrentWeekDraft(Tenant $tenant, ?User $staff, ?User $approver): void
    {
        if (! $staff) {
            return;
        }

        $weekStart = Carbon::now()->startOfWeek(Carbon::MONDAY);
        $weekEnd   = $weekStart->copy()->addDays(6);

        $existing = Timesheet::where('tenant_id', $tenant->id)
            ->where('user_id', $staff->id)
            ->where('week_start', $weekStart->toDateString())
            ->first();

        if ($existing) {
            $this->command->info('Current-week draft already exists for staff user.');
            return;
        }

        $projects = TimesheetProject::where('tenant_id', $tenant->id)->pluck('id')->toArray();

        $ts = Timesheet::create([
            'tenant_id'      => $tenant->id,
            'user_id'        => $staff->id,
            'week_start'     => $weekStart->toDateString(),
            'week_end'       => $weekEnd->toDateString(),
            'total_hours'    => 24,
            'overtime_hours' => 0,
            'status'         => 'draft',
        ]);

        $entries = [
            ['day' => 0, 'hours' => 8, 'bucket' => 'delivery',       'activity' => 'Task Execution',      'proj' => 0],
            ['day' => 1, 'hours' => 4, 'bucket' => 'meeting',         'activity' => 'Team Meeting',         'proj' => 1],
            ['day' => 1, 'hours' => 4, 'bucket' => 'delivery',       'activity' => 'Documentation',        'proj' => 0],
            ['day' => 2, 'hours' => 8, 'bucket' => 'administration', 'activity' => 'HR/Leave Admin',       'proj' => null],
        ];

        foreach ($entries as $e) {
            $workDate   = $weekStart->copy()->addDays($e['day']);
            $projectId  = ($e['proj'] !== null && ! empty($projects)) ? ($projects[$e['proj'] % count($projects)] ?? null) : null;

            TimesheetEntry::create([
                'timesheet_id'  => $ts->id,
                'work_date'     => $workDate->toDateString(),
                'hours'         => $e['hours'],
                'overtime_hours'=> 0,
                'description'   => $e['activity'] . ' — ' . $workDate->format('D d M'),
                'work_bucket'   => $e['bucket'],
                'activity_type' => $e['activity'],
                'project_id'    => $projectId,
            ]);
        }

        $this->command->info('Current-week draft timesheet seeded for staff@sadcpf.org (24h logged, status: draft).');
    }
}
