<?php

namespace Database\Seeders;

use App\Models\Contract;
use App\Models\GoodsReceiptItem;
use App\Models\GoodsReceiptNote;
use App\Models\Invoice;
use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementItem;
use App\Models\ProcurementQuote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\TravelRequest;
use App\Models\TravelItinerary;
use App\Models\Asset;
use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use App\Models\VendorRating;
use App\Models\VendorPerformanceEvaluation;
use Carbon\Carbon;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Comprehensive data seeder — fills every module with realistic,
 * inter-linked records for a believable demo environment.
 *
 * Covers:
 *  - Expanded vendor registry (15 vendors, full profiles, SME flags, banking)
 *  - Vendor ratings + performance evaluations
 *  - Full procurement lifecycle: RFQ → Quotes → PO → GRN → Invoice → Contract
 *  - Additional procurement requests (all statuses)
 *  - Contracts (active, completed, expiring-soon)
 *  - Additional travel requests (more users, more statuses)
 *  - Additional leave requests (different leave types)
 *  - Additional imprest requests (including retired ones)
 *  - Additional assets (IT, vehicles, furniture, AV)
 *
 * Safe to run multiple times — uses firstOrCreate / skipIfExists guards.
 */
class ComprehensiveDataSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            $this->command->warn('Tenant not found — skipping ComprehensiveDataSeeder.');
            return;
        }

        $admin   = User::where('email', 'admin@sadcpf.org')->first();
        $staff   = User::where('email', 'staff@sadcpf.org')->first();
        $hr      = User::where('email', 'hr@sadcpf.org')->first();
        $hradmin = User::where('email', 'hradmin@sadcpf.org')->first();
        $finance = User::where('email', 'finance@sadcpf.org')->first();
        $john    = User::where('email', 'john@sadcpf.org')->first();
        $thabo   = User::where('email', 'thabo@sadcpf.org')->first();
        $sg      = User::where('email', 'sg@sadcpf.org')->first();
        $maria   = User::where('email', 'maria@sadcpf.org')->first();
        $tendai  = User::where('email', 'srhr.zw@sadcpf.org')->first();
        $chanda  = User::where('email', 'srhr.zm@sadcpf.org')->first();

        $approver = $sg ?? $admin;

        $this->command->info('ComprehensiveDataSeeder: starting…');

        $vendors = $this->seedVendors($tenant, $admin, $john);
        $this->seedVendorRatings($tenant, $vendors, $staff, $maria, $hr, $john, $finance);
        $this->seedVendorEvaluations($tenant, $vendors, $john, $finance);
        $procRequests = $this->seedProcurementRequests($tenant, $staff, $maria, $john, $thabo, $finance, $sg, $approver);
        $this->seedFullProcurementLifecycle($tenant, $vendors, $procRequests, $john, $approver, $finance);
        $this->seedContracts($tenant, $vendors, $procRequests, $john, $approver);
        $this->seedTravelRequests($tenant, $staff, $maria, $thabo, $tendai, $chanda, $finance, $hr, $approver, $sg);
        $this->seedLeaveRequests($tenant, $staff, $maria, $hr, $hradmin, $tendai, $chanda, $approver);
        $this->seedImprestRequests($tenant, $staff, $maria, $thabo, $john, $finance, $approver);
        $this->seedAssets($tenant, $staff, $maria, $john, $thabo, $admin);

        $this->command->info('ComprehensiveDataSeeder: complete.');
    }

    /* ═══════════════════════════════════════════════════════════════
     * VENDORS
     * ═══════════════════════════════════════════════════════════════ */

    private function seedVendors(Tenant $tenant, ?User $admin, ?User $john): array
    {
        $approver = $john ?? $admin;
        $today    = Carbon::today();

        $definitions = [
            // ── IT & Technology ────────────────────────────────────────────────
            [
                'name'                => 'TechBridge Solutions',
                'registration_number' => 'CC/2020/01234',
                'tax_number'          => 'TVA-20-01234',
                'contact_name'        => 'Alex Mwangi',
                'contact_email'       => 'procurement@techbridge.na',
                'contact_phone'       => '+264 61 301 000',
                'website'             => 'https://techbridge.na',
                'address'             => '12 Independence Ave, Windhoek, Namibia',
                'country'             => 'Namibia',
                'category'            => 'IT & Technology',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'First National Bank Namibia',
                'bank_account'        => '62031845200',
                'bank_branch'         => 'Windhoek Main Branch',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Preferred ICT supplier. ISO 27001 certified.',
            ],
            [
                'name'                => 'AfriTech Communications',
                'registration_number' => 'CC/2019/09871',
                'tax_number'          => 'TVA-19-09871',
                'contact_name'        => 'Sipho Dlamini',
                'contact_email'       => 'quotes@afritech.co.za',
                'contact_phone'       => '+27 11 456 7890',
                'website'             => 'https://afritech.co.za',
                'address'             => '15 Jan Smuts Ave, Johannesburg, South Africa',
                'country'             => 'South Africa',
                'category'            => 'IT & Technology',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'Standard Bank South Africa',
                'bank_account'        => '0041234567',
                'bank_branch'         => 'Johannesburg CBD',
                'is_approved'         => true,
                'is_sme'              => true,
                'notes'               => 'Good for networking equipment. SME partner.',
            ],
            [
                'name'                => 'DataCore Africa',
                'registration_number' => 'CC/2022/33210',
                'tax_number'          => 'TVA-22-33210',
                'contact_name'        => 'Tendai Ncube',
                'contact_email'       => 'info@datacore.africa',
                'contact_phone'       => '+263 4 789 012',
                'website'             => null,
                'address'             => '23 Samora Machel Ave, Harare, Zimbabwe',
                'country'             => 'Zimbabwe',
                'category'            => 'IT & Technology',
                'payment_terms'       => 'Net 15',
                'bank_name'           => 'CBZ Bank Zimbabwe',
                'bank_account'        => '03-411234-001',
                'bank_branch'         => 'Harare City',
                'is_approved'         => false,
                'is_sme'              => true,
                'notes'               => 'Pending compliance documentation. On-hold.',
            ],
            // ── Office Supplies ────────────────────────────────────────────────
            [
                'name'                => 'OfficeMax Namibia',
                'registration_number' => 'CC/2018/05678',
                'tax_number'          => 'TVA-18-05678',
                'contact_name'        => 'Brenda Nakamhela',
                'contact_email'       => 'sales@officemax.na',
                'contact_phone'       => '+264 61 220 445',
                'website'             => 'https://officemax.na',
                'address'             => '34 Sam Nujoma Drive, Windhoek, Namibia',
                'country'             => 'Namibia',
                'category'            => 'Office Supplies',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'Nedbank Namibia',
                'bank_account'        => '11234567890',
                'bank_branch'         => 'Windhoek',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Reliable stationery and office supplies. Annual contract in place.',
            ],
            [
                'name'                => 'Stationers & Co',
                'registration_number' => 'BW/2021/00456',
                'tax_number'          => 'TIN-21-456',
                'contact_name'        => 'Gaopalelwe Mosele',
                'contact_email'       => 'orders@stationersco.bw',
                'contact_phone'       => '+267 391 2200',
                'website'             => null,
                'address'             => '7 The Mall, Gaborone, Botswana',
                'country'             => 'Botswana',
                'category'            => 'Office Supplies',
                'payment_terms'       => 'Immediate',
                'bank_name'           => 'Barclays Botswana',
                'bank_account'        => '00601234567',
                'bank_branch'         => 'Gaborone Main',
                'is_approved'         => true,
                'is_sme'              => true,
            ],
            // ── Catering & Events ──────────────────────────────────────────────
            [
                'name'                => 'Namib Catering Services',
                'registration_number' => 'CC/2017/11223',
                'tax_number'          => 'TVA-17-11223',
                'contact_name'        => 'Jonas Hamutenya',
                'contact_email'       => 'info@namibcatering.na',
                'contact_phone'       => '+264 61 302 112',
                'website'             => 'https://namibcatering.na',
                'address'             => '88 Robert Mugabe Ave, Windhoek, Namibia',
                'country'             => 'Namibia',
                'category'            => 'Catering & Hospitality',
                'payment_terms'       => 'Net 15',
                'bank_name'           => 'Bank Windhoek',
                'bank_account'        => '1523456789',
                'bank_branch'         => 'Windhoek West',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Official caterer for SADC-PF events. Health certification renewed.',
            ],
            [
                'name'                => 'Premier Event Solutions',
                'registration_number' => 'CC/2021/04321',
                'tax_number'          => 'TVA-21-04321',
                'contact_name'        => 'Thandi Mokoena',
                'contact_email'       => 'events@premiersa.co.za',
                'contact_phone'       => '+27 21 555 0022',
                'website'             => 'https://premiersa.co.za',
                'address'             => '7 Buitenkant St, Cape Town, South Africa',
                'country'             => 'South Africa',
                'category'            => 'Catering & Hospitality',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'ABSA South Africa',
                'bank_account'        => '4053201234',
                'bank_branch'         => 'Cape Town CBD',
                'is_approved'         => false,
                'is_sme'              => true,
                'notes'               => 'Applied for registration. Documentation under review.',
            ],
            // ── Transport & Logistics ──────────────────────────────────────────
            [
                'name'                => 'Kalahari Transport Ltd',
                'registration_number' => 'BW/2016/09923',
                'tax_number'          => 'TIN-16-9923',
                'contact_name'        => 'Ditiro Ramotswa',
                'contact_email'       => 'dispatch@kalahari-transport.bw',
                'contact_phone'       => '+267 395 7788',
                'website'             => null,
                'address'             => '45 Nelson Mandela Drive, Gaborone, Botswana',
                'country'             => 'Botswana',
                'category'            => 'Transport & Logistics',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'First National Bank Botswana',
                'bank_account'        => '62094112300',
                'bank_branch'         => 'Gaborone Industrial',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Used for equipment shipping. Freight and courier services.',
            ],
            // ── Professional Services ──────────────────────────────────────────
            [
                'name'                => 'Apex Legal Consultants',
                'registration_number' => 'ZA/LAW/2015/0078',
                'tax_number'          => 'TVA-15-0078',
                'contact_name'        => 'Advocate Refiloe Sithole',
                'contact_email'       => 'legal@apexconsult.co.za',
                'contact_phone'       => '+27 12 345 6789',
                'website'             => 'https://apexconsult.co.za',
                'address'             => '200 Pretorius St, Pretoria, South Africa',
                'country'             => 'South Africa',
                'category'            => 'Professional Services',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'Nedbank South Africa',
                'bank_account'        => '1923044567',
                'bank_branch'         => 'Pretoria Central',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Provides legal advisory services on contracts and compliance.',
            ],
            [
                'name'                => 'DeloittePwC Advisory (SADC)',
                'registration_number' => 'MZ/2014/00123',
                'tax_number'          => 'NUIT-14-00123',
                'contact_name'        => 'Carlos Baptista',
                'contact_email'       => 'sadc@deloittepwc-advisory.com',
                'contact_phone'       => '+258 21 490 000',
                'website'             => 'https://advisory.com',
                'address'             => '100 Avenida Julius Nyerere, Maputo, Mozambique',
                'country'             => 'Mozambique',
                'category'            => 'Professional Services',
                'payment_terms'       => 'Net 60',
                'bank_name'           => 'Millenium BIM Mozambique',
                'bank_account'        => '0001234567890',
                'bank_branch'         => 'Maputo Branch',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Audit and advisory partner. Used for external audit support.',
            ],
            // ── Construction & Works ───────────────────────────────────────────
            [
                'name'                => 'BuildRight Construction',
                'registration_number' => 'CC/2013/77001',
                'tax_number'          => 'TVA-13-77001',
                'contact_name'        => 'Moses Nghifikwa',
                'contact_email'       => 'contracts@buildright.na',
                'contact_phone'       => '+264 61 409 8800',
                'website'             => 'https://buildright.na',
                'address'             => '3 Industrial Road, Windhoek, Namibia',
                'country'             => 'Namibia',
                'category'            => 'Construction & Works',
                'payment_terms'       => 'Net 45',
                'bank_name'           => 'First National Bank Namibia',
                'bank_account'        => '62099901234',
                'bank_branch'         => 'Northern Industrial Windhoek',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'Used for office renovations and maintenance works.',
            ],
            // ── Security ──────────────────────────────────────────────────────
            [
                'name'                => 'SecureNet Guards',
                'registration_number' => 'CC/2019/22334',
                'tax_number'          => 'TVA-19-22334',
                'contact_name'        => 'Fillipus Haimbodi',
                'contact_email'       => 'ops@securenet.na',
                'contact_phone'       => '+264 61 507 2200',
                'website'             => null,
                'address'             => '22 Katutura West, Windhoek, Namibia',
                'country'             => 'Namibia',
                'category'            => 'Security Services',
                'payment_terms'       => 'Net 30',
                'bank_name'           => 'Bank Windhoek',
                'bank_account'        => '1578123456',
                'bank_branch'         => 'Katutura',
                'is_approved'         => true,
                'is_sme'              => true,
                'notes'               => 'Guards for secretariat premises. Monthly retainer contract.',
            ],
            // ── Blacklisted vendor ─────────────────────────────────────────────
            [
                'name'                => 'ShellCo Logistics',
                'registration_number' => 'XX/2020/99999',
                'tax_number'          => null,
                'contact_name'        => null,
                'contact_email'       => 'admin@shellco.invalid',
                'contact_phone'       => null,
                'website'             => null,
                'address'             => 'Unknown',
                'country'             => null,
                'category'            => 'Transport & Logistics',
                'payment_terms'       => null,
                'bank_name'           => null,
                'bank_account'        => null,
                'bank_branch'         => null,
                'is_approved'         => false,
                'is_active'           => false,
                'is_sme'              => false,
                'is_blacklisted'      => true,
                'blacklisted_at'      => $today->copy()->subMonths(2),
                'blacklisted_by'      => $approver ? $approver->id : null,
                'blacklist_reason'    => 'Fraudulent invoice submitted for services not rendered. Internal audit reference: AUDIT/2026/003.',
                'blacklist_reference' => 'AUDIT/2026/003',
                'notes'               => 'Debarred following internal audit investigation.',
            ],
            // ── Audio Visual ───────────────────────────────────────────────────
            [
                'name'                => 'ProAV Southern Africa',
                'registration_number' => 'ZA/2020/AV001',
                'tax_number'          => 'TVA-20-AV001',
                'contact_name'        => 'Amanda Nkosi',
                'contact_email'       => 'bookings@proav.co.za',
                'contact_phone'       => '+27 11 678 9000',
                'website'             => 'https://proav.co.za',
                'address'             => '89 Commissioner St, Johannesburg, South Africa',
                'country'             => 'South Africa',
                'category'            => 'Audio Visual',
                'payment_terms'       => 'Net 15',
                'bank_name'           => 'First National Bank South Africa',
                'bank_account'        => '6207890123',
                'bank_branch'         => 'Johannesburg CBD',
                'is_approved'         => true,
                'is_sme'              => false,
                'notes'               => 'AV hire for conferences and plenary sessions.',
            ],
            // ── Printing ───────────────────────────────────────────────────────
            [
                'name'                => 'PrintMasters Windhoek',
                'registration_number' => 'CC/2018/31100',
                'tax_number'          => 'TVA-18-31100',
                'contact_name'        => 'Reinhardt Lühl',
                'contact_email'       => 'orders@printmasters.na',
                'contact_phone'       => '+264 61 226 090',
                'website'             => null,
                'address'             => '100 Hosea Kutako Drive, Windhoek, Namibia',
                'country'             => 'Namibia',
                'category'            => 'Printing & Publishing',
                'payment_terms'       => 'Immediate',
                'bank_name'           => 'Nedbank Namibia',
                'bank_account'        => '11098765432',
                'bank_branch'         => 'Windhoek East',
                'is_approved'         => true,
                'is_sme'              => true,
                'notes'               => 'Used for annual reports, brochures, and letterheads.',
            ],
        ];

        $seeded = [];
        $count  = 0;

        foreach ($definitions as $def) {
            $vendor = Vendor::firstOrCreate(
                ['tenant_id' => $tenant->id, 'name' => $def['name']],
                array_merge($def, ['tenant_id' => $tenant->id, 'is_active' => $def['is_active'] ?? true])
            );
            if ($vendor->wasRecentlyCreated && $approver && ($def['is_approved'] ?? false)) {
                $vendor->update(['approved_by' => $approver->id, 'approved_at' => Carbon::today()->subMonths(rand(1,8))]);
            }
            $seeded[$def['name']] = $vendor;
            if ($vendor->wasRecentlyCreated) $count++;
        }

        $this->command->info("Vendors: seeded {$count} new vendors (total " . count($seeded) . ").");
        return $seeded;
    }

    /* ═══════════════════════════════════════════════════════════════
     * VENDOR RATINGS
     * ═══════════════════════════════════════════════════════════════ */

    private function seedVendorRatings(
        Tenant $tenant,
        array $vendors,
        ?User $staff,
        ?User $maria,
        ?User $hr,
        ?User $john,
        ?User $finance
    ): void {
        $raters = array_filter([$staff, $maria, $hr, $john, $finance]);
        $approvedVendors = array_filter($vendors, fn($v) => $v->is_approved && !$v->is_blacklisted);

        $ratingData = [
            'TechBridge Solutions'      => ['staff' => [5,'Excellent service, delivered on time and within budget.'], 'maria' => [4,'Professional team, slight delay on delivery but quality was great.'], 'john' => [5,'Top-tier. Highly recommend for ICT procurement.'], 'finance' => [4,'Invoicing was accurate and payment processing smooth.']],
            'AfriTech Communications'   => ['staff' => [3,'Average. Communication could be better.'], 'john' => [4,'Good product range. Competitive pricing for SMEs.'], 'finance' => [3,'Occasional invoice discrepancies, resolved promptly.']],
            'OfficeMax Namibia'         => ['staff' => [5,'Always reliable. Quick turnaround on stationery orders.'], 'maria' => [5,'Never disappointed. Great product selection.'], 'hr' => [4,'Office supplies consistently good quality.']],
            'Namib Catering Services'   => ['staff' => [4,'Food quality excellent. Some logistical issues at the plenary.'], 'maria' => [5,'Outstanding catering for the ExCo meeting. Very professional.'], 'thabo' => [4,'Good variety. Dietary requirements handled well.']],
            'Kalahari Transport Ltd'    => ['john' => [4,'Reliable for freight. Good tracking system.'], 'finance' => [3,'Delivery occasionally delayed. Pricing transparent.']],
            'Apex Legal Consultants'    => ['maria' => [5,'Excellent legal advice, thorough and responsive.'], 'john' => [4,'Very professional. Contract review was detailed.']],
            'SecureNet Guards'          => ['staff' => [3,'Guards professional but staffing levels sometimes thin overnight.'], 'admin' => [4,'Good security coverage. Incident response adequate.']],
            'ProAV Southern Africa'     => ['staff' => [5,'Flawless AV setup for the plenary. Zero technical issues.'], 'maria' => [4,'Professional team. Equipment was state of the art.']],
            'PrintMasters Windhoek'     => ['staff' => [4,'Annual report came out beautifully. Slight colour variance noted.'], 'hr' => [5,'Quick turnaround. Great quality for HR brochures.']],
        ];

        $userMap = [
            'staff'   => $staff,
            'maria'   => $maria,
            'hr'      => $hr,
            'john'    => $john,
            'finance' => $finance,
            'thabo'   => null, // handled by referencing thabo if passed
        ];

        $count = 0;
        foreach ($ratingData as $vendorName => $ratings) {
            $vendor = $approvedVendors[$vendorName] ?? ($vendors[$vendorName] ?? null);
            if (! $vendor) continue;

            foreach ($ratings as $userKey => [$rating, $review]) {
                $user = $userMap[$userKey] ?? null;
                if (! $user) continue;

                VendorRating::firstOrCreate(
                    ['vendor_id' => $vendor->id, 'rated_by' => $user->id],
                    [
                        'tenant_id' => $tenant->id,
                        'rating'    => $rating,
                        'review'    => $review,
                    ]
                ) && $count++;
            }
        }

        $this->command->info("VendorRatings: seeded {$count} ratings.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * VENDOR PERFORMANCE EVALUATIONS
     * ═══════════════════════════════════════════════════════════════ */

    private function seedVendorEvaluations(
        Tenant $tenant,
        array $vendors,
        ?User $john,
        ?User $finance
    ): void {
        $evaluator = $john ?? $finance;
        if (! $evaluator) return;

        $evalData = [
            'TechBridge Solutions'    => ['delivery' => 5, 'quality' => 5, 'compliance' => 4, 'communication' => 5, 'notes' => 'Exemplary performance on ICT equipment delivery. All SLAs met.'],
            'OfficeMax Namibia'       => ['delivery' => 4, 'quality' => 5, 'compliance' => 5, 'communication' => 4, 'notes' => 'Consistently reliable. Documentation always in order.'],
            'Namib Catering Services' => ['delivery' => 4, 'quality' => 5, 'compliance' => 4, 'communication' => 3, 'notes' => 'Food quality outstanding. Advance communication of menu changes needed.'],
            'Kalahari Transport Ltd'  => ['delivery' => 3, 'quality' => 4, 'compliance' => 4, 'communication' => 3, 'notes' => 'Delivery timelines need improvement. Compliance documentation adequate.'],
            'Apex Legal Consultants'  => ['delivery' => 5, 'quality' => 5, 'compliance' => 5, 'communication' => 5, 'notes' => 'Excellent advisory service. Deliverables always on time and comprehensive.'],
        ];

        $count = 0;
        foreach ($evalData as $vendorName => $scores) {
            $vendor = $vendors[$vendorName] ?? null;
            if (! $vendor) continue;

            $existing = VendorPerformanceEvaluation::where('vendor_id', $vendor->id)
                ->where('evaluated_by', $evaluator->id)->exists();
            if ($existing) continue;

            VendorPerformanceEvaluation::create([
                'tenant_id'           => $tenant->id,
                'vendor_id'           => $vendor->id,
                'evaluated_by'        => $evaluator->id,
                'delivery_score'      => $scores['delivery'],
                'quality_score'       => $scores['quality'],
                'compliance_score'    => $scores['compliance'],
                'communication_score' => $scores['communication'],
                'notes'               => $scores['notes'],
            ]);
            $count++;
        }

        $this->command->info("VendorPerformanceEvaluations: seeded {$count} evaluations.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * PROCUREMENT REQUESTS (expanded set)
     * ═══════════════════════════════════════════════════════════════ */

    private function seedProcurementRequests(
        Tenant $tenant,
        ?User $staff,
        ?User $maria,
        ?User $john,
        ?User $thabo,
        ?User $finance,
        ?User $sg,
        User $approver
    ): array {
        $today      = Carbon::today();
        $requester  = $staff ?? $john;
        if (! $requester) return [];

        $requests = [
            // ── Draft ─────────────────────────────────────────────────────────
            [
                'ref_suffix'      => 'PRINT-001',
                'title'           => 'Annual Report 2025 — Printing & Design',
                'description'     => 'Design and print 500 copies of the SADC-PF Annual Report 2025.',
                'category'        => 'services',
                'estimated_value' => 45000,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'draft',
                'budget_line'     => 'GL-COMMS-PRINT',
                'justification'   => 'Annual reporting obligation to member parliaments.',
                'requester'       => $staff ?? $thabo,
                'required_by'     => $today->copy()->addDays(45),
            ],
            // ── Submitted ─────────────────────────────────────────────────────
            [
                'ref_suffix'      => 'CATER-001',
                'title'           => 'Catering — Annual General Meeting 2026',
                'description'     => 'Full catering service for the 3-day AGM including all meals, coffee breaks, and a gala dinner.',
                'category'        => 'services',
                'estimated_value' => 120000,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'submitted',
                'budget_line'     => 'GL-GOV-EVENTS',
                'justification'   => 'Statutory governance meeting — catering mandatory.',
                'requester'       => $thabo ?? $staff,
                'required_by'     => $today->copy()->addDays(30),
                'submitted_at'    => $today->copy()->subDays(5),
            ],
            // ── HOD Approved ──────────────────────────────────────────────────
            [
                'ref_suffix'      => 'LEGAL-001',
                'title'           => 'Legal Advisory Services — Q2 2026',
                'description'     => 'Quarterly retainer for legal advisory services covering contract review, compliance guidance, and dispute resolution.',
                'category'        => 'services',
                'estimated_value' => 85000,
                'currency'        => 'NAD',
                'method'          => 'direct',
                'status'          => 'hod_approved',
                'budget_line'     => 'GL-ADMIN-LEGAL',
                'justification'   => 'Ongoing legal support required for contract management.',
                'requester'       => $maria ?? $staff,
                'required_by'     => $today->copy()->addDays(20),
                'submitted_at'    => $today->copy()->subDays(10),
                'hod_id'          => $approver->id,
                'hod_reviewed_at' => $today->copy()->subDays(3),
            ],
            // ── Approved / RFQ Issued ─────────────────────────────────────────
            [
                'ref_suffix'      => 'ICT-002',
                'title'           => 'Network Infrastructure Upgrade — Phase 2',
                'description'     => 'Supply and installation of managed network switches, wireless access points, and structured cabling for 2nd floor expansion.',
                'category'        => 'goods',
                'estimated_value' => 185000,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'approved',
                'budget_line'     => 'GL-ICT-INFRA',
                'justification'   => 'Current infrastructure at capacity. Approved in Q1 ICT roadmap.',
                'requester'       => $john ?? $staff,
                'required_by'     => $today->copy()->addDays(60),
                'submitted_at'    => $today->copy()->subDays(20),
                'approved_at'     => $today->copy()->subDays(12),
                'hod_id'          => $approver->id,
                'hod_reviewed_at' => $today->copy()->subDays(18),
                'rfq_issued_at'   => $today->copy()->subDays(10),
                'rfq_deadline'    => $today->copy()->addDays(5),
                'rfq_notes'       => 'Three qualified ICT vendors invited to quote.',
            ],
            // ── Awarded ───────────────────────────────────────────────────────
            [
                'ref_suffix'      => 'SECUR-001',
                'title'           => 'Security Services — Annual Contract Renewal',
                'description'     => 'Renewal of 12-month security guarding services for the SADC-PF Secretariat premises.',
                'category'        => 'services',
                'estimated_value' => 216000,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'awarded',
                'budget_line'     => 'GL-ADMIN-SECURITY',
                'justification'   => 'Statutory obligation. Previous contract expired 31 March 2026.',
                'requester'       => $staff,
                'required_by'     => $today->copy()->addDays(10),
                'submitted_at'    => $today->copy()->subDays(40),
                'approved_at'     => $today->copy()->subDays(30),
                'hod_id'          => $approver->id,
                'hod_reviewed_at' => $today->copy()->subDays(38),
                'rfq_issued_at'   => $today->copy()->subDays(28),
                'rfq_deadline'    => $today->copy()->subDays(14),
                'awarded_at'      => $today->copy()->subDays(7),
                'award_notes'     => 'SecureNet Guards awarded. Best value: NAD 216,000/annum. ISO 9001 certified.',
            ],
            // ── Awarded (for full lifecycle PO→GRN→Invoice) ───────────────────
            [
                'ref_suffix'      => 'FURN-001',
                'title'           => 'Office Furniture — Boardroom Refurbishment',
                'description'     => 'Supply of 20× executive chairs, 2× boardroom tables (10-seater), and matching credenza units.',
                'category'        => 'goods',
                'estimated_value' => 95000,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'awarded',
                'budget_line'     => 'GL-ADMIN-FURN',
                'justification'   => 'Boardroom furniture beyond economical repair. Budget approved.',
                'requester'       => $maria ?? $staff,
                'required_by'     => $today->copy()->subDays(5),
                'submitted_at'    => $today->copy()->subDays(50),
                'approved_at'     => $today->copy()->subDays(42),
                'hod_id'          => $approver->id,
                'hod_reviewed_at' => $today->copy()->subDays(48),
                'rfq_issued_at'   => $today->copy()->subDays(40),
                'rfq_deadline'    => $today->copy()->subDays(25),
                'awarded_at'      => $today->copy()->subDays(20),
                'award_notes'     => 'OfficeMax Namibia awarded at NAD 87,500. Within budget.',
            ],
            // ── Rejected ──────────────────────────────────────────────────────
            [
                'ref_suffix'      => 'TRAVEL-EQ',
                'title'           => 'Portable Projectors for Field Missions (×5)',
                'description'     => 'Purchase of 5× portable HDMI projectors for use during field missions and parliamentary training sessions.',
                'category'        => 'goods',
                'estimated_value' => 22500,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'rejected',
                'budget_line'     => 'GL-ICT-EQUIP',
                'justification'   => 'Required for field programme delivery.',
                'requester'       => $staff,
                'required_by'     => $today->copy()->subDays(20),
                'submitted_at'    => $today->copy()->subDays(30),
                'rejection_reason'=> 'Budget code GL-ICT-EQUIP exhausted for Q1. Resubmit in Q2 with updated budget code.',
            ],
            // ── Audio Visual ──────────────────────────────────────────────────
            [
                'ref_suffix'      => 'AV-PLENARY',
                'title'           => 'Audio-Visual Equipment — Plenary Session May 2026',
                'description'     => 'Hire of full AV setup including LED walls, simultaneous interpretation consoles (×6), and lighting rig for the 3-day plenary session.',
                'category'        => 'services',
                'estimated_value' => 280000,
                'currency'        => 'NAD',
                'method'          => 'quotation',
                'status'          => 'submitted',
                'budget_line'     => 'GL-GOV-PLENARY',
                'justification'   => 'Plenary infrastructure budget. Annual provision.',
                'requester'       => $thabo ?? $staff,
                'required_by'     => $today->copy()->addDays(20),
                'submitted_at'    => $today->copy()->subDays(3),
            ],
        ];

        $seeded   = [];
        $newCount = 0;

        foreach ($requests as $def) {
            $requester    = $def['requester'] ?? $requester;
            $refSuffix    = $def['ref_suffix'];
            $refNumber    = 'PRQ-' . $refSuffix;

            $existing = ProcurementRequest::where('tenant_id', $tenant->id)
                ->where('reference_number', $refNumber)->first();
            if ($existing) {
                $seeded[$refSuffix] = $existing;
                continue;
            }

            $payload = [
                'tenant_id'        => $tenant->id,
                'reference_number' => $refNumber,
                'requester_id'     => $requester ? $requester->id : null,
                'title'            => $def['title'],
                'description'      => $def['description'],
                'category'         => $def['category'],
                'estimated_value'  => $def['estimated_value'],
                'currency'         => $def['currency'],
                'procurement_method' => $def['method'],
                'status'           => $def['status'],
                'budget_line'      => $def['budget_line'],
                'justification'    => $def['justification'],
                'required_by_date' => $def['required_by'],
                'submitted_at'     => $def['submitted_at'] ?? null,
                'approved_at'      => $def['approved_at'] ?? null,
                'approved_by'      => isset($def['approved_at']) ? $approver->id : null,
                'hod_id'           => $def['hod_id'] ?? null,
                'hod_reviewed_at'  => $def['hod_reviewed_at'] ?? null,
                'rfq_issued_at'    => $def['rfq_issued_at'] ?? null,
                'rfq_deadline'     => $def['rfq_deadline'] ?? null,
                'rfq_notes'        => $def['rfq_notes'] ?? null,
                'awarded_at'       => $def['awarded_at'] ?? null,
                'award_notes'      => $def['award_notes'] ?? null,
                'rejection_reason' => $def['rejection_reason'] ?? null,
            ];

            $req = ProcurementRequest::create($payload);
            $seeded[$refSuffix] = $req;
            $newCount++;
        }

        $this->command->info("ProcurementRequests: seeded {$newCount} new requests.");
        return $seeded;
    }

    /* ═══════════════════════════════════════════════════════════════
     * FULL PROCUREMENT LIFECYCLE (Quotes → PO → GRN → Invoice)
     * ═══════════════════════════════════════════════════════════════ */

    private function seedFullProcurementLifecycle(
        Tenant $tenant,
        array $vendors,
        array $procRequests,
        ?User $john,
        User $approver,
        ?User $finance
    ): void {
        $today    = Carbon::today();
        $receiver = $john ?? $finance ?? $approver;

        // Map request ref_suffix → vendor name → quote amounts
        $lifecycleMap = [
            'FURN-001' => [
                'awarded_vendor' => 'OfficeMax Namibia',
                'quotes'         => [
                    ['OfficeMax Namibia',         87500,  true,  'Best value. ISO quality certification. 2-week lead time.'],
                    ['AfriTech Communications',   93200,  false, 'Higher price. Equivalent quality.'],
                    ['TechBridge Solutions',       99800,  false, 'Premium furniture range. Above budget.'],
                ],
                'po_items' => [
                    ['Executive Chairs (×20)',          20, 'unit',  2200,   44000],
                    ['10-Seater Boardroom Table (×2)',    2, 'unit', 18500,  37000],
                    ['Credenza Units (×2)',               2, 'unit',  3250,   6500],
                ],
                'po_status'       => 'delivered',
                'grn_status'      => 'accepted',
                'invoice_status'  => 'approved',
            ],
            'SECUR-001' => [
                'awarded_vendor' => 'SecureNet Guards',
                'quotes'         => [
                    ['SecureNet Guards',      216000, true,  'Competitive annual rate. 3 guards 24/7. ISO 9001 certified.'],
                    ['Namib Catering Services', 0,   false, null], // not applicable - placeholder
                    ['OfficeMax Namibia',        0,   false, null],
                ],
                'po_items' => [
                    ['Security Guarding Services — 12 months', 12, 'month', 18000, 216000],
                ],
                'po_status'       => 'issued',
                'grn_status'      => null, // services — no GRN
                'invoice_status'  => 'pending',
            ],
        ];

        $poCount  = 0;
        $grnCount = 0;
        $invCount = 0;

        foreach ($lifecycleMap as $refSuffix => $def) {
            $procReq = $procRequests[$refSuffix] ?? null;
            if (! $procReq) continue;

            $awardedVendor = $vendors[$def['awarded_vendor']] ?? null;

            // ── Create quotes if not already present ──
            if (ProcurementQuote::where('procurement_request_id', $procReq->id)->doesntExist()) {
                $quotedVendorObj = null;
                foreach ($def['quotes'] as [$vendorName, $amount, $recommended, $notes]) {
                    if ($amount <= 0) continue;
                    $v = $vendors[$vendorName] ?? null;
                    if (! $v) continue;
                    $q = ProcurementQuote::create([
                        'procurement_request_id' => $procReq->id,
                        'vendor_id'    => $v->id,
                        'vendor_name'  => $v->name,
                        'quoted_amount'=> $amount,
                        'currency'     => 'NAD',
                        'is_recommended'=> $recommended,
                        'notes'        => $notes,
                        'quote_date'   => $today->copy()->subDays(rand(15, 25)),
                    ]);
                    if ($recommended) {
                        $procReq->update(['awarded_quote_id' => $q->id]);
                        $quotedVendorObj = $v;
                    }
                }
            }

            if (! $awardedVendor) continue;

            // ── Purchase Order ──────────────────────────────────────────────
            $po = PurchaseOrder::where('procurement_request_id', $procReq->id)->first();
            if (! $po) {
                $totalAmount = collect($def['po_items'])->sum(fn($i) => $i[4]);
                $po = PurchaseOrder::create([
                    'tenant_id'             => $tenant->id,
                    'procurement_request_id'=> $procReq->id,
                    'vendor_id'             => $awardedVendor->id,
                    'title'                 => $procReq->title,
                    'description'           => 'Purchase Order for: ' . $procReq->title,
                    'total_amount'          => $totalAmount,
                    'currency'              => 'NAD',
                    'status'                => $def['po_status'],
                    'issued_at'             => $today->copy()->subDays(rand(12, 18)),
                    'expected_delivery_date'=> $today->copy()->subDays(rand(1, 7)),
                    'payment_terms'         => $awardedVendor->payment_terms ?? 'Net 30',
                    'created_by'            => $receiver ? $receiver->id : $approver->id,
                    'issued_by'             => $approver->id,
                ]);

                foreach ($def['po_items'] as [$desc, $qty, $unit, $unitPrice, $totalPrice]) {
                    PurchaseOrderItem::create([
                        'purchase_order_id' => $po->id,
                        'description'       => $desc,
                        'quantity'          => $qty,
                        'unit'              => $unit,
                        'unit_price'        => $unitPrice,
                        'total_price'       => $totalPrice,
                    ]);
                }
                $poCount++;
            }

            // ── Goods Receipt Note (only for goods, not services) ───────────
            if ($def['grn_status'] && GoodsReceiptNote::where('purchase_order_id', $po->id)->doesntExist()) {
                $grn = GoodsReceiptNote::create([
                    'tenant_id'           => $tenant->id,
                    'purchase_order_id'   => $po->id,
                    'received_by'         => $receiver ? $receiver->id : $approver->id,
                    'received_date'       => $today->copy()->subDays(rand(3, 8)),
                    'delivery_note_number'=> 'DN-' . strtoupper(Str::random(6)),
                    'status'              => $def['grn_status'],
                    'notes'               => 'All items received in good condition. Checked against PO.',
                ]);

                // Link GRN items to PO items
                $poItems = PurchaseOrderItem::where('purchase_order_id', $po->id)->get();
                foreach ($poItems as $poItem) {
                    GoodsReceiptItem::create([
                        'goods_receipt_note_id'  => $grn->id,
                        'purchase_order_item_id' => $poItem->id,
                        'quantity_ordered'        => $poItem->quantity,
                        'quantity_received'       => $poItem->quantity,
                        'quantity_accepted'       => $poItem->quantity,
                        'condition_notes'         => 'Good condition.',
                    ]);
                }
                $grnCount++;
            }

            // ── Invoice ────────────────────────────────────────────────────
            if (Invoice::where('purchase_order_id', $po->id)->doesntExist()) {
                $grn = GoodsReceiptNote::where('purchase_order_id', $po->id)->first();
                Invoice::create([
                    'tenant_id'              => $tenant->id,
                    'purchase_order_id'      => $po->id,
                    'goods_receipt_note_id'  => $grn?->id,
                    'vendor_id'              => $awardedVendor->id,
                    'vendor_invoice_number'  => 'INV-' . strtoupper(Str::random(7)),
                    'invoice_date'           => $today->copy()->subDays(rand(5, 10)),
                    'due_date'               => $today->copy()->addDays(30),
                    'amount'                 => $po->total_amount,
                    'currency'               => 'NAD',
                    'status'                 => $def['invoice_status'],
                    'match_status'           => $grn ? 'matched' : 'pending',
                    'match_notes'            => $grn ? 'Invoice matched to GRN. 3-way match complete.' : 'Pending GRN for services rendered.',
                ]);
                $invCount++;
            }
        }

        $this->command->info("ProcurementLifecycle: {$poCount} POs, {$grnCount} GRNs, {$invCount} Invoices seeded.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * CONTRACTS
     * ═══════════════════════════════════════════════════════════════ */

    private function seedContracts(
        Tenant $tenant,
        array $vendors,
        array $procRequests,
        ?User $john,
        User $approver
    ): void {
        $today = Carbon::today();

        $contractDefs = [
            [
                'vendor'         => 'TechBridge Solutions',
                'proc_ref'       => null,
                'title'          => 'ICT Support & Maintenance Services — 2025/26',
                'description'    => 'Comprehensive ICT support, preventive maintenance, and helpdesk services for SADC-PF Secretariat.',
                'value'          => 168000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subMonths(8),
                'end_date'       => $today->copy()->addMonths(4),
                'status'         => 'active',
                'signed_at'      => $today->copy()->subMonths(8)->addDays(3),
            ],
            [
                'vendor'         => 'SecureNet Guards',
                'proc_ref'       => 'SECUR-001',
                'title'          => 'Security Guarding Services — Annual Contract 2026/27',
                'description'    => '24/7 security guarding for SADC-PF Secretariat premises. 3 guards per shift.',
                'value'          => 216000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->addDays(5),
                'end_date'       => $today->copy()->addDays(365),
                'status'         => 'draft',
                'signed_at'      => null,
            ],
            [
                'vendor'         => 'Namib Catering Services',
                'proc_ref'       => null,
                'title'          => 'Standing Catering Retainer — SADC-PF Events',
                'description'    => 'Standing retainer for catering at all governance meetings and workshops.',
                'value'          => 85000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subMonths(4),
                'end_date'       => $today->copy()->addDays(25),   // expiring soon
                'status'         => 'active',
                'signed_at'      => $today->copy()->subMonths(4)->addDays(2),
            ],
            [
                'vendor'         => 'Apex Legal Consultants',
                'proc_ref'       => null,
                'title'          => 'Legal Advisory Retainer — Q1-Q2 2026',
                'description'    => 'Quarterly legal advisory retainer covering contract review, HR disputes, and compliance.',
                'value'          => 85000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subMonths(3),
                'end_date'       => $today->copy()->addMonths(3),
                'status'         => 'active',
                'signed_at'      => $today->copy()->subMonths(3)->addDays(1),
            ],
            [
                'vendor'         => 'OfficeMax Namibia',
                'proc_ref'       => 'FURN-001',
                'title'          => 'Boardroom Furniture Supply — 2026',
                'description'    => 'One-off supply contract for boardroom furniture refurbishment.',
                'value'          => 87500,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subDays(20),
                'end_date'       => $today->copy()->addDays(40),
                'status'         => 'active',
                'signed_at'      => $today->copy()->subDays(19),
            ],
            [
                'vendor'         => 'Kalahari Transport Ltd',
                'proc_ref'       => null,
                'title'          => 'Freight & Courier Services — FY2024/25',
                'description'    => 'Annual freight and courier service agreement.',
                'value'          => 48000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subMonths(14),
                'end_date'       => $today->copy()->subMonths(2),
                'status'         => 'completed',
                'signed_at'      => $today->copy()->subMonths(14)->addDays(5),
            ],
            [
                'vendor'         => 'BuildRight Construction',
                'proc_ref'       => null,
                'title'          => 'Office Renovation — Second Floor 2025',
                'description'    => 'Renovation of 2nd floor offices including partitioning, painting, and electrical works.',
                'value'          => 320000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subMonths(10),
                'end_date'       => $today->copy()->subMonths(6),
                'status'         => 'completed',
                'signed_at'      => $today->copy()->subMonths(10)->addDays(7),
            ],
            [
                'vendor'         => 'ShellCo Logistics',
                'proc_ref'       => null,
                'title'          => 'Logistics Support — TERMINATED',
                'description'    => 'Contract terminated following audit investigation.',
                'value'          => 75000,
                'currency'       => 'NAD',
                'start_date'     => $today->copy()->subMonths(5),
                'end_date'       => $today->copy()->subMonths(3),
                'status'         => 'terminated',
                'signed_at'      => $today->copy()->subMonths(5)->addDays(2),
                'terminated_at'  => $today->copy()->subMonths(3),
                'termination_reason' => 'Terminated for cause following AUDIT/2026/003 findings. Vendor subsequently blacklisted.',
            ],
        ];

        $count = 0;
        foreach ($contractDefs as $def) {
            $vendor  = $vendors[$def['vendor']] ?? null;
            if (! $vendor) continue;

            $procReq = isset($def['proc_ref']) ? ($procRequests[$def['proc_ref']] ?? null) : null;

            $existing = Contract::where('tenant_id', $tenant->id)
                ->where('vendor_id', $vendor->id)
                ->where('title', $def['title'])
                ->first();
            if ($existing) continue;

            Contract::create([
                'tenant_id'            => $tenant->id,
                'vendor_id'            => $vendor->id,
                'procurement_request_id' => $procReq?->id,
                'title'                => $def['title'],
                'description'          => $def['description'],
                'value'                => $def['value'],
                'currency'             => $def['currency'],
                'start_date'           => $def['start_date'],
                'end_date'             => $def['end_date'],
                'status'               => $def['status'],
                'signed_at'            => $def['signed_at'] ?? null,
                'terminated_at'        => $def['terminated_at'] ?? null,
                'termination_reason'   => $def['termination_reason'] ?? null,
                'created_by'           => $john ? $john->id : $approver->id,
            ]);
            $count++;
        }

        $this->command->info("Contracts: seeded {$count} contracts.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * TRAVEL REQUESTS (expanded)
     * ═══════════════════════════════════════════════════════════════ */

    private function seedTravelRequests(
        Tenant $tenant,
        ?User $staff,
        ?User $maria,
        ?User $thabo,
        ?User $tendai,
        ?User $chanda,
        ?User $finance,
        ?User $hr,
        User $approver,
        ?User $sg
    ): void {
        $today = Carbon::today();

        $requests = [
            [
                'user'        => $thabo,
                'ref'         => 'TRV-THABO-001',
                'destination' => 'Cape Town, South Africa',
                'purpose'     => 'Attend Southern African Parliamentary Governance Conference 2026.',
                'depart'      => $today->copy()->addDays(14),
                'return'      => $today->copy()->addDays(17),
                'status'      => 'submitted',
                'per_diem'    => 3800,
                'currency'    => 'ZAR',
                'submitted_at'=> $today->copy()->subDays(3),
            ],
            [
                'user'        => $finance,
                'ref'         => 'TRV-FINANCE-001',
                'destination' => 'Gaborone, Botswana',
                'purpose'     => 'Attend SADC Finance Officers Forum — budget harmonisation workshop.',
                'depart'      => $today->copy()->addDays(8),
                'return'      => $today->copy()->addDays(10),
                'status'      => 'approved',
                'per_diem'    => 2200,
                'currency'    => 'BWP',
                'submitted_at'=> $today->copy()->subDays(10),
                'approved_at' => $today->copy()->subDays(5),
            ],
            [
                'user'        => $tendai,
                'ref'         => 'TRV-TENDAI-001',
                'destination' => 'Lusaka, Zambia',
                'purpose'     => 'SRHR Parliamentary Sensitisation Workshop — Parliament of Zambia.',
                'depart'      => $today->copy()->subDays(5),
                'return'      => $today->copy()->subDays(2),
                'status'      => 'approved',
                'per_diem'    => 1800,
                'currency'    => 'USD',
                'submitted_at'=> $today->copy()->subDays(20),
                'approved_at' => $today->copy()->subDays(15),
            ],
            [
                'user'        => $chanda,
                'ref'         => 'TRV-CHANDA-001',
                'destination' => 'Harare, Zimbabwe',
                'purpose'     => 'SRHR Research Coordination Meeting — Parliament of Zimbabwe.',
                'depart'      => $today->copy()->addDays(21),
                'return'      => $today->copy()->addDays(23),
                'status'      => 'draft',
                'per_diem'    => 1500,
                'currency'    => 'USD',
            ],
            [
                'user'        => $hr,
                'ref'         => 'TRV-HR-001',
                'destination' => 'Johannesburg, South Africa',
                'purpose'     => 'Africa HR Summit — talent management and performance frameworks.',
                'depart'      => $today->copy()->subDays(30),
                'return'      => $today->copy()->subDays(27),
                'status'      => 'completed',
                'per_diem'    => 4500,
                'currency'    => 'ZAR',
                'submitted_at'=> $today->copy()->subDays(45),
                'approved_at' => $today->copy()->subDays(40),
            ],
            [
                'user'        => $maria,
                'ref'         => 'TRV-MARIA-002',
                'destination' => 'Maputo, Mozambique',
                'purpose'     => 'Programme coordination visit — SADC-PF field office.',
                'depart'      => $today->copy()->addDays(35),
                'return'      => $today->copy()->addDays(38),
                'status'      => 'draft',
                'per_diem'    => 2800,
                'currency'    => 'USD',
            ],
            [
                'user'        => $sg,
                'ref'         => 'TRV-SG-001',
                'destination' => 'Geneva, Switzerland',
                'purpose'     => 'Inter-Parliamentary Union Assembly — SADC-PF delegation.',
                'depart'      => $today->copy()->addDays(20),
                'return'      => $today->copy()->addDays(25),
                'status'      => 'hod_approved',
                'per_diem'    => 12000,
                'currency'    => 'CHF',
                'submitted_at'=> $today->copy()->subDays(15),
                'approved_at' => null,
            ],
        ];

        $count = 0;
        foreach ($requests as $def) {
            if (! $def['user']) continue;
            if (TravelRequest::where('reference_number', $def['ref'])->exists()) continue;

            // Split destination into city/country
            $destParts   = explode(', ', $def['destination'], 2);
            $destCity    = $destParts[0] ?? $def['destination'];
            $destCountry = $destParts[1] ?? '';

            TravelRequest::create([
                'tenant_id'          => $tenant->id,
                'requester_id'       => $def['user']->id,
                'reference_number'   => $def['ref'],
                'destination_city'   => $destCity,
                'destination_country'=> $destCountry,
                'purpose'            => $def['purpose'],
                'departure_date'     => $def['depart'],
                'return_date'        => $def['return'],
                'status'             => $def['status'],
                'estimated_dsa'      => $def['per_diem'],
                'currency'           => $def['currency'],
                'submitted_at'       => $def['submitted_at'] ?? null,
                'approved_at'        => $def['approved_at'] ?? null,
                'approved_by'        => isset($def['approved_at']) ? $approver->id : null,
            ]);
            $count++;
        }

        $this->command->info("TravelRequests: seeded {$count} new requests.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * LEAVE REQUESTS (expanded — all leave types)
     * ═══════════════════════════════════════════════════════════════ */

    private function seedLeaveRequests(
        Tenant $tenant,
        ?User $staff,
        ?User $maria,
        ?User $hr,
        ?User $hradmin,
        ?User $tendai,
        ?User $chanda,
        User $approver
    ): void {
        $today = Carbon::today();

        $requests = [
            [
                'user'        => $staff,
                'ref'         => 'LV-STAFF-002',
                'type'        => 'annual',
                'start'       => $today->copy()->addDays(30),
                'end'         => $today->copy()->addDays(39),
                'days'        => 8,
                'reason'      => 'Annual family holiday — Botswana.',
                'status'      => 'submitted',
                'submitted_at'=> $today->copy()->subDays(5),
            ],
            [
                'user'        => $maria,
                'ref'         => 'LV-MARIA-001',
                'type'        => 'sick',
                'start'       => $today->copy()->subDays(10),
                'end'         => $today->copy()->subDays(8),
                'days'        => 3,
                'reason'      => 'Flu and fever. Doctor certificate attached.',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(12),
                'approved_at' => $today->copy()->subDays(11),
            ],
            [
                'user'        => $tendai,
                'ref'         => 'LV-TENDAI-001',
                'type'        => 'annual',
                'start'       => $today->copy()->addDays(60),
                'end'         => $today->copy()->addDays(74),
                'days'        => 15,
                'reason'      => 'Annual leave — visiting family in Bulawayo.',
                'status'      => 'draft',
            ],
            [
                'user'        => $hr,
                'ref'         => 'LV-HR-001',
                'type'        => 'special',
                'start'       => $today->copy()->subDays(20),
                'end'         => $today->copy()->subDays(18),
                'days'        => 3,
                'reason'      => 'Bereavement leave — passing of mother-in-law.',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(22),
                'approved_at' => $today->copy()->subDays(21),
            ],
            [
                'user'        => $chanda,
                'ref'         => 'LV-CHANDA-001',
                'type'        => 'annual',
                'start'       => $today->copy()->addDays(90),
                'end'         => $today->copy()->addDays(104),
                'days'        => 15,
                'reason'      => 'Annual leave — end of year break.',
                'status'      => 'submitted',
                'submitted_at'=> $today->copy()->subDays(2),
            ],
            [
                'user'        => $hradmin,
                'ref'         => 'LV-HRADMIN-001',
                'type'        => 'annual',
                'start'       => $today->copy()->addDays(15),
                'end'         => $today->copy()->addDays(24),
                'days'        => 10,
                'reason'      => 'Annual leave.',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(8),
                'approved_at' => $today->copy()->subDays(6),
            ],
            [
                'user'        => $maria,
                'ref'         => 'LV-MARIA-002',
                'type'        => 'study',
                'start'       => $today->copy()->addDays(45),
                'end'         => $today->copy()->addDays(49),
                'days'        => 5,
                'reason'      => 'Study leave for Masters dissertation submission.',
                'status'      => 'submitted',
                'submitted_at'=> $today->copy()->subDays(1),
            ],
        ];

        $count = 0;
        foreach ($requests as $def) {
            if (! $def['user']) continue;
            if (LeaveRequest::where('reference_number', $def['ref'])->exists()) continue;

            LeaveRequest::create([
                'tenant_id'        => $tenant->id,
                'requester_id'     => $def['user']->id,
                'reference_number' => $def['ref'],
                'leave_type'       => $def['type'],
                'start_date'       => $def['start'],
                'end_date'         => $def['end'],
                'days_requested'   => $def['days'],
                'reason'           => $def['reason'],
                'status'           => $def['status'],
                'submitted_at'     => $def['submitted_at'] ?? null,
                'approved_at'      => $def['approved_at'] ?? null,
                'approved_by'      => isset($def['approved_at']) ? $approver->id : null,
            ]);
            $count++;
        }

        $this->command->info("LeaveRequests: seeded {$count} new requests.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * IMPREST REQUESTS (expanded — including retired)
     * ═══════════════════════════════════════════════════════════════ */

    private function seedImprestRequests(
        Tenant $tenant,
        ?User $staff,
        ?User $maria,
        ?User $thabo,
        ?User $john,
        ?User $finance,
        User $approver
    ): void {
        $today = Carbon::today();

        $requests = [
            // Submitted — awaiting approval
            [
                'user'        => $thabo,
                'ref'         => 'IMP-THABO-001',
                'purpose'     => 'Workshop logistics — transport and printing for governance training.',
                'budget_line' => 'OP-GOV-TRAINING',
                'amount'      => 8500,
                'currency'    => 'NAD',
                'status'      => 'submitted',
                'submitted_at'=> $today->copy()->subDays(4),
                'due'         => $today->copy()->addDays(45),
            ],
            // Approved
            [
                'user'        => $john,
                'ref'         => 'IMP-JOHN-001',
                'purpose'     => 'Procurement field visit — supplier site inspections in South Africa.',
                'budget_line' => 'OP-PROC-VISITS',
                'amount'      => 12000,
                'currency'    => 'NAD',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(12),
                'approved_at' => $today->copy()->subDays(8),
                'due'         => $today->copy()->addDays(30),
            ],
            // Approved (pending liquidation)
            [
                'user'        => $maria,
                'ref'         => 'IMP-MARIA-001',
                'purpose'     => 'SRHR programme coordination — field monitoring costs.',
                'budget_line' => 'PROG-SRHR-2026',
                'amount'      => 15000,
                'currency'    => 'NAD',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(20),
                'approved_at' => $today->copy()->subDays(16),
                'due'         => $today->copy()->addDays(16),
                'amount_liquidated' => 0,
            ],
            // Liquidated (fully retired)
            [
                'user'        => $staff,
                'ref'         => 'IMP-STAFF-002',
                'purpose'     => 'Stationery and office supplies — urgent procurement.',
                'budget_line' => 'OP-ADMIN-SUPPLIES',
                'amount'      => 4500,
                'currency'    => 'NAD',
                'status'      => 'liquidated',
                'submitted_at'=> $today->copy()->subDays(40),
                'approved_at' => $today->copy()->subDays(36),
                'due'         => $today->copy()->subDays(5),
                'amount_liquidated' => 4350,
                'liquidated_at' => $today->copy()->subDays(20),
            ],
            // Partially liquidated
            [
                'user'        => $thabo,
                'ref'         => 'IMP-THABO-002',
                'purpose'     => 'Committee preparation — printing, refreshments, stationery.',
                'budget_line' => 'OP-GOV-COMMITTEE',
                'amount'      => 6000,
                'currency'    => 'NAD',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(25),
                'approved_at' => $today->copy()->subDays(21),
                'due'         => $today->copy()->addDays(5),
                'amount_liquidated' => 3800,
            ],
            // Approved but overdue (past liquidation date)
            [
                'user'        => $john,
                'ref'         => 'IMP-JOHN-002',
                'purpose'     => 'Vendor site visit — Cape Town procurement evaluation.',
                'budget_line' => 'OP-PROC-VISITS',
                'amount'      => 9500,
                'currency'    => 'NAD',
                'status'      => 'approved',
                'submitted_at'=> $today->copy()->subDays(50),
                'approved_at' => $today->copy()->subDays(46),
                'due'         => $today->copy()->subDays(14), // overdue
            ],
        ];

        $count = 0;
        foreach ($requests as $def) {
            if (! $def['user']) continue;
            if (ImprestRequest::where('reference_number', $def['ref'])->exists()) continue;

            $payload = [
                'tenant_id'                 => $tenant->id,
                'requester_id'              => $def['user']->id,
                'reference_number'          => $def['ref'],
                'budget_line'               => $def['budget_line'],
                'purpose'                   => $def['purpose'],
                'amount_requested'          => $def['amount'],
                'amount_approved'           => isset($def['approved_at']) ? $def['amount'] : null,
                'amount_liquidated'         => $def['amount_liquidated'] ?? 0,
                'currency'                  => $def['currency'],
                'status'                    => $def['status'],
                'submitted_at'              => $def['submitted_at'] ?? null,
                'approved_at'               => $def['approved_at'] ?? null,
                'approved_by'               => isset($def['approved_at']) ? $approver->id : null,
                'expected_liquidation_date' => $def['due'],
                'liquidated_at'             => $def['liquidated_at'] ?? null,
            ];

            ImprestRequest::create(array_filter($payload, fn($v) => $v !== null));
            $count++;
        }

        $this->command->info("ImprestRequests: seeded {$count} new requests.");
    }

    /* ═══════════════════════════════════════════════════════════════
     * ASSETS (expanded inventory)
     * ═══════════════════════════════════════════════════════════════ */

    private function seedAssets(
        Tenant $tenant,
        ?User $staff,
        ?User $maria,
        ?User $john,
        ?User $thabo,
        ?User $admin
    ): void {
        $today = Carbon::today();

        $assets = [
            // IT Equipment
            ['code' => 'IT-NB-001', 'name' => 'Dell XPS 15 Laptop',             'category' => 'IT Equipment', 'status' => 'active',     'user' => $staff,  'value' => 22000, 'notes' => 'DX15-2024-001 · Office 102'],
            ['code' => 'IT-NB-002', 'name' => 'Apple MacBook Pro 14"',           'category' => 'IT Equipment', 'status' => 'active',     'user' => $maria,  'value' => 35000, 'notes' => 'MBP14-2024-002 · Office 104'],
            ['code' => 'IT-NB-003', 'name' => 'HP EliteBook 840 G9 Laptop',     'category' => 'IT Equipment', 'status' => 'active',     'user' => $john,   'value' => 18500, 'notes' => 'HPE840-2024-003 · Procurement 201'],
            ['code' => 'IT-NB-004', 'name' => 'Lenovo ThinkPad X1 Carbon',      'category' => 'IT Equipment', 'status' => 'active',     'user' => $thabo,  'value' => 21000, 'notes' => 'TPX1-2025-004 · Governance 203'],
            ['code' => 'IT-NB-005', 'name' => 'Dell Latitude 7440 Laptop',      'category' => 'IT Equipment', 'status' => 'loan_out',   'user' => null,    'value' => 17500, 'notes' => 'DL7440-2025-005 · Pool Store'],
            ['code' => 'IT-DK-001', 'name' => 'Dell 27" Monitor U2722D',        'category' => 'IT Equipment', 'status' => 'active',     'user' => $staff,  'value' => 5800,  'notes' => 'DM27-2024-001 · Office 102'],
            ['code' => 'IT-DK-002', 'name' => 'HP LaserJet Pro MFP M428',       'category' => 'IT Equipment', 'status' => 'service_due','user' => null,    'value' => 9200,  'notes' => 'HPLJ428-2022-001 · Print Room'],
            ['code' => 'IT-SV-001', 'name' => 'Dell PowerEdge R750 Server',     'category' => 'IT Equipment', 'status' => 'active',     'user' => $admin,  'value' => 85000, 'notes' => 'DPER750-2023-001 · Server Room B3'],
            ['code' => 'IT-NW-001', 'name' => 'Cisco Catalyst 9300 Switch',     'category' => 'IT Equipment', 'status' => 'active',     'user' => $admin,  'value' => 28000, 'notes' => 'CC9300-2023-001 · Server Room B3'],
            // Vehicles
            ['code' => 'VH-LV-001', 'name' => 'Toyota Land Cruiser 200',        'category' => 'Fleet',        'status' => 'active',     'user' => null,    'value' => 450000,'notes' => 'NA-AB-2022 · Secretariat Parking'],
            ['code' => 'VH-LV-002', 'name' => 'Toyota Hilux 2.8 GD-6',         'category' => 'Fleet',        'status' => 'active',     'user' => null,    'value' => 320000,'notes' => 'NA-CD-2021 · Secretariat Parking'],
            ['code' => 'VH-LV-003', 'name' => 'Nissan NP300 Hardbody',          'category' => 'Fleet',        'status' => 'service_due','user' => null,    'value' => 180000,'notes' => 'NA-EF-2019 · Fleet Garage'],
            // Furniture
            ['code' => 'FN-CH-001', 'name' => 'Herman Miller Aeron Chairs (×20)','category' => 'Furniture',   'status' => 'active',     'user' => null,    'value' => 44000, 'notes' => 'HMA-2026-BRD · Boardroom'],
            ['code' => 'FN-TB-001', 'name' => 'Boardroom Table 10-Seater',      'category' => 'Furniture',    'status' => 'active',     'user' => null,    'value' => 37000, 'notes' => 'BT10-2026-001 · Main Boardroom'],
            ['code' => 'FN-RK-001', 'name' => 'Steel Storage Racking (×5 bays)','category' => 'Furniture',   'status' => 'active',     'user' => null,    'value' => 8500,  'notes' => 'RACK-2023-STR · Records Room B1'],
            // AV Equipment
            ['code' => 'AV-PJ-001', 'name' => 'Epson EB-PU1007 Projector',     'category' => 'Equipment',    'status' => 'active',     'user' => null,    'value' => 32000, 'notes' => 'EPPU1007-2024-001 · Conference Room A'],
            ['code' => 'AV-SC-001', 'name' => 'Samsung 75" Interactive Display','category' => 'Equipment',    'status' => 'active',     'user' => null,    'value' => 48000, 'notes' => 'SAMS75-2024-001 · Boardroom'],
            ['code' => 'AV-CM-001', 'name' => 'Logitech Rally Conference Camera','category' => 'Equipment',   'status' => 'active',     'user' => null,    'value' => 12000, 'notes' => 'LGRC-2025-001 · Main Boardroom'],
        ];

        $count = 0;
        foreach ($assets as $def) {
            if (Asset::where('asset_code', $def['code'])->exists()) continue;

            Asset::create(array_filter([
                'tenant_id'      => $tenant->id,
                'asset_code'     => $def['code'],
                'name'           => $def['name'],
                'category'       => $def['category'],
                'status'         => $def['status'],
                'assigned_to'    => $def['user']?->id,
                'issued_at'      => $def['user'] ? $today->copy()->subMonths(rand(1, 12)) : null,
                'purchase_date'  => $today->copy()->subMonths(rand(6, 36)),
                'purchase_value' => $def['value'],
                'value'          => $def['value'],
                'notes'          => $def['notes'],
            ], fn($v) => $v !== null));
            $count++;
        }

        $this->command->info("Assets: seeded {$count} new assets.");
    }
}
