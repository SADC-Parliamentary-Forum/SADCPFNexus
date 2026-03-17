<?php

namespace Database\Seeders;

use App\Models\Department;
use App\Models\Position;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Seeder;

class PositionsSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        $osg = Department::where('tenant_id', $tenant->id)->where('code', 'OSG')->first();
        $pb  = Department::where('tenant_id', $tenant->id)->where('code', 'PB')->first();
        $fcs = Department::where('tenant_id', $tenant->id)->where('code', 'FCS')->first();

        if (! $osg || ! $pb || ! $fcs) {
            return;
        }

        $positions = [
            // Office of the Secretary General
            ['dept' => $osg, 'title' => 'Secretary General',        'grade' => 'A1', 'headcount' => 1, 'description' => 'Chief executive officer of SADC-PF responsible for overall leadership and management.'],
            ['dept' => $osg, 'title' => 'Deputy Secretary General',  'grade' => 'A2', 'headcount' => 1, 'description' => 'Supports the SG in managing parliamentary programs and inter-parliamentary affairs.'],
            ['dept' => $osg, 'title' => 'Chief of Staff',            'grade' => 'B1', 'headcount' => 1, 'description' => 'Manages the SG office operations and coordinates cross-departmental initiatives.'],
            ['dept' => $osg, 'title' => 'System Administrator',      'grade' => 'B2', 'headcount' => 1, 'description' => 'Manages IT systems, infrastructure, and user access across the Secretariat.'],
            ['dept' => $osg, 'title' => 'Executive Assistant',       'grade' => 'C1', 'headcount' => 2, 'description' => 'Provides high-level administrative and secretarial support to senior management.'],

            // Parliamentary Business
            ['dept' => $pb, 'title' => 'Director of Parliamentary Business', 'grade' => 'B1', 'headcount' => 1, 'description' => 'Leads the Parliamentary Business department, overseeing all programme and governance functions.'],
            ['dept' => $pb, 'title' => 'Senior Programme Officer',   'grade' => 'B3', 'headcount' => 2, 'description' => 'Manages parliamentary programmes, provides expert advice, and coordinates with member parliaments.'],
            ['dept' => $pb, 'title' => 'Programme Officer',          'grade' => 'C1', 'headcount' => 4, 'description' => 'Implements parliamentary programmes, drafts reports, and supports committee operations.'],
            ['dept' => $pb, 'title' => 'Governance Officer',         'grade' => 'C2', 'headcount' => 2, 'description' => 'Supports governance activities including committee management and resolution tracking.'],
            ['dept' => $pb, 'title' => 'Research Officer',           'grade' => 'C2', 'headcount' => 2, 'description' => 'Conducts legislative research and prepares briefing papers for parliamentary activities.'],
            ['dept' => $pb, 'title' => 'Parliamentary Liaison Officer', 'grade' => 'C2', 'headcount' => 2, 'description' => 'Manages communications and coordination with SADC member parliaments.'],

            // Finance and Corporate Services
            ['dept' => $fcs, 'title' => 'Director of Finance and Corporate Services', 'grade' => 'B1', 'headcount' => 1, 'description' => 'Oversees all financial, HR, procurement, and corporate services functions.'],
            ['dept' => $fcs, 'title' => 'Finance Controller',        'grade' => 'B3', 'headcount' => 1, 'description' => 'Manages financial reporting, budgeting, and compliance with financial regulations.'],
            ['dept' => $fcs, 'title' => 'Senior Accountant',         'grade' => 'C1', 'headcount' => 1, 'description' => 'Prepares financial statements, manages imprest, and oversees payroll processing.'],
            ['dept' => $fcs, 'title' => 'Accountant',                'grade' => 'C2', 'headcount' => 2, 'description' => 'Processes financial transactions, maintains ledgers, and supports audit activities.'],
            ['dept' => $fcs, 'title' => 'HR Manager',                'grade' => 'B3', 'headcount' => 1, 'description' => 'Manages human resources functions including recruitment, performance, and staff welfare.'],
            ['dept' => $fcs, 'title' => 'HR Officer',                'grade' => 'C2', 'headcount' => 2, 'description' => 'Supports HR operations including leave management, timesheets, and staff records.'],
            ['dept' => $fcs, 'title' => 'Procurement Officer',       'grade' => 'C2', 'headcount' => 2, 'description' => 'Manages procurement processes, vendor relations, and asset acquisition.'],
            ['dept' => $fcs, 'title' => 'IT Officer',                'grade' => 'C2', 'headcount' => 2, 'description' => 'Maintains IT infrastructure, provides technical support, and manages system updates.'],
            ['dept' => $fcs, 'title' => 'Driver / Messenger',        'grade' => 'D1', 'headcount' => 3, 'description' => 'Provides transport services and handles official correspondence and deliveries.'],
        ];

        foreach ($positions as $p) {
            $pos = Position::firstOrCreate(
                ['tenant_id' => $tenant->id, 'department_id' => $p['dept']->id, 'title' => $p['title']],
                [
                    'grade'       => $p['grade'],
                    'headcount'   => $p['headcount'],
                    'description' => $p['description'],
                    'is_active'   => true,
                ]
            );
        }

        // Assign positions to users based on job titles
        $mappings = [
            'sg@sadcpf.org'      => ['dept' => $osg, 'title' => 'Secretary General'],
            'admin@sadcpf.org'   => ['dept' => $osg, 'title' => 'System Administrator'],
            'maria@sadcpf.org'   => ['dept' => $pb,  'title' => 'Senior Programme Officer'],
            'staff@sadcpf.org'   => ['dept' => $pb,  'title' => 'Programme Officer'],
            'thabo@sadcpf.org'   => ['dept' => $pb,  'title' => 'Governance Officer'],
            'hr@sadcpf.org'      => ['dept' => $fcs, 'title' => 'HR Manager'],
            'finance@sadcpf.org' => ['dept' => $fcs, 'title' => 'Finance Controller'],
            'john@sadcpf.org'    => ['dept' => $fcs, 'title' => 'Procurement Officer'],
        ];

        foreach ($mappings as $email => $info) {
            $user = User::where('email', $email)->first();
            if (! $user) continue;
            $pos = Position::where('tenant_id', $tenant->id)
                ->where('department_id', $info['dept']->id)
                ->where('title', $info['title'])
                ->first();
            if ($pos) {
                $user->update(['position_id' => $pos->id]);
            }
        }
    }
}
