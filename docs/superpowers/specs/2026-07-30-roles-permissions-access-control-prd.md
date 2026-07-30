# SADC PF Nexus  
# Full Application Roles, Permissions and Access-Control Re-engineering PRD

**Document type:** Product Requirements Document  
**Module:** Roles, Permissions and Access Governance  
**System:** SADC PF Nexus Internal Secretariat Paperless Administration System  
**Status:** Implementation Authority  
**Priority:** Critical / Production Blocking  
**Version:** 1.0  
**Date:** 30 July 2026

---

## 1. Executive summary

The SADC PF Nexus roles system shall be re-engineered from a broad module-level role model into a **fine-grained, deny-by-default access-control platform**.

A user shall see and access only:

- The modules assigned to them.
- The specific features assigned to them within those modules.
- The actions they are authorised to perform.
- The records falling within their authorised scope.
- The fields and document sections they are permitted to see or edit.
- The workflow steps currently assigned to them.
- The reports, dashboard cards, notifications and exports they are authorised to receive.

Access to one feature shall **not** automatically grant access to the parent module, sibling features, module dashboards, reports, configuration pages or other records.

For example:

- A staff member assigned only to evaluate a particular procurement shall see the assigned evaluation feature and records, but not the full Procurement module.
- An officer authorised only to confirm budget availability on a PIF shall see the Finance Review section of the assigned PIF, but not programme-management features or unrelated PIF records.
- A supervisor authorised to review a staff member’s timesheet shall see the review task and relevant timesheet, but not all timesheets.
- An acting approver shall receive only the delegated workflow step, for the approved period and scope.

The institutional rules require observance of organisational hierarchy and protection of confidential information. fileciteturn0file3 The Accounting Policies and Procedures Manual also expressly requires segregation of duties, particularly around financial processing and authorisation. fileciteturn0file5

This PRD therefore establishes a hybrid model combining:

1. **Role-Based Access Control — RBAC**
2. **Attribute-Based Access Control — ABAC**
3. **Relationship-Based Access Control — ReBAC**
4. **Workflow-state permissions**
5. **Record and field-level restrictions**
6. **Temporary delegation**
7. **Segregation-of-duties controls**

---

# 2. Product problem

The existing approach appears to treat access too broadly. A person may receive access to an entire module merely because they need to perform one task inside it.

That creates several risks:

- Users see menu items they cannot or should not use.
- Users can discover records outside their responsibilities.
- Sensitive HR and financial information may be overexposed.
- Approval permissions may be treated as permanent powers rather than workflow-specific responsibilities.
- Module access may unintentionally expose reports, exports, attachments or configuration screens.
- ICT or system administrators may acquire business-data access merely because they maintain the platform.
- Direct URLs or API calls may bypass menu restrictions.
- A user may be able to approve something they created or prepared.
- Acting appointments or delegated access may remain active after the approved period.
- Notifications and dashboard totals may disclose information even when the underlying records are hidden.

The central defect is that **a menu-hiding system is not an access-control system**. The backend, database queries, exports, attachments, search results and workflow engine must enforce the same rules.

---

# 3. Vision

Nexus shall provide an access-control ecosystem in which every screen, action and record answers five questions:

1. **Who is the user?**
2. **What capability has the user been granted?**
3. **Within what organisational, project, workflow or record scope?**
4. **At what workflow state and during what period?**
5. **Are there restrictions, conflicts or explicit denials that override the grant?**

The default outcome shall always be:

> **Access denied unless an active, valid and appropriately scoped permission grants access.**

---

# 4. Goals

The re-engineered Roles and Permissions system shall:

1. Hide every unauthorised menu item, card, shortcut, button, report and search result.
2. Enforce permissions on the server, not only in the interface.
3. Support access to a single feature without granting the entire module.
4. support users holding multiple roles simultaneously.
5. Restrict access by self, reporting line, department, project, assigned records, workflow stage or specific records.
6. Support temporary acting appointments and delegations.
7. prevent users from approving their own requests.
8. Support field-level controls for sensitive HR, Finance, M&E and procurement information.
9. Separate technical administration from business-data authority.
10. Produce a complete audit history of permission grants, changes, use and revocation.
11. Make permission changes effective immediately.
12. Support periodic access reviews and automatic expiry.
13. Eliminate orphaned, duplicated and ambiguous permissions.
14. Ensure that APIs, background jobs, exports and file downloads apply the same controls as the visible application.
15. Provide testable evidence that every protected feature is secure.

---

# 5. Non-goals

This PRD shall not:

- Turn Nexus into the SADC Parliament Connect public or parliamentary portal.
- Use job titles as the sole security mechanism.
- Give ICT personnel unrestricted access to institutional business records.
- Allow a “Super Administrator” account to bypass all business controls during ordinary operations.
- Treat UI visibility as sufficient security.
- Automatically grant all staff access to every internal module.
- Permit role changes without approval, justification and audit.
- Use direct database edits as a normal role-management process.
- combine PIF and M&E into one permission domain. M&E remains a separate module and system of record, while approved PIF data may be linked to it. fileciteturn2file0

---

# 6. Authorisation principles

## 6.1 Deny by default

Every new:

- Route
- API endpoint
- feature
- dashboard card
- report
- export
- notification type
- attachment category
- administrative screen
- background process

shall be inaccessible until explicitly linked to a registered permission.

No new functionality may inherit broad access merely because it belongs to an existing module.

---

## 6.2 Least privilege

Users shall receive only the minimum access necessary to perform assigned duties.

Access shall be limited by:

- Capability
- scope
- duration
- workflow stage
- record relationship
- data sensitivity
- organisational position
- conflict-of-interest restrictions

---

## 6.3 Parent and child permissions are independent

Module access shall not imply feature access.

Feature access shall not imply module access.

Example:

```text
procurement.module.view
```

does not grant:

```text
procurement.rfq.create
procurement.bid.open
procurement.evaluation.view
procurement.award.approve
procurement.report.export
procurement.supplier.manage
```

Likewise:

```text
procurement.evaluation.complete.assigned
```

may be granted without:

```text
procurement.module.view
```

The user shall receive a direct link to **My Assigned Evaluations** without seeing the full Procurement landing page.

---

## 6.4 Backend authority

The backend shall be the final authority.

A hidden button shall never be considered enforcement.

Every request shall be checked at:

1. Route level.
2. Controller or endpoint level.
3. Service/business-rule level.
4. Database query scope.
5. Record level.
6. Field or section level.
7. Attachment/download level.
8. Export level.

---

## 6.5 Explicit scope

Every permission grant shall have one or more scopes.

| Scope | Meaning |
|---|---|
| `self` | User’s own profile or records |
| `created` | Records created by the user |
| `assigned` | Records explicitly assigned to the user |
| `direct_reports` | Staff directly supervised by the user |
| `reporting_tree` | Authorised reporting hierarchy |
| `department` | Records within the user’s department |
| `directorate` | Records within the user’s directorate |
| `project` | Records linked to an assigned project or donor |
| `programme` | Records linked to an assigned programme |
| `workflow_stage` | Records awaiting the user’s workflow action |
| `specific_records` | Named records explicitly granted |
| `organisation` | All authorised organisational records |
| `system` | Technical configuration only |

“Organisation” scope shall be rare and require stronger approval.

---

## 6.6 Deny takes precedence

Where a user has both a grant and a restriction:

> **Explicit denial or segregation-of-duties restriction shall win.**

Effective access shall be calculated as:

```text
Active role grants
+ approved direct grants
+ approved delegated grants
+ relationship-derived grants
- explicit denials
- expired assignments
- suspended roles
- segregation-of-duties conflicts
- workflow-state restrictions
- record restrictions
= effective access
```

---

# 7. Roles versus permissions

## 7.1 Permission

A permission is one precise capability.

Examples:

```text
leave.request.create
leave.request.read.self
leave.request.recommend.direct_reports
leave.balance.certify
leave.request.authorise.assigned

travel.itinerary.update.assigned
travel.dsa.calculate.assigned
travel.funds.confirm.assigned
travel.request.approve.assigned

programme.finance_review.update.assigned
mande.evidence.validate.assigned
procurement.evaluation.score.assigned
risk.control.update.assigned
```

---

## 7.2 Role

A role is a managed bundle of permissions.

Examples:

- Employee
- Supervisor
- HR and Administration Officer
- Finance Officer
- Programme Officer
- M&E Officer
- Procurement Officer
- Internal Auditor

Roles make administration easier, but they are not the final security decision.

---

## 7.3 Role assignment

A role assignment shall contain:

- User
- role
- organisational unit
- project or programme scope where applicable
- record scope
- effective date
- expiry date
- assignment type
- reason
- requested by
- approved by
- status
- review date
- supporting document
- audit reference

---

## 7.4 Direct permission grants

Direct permissions may be used only where:

- A user requires one exceptional feature.
- A committee member requires access to selected records.
- A temporary assignment does not justify creating a new permanent role.
- A user needs read-only access to a specific report or record set.

Direct grants shall not become the normal substitute for properly designed roles.

Every direct grant must have:

- A reason.
- an owner.
- an approver.
- an expiry date unless formally classified as permanent.
- a defined scope.

---

# 8. Permission naming standard

Permissions shall follow:

```text
<domain>.<resource-or-feature>.<action>.<optional-scope>
```

Examples:

```text
leave.request.read.self
leave.request.edit.created
leave.request.recommend.direct_reports

programme.request.create
programme.finance_review.update.assigned
programme.procurement_transfer.execute.assigned

procurement.bid.open.assigned
procurement.evaluation.score.assigned
procurement.award.approve.assigned

audit.event.read.department
audit.export.create.organisation
```

## 8.1 Standard actions

The standard action vocabulary shall include:

- `view`
- `list`
- `read`
- `create`
- `edit`
- `submit`
- `withdraw`
- `cancel`
- `delete`
- `restore`
- `recommend`
- `review`
- `verify`
- `certify`
- `validate`
- `approve`
- `reject`
- `return`
- `reassign`
- `delegate`
- `publish`
- `dispatch`
- `archive`
- `close`
- `reopen`
- `configure`
- `manage`
- `download`
- `upload`
- `export`
- `sign`
- `override`

`override` permissions shall be exceptional, strongly controlled and audited.

---

# 9. Effective access decision

For every protected request, Nexus shall evaluate:

```text
Can user U perform action A
on resource R
within context C
at workflow state S
during time T?
```

The access decision shall examine:

- Active account status.
- MFA status where required.
- active role assignments.
- direct grants.
- explicit denials.
- department and reporting relationship.
- project or programme assignment.
- record creator and owner.
- current workflow assignee.
- acting or delegated authority.
- start and expiry dates.
- record confidentiality classification.
- segregation-of-duties rules.
- legal hold or record lock.
- whether the requested fields are permitted.
- whether the user’s session assurance is sufficient.

---

# 10. Navigation and interface requirements

## 10.1 Menu visibility

The sidebar, mobile navigation and command menu shall be generated from effective permissions.

A user shall not see:

- Unauthorised modules.
- empty menu groups.
- unauthorised child pages.
- configuration links they cannot use.
- reports they cannot open.
- badges or counts for hidden records.
- inaccessible quick actions.
- inaccessible dashboard widgets.

---

## 10.2 Feature-only access

Where a user has access to one feature but not the parent module:

- The module overview shall remain hidden and inaccessible.
- The feature may appear under **My Work**, **My Assigned Tasks** or a non-clickable menu group.
- Only the permitted feature shall be displayed.
- Breadcrumbs shall not link to an inaccessible module landing page.
- The user shall not be able to enumerate sibling routes.
- Search shall return only permitted records from that feature.

Example:

```text
My Work
 └── Procurement Evaluations
```

The user shall not see:

```text
Procurement
 ├── Requests
 ├── Suppliers
 ├── RFQs
 ├── Bids
 ├── Evaluations
 ├── Awards
 ├── Purchase Orders
 └── Reports
```

---

## 10.3 Buttons and actions

An unauthorised action shall be hidden.

A disabled button may be shown only where the user has the permission but the action is unavailable because of:

- Workflow state.
- missing required information.
- deadline.
- record lock.
- dependency.
- completed approval.

The interface shall explain why an authorised action is currently unavailable.

---

## 10.4 Direct URL handling

A user navigating directly to an unauthorised route shall not gain access.

The system shall return:

- `403 Forbidden` where the route is known but the capability is absent.
- `404 Not Found` where confirming the existence of a sensitive record would leak information.
- A safe “You do not have access” screen without record details.

---

## 10.5 Search and global discovery

Global search shall apply the same permissions as the originating module.

Search suggestions shall not reveal:

- Record titles.
- staff names.
- subjects of confidential correspondence.
- procurement values.
- salary advance details.
- leave reasons.
- risk descriptions.
- attachment names.

unless the user can open the relevant record.

---

# 11. Core role templates

These are default templates, not hard-coded authority. SADC PF may adjust their permission bundles without code changes.

| Role template | Intended responsibility |
|---|---|
| General Employee | Self-service access and assigned work |
| Supervisor / Line Manager | Review direct-report submissions and assignments |
| Head of Department / Director | Departmental oversight and assigned approvals |
| Secretary General | Final institutional approvals and executive oversight |
| SG Office Workflow Coordinator | Route, track and administer SG-level submissions without inheriting approval authority |
| HR and Administration Officer | HR records, leave certification, travel logistics and administration |
| Finance Officer | Financial validation, calculations and processing |
| Project Accountant | Project-budget and donor-funded transaction review |
| Director Finance and Corporate Services | Assigned financial and corporate approvals |
| Programme Officer | Prepare and manage assigned programmes and PIFs |
| Programme Manager | Programme supervision and assigned programme approvals |
| Director Programmes and Parliamentary Business | Directorate oversight and assigned approvals |
| M&E Officer | Indicator, evidence and activity-report processing |
| M&E Manager | M&E review, acceptance, closure and reporting |
| Procurement Officer | Procurement administration and controlled process execution |
| Procurement Evaluation Committee Member | Assigned evaluation only |
| Supplier Administrator | Supplier onboarding, verification and lifecycle management |
| Correspondence Registry Officer | Register, classify, route and dispatch correspondence |
| Risk Owner | Maintain assigned risks and controls |
| Risk Coordinator | Administer risk framework and consolidate institutional reporting |
| Weekly Report Consolidator | Consolidate authorised departmental summaries |
| Internal Auditor | Read-only assurance access to authorised records and audit data |
| Report Viewer | Read approved reports only |
| Report Exporter | Export specifically authorised datasets |
| ICT Platform Administrator | Technical platform administration without automatic business-data access |
| Security and Access Administrator | Role and access administration without business approval authority |
| Workflow Administrator | Workflow configuration and operational correction under controlled conditions |
| External Supplier | Supplier portal and own procurement interactions |
| Temporary Reviewer / Committee Member | Time-bound, record-specific review access |

---

# 12. Critical separation of administrative powers

## 12.1 ICT Platform Administrator

ICT administrators may:

- Manage infrastructure.
- monitor platform health.
- manage deployments.
- troubleshoot technical failures.
- manage integrations.
- manage backups.
- review security logs within approved scope.

ICT administrators shall not automatically:

- Read leave applications.
- see salary advance details.
- view correspondence content.
- approve requests.
- access procurement bids.
- read confidential risk records.
- export financial or HR information.
- grant themselves business permissions.

The ICT Officer’s institutional responsibilities include system administration and secure user-access management, but this technical mandate must not be interpreted as unrestricted business-data authority. fileciteturn1file0

---

## 12.2 Security and Access Administrator

The Access Administrator may administer roles and assignments but shall not:

- Approve their own access.
- alter their own privileged role.
- bypass segregation-of-duties rules.
- become a business approver merely through administrative control.
- silently impersonate users.
- delete role-change audit records.

A second authorised officer shall approve high-risk role grants.

---

## 12.3 Workflow Administrator

A Workflow Administrator may correct routing problems but shall not make the underlying business decision.

Any reassign, skip, reopen or override action shall require:

- A reason.
- approved authority.
- audit entry.
- affected-user notification.
- before-and-after workflow history.

---

# 13. Module-by-module roles and permission requirements

## 13.1 Dashboard and My Work

### Permissions

```text
dashboard.view
dashboard.widget.view.<widget>
dashboard.executive_view
my_work.view
my_work.task.open.assigned
my_work.task.reassign
```

### Requirements

- Every widget shall have an independent permission.
- Counts shall include only records the user can access.
- Executive dashboards shall not automatically grant access to source records.
- Clicking a metric shall show only authorised underlying records.
- Users with feature-only access shall receive the relevant task through My Work.
- Dashboard APIs shall filter data server-side.

---

## 13.2 Leave Management

The leave form establishes separate applicant, supervisor, Administration and Head of Institution responsibilities. fileciteturn0file0

### Permission catalogue

```text
leave.request.create.self
leave.request.read.self
leave.request.edit.created
leave.request.submit.created
leave.request.withdraw.created
leave.request.cancel.created

leave.request.read.direct_reports
leave.request.recommend.assigned
leave.request.return.assigned

leave.balance.read.self
leave.balance.read.assigned_staff
leave.balance.certify.assigned
leave.balance.adjust
leave.balance.import
leave.balance.export

leave.request.authorise.assigned
leave.request.reject.assigned

leave.calendar.view.department
leave.calendar.view.organisation
leave.report.view
leave.report.export
leave.type.configure
leave.workflow.configure
```

### Role behaviour

| Role | Default access |
|---|---|
| Employee | Create, edit and view own requests and balances |
| Supervisor | View and recommend requests from direct reports |
| HR/Admin | Certify balances and administer leave records |
| Head/Director/SG | Authorise only requests routed to them |
| Auditor | Read-only access under approved audit scope |

### Controls

- Employees may not modify a submitted request unless returned.
- Supervisors may not recommend their own applications.
- HR certification shall not constitute final approval.
- Final approvers shall act only on records awaiting their decision.
- Medical or compassionate attachments shall have stricter document permissions.
- Leave reasons shall not appear in broad leave calendars.
- Calendar access may show availability without exposing sensitive reasons.

---

## 13.3 Travel Requisition

The travel form separates the travelling officer, Administrative Officer, Finance Officer, Director of Finance and Corporate Services, and Secretary General functions. fileciteturn0file4

### Permission catalogue

```text
travel.request.create.self
travel.request.create.on_behalf
travel.request.read.self
travel.request.edit.created
travel.request.submit.created
travel.request.withdraw.created

travel.vehicle.request
travel.vehicle.assign
travel.driver.assign

travel.itinerary.read.assigned
travel.itinerary.update.assigned
travel.supporting_document.manage.assigned

travel.dsa.calculate.assigned
travel.dsa.verify.assigned
travel.budget_line.update.assigned
travel.financial_provision.update.assigned

travel.funds.confirm.assigned
travel.logistics.confirm.assigned
travel.request.approve.assigned
travel.request.reject.assigned
travel.request.return.assigned

travel.accountability.create.self
travel.accountability.review.assigned
travel.accountability.close.assigned

travel.report.view
travel.report.export
travel.rate.configure
travel.workflow.configure
```

### Controls

- Traveller access shall not expose other employees’ DSA calculations.
- Administrative users may update itinerary and logistics but not approve financial values unless separately authorised.
- Finance may calculate DSA and provisions but may not provide final institutional approval.
- The Secretary General or delegated approver shall approve only the final stage.
- The person who calculated a financial amount shall not be the sole final authoriser.
- Travel records linked to PIFs shall not inherit all PIF permissions.
- Each module shall independently authorise its own data.

---

## 13.4 Programme Implementation Form

The PIF contains distinct signatory responsibilities for the requesting officer, activity authorisation, Finance confirmation, Director of Finance and Corporate Services, and Secretary General. fileciteturn0file2

### Permission catalogue

```text
programme.request.create
programme.request.read.created
programme.request.read.assigned
programme.request.edit.created
programme.request.submit.created
programme.request.withdraw.created

programme.supporting_officer.assign
programme.preparation.delegate
programme.manager_review.act.assigned
programme.activity_authorise.act.assigned

programme.finance_review.read.assigned
programme.finance_review.update.assigned
programme.budget_availability.confirm.assigned

programme.funds_procurement_rates.authorise.assigned
programme.sg_approval.act.assigned

programme.document.manage.created
programme.arrival_departure.manage.created
programme.conflict_declaration.submit.created

programme.procurement_item.transfer.assigned
programme.mande_link.read.authorised
programme.report.view
programme.report.export
programme.configuration.manage
```

### Field-level restrictions

| PIF section | Editable by |
|---|---|
| General activity information | Requester or authorised preparer while draft |
| Venue and logistics | Requester or authorised logistics contributor |
| Programme staffing | Requester or authorised programme contributor |
| Budget estimates | Requester within permitted fields |
| Budget availability status | Finance only |
| Finance comments | Finance only |
| Funding, procurement and rates authorisation | Director Finance and Corporate Services or delegated equivalent |
| M&E link and M&E status | M&E module only |
| SG approval fields | SG or active delegated approver |
| Conflict declaration | Requester; immutable after submission except controlled return |

The existing implementation design already identifies `programme.finance-review` as a separate permission and requires non-Finance users to receive a `403` when attempting to change Finance-only fields. fileciteturn1file4

### Controls

- Programme Officers shall not edit Finance-only fields.
- M&E users shall not edit the PIF’s programme-planning sections merely because they can link an M&E record.
- Procurement transfer permission shall allow transfer only from approved PIF items.
- Access to a linked procurement request shall be independently evaluated.
- Supporting Officers shall receive only assigned sections or tasks where practical.
- A delegated preparer shall not become the owner or approver.
- The user who submits the PIF may not approve it at any subsequent stage.
- PIF and M&E shall remain separate permission domains.

---

## 13.5 Monitoring and Evaluation

### Permission catalogue

```text
mande.module.view
mande.strategic_plan.read
mande.strategic_plan.manage
mande.result_framework.read
mande.result_framework.manage
mande.indicator.read
mande.indicator.create
mande.indicator.edit
mande.indicator.retire

mande.activity_link.create
mande.activity_link.read
mande.activity_report.create
mande.activity_report.edit.created
mande.activity_report.submit
mande.activity_report.return
mande.activity_report.review.assigned
mande.activity_report.accept.assigned
mande.activity_report.close.assigned

mande.evidence.upload
mande.evidence.read.authorised
mande.evidence.validate.assigned
mande.evidence.reject.assigned

mande.dashboard.view
mande.report.view
mande.report.export
mande.configuration.manage
```

### Controls

- M&E may read approved PIF information required for reporting.
- PIF access shall not automatically grant M&E access.
- M&E permissions shall not grant procurement, travel or budget authority.
- Evidence access shall follow project, programme, thematic and confidentiality scopes.
- Programme Officers may see the status of linked M&E reporting without acquiring M&E administration rights.
- Indicator configuration shall be restricted to designated M&E administrators.
- Closing an M&E report shall require a distinct permission from reviewing it.

---

## 13.6 Salary Advance

The salary advance form separates the applicant, Finance Officer and final institutional approval functions and includes a test against the 50% threshold and existing advances. fileciteturn0file1

### Permission catalogue

```text
salary_advance.request.create.self
salary_advance.request.read.self
salary_advance.request.edit.created
salary_advance.request.submit.created
salary_advance.request.withdraw.created

salary_advance.financial_details.read.assigned
salary_advance.salary_verify.assigned
salary_advance.outstanding_advance_verify.assigned
salary_advance.threshold_verify.assigned
salary_advance.finance_certify.assigned

salary_advance.approve.assigned
salary_advance.reject.assigned
salary_advance.return.assigned

salary_advance.payroll_deduction.record.assigned
salary_advance.settlement.close.assigned

salary_advance.report.view
salary_advance.report.export
salary_advance.configuration.manage
```

### Controls

- Salary information shall be classified as highly sensitive.
- Applicants shall see only their own applications.
- Supervisors shall not see salary amounts unless explicitly required by the approved workflow.
- Finance may verify salary and advance status but shall not automatically receive final approval authority.
- Payroll-deduction recording shall be distinct from approval.
- Report exports containing salary information shall require a separate permission and justification.
- Notification messages shall avoid displaying salary or advance amounts on lock screens or email subjects.

---

## 13.7 Procurement, RFQ and Suppliers

### Permission catalogue

```text
procurement.request.create
procurement.request.read.created
procurement.request.read.assigned
procurement.request.edit.created
procurement.request.submit.created
procurement.request.review.assigned
procurement.request.approve.assigned

procurement.specification.create.assigned
procurement.specification.review.assigned
procurement.method.select.assigned
procurement.method.approve.assigned

procurement.rfq.create.assigned
procurement.rfq.review.assigned
procurement.rfq.publish.assigned
procurement.rfq.close.assigned

procurement.supplier.read
procurement.supplier.invite
procurement.supplier.verify
procurement.supplier.approve
procurement.supplier.suspend
procurement.supplier.rate

procurement.bid.submit.own
procurement.bid.read.own
procurement.bid.custody.manage
procurement.bid.open.assigned
procurement.bid.view.opened.assigned

procurement.evaluation.read.assigned
procurement.evaluation.score.assigned
procurement.evaluation.submit.assigned
procurement.evaluation.chair.consolidate.assigned

procurement.award.recommend.assigned
procurement.award.approve.assigned
procurement.award.notify.assigned

procurement.purchase_order.create.assigned
procurement.purchase_order.approve.assigned
procurement.goods_receipt.record.assigned

procurement.report.view
procurement.report.export
procurement.configuration.manage
```

### Feature-only examples

A committee member assigned only to evaluate RFQ-2026-014 shall receive:

```text
procurement.evaluation.read.specific_record
procurement.evaluation.score.specific_record
procurement.evaluation.submit.specific_record
```

They shall not receive:

- Supplier-management access.
- access to unrelated procurements.
- bid-opening access.
- award approval.
- purchase-order access.
- procurement reports.
- procurement configuration.

### Controls

- Submitted bids shall remain sealed until the approved opening time.
- Evaluation committee members shall see only procurements assigned to them.
- Individual scoring shall remain private until the defined consolidation stage.
- A requester shall not approve their own procurement.
- A bid custodian shall not alter supplier submissions.
- Supplier verification and supplier approval should be separated where staffing permits.
- Evaluation and award approval shall be distinct capabilities.
- Conflict-of-interest declarations shall be required before evaluators access bid details.
- The system shall block conflicted users from the affected procurement.
- Procurement records derived from PIF shall retain the PIF link but use independent permissions.
- Supplier ratings shall not be editable by suppliers.

Sida procurement provisions emphasise transparency, equal treatment, non-discrimination, fair competition and avoidance of conflicts of interest, reinforcing the need for carefully separated procurement roles. fileciteturn0file7

---

## 13.8 Correspondence Register

### Permission catalogue

```text
correspondence.incoming.register
correspondence.outgoing.register
correspondence.read.created
correspondence.read.assigned
correspondence.read.department
correspondence.read.confidential

correspondence.classify
correspondence.assign
correspondence.reassign
correspondence.acknowledge
correspondence.response.draft
correspondence.response.review
correspondence.response.approve
correspondence.dispatch
correspondence.archive
correspondence.reopen

correspondence.attachment.upload
correspondence.attachment.download
correspondence.report.view
correspondence.report.export
correspondence.configuration.manage
```

### Controls

- Correspondence shall be classified as public, internal, confidential or restricted.
- Registry staff may register and route correspondence without necessarily reading restricted attachments.
- SG Office users may track routing without automatically obtaining content access.
- Assignment notifications shall disclose only the minimum necessary metadata.
- Outgoing correspondence approval shall follow organisational hierarchy.
- Archived records shall remain subject to access controls.
- Confidential records shall be excluded from ordinary search and dashboard counts unless authorised.

---

## 13.9 Timesheets

### Permission catalogue

```text
timesheet.create.self
timesheet.read.self
timesheet.edit.created
timesheet.submit.created
timesheet.withdraw.created

timesheet.read.direct_reports
timesheet.review.assigned
timesheet.return.assigned
timesheet.approve.assigned

timesheet.project_code.assign
timesheet.finance_verify.assigned
timesheet.period.lock
timesheet.period.reopen

timesheet.report.view
timesheet.report.export
timesheet.configuration.manage
```

### Controls

- Employees shall access only their own timesheets unless assigned review authority.
- Supervisors shall access direct reports or explicitly assigned staff only.
- Project Accountants may validate project coding without obtaining HR-management authority.
- Locked timesheets shall require controlled reopening.
- Users shall not approve their own timesheets.
- Reopening shall preserve the previous approved version and audit history.

---

## 13.10 Assignments and Task Tracking

### Permission catalogue

```text
assignment.create
assignment.assign
assignment.read.created
assignment.read.assigned
assignment.read.direct_reports
assignment.read.department

assignment.update.assigned
assignment.comment.authorised
assignment.evidence.upload.assigned
assignment.reassign
assignment.extend_deadline
assignment.verify.assigned
assignment.close.assigned
assignment.reopen.assigned

assignment.report.view
assignment.report.export
assignment.configuration.manage
```

### Controls

- A user assigned one task shall see that task through My Work without receiving the full Assignments module.
- Private management tasks shall not appear in general task searches.
- Reassignment shall require a reason.
- Assignees may update progress but may not change the task owner, priority or deadline unless granted.
- Closing and verifying shall be separate where the task requires independent confirmation.
- Attachments shall inherit the task’s permissions.

---

## 13.11 Risk Register

### Permission catalogue

```text
risk.register.view
risk.record.create
risk.record.read.assigned
risk.record.read.department
risk.record.read.organisation

risk.record.edit.owner
risk.owner.assign
risk.control.create.assigned
risk.control.update.assigned
risk.treatment.update.assigned
risk.evidence.upload.assigned

risk.review.department
risk.review.management
risk.accept.assigned
risk.escalate
risk.close.assigned
risk.reopen.assigned

risk.category.configure
risk.matrix.configure
risk.report.view
risk.report.export
```

### Controls

- Risk Owners shall update only assigned risks and controls.
- Risk Coordinators may administer the framework without owning every risk.
- Management may receive consolidated exposure while access to sensitive descriptions remains controlled.
- Audit users shall be read-only.
- ICT administrators shall not automatically access institutional risk details.
- Closed risks shall remain immutable except through controlled reopening.
- Risk-export access shall be independent from risk-view access.

---

## 13.12 Weekly Summary Reports

### Permission catalogue

```text
weekly_summary.create.self
weekly_summary.read.self
weekly_summary.edit.created
weekly_summary.submit.created
weekly_summary.withdraw.created

weekly_summary.review.direct_reports
weekly_summary.return.assigned
weekly_summary.approve.assigned

weekly_summary.department.consolidate
weekly_summary.directorate.consolidate
weekly_summary.organisation.view
weekly_summary.publish
weekly_summary.lock
weekly_summary.reopen

weekly_summary.report.export
weekly_summary.configuration.manage
```

### Controls

- Staff shall access their own reports.
- Supervisors shall review only assigned reports.
- Consolidators shall receive authorised submissions but not unrelated staff records.
- A consolidated report shall reference source reports without broadening access to sensitive source content.
- Published versions shall be versioned and locked.
- Reopening shall require an audit reason.

---

## 13.13 User Profiles and Signatures

### Permission catalogue

```text
profile.read.self
profile.edit.self
profile.photo.update.self
profile.contact.update.self
profile.emergency_contact.update.self

profile.read.direct_reports
profile.read.department
profile.verify.assigned
profile.employment_data.manage
profile.organisation_assignment.manage

signature.upload.self
signature.replace.self
signature.activate.self
signature.use.self
signature.use.on_behalf
signature.verify
signature.revoke
signature.audit.read
```

### Controls

- A user’s electronic signature image or signing credential shall not be exposed as a normal downloadable attachment.
- Signature use shall require re-authentication for high-risk actions.
- “Use on behalf” shall require documented delegation and shall clearly identify both the signatory and operator.
- A profile administrator shall not automatically gain permission to use the person’s signature.
- Signature changes shall invalidate unapproved pending uses where appropriate.
- Historic signed records shall preserve the signature evidence used at the time.

---

## 13.14 Approval Inbox and Workflow Tasks

### Permission catalogue

```text
approval.inbox.view
approval.task.read.assigned
approval.task.act.assigned
approval.task.return.assigned
approval.task.reject.assigned
approval.task.delegate.assigned
approval.task.reassign.admin
approval.task.escalate
approval.history.read.authorised
```

### Controls

- There shall be no universal “approve everything” permission in ordinary roles.
- Approval authority shall be derived from the specific workflow, stage, scope and assignment.
- A user may approve only while the record is awaiting their action.
- Once the workflow moves forward, prior approvers shall retain read-only history where authorised.
- Approvers shall not approve records they created, prepared, materially edited or financially certified where an SoD rule prohibits it.
- Bulk approval shall be disabled for sensitive financial, HR and procurement workflows unless explicitly designed and approved.
- Delegation shall not transfer more authority than the delegator possesses.

---

## 13.15 Notifications

### Permission catalogue

```text
notification.read.self
notification.manage.self
notification.preference.update.self
notification.template.read
notification.template.manage
notification.delivery_log.read
notification.resend
```

### Controls

- Users shall receive notifications only for records they can access.
- Revoking access shall remove future notifications.
- Existing notifications shall become non-actionable if access is removed.
- Notification text shall not leak restricted data.
- Delivery-log access shall not expose message content unnecessarily.
- Notification administrators shall not gain source-record access merely through delivery logs.

---

## 13.16 Documents and Attachments

### Permission catalogue

```text
attachment.upload.authorised_parent
attachment.read.authorised_parent
attachment.download.authorised_parent
attachment.replace.authorised_parent
attachment.delete.draft
attachment.restore
attachment.classify
attachment.retention.manage
attachment.quarantine.review
```

### Controls

Attachments shall inherit access from the parent record unless a stricter classification is applied.

An attachment URL shall never be permanently public.

Every download shall re-check:

- User session.
- parent-record access.
- attachment classification.
- expiry.
- legal hold.
- malware status.

Attachment titles, thumbnails and metadata shall not appear to unauthorised users.

---

## 13.17 Audit Trail

### Permission catalogue

```text
audit.own_activity.read
audit.module_activity.read
audit.department_activity.read
audit.security_activity.read
audit.organisation_activity.read
audit.evidence_package.create
audit.export.request
audit.export.approve
audit.retention.configure
audit.integrity.verify
```

### Controls

- Audit records shall be append-only and tamper-evident.
- Users shall not delete or edit audit events.
- Access to audit records shall itself be audited.
- Business administrators shall not automatically access all security logs.
- Security administrators shall not automatically access full business-record content.
- Sensitive exports shall require approval.
- Audit events shall record the effective role and scope used for the action.

---

## 13.18 Reports and Exports

### Permission catalogue

```text
report.<module>.<report_name>.view
report.<module>.<report_name>.export
report.<module>.<report_name>.schedule
report.<module>.<report_name>.share
report.builder.use
report.definition.manage
```

### Controls

- Report access shall not be implied by module access.
- View and export shall be separate.
- Exported fields shall be filtered according to field permissions.
- A user allowed to see a total may not necessarily see underlying records.
- Scheduled reports shall stop when the owner’s permission expires.
- Shared report links shall re-check recipient access.
- Exports shall be watermarked or tagged with user, date and classification where appropriate.
- Large or sensitive exports may require secondary approval.

---

## 13.19 Admin Console

The Admin Console shall be separated into permission domains.

### User administration

```text
admin.user.read
admin.user.create
admin.user.edit
admin.user.activate
admin.user.suspend
admin.user.terminate
admin.user.session.revoke
```

### Role administration

```text
admin.role.read
admin.role.create
admin.role.edit
admin.role.version.publish
admin.role.retire
admin.role_assignment.request
admin.role_assignment.approve
admin.role_assignment.revoke
admin.permission_override.manage
```

### Organisation administration

```text
admin.department.manage
admin.position.manage
admin.reporting_line.manage
admin.project_assignment.manage
admin.programme_assignment.manage
```

### Workflow administration

```text
admin.workflow.read
admin.workflow.edit
admin.workflow.publish
admin.workflow.instance.reassign
admin.workflow.instance.recover
```

### Security administration

```text
admin.security_policy.read
admin.security_policy.manage
admin.mfa.reset
admin.account_recovery.execute
admin.access_review.manage
admin.break_glass.manage
```

No single administrative role should receive every permission above by default.

---

# 14. Access lifecycle

## 14.1 New user provisioning

1. HR or authorised officer creates or verifies the employee profile.
2. Organisational assignment is captured.
3. A role request is generated from approved role templates.
4. The user’s supervisor or role owner confirms the need.
5. Sensitive roles receive secondary approval.
6. The Access Administrator assigns the approved role.
7. MFA is enrolled where required.
8. Access becomes effective.
9. The user receives a summary of granted access.
10. All steps are audited.

---

## 14.2 Role change

Role changes shall be triggered by:

- Transfer.
- promotion.
- change of supervisor.
- project assignment.
- acting appointment.
- committee appointment.
- disciplinary restriction.
- termination.
- changed business responsibilities.

The system shall calculate:

- Permissions to add.
- permissions to retain.
- permissions to revoke.
- conflicts introduced.
- temporary grants requiring expiry.

Access shall not simply accumulate over time.

---

## 14.3 Termination or suspension

On termination or suspension:

- Active sessions shall be revoked.
- future delegations shall end.
- privileged roles shall be removed.
- assigned tasks shall be rerouted.
- scheduled exports shall stop.
- API tokens shall be revoked.
- signature authority shall end.
- pending approvals shall be reassigned.
- the audit history shall remain intact.

---

# 15. Delegation and acting appointments

## 15.1 Delegation record

Every delegation shall capture:

- Delegator.
- delegate.
- reason.
- start date and time.
- end date and time.
- modules or workflow steps covered.
- organisational scope.
- exclusions.
- approving authority.
- status.
- revocation date.
- audit reference.

---

## 15.2 Delegation rules

- Delegation shall be time-bound.
- Delegation shall never exceed the delegator’s authority.
- The delegate shall see only delegated tasks and records.
- Existing personal authority and delegated authority shall remain distinguishable.
- Delegated actions shall display “Acting for” or “On behalf of”.
- A delegate shall not re-delegate unless expressly authorised.
- Delegation shall not bypass self-approval restrictions.
- Expiry shall be automatic.
- Future tasks shall stop routing to the delegate after expiry.
- Open tasks may be returned to the original holder or rerouted according to workflow rules.

---

# 16. Segregation of duties

The system shall have configurable SoD rules.

## 16.1 Mandatory rules

1. A requester shall not approve their own request.
2. A user shall not approve a role assignment benefiting themselves.
3. An Access Administrator shall not assign themselves privileged access.
4. A procurement requester shall not be the sole evaluator or award approver.
5. A bid opener shall not alter bids.
6. A Finance preparer shall not be the sole final authoriser of the same transaction.
7. A payroll preparer shall not be the sole payroll approver.
8. A user who certifies financial availability shall not automatically become the final institutional approver.
9. An auditor shall not edit the business records being audited.
10. ICT administrators shall not use technical privileges to perform business approvals.
11. A workflow administrator shall not use routing correction to record a business approval.
12. A supplier shall never access competitors’ bids or evaluations.
13. A user with signature-administration rights shall not automatically be allowed to sign on behalf of another person.

The Accounting Manual specifically highlights the need for separate people in payroll preparation, authorisation and payment processing. fileciteturn0file5

---

## 16.2 Conflict handling

When a role assignment introduces a conflict, the system shall:

- Block the assignment; or
- require an approved compensating control; or
- limit the role scope; or
- require dual approval.

The system shall not merely display a warning and continue.

---

# 17. Data sensitivity and field-level permissions

## 17.1 Classification levels

| Level | Example |
|---|---|
| Public | Approved non-sensitive institutional information |
| Internal | Routine Secretariat operational records |
| Confidential | Leave reasons, correspondence, performance information |
| Restricted | Salary, payroll, bids, investigations, sensitive risks |
| Highly Restricted | Authentication secrets, signing credentials, recovery data |

---

## 17.2 Field permissions

The authorisation engine shall support:

- Hidden fields.
- read-only fields.
- editable fields.
- masked fields.
- derived/summary-only values.
- export-excluded fields.

Examples:

- A leave calendar may show “Unavailable” but not the medical reason.
- A supervisor may know a salary advance is awaiting Finance without seeing salary figures.
- A Programme Officer may see Finance’s budget status but not edit it.
- An executive dashboard may show total procurement expenditure without exposing sealed bid details.
- An Access Administrator may see that a user has an HR role without seeing HR records.

---

# 18. Role administration screens

## 18.1 Role catalogue

Shall display:

- Role name.
- purpose.
- owner.
- risk level.
- current version.
- included permissions.
- default scopes.
- assigned users.
- conflicting roles.
- review date.
- status.

---

## 18.2 Role builder

The Role Builder shall:

- Group permissions by module and feature.
- show descriptions in business language.
- warn about broad scopes.
- identify segregation conflicts.
- prevent duplicate or orphan permissions.
- compare the proposed role against an existing role.
- require version publishing.
- retain historical versions.
- support draft, review, approved, active and retired states.

---

## 18.3 User access profile

The screen shall show:

- Effective roles.
- direct permissions.
- delegated roles.
- explicit denials.
- accessible modules.
- accessible features.
- record scopes.
- field restrictions.
- upcoming expiries.
- SoD conflicts.
- MFA status.
- last access review.
- role-change history.

---

## 18.4 Access simulator

Authorised administrators shall be able to evaluate:

> “What would this user be able to see and do?”

The simulator shall show:

- Menu preview.
- permitted routes.
- permitted actions.
- record scopes.
- denied permissions and reasons.
- role source.
- delegation source.
- SoD restrictions.

It shall not silently impersonate the user or create an unrestricted live session.

---

## 18.5 Permission explorer

Administrators shall be able to search:

- Which roles contain a permission.
- which users effectively hold it.
- how the user obtained it.
- where it is used in the application.
- which endpoints and screens depend on it.
- when it was last exercised.
- whether the permission is orphaned.

---

# 19. Access requests

Users may request additional access through Nexus.

An access request shall specify:

- Requested feature or permission.
- business reason.
- required scope.
- start and expiry dates.
- related project or assignment.
- data sensitivity.
- supervisor approval.
- role-owner approval.
- security approval where privileged.
- SoD result.

The requester shall not select vague options such as “Full access” without a controlled role template.

---

# 20. Periodic access reviews

The system shall support review campaigns.

## 20.1 Review frequency

- Privileged roles: at least quarterly.
- Finance, HR, procurement and restricted data roles: at least quarterly.
- Standard roles: at least every six months.
- Temporary access: automatically at expiry.
- Acting roles: automatically at end date.
- External accounts: per engagement and expiry.

## 20.2 Reviewer decisions

- Confirm.
- reduce scope.
- revoke.
- extend with reason.
- reassign owner.
- request clarification.

Failure to complete a mandatory review may suspend the affected high-risk role.

---

# 21. Emergency access

A controlled break-glass process may be provided for genuine emergencies.

It shall require:

- Named emergency reason.
- approved incident or service ticket.
- restricted duration.
- strong re-authentication.
- dual approval for highly restricted access where feasible.
- enhanced logging.
- immediate notification to Security and Internal Audit.
- post-event review.
- automatic revocation.

Break-glass shall not be used for ordinary convenience or workflow delays.

---

# 22. Data model

The implementation shall include, at minimum:

## 22.1 Core entities

```text
users
roles
role_versions
permissions
role_permissions
user_role_assignments
user_permission_grants
user_permission_denials
scope_definitions
assignment_scopes
resource_access_grants
delegations
acting_appointments
access_requests
access_request_approvals
segregation_rules
segregation_conflicts
access_review_campaigns
access_review_items
permission_usage_events
break_glass_sessions
```

## 22.2 Required assignment fields

```text
id
user_id
role_version_id
assignment_type
scope_type
scope_reference
valid_from
valid_until
status
reason
requested_by
approved_by
revoked_by
revoked_at
review_due_at
created_at
updated_at
```

## 22.3 Stable identifiers

Role and permission names used by code shall have stable identifiers.

Renaming the display label shall not break:

- API checks.
- audit records.
- workflow definitions.
- reports.
- historic assignments.

---

# 23. Technical architecture

## 23.1 Permission registry

The application shall maintain a central permission registry containing:

- Stable permission key.
- display name.
- description.
- module.
- feature.
- action.
- supported scopes.
- risk level.
- data classification.
- MFA requirement.
- SoD relationships.
- linked routes.
- linked endpoints.
- linked background jobs.

Unregistered permissions shall fail deployment validation.

---

## 23.2 Policy Decision Point

A central authorisation service shall calculate access decisions consistently.

Example interface:

```text
authorize(
    actor,
    permission,
    resource,
    context
) -> allow | deny + reason
```

The service shall return machine-readable denial reasons without exposing sensitive information to end users.

---

## 23.3 Policy Enforcement Points

Enforcement shall exist in:

- Web routes.
- mobile routes.
- API middleware.
- controllers.
- service classes.
- database query scopes.
- GraphQL resolvers where applicable.
- file downloads.
- export jobs.
- scheduled jobs.
- notification jobs.
- search indexing.
- websocket or live-update channels.
- administrative scripts.

---

## 23.4 Query-level filtering

The system shall never:

1. Load all records.
2. return them to the client.
3. rely on the interface to hide unauthorised rows.

Filtering must occur before data leaves the backend.

Pagination totals, counts and aggregates shall also be scoped.

---

## 23.5 Cache invalidation

Role changes, revocation and suspensions shall become effective immediately.

Permission caches shall be:

- User-specific.
- tenant/organisation aware.
- scope aware.
- invalidated on changes.
- short-lived.
- prohibited from mixing users.

Revoked users shall not retain access until a long cache expires.

---

# 24. Audit requirements

The following shall be audited:

- Role creation.
- role modification.
- role publishing.
- permission addition or removal.
- assignment request.
- assignment approval.
- assignment rejection.
- assignment expiry.
- delegation creation.
- delegation revocation.
- explicit denial.
- SoD conflict.
- emergency access.
- access simulation.
- sensitive role use.
- export.
- permission denial.
- workflow override.
- access review decision.

Each event shall record:

```text
actor
effective role
source of authority
target user
permission
scope
resource
before state
after state
reason
approver
session
device/IP reference
timestamp
correlation ID
result
```

Secrets and authentication credentials shall never be written to audit logs.

---

# 25. Security requirements

1. MFA shall be mandatory for privileged, HR, Finance, procurement, role-administration and highly restricted roles.
2. Privileged access shall require recent authentication for sensitive actions.
3. Role updates shall revoke or refresh affected sessions.
4. Service accounts shall have non-interactive, narrowly scoped permissions.
5. API tokens shall be linked to named owners and explicit permissions.
6. Shared accounts shall be prohibited.
7. Default passwords shall be prohibited.
8. Dormant privileged accounts shall be automatically suspended.
9. Permission denials shall not expose sensitive record existence.
10. Access-control configuration shall be included in backup and disaster-recovery testing.
11. Role and permission migrations shall be version-controlled.
12. Production role changes shall not depend on manual database edits.

---

# 26. Re-engineering and migration plan

## Phase 1: Complete inventory

Catalogue every:

- Module.
- feature.
- route.
- API.
- button.
- workflow action.
- dashboard widget.
- report.
- export.
- attachment type.
- notification.
- background job.
- administrative function.

No screen or endpoint may remain “implicitly accessible.”

---

## Phase 2: Permission registry

- Create the canonical permission list.
- Map every system surface to a permission.
- remove duplicate permissions.
- identify vague permissions such as `manage_all`.
- split overly broad permissions.
- define scopes and classifications.

---

## Phase 3: Role redesign

- Build approved role templates.
- map current users to proposed roles.
- identify excessive access.
- define SoD rules.
- define temporary and direct grants.
- obtain business-owner validation.

---

## Phase 4: Backend enforcement

- Implement central authorisation service.
- protect every API and route.
- add query scopes.
- protect attachments and exports.
- ensure workflow actions evaluate current assignment and state.
- enforce field-level restrictions.

Backend enforcement shall be completed before relying on the new menus.

---

## Phase 5: Navigation re-engineering

- Generate navigation from effective permissions.
- implement feature-only navigation.
- remove empty groups.
- filter dashboards and search.
- hide unauthorised actions.
- provide safe access-denied states.

---

## Phase 6: Administration and governance

- Build role catalogue.
- build role builder.
- build user access profile.
- build access requests.
- build delegation management.
- build SoD reporting.
- build periodic access review.
- build audit views.

---

## Phase 7: Migration and pilot

Pilot with representative users:

- Employee.
- Supervisor.
- HR.
- Finance.
- Programme.
- M&E.
- Procurement.
- SG Office.
- SG.
- Internal Auditor.
- ICT Administrator.
- feature-only committee member.

Compare actual visibility against the approved matrix.

---

## Phase 8: Production cutover

- Freeze legacy role changes.
- migrate validated assignments.
- revoke obsolete roles.
- force privileged session refresh.
- run automated negative-access tests.
- obtain module-owner sign-off.
- activate monitoring.
- retain a controlled rollback plan.

---

# 27. Testing requirements

## 27.1 Unit tests

Test:

- Permission resolution.
- scope resolution.
- expiry.
- denial precedence.
- delegation.
- role combinations.
- SoD conflicts.
- workflow-state restrictions.
- field filtering.

---

## 27.2 API tests

For every protected endpoint:

- Authorised user receives expected response.
- unauthorised user receives `403` or safe `404`.
- feature-only user cannot access module siblings.
- out-of-scope user cannot enumerate records.
- direct URL access is blocked.
- record IDs cannot be guessed to obtain access.
- export endpoints apply the same scope as screens.
- attachments cannot bypass parent access.

---

## 27.3 Interface tests

For each persona:

- Correct menu items appear.
- prohibited menu items do not appear.
- prohibited buttons do not appear.
- correct dashboard cards appear.
- correct feature-only links appear.
- search does not leak records.
- notification links respect access.
- breadcrumb links do not expose parent modules.
- mobile and desktop navigation behave consistently.

---

## 27.4 Negative-access tests

Negative tests are mandatory, not optional.

Examples:

- Employee attempts to approve own leave.
- Programme Officer attempts to change Finance PIF fields.
- Evaluation member opens an unrelated procurement.
- Registry Officer attempts to download a restricted correspondence attachment.
- ICT Administrator attempts to export salary advances.
- Finance Officer attempts to publish an RFQ without procurement authority.
- expired acting approver attempts to approve.
- user calls an API hidden from their menu.
- removed user opens an old notification link.
- supervisor queries records outside the reporting line.

---

## 27.5 Security testing

- Broken access-control testing.
- horizontal privilege escalation.
- vertical privilege escalation.
- insecure direct object reference testing.
- mass-assignment testing.
- export leakage testing.
- cache cross-user leakage testing.
- signed URL expiry testing.
- role-management abuse testing.
- session revocation testing.
- penetration testing before production release.

---

# 28. Acceptance criteria

The Roles and Permissions re-engineering shall be accepted only when all the following are proven.

## 28.1 Coverage

- 100% of modules are represented in the permission registry.
- 100% of routes are mapped to permissions.
- 100% of APIs are mapped to permissions.
- 100% of reports and exports are independently protected.
- 100% of attachment downloads re-check access.
- 100% of workflow actions validate current assignee and state.

## 28.2 Visibility

- Users see no unauthorised module.
- Users see no unauthorised menu item.
- Users see no unauthorised dashboard widget.
- Users see no unauthorised action.
- Users see no inaccessible report or export.
- Feature-only users see only the assigned feature.

## 28.3 Data access

- Users cannot retrieve unauthorised records through APIs.
- Users cannot infer restricted record counts.
- Users cannot access unauthorised attachments.
- Users cannot retrieve restricted fields through exports.
- Search and notifications disclose no unauthorised data.

## 28.4 Workflow

- No requester can approve their own request.
- Approval rights exist only while a record is assigned at the correct stage.
- Delegated authority expires automatically.
- Workflow reassignments require a reason and audit entry.
- Returned records re-enable only the appropriate editing permissions.

## 28.5 Administration

- Role versions are controlled.
- Every assignment has an owner and reason.
- High-risk roles require approval.
- Administrators cannot approve their own privileged access.
- Role changes take effect immediately.
- Revocations terminate affected sessions.
- Expired access is removed automatically.

## 28.6 Audit

- All role and permission changes are auditable.
- Sensitive permission use is auditable.
- Audit records cannot be edited or deleted through the application.
- Audit access is itself recorded.
- Export events identify user, scope and reason.

## 28.7 Verification evidence

The delivery team shall provide:

- Complete route-to-permission matrix.
- API-to-permission matrix.
- role-to-permission matrix.
- user persona test matrix.
- SoD conflict matrix.
- automated test results.
- screenshots for each persona.
- audit-event samples.
- penetration-test results.
- business-owner sign-off for every module.

A screen existing in the system shall not be treated as proof of completion. Completion requires working backend enforcement, correct data scoping, audit evidence and successful negative testing.

---

# 29. Success metrics

| Metric | Required outcome |
|---|---|
| Unregistered protected routes | 0 |
| Unauthorised menu items in persona tests | 0 |
| Unauthorised API requests returning data | 0 |
| Feature-only grants exposing sibling features | 0 |
| Sensitive actions without audit events | 0 |
| Privileged users without MFA | 0 |
| Expired temporary assignments remaining active | 0 |
| Users approving own requests | 0 |
| Orphan permissions | 0 |
| Role changes requiring manual database changes | 0 |
| Permission changes effective | Immediate or within 60 seconds |
| High-risk access reviews completed | 100% |
| Modules with signed access matrix | 100% |

---

# 30. Required implementation artefacts

The implementation team shall produce:

1. Full feature and route inventory.
2. Canonical permission registry.
3. Permission naming dictionary.
4. Role catalogue.
5. Role-to-permission matrix.
6. User-to-role migration matrix.
7. Scope model.
8. Field-access matrix.
9. Segregation-of-duties matrix.
10. Workflow-role matrix.
11. Menu and route visibility matrix.
12. API enforcement matrix.
13. Report and export access matrix.
14. Attachment access matrix.
15. Delegation and acting-authority specification.
16. Audit-event catalogue.
17. Automated test pack.
18. Production migration plan.
19. Access-review procedure.
20. Module-owner sign-off pack.

---

# 31. Final product rule

The governing rule for Nexus shall be:

> A user’s organisational position may suggest what access they need, but only an active, approved, scoped and auditable permission shall grant access.

And:

> A user who needs one feature shall receive one feature—not the whole module.

The strongest implementation will therefore avoid building a collection of broad titles such as “Finance,” “Admin” or “Manager” and treating them as unrestricted powers. Roles should be convenient permission bundles; the actual security boundary must remain the individual capability, record scope, workflow relationship, data classification and time period.
</user_query>