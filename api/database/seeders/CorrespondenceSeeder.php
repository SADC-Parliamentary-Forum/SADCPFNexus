<?php

namespace Database\Seeders;

use App\Models\ContactGroup;
use App\Models\Correspondence;
use App\Models\CorrespondenceContact;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * Seeds the correspondence module:
 *  - Contact groups (Permanent Missions, Member Parliaments, Donor Partners, etc.)
 *  - Correspondence contacts (external stakeholders, missions, donor reps)
 *  - Correspondence records across all workflow statuses
 */
class CorrespondenceSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            $this->command->warn('Tenant not found — skipping CorrespondenceSeeder.');
            return;
        }

        $admin  = User::where('email', 'admin@sadcpf.org')->first();
        $staff  = User::where('email', 'staff@sadcpf.org')->first();
        $hr     = User::where('email', 'hr@sadcpf.org')->first();
        $thabo  = User::where('email', 'thabo@sadcpf.org')->first();
        $sg     = User::where('email', 'sg@sadcpf.org')->first();

        if (! $admin || ! $staff) {
            $this->command->warn('Required users not found — skipping CorrespondenceSeeder.');
            return;
        }

        $creator  = $staff;
        $reviewer = $hr ?? $admin;
        $approver = $sg ?? $admin;

        $groups   = $this->seedContactGroups($tenant);
        $contacts = $this->seedContacts($tenant, $groups);
        $this->seedCorrespondence($tenant, $creator, $reviewer, $approver, $contacts, $thabo);
    }

    /* ─── Contact Groups ─────────────────────────────────────── */

    private function seedContactGroups(Tenant $tenant): array
    {
        $groups = [
            ['name' => 'Member Parliaments',   'description' => 'SADC member state national parliaments and their focal points.'],
            ['name' => 'Permanent Missions',   'description' => 'Permanent diplomatic missions accredited to SADC-PF host country.'],
            ['name' => 'Donor Partners',        'description' => 'International development partners and donors (EU, USAID, GIZ, etc.).'],
            ['name' => 'Civil Society',         'description' => 'Civil society organisations and NGO partners in the SADC region.'],
            ['name' => 'UN Agencies',           'description' => 'United Nations system agencies operating in the SADC region.'],
            ['name' => 'Regional Bodies',       'description' => 'Other regional intergovernmental bodies and forums.'],
            ['name' => 'Media',                 'description' => 'Journalists, press offices, and media outlets.'],
        ];

        $out = [];
        foreach ($groups as $g) {
            $out[$g['name']] = ContactGroup::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $g['name']],
                ['description' => $g['description']]
            );
        }

        $this->command->info('ContactGroups: seeded ' . count($out) . ' groups.');
        return $out;
    }

    /* ─── Contacts ───────────────────────────────────────────── */

    private function seedContacts(Tenant $tenant, array $groups): array
    {
        $records = [
            // Member Parliaments
            ['full_name' => 'Hon. Rosário Fernandes',     'organization' => 'Mozambique National Assembly',       'country' => 'Mozambique',   'email' => 'rfernandes@parliament.mz',    'stakeholder_type' => 'parliament',     'group' => 'Member Parliaments'],
            ['full_name' => 'Mr. Sipho Dube',             'organization' => 'National Assembly of Zambia',        'country' => 'Zambia',       'email' => 'sdube@parliament.gov.zm',     'stakeholder_type' => 'parliament',     'group' => 'Member Parliaments'],
            ['full_name' => 'Ms. Thandiwe Mokoena',       'organization' => 'Parliament of Zimbabwe',             'country' => 'Zimbabwe',     'email' => 'tmokoena@parlzim.gov.zw',     'stakeholder_type' => 'parliament',     'group' => 'Member Parliaments'],
            ['full_name' => 'Dr. Lerato Khumalo',         'organization' => 'Parliament of South Africa',         'country' => 'South Africa', 'email' => 'lkhumalo@parliament.gov.za',  'stakeholder_type' => 'parliament',     'group' => 'Member Parliaments'],
            ['full_name' => 'Hon. Amadou Diallo',         'organization' => 'Assemblée Nationale du Malawi',      'country' => 'Malawi',       'email' => 'adiallo@parliament.mw',       'stakeholder_type' => 'parliament',     'group' => 'Member Parliaments'],
            // Permanent Missions
            ['full_name' => 'Ambassador H.E. Naledi Stein', 'organization' => 'Permanent Mission of Botswana',   'country' => 'Botswana',     'email' => 'nstein@botswanamission.org',  'stakeholder_type' => 'government',     'group' => 'Permanent Missions'],
            ['full_name' => 'Mr. Eduardo Correia',        'organization' => 'Permanent Mission of Angola',        'country' => 'Angola',       'email' => 'ecorreia@angola-mission.ao',  'stakeholder_type' => 'government',     'group' => 'Permanent Missions'],
            // Donor Partners
            ['full_name' => 'Ms. Claire Dubois',          'organization' => 'European Union Delegation – Namibia','country' => 'Namibia',     'email' => 'claire.dubois@eeas.europa.eu','stakeholder_type' => 'donor',          'group' => 'Donor Partners'],
            ['full_name' => 'Mr. James Keller',           'organization' => 'USAID Southern Africa',              'country' => 'South Africa', 'email' => 'jkeller@usaid.gov',           'stakeholder_type' => 'donor',          'group' => 'Donor Partners'],
            ['full_name' => 'Ms. Anke Fischer',           'organization' => 'GIZ Regional Office',                'country' => 'Namibia',      'email' => 'a.fischer@giz.de',            'stakeholder_type' => 'donor',          'group' => 'Donor Partners'],
            // UN Agencies
            ['full_name' => 'Dr. Fatima Al-Hassan',       'organization' => 'UNDP Southern Africa',               'country' => 'Zimbabwe',     'email' => 'falhassan@undp.org',          'stakeholder_type' => 'un_agency',      'group' => 'UN Agencies'],
            ['full_name' => 'Mr. Patrick Osei',           'organization' => 'UN Women – Southern Africa',         'country' => 'Mozambique',   'email' => 'posei@unwomen.org',           'stakeholder_type' => 'un_agency',      'group' => 'UN Agencies'],
            // Civil Society
            ['full_name' => 'Ms. Charity Mwale',          'organization' => 'SADC Civil Society Forum',           'country' => 'Zambia',       'email' => 'cmwale@sadccsf.org',          'stakeholder_type' => 'ngo',            'group' => 'Civil Society'],
            ['full_name' => 'Rev. Samuel Nkhoma',         'organization' => 'Council of Churches in Malawi',      'country' => 'Malawi',       'email' => 'snkhoma@ccm.org.mw',          'stakeholder_type' => 'ngo',            'group' => 'Civil Society'],
            // Regional Bodies
            ['full_name' => 'Mr. Leonard Shumba',         'organization' => 'SADC Secretariat',                   'country' => 'Botswana',     'email' => 'lshumba@sadc.int',            'stakeholder_type' => 'regional_body',  'group' => 'Regional Bodies'],
            ['full_name' => 'Ms. Isabelle Nakagawa',      'organization' => 'African Parliamentary Union',         'country' => "Côte d'Ivoire",'email' => 'inakagawa@apu-upa.org',       'stakeholder_type' => 'regional_body',  'group' => 'Regional Bodies'],
        ];

        $out = [];
        foreach ($records as $r) {
            $group  = $r['group'];
            $key    = $r['email'];
            unset($r['group']);

            $contact = CorrespondenceContact::firstOrCreate(
                ['tenant_id' => $tenant->id, 'email' => $r['email']],
                array_merge($r, ['tenant_id' => $tenant->id])
            );

            // Attach to group
            if (isset($groups[$group])) {
                $alreadyMember = DB::table('contact_group_members')
                    ->where('group_id', $groups[$group]->id)
                    ->where('contact_id', $contact->id)
                    ->exists();
                if (! $alreadyMember) {
                    DB::table('contact_group_members')->insert([
                        'group_id'   => $groups[$group]->id,
                        'contact_id' => $contact->id,
                    ]);
                }
            }

            $out[$key] = $contact;
        }

        $this->command->info('Contacts: seeded ' . count($out) . ' contacts.');
        return $out;
    }

    /* ─── Correspondence ─────────────────────────────────────── */

    private function seedCorrespondence(
        Tenant $tenant,
        User $creator,
        User $reviewer,
        User $approver,
        array $contacts,
        ?User $thabo
    ): void {
        $today = Carbon::today();

        $eu       = $contacts['claire.dubois@eeas.europa.eu'] ?? null;
        $usaid    = $contacts['jkeller@usaid.gov'] ?? null;
        $undp     = $contacts['falhassan@undp.org'] ?? null;
        $sadc     = $contacts['lshumba@sadc.int'] ?? null;
        $zambia   = $contacts['sdube@parliament.gov.zm'] ?? null;
        $giz      = $contacts['a.fischer@giz.de'] ?? null;
        $unwomen  = $contacts['posei@unwomen.org'] ?? null;

        $letters = [
            // 1. Sent outgoing letter to EU
            [
                'reference_number' => 'OSG/SG/SA/0001/2026',
                'title'            => 'Invitation to SADC-PF Annual Plenary Session 2026',
                'subject'          => 'Invitation – SADC-PF Plenary Session, Gaborone, 7–10 April 2026',
                'body'             => "Dear Ms Dubois,\n\nOn behalf of the SADC Parliamentary Forum, I have the honour to extend a formal invitation to the European Union Delegation to participate as an observer at the SADC-PF Annual Plenary Session, scheduled for 7–10 April 2026 in Gaborone, Botswana.\n\nThe Plenary will deliberate on the SADC-PF Strategic Plan 2026–2030, adopt resolutions on parliamentary strengthening, and receive reports from thematic standing committees.\n\nKindly confirm attendance by 20 March 2026.\n\nYours sincerely,\nSecretary General",
                'type'             => 'outgoing',
                'direction'        => 'outgoing',
                'priority'         => 'high',
                'language'         => 'en',
                'status'           => 'sent',
                'file_code'        => 'OSG',
                'signatory_code'   => 'SG',
                'created_by'       => $creator->id,
                'reviewed_by'      => $reviewer->id,
                'approved_by'      => $approver->id,
                'submitted_at'     => $today->copy()->subDays(20),
                'reviewed_at'      => $today->copy()->subDays(18),
                'approved_at'      => $today->copy()->subDays(17),
                'sent_at'          => $today->copy()->subDays(16),
                'contact'          => $eu,
            ],
            // 2. Sent outgoing letter to USAID
            [
                'reference_number' => 'FIN/SG/SA/0002/2026',
                'title'            => 'Q4 2025 Donor Financial Report – USAID',
                'subject'          => 'Submission of Q4 2025 Financial Report under Parliamentary Strengthening Grant',
                'body'             => "Dear Mr Keller,\n\nIn accordance with the terms of the Parliamentary Strengthening Programme grant agreement (No. USAID-PSP-2023-001), please find enclosed the Q4 2025 Financial Report for the period October–December 2025.\n\nKey highlights:\n- Total expenditure: USD 487,320 (96.3% of Q4 allocation)\n- Programme activities: 14 of 15 planned activities completed\n- Variance explanation attached as Annex B\n\nShould you require any clarification, please do not hesitate to contact our Finance Department.\n\nYours faithfully,\nSecretary General",
                'type'             => 'outgoing',
                'direction'        => 'outgoing',
                'priority'         => 'high',
                'language'         => 'en',
                'status'           => 'sent',
                'file_code'        => 'FIN',
                'signatory_code'   => 'SG',
                'created_by'       => $creator->id,
                'reviewed_by'      => $reviewer->id,
                'approved_by'      => $approver->id,
                'submitted_at'     => $today->copy()->subDays(14),
                'reviewed_at'      => $today->copy()->subDays(13),
                'approved_at'      => $today->copy()->subDays(12),
                'sent_at'          => $today->copy()->subDays(11),
                'contact'          => $usaid,
            ],
            // 3. Pending approval — outgoing to UNDP
            [
                'reference_number' => 'PB/SG/SA/0003/2026',
                'title'            => 'MOU Renewal Proposal – UNDP Partnership',
                'subject'          => 'Proposal for Renewal of Memorandum of Understanding: SADC-PF and UNDP',
                'body'             => "Dear Dr Al-Hassan,\n\nI write to propose the renewal of the Memorandum of Understanding between the SADC Parliamentary Forum and the United Nations Development Programme, which is due to expire on 30 June 2026.\n\nWe propose a 3-year renewal (2026–2029) with expanded scope to include parliamentary oversight of SDG implementation.\n\nA draft revised MOU is attached for your review and comment. We would welcome a meeting at your earliest convenience to finalise the terms.\n\nYours sincerely,\nSecretary General",
                'type'             => 'outgoing',
                'direction'        => 'outgoing',
                'priority'         => 'normal',
                'language'         => 'en',
                'status'           => 'pending_approval',
                'file_code'        => 'PB',
                'signatory_code'   => 'SG',
                'created_by'       => $creator->id,
                'reviewed_by'      => $reviewer->id,
                'approved_by'      => null,
                'submitted_at'     => $today->copy()->subDays(5),
                'reviewed_at'      => $today->copy()->subDays(3),
                'approved_at'      => null,
                'sent_at'          => null,
                'contact'          => $undp,
            ],
            // 4. Under review — outgoing to SADC Secretariat
            [
                'reference_number' => 'OSG/SG/SA/0004/2026',
                'title'            => 'Request for Joint Session – SADC Secretariat & SADC-PF',
                'subject'          => 'Proposal for a Joint Consultative Session on Regional Integration',
                'body'             => "Dear Mr Shumba,\n\nIn light of the upcoming SADC Summit, the SADC Parliamentary Forum wishes to propose a joint consultative session between SADC-PF Standing Committees and the SADC Secretariat to align parliamentary oversight priorities with the SADC Integration Agenda 2026.\n\nWe propose a half-day session on the margins of the Plenary, on 6 April 2026.\n\nPlease advise on the feasibility of this arrangement at your earliest convenience.\n\nYours faithfully,\nSecretary General",
                'type'             => 'outgoing',
                'direction'        => 'outgoing',
                'priority'         => 'normal',
                'language'         => 'en',
                'status'           => 'pending_review',
                'file_code'        => 'OSG',
                'signatory_code'   => 'SG',
                'created_by'       => $creator->id,
                'reviewed_by'      => null,
                'approved_by'      => null,
                'submitted_at'     => $today->copy()->subDays(2),
                'reviewed_at'      => null,
                'approved_at'      => null,
                'sent_at'          => null,
                'contact'          => $sadc,
            ],
            // 5. Draft — outgoing to Zambia parliament
            [
                'reference_number' => null,
                'title'            => 'Invitation to Budget Oversight Capacity Building Workshop',
                'subject'          => 'Invitation – Parliamentary Budget Oversight Workshop, Windhoek, May 2026',
                'body'             => "Dear Mr Dube,\n\nThe SADC Parliamentary Forum cordially invites the National Assembly of Zambia to nominate two (2) members of parliament and one (1) parliamentary staff to participate in the Parliamentary Budget Oversight Capacity Building Workshop, scheduled for 19–21 May 2026 in Windhoek, Namibia.\n\nThe workshop is supported by the GIZ Regional Parliamentary Strengthening Programme. All participant costs will be covered.\n\nKindly submit nominations by 15 April 2026.\n\nYours sincerely,\nProgramme Officer",
                'type'             => 'outgoing',
                'direction'        => 'outgoing',
                'priority'         => 'normal',
                'language'         => 'en',
                'status'           => 'draft',
                'file_code'        => 'PB',
                'signatory_code'   => 'PO',
                'created_by'       => $creator->id,
                'reviewed_by'      => null,
                'approved_by'      => null,
                'submitted_at'     => null,
                'reviewed_at'      => null,
                'approved_at'      => null,
                'sent_at'          => null,
                'contact'          => $zambia,
            ],
            // 6. Incoming letter from GIZ
            [
                'reference_number' => 'GIZ/SADCPF/2026-003',
                'title'            => 'GIZ – Q2 2026 Programme Support Disbursement Confirmation',
                'subject'          => 'Confirmation of Q2 2026 Disbursement – GIZ Parliamentary Strengthening Programme',
                'body'             => "Dear Secretary General,\n\nWe are pleased to confirm the disbursement of EUR 125,000 for Q2 2026 under the GIZ Parliamentary Strengthening Programme (Contract No. GIZ-81234237).\n\nFunds have been transferred to the SADC-PF designated account. Please acknowledge receipt and submit the Q1 2026 Narrative Report no later than 30 April 2026.\n\nBest regards,\nAnke Fischer\nProgramme Manager, GIZ",
                'type'             => 'incoming',
                'direction'        => 'incoming',
                'priority'         => 'high',
                'language'         => 'en',
                'status'           => 'approved',
                'file_code'        => 'FIN',
                'signatory_code'   => 'FC',
                'created_by'       => $creator->id,
                'reviewed_by'      => $reviewer->id,
                'approved_by'      => $approver->id,
                'submitted_at'     => $today->copy()->subDays(10),
                'reviewed_at'      => $today->copy()->subDays(9),
                'approved_at'      => $today->copy()->subDays(8),
                'sent_at'          => null,
                'contact'          => $giz,
            ],
            // 7. Incoming letter from UN Women
            [
                'reference_number' => 'UNW/SADC-PF/2026-007',
                'title'            => 'UN Women – Gender Parity in SADC Parliaments Survey Request',
                'subject'          => 'Request for Data Submission: Gender Parity Survey 2026',
                'body'             => "Dear Secretary General,\n\nUN Women Southern Africa is conducting its biennial survey on gender parity in SADC member state parliaments and requests the SADC Parliamentary Forum's cooperation in distributing the attached questionnaire to member parliaments.\n\nWe request that completed questionnaires be returned by 30 April 2026 to enable publication of the 2026 Gender Parity Index by July 2026.\n\nYours sincerely,\nPatrick Osei\nUN Women",
                'type'             => 'incoming',
                'direction'        => 'incoming',
                'priority'         => 'normal',
                'language'         => 'en',
                'status'           => 'pending_review',
                'file_code'        => 'PB',
                'signatory_code'   => 'PO',
                'created_by'       => ($thabo ?? $creator)->id,
                'reviewed_by'      => null,
                'approved_by'      => null,
                'submitted_at'     => $today->copy()->subDays(1),
                'reviewed_at'      => null,
                'approved_at'      => null,
                'sent_at'          => null,
                'contact'          => $unwomen,
            ],
        ];

        $count = 0;
        foreach ($letters as $data) {
            $contact = $data['contact'];
            unset($data['contact']);

            $existing = Correspondence::withTrashed()
                ->where('tenant_id', $tenant->id)
                ->where('title', $data['title'])
                ->first();

            if ($existing) {
                continue;
            }

            $correspondence = Correspondence::create(array_merge($data, [
                'tenant_id' => $tenant->id,
            ]));

            // Attach contact as primary recipient
            if ($contact) {
                $recipientType = $data['direction'] === 'outgoing' ? 'to' : 'from';
                DB::table('correspondence_recipients')->insert([
                    'correspondence_id' => $correspondence->id,
                    'contact_id'        => $contact->id,
                    'recipient_type'    => $recipientType,
                    'email_sent_at'     => $data['sent_at'] ?? null,
                    'email_status'      => ($data['sent_at'] ?? null) ? 'sent' : null,
                ]);
            }

            $count++;
        }

        $this->command->info("Correspondence: seeded {$count} letters.");
    }
}
