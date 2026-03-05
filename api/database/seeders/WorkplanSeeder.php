<?php

namespace Database\Seeders;

use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Database\Seeder;

class WorkplanSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (!$tenant) {
            return;
        }

        $admin = User::where('email', 'admin@sadcpf.org')->first();
        $staff = User::where('email', 'staff@sadcpf.org')->first();
        $user  = $admin ?? $staff;

        if (!$user) {
            return;
        }

        $events = [
            // ── THIS WEEK (2026-03-02 to 2026-03-08) ──
            [
                'title'       => 'Finance Sub-Committee – Budget Review',
                'type'        => 'meeting',
                'date'        => '2026-03-04',
                'description' => 'Finance sub-committee meeting to review Q1 actuals vs budget.',
                'responsible' => 'Finance Director',
            ],
            [
                'title'       => 'Procurement Evaluation – Software Licences',
                'type'        => 'milestone',
                'date'        => '2026-03-07',
                'description' => 'Deadline for procurement evaluation committee to submit scores.',
                'responsible' => 'Procurement Officer',
            ],
            // ── UPCOMING DEADLINE within 14 days (2026-03-04 to 2026-03-18) ──
            [
                'title'       => 'Imprest Documentation Deadline – Q1 Missions',
                'type'        => 'deadline',
                'date'        => '2026-03-12',
                'description' => 'All Q1 mission imprest retirement documents must be submitted to Finance.',
                'responsible' => 'Finance Controller',
            ],
            // March 2026
            [
                'title'         => 'Executive Committee Meeting',
                'type'          => 'meeting',
                'date'          => '2026-03-05',
                'end_date'      => '2026-03-06',
                'description'   => 'Quarterly ExCo meeting to review programme progress and approve Q2 workplan.',
                'responsible'   => 'Secretary General',
            ],
            [
                'title'         => 'Travel: Parliamentary Strengthening Workshop – Lusaka',
                'type'          => 'travel',
                'date'          => '2026-03-10',
                'end_date'      => '2026-03-14',
                'description'   => 'Programme team travel for capacity building workshop with Zambian parliament.',
                'responsible'   => 'Programme Manager',
                'linked_module' => 'programme',
            ],
            [
                'title'         => 'Annual Audit Submission Deadline',
                'type'          => 'deadline',
                'date'          => '2026-03-15',
                'description'   => 'Deadline for submitting 2025 financial statements to external auditors.',
                'responsible'   => 'Finance Director',
            ],
            [
                'title'         => 'Staff Annual Leave – Finance Officer',
                'type'          => 'leave',
                'date'          => '2026-03-18',
                'end_date'      => '2026-03-22',
                'description'   => 'Approved annual leave.',
                'responsible'   => 'Finance Officer',
                'linked_module' => 'leave',
            ],
            [
                'title'         => 'Gender & Youth Initiative – Inception Report Due',
                'type'          => 'deadline',
                'date'          => '2026-03-25',
                'description'   => 'Inception report must be submitted to USAID by this date.',
                'responsible'   => 'Gender Specialist',
                'linked_module' => 'programme',
            ],
            // April 2026
            [
                'title'         => 'Plenary Session – Gaborone',
                'type'          => 'meeting',
                'date'          => '2026-04-07',
                'end_date'      => '2026-04-10',
                'description'   => 'Annual Plenary Session of the SADC Parliamentary Forum.',
                'responsible'   => 'Secretary General',
            ],
            [
                'title'         => 'ICT Modernisation – Procurement Launch',
                'type'          => 'milestone',
                'date'          => '2026-04-15',
                'description'   => 'Issue tender documents for Cloud DMS and network equipment.',
                'responsible'   => 'ICT Manager',
                'linked_module' => 'programme',
            ],
            [
                'title'         => 'Travel: Gender Audit – Lilongwe',
                'type'          => 'travel',
                'date'          => '2026-04-20',
                'end_date'      => '2026-04-25',
                'description'   => 'Gender specialist travel to Malawi for parliamentary gender audit.',
                'responsible'   => 'Gender Specialist',
                'linked_module' => 'travel',
            ],
            [
                'title'         => 'Q1 Financial Reporting Deadline',
                'type'          => 'deadline',
                'date'          => '2026-04-30',
                'description'   => 'Deadline for Q1 2026 donor financial reports (EU & USAID).',
                'responsible'   => 'Finance Director',
            ],
            // May 2026
            [
                'title'         => 'HR Department Management Meeting',
                'type'          => 'meeting',
                'date'          => '2026-05-04',
                'description'   => 'Monthly HR management meeting to review performance appraisals and staffing.',
                'responsible'   => 'HR Manager',
            ],
            [
                'title'         => 'Travel: Peer Exchange Mission – Windhoek',
                'type'          => 'travel',
                'date'          => '2026-05-05',
                'end_date'      => '2026-05-08',
                'description'   => 'Study visit for 20 parliamentary staff under Parliamentary Strengthening Programme.',
                'responsible'   => 'Programme Manager',
                'linked_module' => 'programme',
            ],
            [
                'title'         => 'Annual Performance Appraisals Milestone',
                'type'          => 'milestone',
                'date'          => '2026-05-31',
                'description'   => 'All staff 2025/26 annual performance appraisals must be completed.',
                'responsible'   => 'HR Manager',
            ],
        ];

        foreach ($events as $data) {
            $existing = WorkplanEvent::where('tenant_id', $tenant->id)
                ->where('title', $data['title'])
                ->where('date', $data['date'])
                ->first();

            if ($existing) {
                continue;
            }

            WorkplanEvent::create(array_merge($data, [
                'tenant_id'  => $tenant->id,
                'created_by' => $user->id,
            ]));
        }
    }
}
