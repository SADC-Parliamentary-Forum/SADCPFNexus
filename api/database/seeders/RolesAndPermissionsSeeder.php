<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class RolesAndPermissionsSeeder extends Seeder
{
    public function run(): void
    {
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // --- Permissions (aligned with web Admin Roles UI) ---
        $permissions = [
            'users.view', 'users.create', 'users.edit', 'users.deactivate', 'users.delete',
            'roles.view', 'roles.manage',
            'travel.view', 'travel.create', 'travel.approve', 'travel.admin',
            'travel.prepare-for-others', 'travel.recommend', 'travel.admin-review',
            'travel.finance-review', 'travel.director-finance-confirm', 'travel.final-approve',
            'travel.review-retirement', 'travel.review-toil', 'travel.export', 'travel.emergency-commit',
            'travel.health-view',
            'leave.view', 'leave.create', 'leave.approve', 'leave.admin',
            'imprest.view', 'imprest.create', 'imprest.approve', 'imprest.liquidate',
            'finance.view', 'finance.create', 'finance.approve', 'finance.export', 'finance.admin',
            // Salary Advance (dedicated module permissions â€” Phase 1)
            'salary_advance.view', 'salary_advance.create', 'salary_advance.certify',
            'salary_advance.approve', 'salary_advance.pay', 'salary_advance.recover',
            'salary_advance.export', 'salary_advance.admin',
            'procurement.view', 'procurement.create', 'procurement.approve', 'procurement.admin',
            'procurement.award', 'procurement.manage_vendors', 'procurement.manage_po',
            'procurement.receive_goods', 'procurement.approve_invoice',
            'procurement.hod_approve', 'procurement.manage_budget',
            'supplier.portal',
            'assets.view', 'assets.create', 'assets.edit', 'assets.dispose', 'assets.admin', 'assets.manage',
            // Consumables / Stock Register (separate from Fixed Assets)
            'stock.view', 'stock.create', 'stock.edit', 'stock.issue', 'stock.manage', 'stock.admin',
            'stock.approve', 'stock.transfer',
            'governance.view', 'governance.create', 'governance.approve', 'governance.admin',
            'hr.view', 'hr.create', 'hr.edit', 'hr.approve', 'hr.admin', 'hr.supervisor',
            // HR Settings (master data governance â€” restricted to HR Manager & Finance Director)
            'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
            // Programmes / PIF
            'pif.view', 'pif.create', 'pif.approve', 'pif.admin',
            'programme.finance-review',
            // Workplan (workplan.external = machine/integration feed only)
            'workplan.view', 'workplan.create', 'workplan.approve', 'workplan.admin', 'workplan.external',
            // Assignments (Oversight & Accountability)
            'assignments.view', 'assignments.create', 'assignments.issue', 'assignments.admin',
            'assignments.team', 'assignments.review', 'assignments.reports', 'assignments.confidential.view',
            // Timesheets
            'timesheets.view', 'timesheets.create', 'timesheets.approve',
            'timesheets.view-own', 'timesheets.create-own', 'timesheets.edit-own-draft', 'timesheets.submit',
            'timesheets.view-team', 'timesheets.review-team', 'timesheets.return',
            'timesheets.manage-schedules', 'timesheets.manage-periods',
            'timesheets.view-attendance', 'timesheets.manage-attendance-exceptions',
            'overtime.request', 'overtime.recommend', 'overtime.approve',
            'overtime.verify-actual', 'overtime.hr-validate', 'overtime.send-payroll', 'overtime.send-toil',
            'timesheets.export', 'timesheets.audit', 'timesheets.admin',
            // Performance Appraisals
            'appraisals.view', 'appraisals.create', 'appraisals.review', 'appraisals.admin',
            // Conduct, Discipline & Recognition
            'conduct.view', 'conduct.create', 'conduct.admin',
            // Calendar
            'calendar.view', 'calendar.create', 'calendar.admin',
            // Support Tickets
            'support.view', 'support.create', 'support.admin',
            'saam.view', 'saam.delegate',
            'correspondence.view', 'correspondence.create', 'correspondence.review',
            'correspondence.approve', 'correspondence.send', 'correspondence.admin',
            'correspondence.registry', 'correspondence.route', 'correspondence.dispatch',
            'correspondence.confidential.view', 'correspondence.manage-retention',
            'srhr.view', 'srhr.create', 'srhr.manage', 'srhr.admin',
            'parliaments.view', 'parliaments.manage',
            'researcher_reports.view', 'researcher_reports.submit', 'researcher_reports.acknowledge', 'researcher_reports.admin',
            'reports.view', 'reports.export', 'reports.audit',
            'audit.view', 'audit.export',
            // Audit Management Module (Phase 1) — distinct from platform audit.view/export
            'audit.universe.manage', 'audit.plan.manage', 'audit.plan.approve',
            'audit.engagement.manage', 'audit.engagement.fieldwork',
            'audit.findings.issue', 'audit.findings.view',
            'audit.response.manage', 'audit.corrective.manage', 'audit.corrective.verify',
            'audit.workpapers.manage', 'audit.workpapers.review',
            'audit.report.draft', 'audit.report.issue',
            'audit.external.coordinate',
            'audit.dashboard.auditor', 'audit.dashboard.management', 'audit.dashboard.sg',
            'audit.settings.view', 'audit.events.view', 'audit.confidential.view', 'audit.admin',
            'system.admin',
            // Risk Register
            'risk.view', 'risk.create', 'risk.submit', 'risk.review', 'risk.approve', 'risk.manage', 'risk.admin', 'risk.accept', 'risk.confidential',
            // Meeting Resolutions / Decision Register
            'decisions.view', 'decisions.create', 'decisions.adopt', 'decisions.manage', 'decisions.admin', 'decisions.confidential',
            // M&E / Results Monitoring (PRD Â§10)
            'mande.view', 'mande.create', 'mande.review', 'mande.admin',
            // Weekly Summary Reports (operational â€” distinct from email digest)
            'weekly-reports.view-own', 'weekly-reports.create-own', 'weekly-reports.edit-own-draft',
            'weekly-reports.submit', 'weekly-reports.view-team', 'weekly-reports.review-team',
            'weekly-reports.return', 'weekly-reports.accept', 'weekly-reports.consolidate-department',
            'weekly-reports.view-department', 'weekly-reports.view-management',
            'weekly-reports.publish-department', 'weekly-reports.publish-institutional',
            'weekly-reports.record-decision', 'weekly-reports.create-assignment', 'weekly-reports.create-risk',
            'weekly-reports.manage-periods', 'weekly-reports.manage-templates', 'weekly-reports.manage-exemptions',
            'weekly-reports.reopen', 'weekly-reports.export', 'weekly-reports.audit', 'weekly-reports.admin',
            // People & Authority (PRD §109)
            'people.view-directory', 'people.view-profile', 'people.view-confidential', 'people.manage',
            'organisation.view', 'organisation.manage', 'positions.manage', 'reporting-lines.manage',
            'roles.view', 'roles.assign', 'roles.approve', 'roles.revoke',
            'authorities.manage',
            'acting-appointments.create', 'acting-appointments.approve',
            'delegations.create', 'delegations.approve', 'delegations.revoke',
            'signatures.enrol', 'signatures.verify', 'signatures.administer', 'documents.sign',
            'access-reviews.manage', 'onboarding.manage', 'offboarding.manage',
            'people.export', 'identity.audit',
            // People & Authority Phase 2 / 3
            'people.certificate.enrol', 'people.esign.manage', 'people.m365.sync',
            'people.recertification.manage', 'people.sod.analyse', 'people.org-scenarios.manage',
            'people.payroll-link.manage', 'people.signatures.publish-verify',
            'people.succession.manage', 'people.skills.manage', 'people.analytics.view',
            'people.ai.suggest', 'people.ai.apply', 'people.privilege-alerts.manage',
            // Workflow Engine Phase 1 (PRD §104)
            'workflows.view-own', 'workflows.view-department', 'workflows.view-all',
            'workflows.submit', 'workflows.act', 'workflows.recommend', 'workflows.certify',
            'workflows.authorise', 'workflows.approve', 'workflows.sign', 'workflows.release',
            'workflows.withdraw', 'workflows.cancel', 'workflows.reassign',
            'workflows.resolve-exception', 'workflows.manage-definitions',
            'workflows.approve-definitions', 'workflows.publish-definitions',
            'workflows.view-audit', 'workflows.export', 'workflows.admin',
            // Notifications Phase 1 (PRD §104)
            'notifications.view-own', 'notifications.manage-own-preferences', 'notifications.acknowledge',
            'notifications.view-delivery-status', 'notifications.manage-templates', 'notifications.approve-templates',
            'notifications.manage-policies', 'notifications.send-broadcast', 'notifications.approve-broadcast',
            'notifications.retry', 'notifications.suppress', 'notifications.manage-providers',
            'notifications.view-failures', 'notifications.view-audit', 'notifications.export', 'notifications.admin',
        ];

        foreach ($permissions as $perm) {
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'sanctum']);
            Permission::firstOrCreate(['name' => $perm, 'guard_name' => 'web']);
        }

        $guards = ['sanctum', 'web'];

        foreach ($guards as $guard) {
            // --- Roles (same names for both guards so syncRoles() finds them; default guard is web) ---
            $systemAdmin = Role::firstOrCreate(['name' => 'System Admin', 'guard_name' => $guard]);
            $systemAdmin->syncPermissions(Permission::where('guard_name', $guard)->get());

            $superAdmin = Role::firstOrCreate(['name' => 'super-admin', 'guard_name' => $guard]);
            $superAdmin->syncPermissions(Permission::where('guard_name', $guard)->get());

            $hrManager = Role::firstOrCreate(['name' => 'HR Manager', 'guard_name' => $guard]);
            $hrManager->syncPermissions(
                Permission::whereIn('name', [
                    'users.view', 'hr.view', 'hr.create', 'hr.edit', 'hr.approve',
                    'travel.view', 'travel.review-toil', 'travel.prepare-for-others', 'travel.health-view',
                    'leave.view', 'leave.approve', 'imprest.view', 'imprest.approve',
                    'governance.view',
                    'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
                    // People & Authority
                    'people.view-directory', 'people.view-profile', 'people.view-confidential', 'people.manage',
                    'organisation.view', 'organisation.manage', 'positions.manage', 'reporting-lines.manage',
                    'roles.view', 'roles.assign',
                    'authorities.manage',
                    'acting-appointments.create', 'acting-appointments.approve',
                    'delegations.create', 'delegations.approve', 'delegations.revoke',
                    'signatures.enrol', 'signatures.verify', 'signatures.administer', 'documents.sign',
                    'access-reviews.manage', 'onboarding.manage', 'offboarding.manage',
                    'people.export', 'identity.audit',
                    'people.certificate.enrol', 'people.esign.manage', 'people.m365.sync',
                    'people.recertification.manage', 'people.sod.analyse', 'people.org-scenarios.manage',
                    'people.payroll-link.manage', 'people.signatures.publish-verify',
                    'people.succession.manage', 'people.skills.manage', 'people.analytics.view',
                    'people.ai.suggest', 'people.ai.apply', 'people.privilege-alerts.manage',
                ])->where('guard_name', $guard)->get()
            );

            $financeController = Role::firstOrCreate(['name' => 'Finance Controller', 'guard_name' => $guard]);
            $financeController->syncPermissions(
                Permission::whereIn('name', [
                    'finance.view', 'finance.create', 'finance.approve', 'finance.export',
                    'salary_advance.view', 'salary_advance.certify', 'salary_advance.pay',
                    'salary_advance.recover', 'salary_advance.export', 'salary_advance.admin',
                    'travel.view', 'travel.finance-review', 'travel.export', 'travel.health-view',
                    'procurement.view', 'procurement.manage_po', 'procurement.approve_invoice',
                    'procurement.manage_budget',
                    'governance.view', 'audit.view',
                    'reports.view', 'reports.export',
                    'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
                    'overtime.send-payroll', 'timesheets.export', 'timesheets.view',
                ])->where('guard_name', $guard)->get()
            );

            $procurementOfficer = Role::firstOrCreate(['name' => 'Procurement Officer', 'guard_name' => $guard]);
            $procurementOfficer->syncPermissions(
                Permission::whereIn('name', [
                    'procurement.view', 'procurement.create', 'procurement.approve', 'procurement.admin',
                    'procurement.award', 'procurement.manage_vendors', 'procurement.manage_po',
                    'procurement.receive_goods',
                    'assets.view', 'assets.create', 'finance.view', 'governance.view',
                    // Procurement officers manage the consumables/stock register
                    'stock.view', 'stock.create', 'stock.edit', 'stock.issue', 'stock.manage',
                    'stock.approve', 'stock.transfer',
                ])->where('guard_name', $guard)->get()
            );

            $governanceOfficer = Role::firstOrCreate(['name' => 'Governance Officer', 'guard_name' => $guard]);
            $governanceOfficer->syncPermissions(
                Permission::whereIn('name', [
                    'governance.view', 'governance.create', 'governance.approve', 'governance.admin',
                    'decisions.view', 'decisions.create', 'decisions.adopt', 'decisions.manage', 'decisions.admin', 'decisions.confidential',
                    'reports.view', 'reports.export',
                    'audit.view', 'audit.plan.approve', 'audit.findings.view',
                    'audit.dashboard.management', 'audit.settings.view',
                ])->where('guard_name', $guard)->get()
            );

            $externalAuditor = Role::firstOrCreate(['name' => 'External Auditor', 'guard_name' => $guard]);
            $externalAuditor->syncPermissions(
                Permission::whereIn('name', [
                    'finance.view', 'salary_advance.view', 'governance.view', 'audit.view', 'audit.export',
                    'travel.view', 'assets.view', 'hr.view',
                ])->where('guard_name', $guard)->get()
            );

            $staff = Role::firstOrCreate(['name' => 'staff', 'guard_name' => $guard]);
            $staff->syncPermissions(
                Permission::whereIn('name', [
                    'travel.view', 'travel.create',
                    'leave.view', 'leave.create',
                    'imprest.view', 'imprest.create',
                    'finance.view', 'finance.create',
                    'salary_advance.view', 'salary_advance.create',
                    'procurement.view', 'procurement.create',
                    'hr.view', 'hr.create',
                    'governance.view', 'reports.view', 'assets.view',
                    'decisions.view', 'decisions.create',
                    'stock.view',
                    'saam.view', 'saam.delegate',
                    'correspondence.view', 'correspondence.create',
                    'correspondence.registry', 'correspondence.dispatch',
                    'correspondence.review', 'correspondence.send',
                    'parliaments.view',
                    'parliaments.view',
                    'assignments.view', 'assignments.create',
                    'timesheets.view', 'timesheets.create', 'timesheets.view-own',
                    'timesheets.create-own', 'timesheets.edit-own-draft', 'timesheets.submit',
                    'overtime.request',
                    'weekly-reports.view-own', 'weekly-reports.create-own', 'weekly-reports.edit-own-draft',
                    'weekly-reports.submit', 'weekly-reports.export',
                    'audit.view', 'audit.findings.view',
                    'audit.response.manage', 'audit.corrective.manage',
                    'audit.dashboard.management',
                    'people.view-directory', 'people.view-profile',
                    'organisation.view',
                    'delegations.create', 'delegations.revoke',
                    'signatures.enrol', 'documents.sign',
                    'roles.view',
                    'workflows.view-own', 'workflows.submit', 'workflows.act', 'workflows.withdraw',
                    'notifications.view-own', 'notifications.manage-own-preferences', 'notifications.acknowledge',
                ])->where('guard_name', $guard)->get()
            );

            // HOD: Head of Department â€” reviews procurement requests before Procurement Officer approval
            $hod = Role::firstOrCreate(['name' => 'HOD', 'guard_name' => $guard]);
            $hod->syncPermissions(
                Permission::whereIn('name', [
                    'procurement.view', 'procurement.hod_approve',
                    'hr.view', 'travel.view', 'leave.view', 'finance.view',
                    'reports.view',
                    'reports.view',
                    'timesheets.view', 'timesheets.view-team', 'timesheets.review-team',
                    'timesheets.return', 'timesheets.approve',
                    'overtime.recommend', 'overtime.approve', 'overtime.verify-actual',
                    'weekly-reports.view-own', 'weekly-reports.create-own', 'weekly-reports.edit-own-draft',
                    'weekly-reports.submit', 'weekly-reports.view-team', 'weekly-reports.review-team',
                    'weekly-reports.return', 'weekly-reports.accept',
                    'weekly-reports.consolidate-department', 'weekly-reports.view-department',
                    'weekly-reports.publish-department', 'weekly-reports.record-decision',
                    'weekly-reports.create-assignment', 'weekly-reports.create-risk',
                    'weekly-reports.export',
                    'audit.view', 'audit.findings.view',
                    'audit.response.manage', 'audit.corrective.manage',
                    'audit.dashboard.management',
                ])->where('guard_name', $guard)->get()
            );

            $fieldResearcher = Role::firstOrCreate(['name' => 'Field Researcher', 'guard_name' => $guard]);
            $fieldResearcher->syncPermissions(
                Permission::whereIn('name', [
                    'researcher_reports.view', 'researcher_reports.submit',
                    'parliaments.view', 'srhr.view',
                ])->where('guard_name', $guard)->get()
            );

            // HR Administrator: manages departments, positions, HR settings, appraisals, conduct, timesheets.
            $hrAdmin = Role::firstOrCreate(['name' => 'HR Administrator', 'guard_name' => $guard]);
            $hrAdmin->syncPermissions(
                Permission::whereIn('name', [
                    'hr.view', 'hr.create', 'hr.edit', 'hr.approve', 'hr.admin',
                    'hr_settings.view', 'hr_settings.edit', 'hr_settings.approve', 'hr_settings.publish',
                    'users.view',
                    'leave.view', 'leave.approve',
                    'travel.view', 'travel.review-toil', 'travel.review-retirement', 'travel.health-view',
                    'timesheets.view', 'timesheets.create', 'timesheets.approve',
                    'timesheets.view-team', 'timesheets.review-team', 'timesheets.return',
                    'timesheets.manage-schedules', 'timesheets.manage-periods',
                    'timesheets.export', 'timesheets.audit', 'timesheets.admin',
                    'overtime.request', 'overtime.recommend', 'overtime.approve',
                    'overtime.verify-actual', 'overtime.hr-validate', 'overtime.send-toil',
                    'appraisals.view', 'appraisals.create', 'appraisals.review', 'appraisals.admin',
                    'conduct.view', 'conduct.create', 'conduct.admin',
                    'governance.view',
                    'reports.view',
                    'people.view-directory', 'people.view-profile', 'people.view-confidential', 'people.manage',
                    'organisation.view', 'organisation.manage', 'positions.manage', 'reporting-lines.manage',
                    'roles.view', 'roles.assign',
                    'acting-appointments.create',
                    'delegations.create', 'delegations.approve',
                    'signatures.enrol', 'signatures.administer', 'documents.sign',
                    'onboarding.manage', 'offboarding.manage', 'identity.audit',
                ])->where('guard_name', $guard)->get()
            );

            // Secretary General: final approver; can approve after workflow steps (including own request at final step).
            $secretaryGeneral = Role::firstOrCreate(['name' => 'Secretary General', 'guard_name' => $guard]);
            $secretaryGeneral->syncPermissions(
                Permission::whereIn('name', [
                    'travel.view', 'travel.approve', 'travel.final-approve', 'travel.emergency-commit',
                    'leave.view', 'leave.approve',
                    'imprest.view', 'imprest.approve',
                    'procurement.view', 'procurement.approve', 'procurement.award', 'procurement.manage_vendors',
                    'finance.view', 'finance.approve',
                    'salary_advance.view', 'salary_advance.approve',
                    'governance.view', 'governance.approve',
                    'decisions.view', 'decisions.create', 'decisions.adopt', 'decisions.manage', 'decisions.admin', 'decisions.confidential',
                    'hr.view', 'hr.approve',
                    'reports.view', 'reports.export',
                    'audit.view',
                    'audit.plan.approve', 'audit.findings.view',
                    'audit.dashboard.sg', 'audit.dashboard.management',
                    'audit.settings.view', 'audit.events.view',
                    'risk.view', 'risk.review', 'risk.approve',
                    'correspondence.view', 'correspondence.create', 'correspondence.review',
                    'correspondence.approve', 'correspondence.send', 'correspondence.route',
                    'correspondence.registry', 'correspondence.dispatch', 'correspondence.confidential.view',
                    'people.view-directory', 'people.view-profile', 'people.view-confidential',
                    'organisation.view', 'roles.view', 'roles.approve', 'roles.revoke',
                    'authorities.manage', 'acting-appointments.approve',
                    'delegations.approve', 'signatures.verify', 'documents.sign',
                    'access-reviews.manage', 'identity.audit',
                    'people.sod.analyse', 'people.org-scenarios.manage',
                    'people.succession.manage', 'people.analytics.view',
                    'people.privilege-alerts.manage', 'people.ai.suggest',
                    'workflows.view-all', 'workflows.act', 'workflows.approve', 'workflows.authorise',
                    'workflows.sign', 'workflows.recommend', 'workflows.certify',
                    'workflows.manage-definitions', 'workflows.approve-definitions',
                    'workflows.publish-definitions', 'workflows.admin', 'workflows.view-audit',
                ])->where('guard_name', $guard)->get()
            );

            // â”€â”€ Risk Register: update existing roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

            // Staff: risk view, create, submit
            $staff->givePermissionTo(
                Permission::whereIn('name', ['risk.view', 'risk.create', 'risk.submit'])
                    ->where('guard_name', $guard)->get()
            );

            // HOD: + risk.review
            $hod->givePermissionTo(
                Permission::whereIn('name', ['risk.view', 'risk.create', 'risk.submit', 'risk.review'])
                    ->where('guard_name', $guard)->get()
            );

            // Governance Officer: + risk.review, risk.manage
            $governanceOfficer->givePermissionTo(
                Permission::whereIn('name', ['risk.view', 'risk.create', 'risk.submit', 'risk.review', 'risk.manage', 'risk.accept', 'risk.confidential'])
                    ->where('guard_name', $guard)->get()
            );

            // External Auditor: + risk.view
            $externalAuditor->givePermissionTo(
                Permission::where('name', 'risk.view')->where('guard_name', $guard)->get()
            );

            // Finance Controller: + risk.view
            $financeController->givePermissionTo(
                Permission::where('name', 'risk.view')->where('guard_name', $guard)->get()
            );

            // Procurement Officer: + risk.view
            $procurementOfficer->givePermissionTo(
                Permission::where('name', 'risk.view')->where('guard_name', $guard)->get()
            );

            // â”€â”€ M&E / Results Monitoring: extend existing roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

            // Staff create activity reports against their approved PIFs.
            $staff->givePermissionTo(
                Permission::whereIn('name', ['mande.view', 'mande.create'])
                    ->where('guard_name', $guard)->get()
            );

            // Governance Officer owns the M&E function (config + review).
            $governanceOfficer->givePermissionTo(
                Permission::whereIn('name', ['mande.view', 'mande.create', 'mande.review', 'mande.admin'])
                    ->where('guard_name', $guard)->get()
            );

            // Finance Controller: read-only oversight.
            $financeController->givePermissionTo(
                Permission::where('name', 'mande.view')->where('guard_name', $guard)->get()
            );

            // Finance Controller reviews PIF budget-availability and finance comments.
            $financeController->givePermissionTo(
                Permission::where('name', 'programme.finance-review')->where('guard_name', $guard)->get()
            );

            // HR Administrator / Procurement Officer: read-only visibility.
            $hrAdmin->givePermissionTo(
                Permission::where('name', 'mande.view')->where('guard_name', $guard)->get()
            );

            // Secretary General: oversight + reviewer.
            $secretaryGeneral->givePermissionTo(
                Permission::whereIn('name', ['mande.view', 'mande.review'])
                    ->where('guard_name', $guard)->get()
            );

            // â”€â”€ New roles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

            $director = Role::firstOrCreate(['name' => 'Director', 'guard_name' => $guard]);
            $director->syncPermissions(
                Permission::whereIn('name', [
                    'risk.view', 'risk.create', 'risk.submit', 'risk.review', 'risk.approve',
                    'travel.view', 'travel.director-finance-confirm', 'travel.recommend',
                    'leave.view', 'imprest.view', 'finance.view',
                    'salary_advance.view', 'salary_advance.approve',
                    'procurement.view', 'hr.view', 'governance.view', 'reports.view',
                    'decisions.view', 'decisions.create', 'decisions.adopt', 'decisions.manage',
                    'workplan.view', 'assignments.view',
                    'mande.view', 'mande.create', 'mande.review',
                    'weekly-reports.view-own', 'weekly-reports.create-own', 'weekly-reports.submit',
                    'weekly-reports.view-team', 'weekly-reports.review-team', 'weekly-reports.return',
                    'weekly-reports.accept', 'weekly-reports.view-department', 'weekly-reports.view-management',
                    'weekly-reports.publish-institutional', 'weekly-reports.record-decision',
                    'weekly-reports.create-assignment', 'weekly-reports.create-risk', 'weekly-reports.export',
                    'audit.view', 'audit.findings.view',
                    'audit.response.manage', 'audit.corrective.manage',
                    'audit.dashboard.management',
                ])->where('guard_name', $guard)->get()
            );

            $adminOfficer = Role::firstOrCreate(['name' => 'Administration Officer', 'guard_name' => $guard]);
            $adminOfficer->syncPermissions(
                Permission::whereIn('name', [
                    'travel.view', 'travel.admin-review', 'travel.admin', 'travel.health-view',
                    'leave.view', 'imprest.view', 'hr.view', 'reports.view',
                ])->where('guard_name', $guard)->get()
            );

            $internalAuditor = Role::firstOrCreate(['name' => 'Internal Auditor', 'guard_name' => $guard]);
            $internalAuditor->syncPermissions(
                Permission::whereIn('name', [
                    'risk.view', 'risk.review',
                    'travel.view', 'leave.view', 'imprest.view', 'finance.view',
                    'procurement.view', 'hr.view', 'governance.view', 'reports.view',
                    'mande.view', 'mande.review',
                    'audit.view', 'audit.export',
                    'audit.universe.manage', 'audit.plan.manage',
                    'audit.engagement.manage', 'audit.engagement.fieldwork',
                    'audit.findings.issue', 'audit.findings.view',
                    'audit.workpapers.manage', 'audit.workpapers.review',
                    'audit.report.draft', 'audit.report.issue',
                    'audit.corrective.verify',
                    'audit.external.coordinate',
                    'audit.dashboard.auditor',
                    'audit.settings.view', 'audit.events.view',
                    'audit.confidential.view',
                ])->where('guard_name', $guard)->get()
            );

            $committeeMember = Role::firstOrCreate(['name' => 'Committee Member', 'guard_name' => $guard]);
            $committeeMember->syncPermissions(
                Permission::whereIn('name', [
                    'risk.view',
                    'governance.view', 'finance.view', 'reports.view',
                ])->where('guard_name', $guard)->get()
            );

            $supplier = Role::firstOrCreate(['name' => 'Supplier', 'guard_name' => $guard]);
            $supplier->syncPermissions(
                Permission::whereIn('name', ['supplier.portal'])->where('guard_name', $guard)->get()
            );

            $supplierFinance = Role::firstOrCreate(['name' => 'Supplier Finance User', 'guard_name' => $guard]);
            $supplierFinance->syncPermissions(
                Permission::whereIn('name', ['supplier.portal'])->where('guard_name', $guard)->get()
            );
        }
    }
}


