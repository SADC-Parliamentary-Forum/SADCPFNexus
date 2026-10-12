# ADR 0001: Self-approval is governed by the workflow engine's policy, not by module code

- **Status:** Accepted
- **Date:** 2026-08-08 (recorded 2026-10-12)
- **Deciders:** Platform / Workflow Engine owners

## Context

Nexus routes approvals for many modules through the central workflow engine. The modules include Leave, Timesheet, Weekly Reports, M&E, Correspondence, Risk, Supplier, Programme/PIF, Travel and Salary Advance. Some of them grew their own hardcoded "you cannot approve your own request" checks before the engine existed.

The engine has a configurable policy, `ApprovalWorkflow::$self_approval_policy` (`api/app/Models/ApprovalWorkflow.php`), with three values:

- `denied`
- `allow_with_controls`
- `require_external_approver`

Two components enforce it:

- `AuthorityCheckService::check()` (`api/app/Modules/PeopleAuthority/Services/AuthorityCheckService.php`)
- `WorkflowOrchestrator::decide()` (`api/app/Modules/WorkflowEngine/Services/WorkflowOrchestrator.php`). This requires a comment when an approval is a self-approval.

In Timesheet and M&E, a hardcoded module check also ran on the engine-completion path. That made the engine policy a silent no-op: setting `allow_with_controls` in the designer had no effect.

## Decision

1. **On the engine path, the engine policy is the single source of truth for self-approval.** A module service method called from `onWorkflowApproved()` must not apply its own self-approval check.
2. A module that still needs a legacy check for its non-engine path (records with no `ApprovalRequest`) takes a `bool $enforceLegacyAuthChecks = true` parameter on its service method. The engine hook passes `false`. Reference implementations:
   - `WeeklyReportService::accept()` / `returnReport()`, called from `api/app/Models/WeeklyReport.php`
   - `MeReviewService::accept()`, called from `api/app/Models/MeActivityReport.php`
3. Modules with no module-level guard are the preferred end state. These are Correspondence, Risk, Supplier, Programme/PIF, Travel and Salary Advance.
4. Separation-of-duties checks on *other* actions are not self-approval checks and are out of scope for this rule. Examples are Travel `confirmFunds()` and Salary Advance `assertCanCertify()` / `assertCanPay()`.

## Consequences

- Changing a module's policy in the workflow designer takes effect without code changes.
- Legacy non-engine paths still block self-approval unconditionally, because there is no policy there to consult.
- If self-approval "doesn't work" after a policy change, check first whether that module's `onWorkflowApproved()` calls a service method with a hardcoded check and no bypass flag. That was the root cause for both Timesheet and M&E.
- As of 2026-08-08, only Leave has `allow_with_controls` configured in production, for the Secretary General role. The other modules are `denied`.

## Verification

Each of the 10 engine-integrated modules was verified on 2026-08-08 against real service and controller code paths. The tests ran inside a database transaction that was rolled back, because there is no staging environment.
