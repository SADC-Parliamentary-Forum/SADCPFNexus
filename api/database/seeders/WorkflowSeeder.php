<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\WorkflowEngine\Services\DefinitionVersionService;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

/**
 * Seeds approval workflows for all system modules with Phase 1 stage semantics.
 *
 * Stage types preserve distinct meanings (PRD §8):
 * review ≠ recommend ≠ certify ≠ authorise ≠ approve ≠ sign
 */
class WorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (! $tenant) {
            return;
        }

        $sgRole      = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();
        $hrRole      = Role::where('name', 'HR Manager')->where('guard_name', 'sanctum')->first();
        $hrAdminRole = Role::where('name', 'HR Administrator')->where('guard_name', 'sanctum')->first();
        $finRole     = Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $govRole     = Role::where('name', 'Governance Officer')->where('guard_name', 'sanctum')->first();
        $adminOfficerRole = Role::where('name', 'Administration Officer')->where('guard_name', 'sanctum')->first()
            ?? Role::where('name', 'HR Administrator')->where('guard_name', 'sanctum')->first();
        $directorRole = Role::where('name', 'Director')->where('guard_name', 'sanctum')->first();
        $procurementOfficer = Role::where('name', 'Procurement Officer')->where('guard_name', 'sanctum')->first();

        $this->makeWorkflow($tenant, 'Standard Leave Approval', 'leave', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend', 'step_name' => 'HOD Recommendation', 'authority_action' => 'leave.recommend', 'allow_return' => true, 'sla_hours' => 48],
            ['approver_type' => 'up_the_chain', 'actor_selector' => 'hod', 'stage_type' => 'review', 'step_name' => 'Department Review', 'allow_return' => true, 'sla_hours' => 48],
            ...($hrRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $hrRole->id, 'stage_type' => 'certify', 'step_name' => 'Administration Certification', 'authority_action' => 'leave.certify', 'sla_hours' => 72]] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'authorise', 'step_name' => 'Head of Institution Authorisation', 'authority_action' => 'sg.approve', 'sla_hours' => 72]] : []),
        ], ApprovalWorkflow::SELF_APPROVAL_ALLOW_WITH_CONTROLS);

        $this->makeWorkflow($tenant, 'Standard Travel & Mission Approval', 'travel', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend', 'step_name' => 'Supervisor Recommendation', 'allow_return' => true, 'sla_hours' => 48],
            ...($adminOfficerRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $adminOfficerRole->id, 'stage_type' => 'prepare', 'step_name' => 'Administration Itinerary', 'sla_hours' => 72]] : []),
            ...($finRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'step_name' => 'Finance Calculation', 'authority_action' => 'finance.certify', 'sla_hours' => 72]] : []),
            ...($directorRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'director_finance', 'role_id' => $directorRole->id, 'stage_type' => 'authorise', 'step_name' => 'Director Finance Confirmation', 'authority_action' => 'finance.authorise', 'sla_hours' => 72, 'condition_expression' => ['field' => 'amount', 'op' => 'gte', 'value' => 0], 'skip_if_condition_false' => false]] : []),
            ...($sgRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'Secretary General Approval', 'authority_action' => 'sg.approve', 'sla_hours' => 72]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Imprest Advance Approval', 'imprest', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend', 'step_name' => 'Supervisor Recommendation', 'allow_return' => true],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'step_name' => 'Finance Certification', 'authority_action' => 'finance.certify']] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'SG Approval']] : []),
        ]);

        // Correspondence Approval (PRD §19): two stages to match the two client-facing
        // actions (CorrespondenceController::review()/approve()) — HOD/Director review,
        // then SG final approval and registry dispatch authorisation.
        $this->makeWorkflow($tenant, 'Correspondence Approval', 'correspondence', [
            ['approver_type' => 'up_the_chain', 'actor_selector' => 'hod', 'stage_type' => 'review', 'step_name' => 'HOD/Director Review', 'allow_return' => true, 'sla_hours' => 48],
            ...($sgRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'Secretary General Approval', 'authority_action' => 'sg.approve', 'sla_hours' => 48]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Procurement Approval', 'procurement', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend', 'step_name' => 'Supervisor Recommendation', 'allow_return' => true],
            ['approver_type' => 'up_the_chain', 'actor_selector' => 'hod', 'stage_type' => 'authorise', 'step_name' => 'HOD Authorisation'],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'step_name' => 'Finance Certification', 'authority_action' => 'finance.certify', 'condition_expression' => ['field' => 'amount', 'op' => 'gte', 'value' => 5000], 'skip_if_condition_false' => true]] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'SG Approval']] : []),
        ]);

        $this->makeWorkflow($tenant, 'Finance & Payment Approval', 'finance', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend'],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'authority_action' => 'finance.certify']] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve']] : []),
        ]);

        $this->makeWorkflow($tenant, 'Salary Advance Approval', 'salary_advance', [
            ...($directorRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'director_finance', 'role_id' => $directorRole->id, 'stage_type' => 'review', 'step_name' => 'Principal/Director Review', 'allow_return' => true]] : []),
            ...($sgRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'SG Final Approval', 'authority_action' => 'sg.approve']] : []),
        ]);

        $this->makeWorkflow($tenant, 'HR Request Approval', 'hr', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend'],
            ...($hrAdminRole ?? $hrRole ? [['approver_type' => 'specific_role', 'role_id' => ($hrAdminRole ?? $hrRole)->id, 'stage_type' => 'certify']] : []),
            ...($sgRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve']] : []),
        ]);

        $this->makeWorkflow($tenant, 'Governance Approval', 'governance', [
            ['approver_type' => 'up_the_chain', 'actor_selector' => 'hod', 'stage_type' => 'recommend'],
            ...($sgRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve']] : []),
        ]);

        // Timesheets — Supervisor accepts; donor/project-funded work additionally
        // requires Finance/Project validation of the coding (PRD §20). Gated by
        // is_donor_funded in the condition context TimesheetService::submit()
        // passes to initiate() (true when any entry is logged against a project).
        $this->makeWorkflow($tenant, 'Timesheet Approval', 'timesheet', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'accept', 'step_name' => 'Supervisor Acceptance', 'allow_return' => true, 'sla_hours' => 48],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'step_name' => 'Finance/Project Validation', 'authority_action' => 'finance.certify', 'sla_hours' => 48, 'condition_expression' => ['field' => 'is_donor_funded', 'op' => 'eq', 'value' => true], 'skip_if_condition_false' => true]] : []),
        ]);

        // M&E Activity Reports (PRD §24) — two stages matching the two
        // client-facing actions (MeReviewController::review()/accept()):
        // M&E Officer review, then Programme Manager acceptance. This is a
        // deliberately separate workflow instance from PIF/Programme approval
        // even when a report pre-populates from a PIF — per spec, M&E review
        // does NOT inherit the programme's own approval chain.
        $this->makeWorkflow($tenant, 'M&E Activity Report Review', 'mande', [
            ...($govRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $govRole->id, 'stage_type' => 'review', 'step_name' => 'M&E Review', 'allow_return' => true, 'sla_hours' => 72]] : []),
            ...($directorRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $directorRole->id, 'stage_type' => 'accept', 'step_name' => 'Programme Manager Acceptance', 'allow_return' => true, 'sla_hours' => 72]] : []),
        ]);

        // Weekly Reports (PRD §21) — single supervisor accept/return stage,
        // matching the existing WeeklyReportController accept()/returnReport()
        // actions (WeeklyReportService::assertCanReview() already allows
        // supervisor_id, department HOD, or a review-team permission holder;
        // the engine step targets the direct supervisor as the primary path).
        $this->makeWorkflow($tenant, 'Weekly Report Acceptance', 'weekly_report', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'accept', 'step_name' => 'Supervisor Acceptance', 'allow_return' => true, 'sla_hours' => 72],
        ]);

        // Risk register (PRD §23) — two stages matching the two client-facing
        // actions (RiskController::startReview()/approve()): Governance review,
        // then Director final approval. The existing hardcoded gate also allows
        // Secretary General to approve; severity-conditional SG escalation for
        // high/critical risks is deferred (would need a 3rd endpoint/UI action).
        $this->makeWorkflow($tenant, 'Risk Register Approval', 'risk', [
            ...($govRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $govRole->id, 'stage_type' => 'review', 'step_name' => 'Governance Review', 'sla_hours' => 72]] : []),
            ...($directorRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $directorRole->id, 'stage_type' => 'approve', 'step_name' => 'Director Approval', 'sla_hours' => 72]] : []),
        ]);

        // Supplier registration (PRD §18) — self-service applicant (portal user, no
        // institutional supervisor/HOD) so this chain uses role-based verify/authorise
        // steps only: Procurement verifies company info, Finance/Compliance verifies
        // banking/tax/statutory documentation, Procurement gives final authorisation.
        $this->makeWorkflow($tenant, 'Supplier Registration Approval', 'supplier', [
            ...($procurementOfficer ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $procurementOfficer->id, 'stage_type' => 'verify', 'step_name' => 'Procurement Verification', 'allow_return' => true, 'sla_hours' => 72]] : []),
            ...($finRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'verify', 'step_name' => 'Finance/Compliance Verification', 'allow_return' => true, 'sla_hours' => 72]] : []),
            ...($procurementOfficer ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $procurementOfficer->id, 'stage_type' => 'authorise', 'step_name' => 'Procurement Authorisation', 'authority_action' => 'procurement.authorise', 'sla_hours' => 72]] : []),
        ]);

        // PIF / Programmes — requesting officer → activity auth → Finance → DF → SG
        $this->makeWorkflow($tenant, 'Programme Activity Approval', 'programmes', [
            ['approver_type' => 'supervisor', 'actor_selector' => 'supervisor', 'stage_type' => 'recommend', 'step_name' => 'Activity Authorisation', 'allow_return' => true, 'sla_hours' => 48],
            ['approver_type' => 'up_the_chain', 'actor_selector' => 'hod', 'stage_type' => 'authorise', 'step_name' => 'Department Authorisation', 'sla_hours' => 48],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'step_name' => 'Finance Confirmation', 'authority_action' => 'finance.certify', 'sla_hours' => 72]] : []),
            ...($directorRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'director_finance', 'role_id' => $directorRole->id, 'stage_type' => 'authorise', 'step_name' => 'Director Finance Authorisation', 'authority_action' => 'finance.authorise', 'sla_hours' => 72]] : []),
            ...($sgRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'Secretary General Approval', 'authority_action' => 'sg.approve', 'requires_signature' => true, 'sla_hours' => 72]] : []),
        ]);

        // Employee Lifecycle — approval gates only (operational tasks use Assignments)
        $this->makeWorkflow($tenant, 'Lifecycle Appointment Authorisation', 'lifecycle_appointment_authorise', [
            ...($hrRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $hrRole->id, 'stage_type' => 'authorise', 'step_name' => 'HR Authorise Appointment', 'sla_hours' => 72]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Lifecycle Final HR Clearance', 'lifecycle_final_hr_clearance', [
            ...($hrRole ? [['approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $hrRole->id, 'stage_type' => 'approve', 'step_name' => 'Final HR Clearance', 'sla_hours' => 72]] : []),
        ]);

        // Publish version snapshots for active workflows
        $publisher = User::role('System Admin')->where('tenant_id', $tenant->id)->first()
            ?? User::where('tenant_id', $tenant->id)->first();
        if ($publisher) {
            $svc = app(DefinitionVersionService::class);
            ApprovalWorkflow::where('tenant_id', $tenant->id)->where('is_active', true)->each(function ($wf) use ($svc, $publisher) {
                $svc->ensurePublishedSnapshot($wf, $publisher);
            });
        }
    }

    private function makeWorkflow(Tenant $tenant, string $name, string $module, array $steps, ?string $selfApprovalPolicy = null): void
    {
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => $name],
            [
                'module_type' => $module,
                'record_type' => $module,
                'is_active' => true,
                'definition_status' => 'published',
                'self_approval_policy' => $selfApprovalPolicy ?? ApprovalWorkflow::SELF_APPROVAL_DENIED,
            ]
        );

        $wf->steps()->delete();

        foreach ($steps as $order => $step) {
            $wf->steps()->create(array_merge([
                'step_order' => $order,
                'stage_type' => $step['stage_type'] ?? 'approve',
                'actor_selector' => $step['actor_selector'] ?? $step['approver_type'],
            ], $step));
        }

        if ($this->command) {
            $this->command->info("Workflow '{$name}' seeded with " . count($steps) . ' steps.');
        }
    }
}
