<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

/**
 * Full app seeding for dev/demo. Run with: php artisan migrate:fresh --seed
 *
 * Order:
 *  1. Tenant
 *  2. Roles & Permissions (creates all roles including HR Administrator)
 *  3. Departments, Portfolio, Lookups, Asset categories
 *  4. Users (depends on roles + departments)
 *  5. Workflows (depends on roles + tenant)
 *  6. Workplan event types
 *  7. Demo module data (travel, leave, imprest, procurement, payslips, budgets, etc.)
 *  8. HR modules (personal files, appraisals, conduct, performance)
 *  9. HR settings (pay grades, leave profiles, contract types, etc.)
 * 10. Positions
 * 11. Assignments (work assignments)
 * 12. Programmes + attachments
 * 13. Workplan events + calendar
 * 14. Correspondence + contacts
 * 15. SAAM (delegated authorities)
 * 16. SRHR (parliaments, researcher deployments, sample reports)
 * 17. Missing modules (meeting types, vendors, quotes, meeting minutes, timesheets)
 */
class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            // ── Foundation ─────────────────────────────────
            TenantSeeder::class,
            RolesAndPermissionsSeeder::class,
            DepartmentsSeeder::class,
            PortfolioSeeder::class,
            LookupsSeeder::class,
            AssetCategorySeeder::class,

            // ── Users & Auth ───────────────────────────────
            UsersSeeder::class,

            // ── Configuration ──────────────────────────────
            WorkflowSeeder::class,
            WorkplanEventTypeSeeder::class,
            HrSettingsSeeder::class,
            PositionsSeeder::class,

            // ── Core Module Demo Data ──────────────────────
            DemoDataSeeder::class,
            HrModulesSeeder::class,
            AssignmentsSeeder::class,

            // ── Programmes ─────────────────────────────────
            ProgrammeSeeder::class,
            ProgrammeAttachmentSeeder::class,

            // ── Workplan & Calendar ────────────────────────
            WorkplanSeeder::class,
            CalendarSeeder::class,

            // ── Correspondence ─────────────────────────────
            CorrespondenceSeeder::class,

            // ── SAAM ───────────────────────────────────────
            SaamSeeder::class,

            // ── SRHR — Field Researcher Module ─────────────
            SrhrSeeder::class,

            // ── Governance Config ──────────────────────────
            GovernanceConfigSeeder::class,

            // ── Supplementary Data ─────────────────────────
            MissingModulesSeeder::class,

            // ── Risk Register — import from Excel source files ──────────────
            RiskRegisterSeeder::class,
        ]);
    }
}
