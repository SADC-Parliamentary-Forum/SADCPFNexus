# SADC PF Nexus

# Sequential Approval Workflow & Approval Orchestration Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Sequential Approval Workflow & Approval Orchestration
**Short name:** Workflow Engine
**Document status:** Updated implementation PRD
**Module type:** Shared institutional workflow, approval, authority-validation and decision-orchestration platform

The next module is **Sequential Approval Workflow & Approval Orchestration**.

SADC PF forms demonstrate that approval is not one generic action. Leave requires a Head of Department recommendation, Administration certification and final authorisation by the Head of Institution.  Travel separates Administration itinerary preparation, Finance calculation, Director Finance confirmation of funds and logistics, and Secretary General approval.   The PIF separately captures requesting officer, activity authorisation, Finance confirmation, Director Finance authorisation and Secretary General approval. 

The Accounting Manual requires organisational authority to be clearly defined, financial transactions to be approved at the appropriate level and duties to be separated so that a single officer does not process a transaction from beginning to end. 

The Workflow Engine must therefore preserve the meaning of each stage instead of reducing all decisions to a generic `Approved` button.

---

# 1. Executive Summary

The Workflow Engine will provide one shared, secure and configurable approval platform for every Nexus business module.

It will manage:

* submission;
* sequential approval;
* parallel review;
* conditional routing;
* recommendations;
* certifications;
* verifications;
* authorisations;
* final approvals;
* signatures;
* acknowledgements;
* returns for correction;
* resubmissions;
* rejections;
* withdrawals;
* cancellations;
* delegations;
* acting appointments;
* recusals;
* escalations;
* reminders;
* authority checks;
* segregation-of-duties checks;
* document-version locking;
* complete workflow history.

The engine must answer:

* What process is this record following?
* Which workflow version applies?
* What stage is currently active?
* Who currently holds the action?
* Why was that person selected?
* What authority do they have?
* Is the authority still valid?
* Are they acting or delegated?
* What action must they perform?
* What is the next stage?
* What conditions determine the next stage?
* What happens if they reject or return the request?
* Has the record changed since a prior approval?
* Which document version was approved or signed?
* Is the request overdue?
* Who has been notified or escalated?
* Is self-approval or a segregation conflict present?
* What is the complete decision history?

---

# 2. Core Product Principle

The Workflow Engine must operate according to:

> **Record Prepared → Validated → Submitted → Routed → Reviewed → Recommended → Certified → Authorised → Approved → Signed → Released → Completed**

Not every workflow uses every step.

The engine must preserve the distinct meaning of:

* review;
* recommendation;
* certification;
* authorisation;
* approval;
* signature;
* release.

The governing architecture rule is:

> Business modules own their records and business rules. The Workflow Engine owns the progression, routing, authority validation and decision history.

---

# 3. Product Boundary

## 3.1 Workflow Engine owns

* workflow definitions;
* definition versions;
* workflow instances;
* stages;
* approval tasks;
* actor resolution;
* decisions;
* routing;
* escalation;
* delegation application;
* authority validation;
* workflow history;
* stage deadlines;
* workflow notifications;
* workflow completion events.

## 3.2 Business modules own

* form data;
* calculations;
* business validations;
* module-specific statuses;
* attachments;
* financial or HR consequences;
* post-approval implementation.

Examples:

* Leave owns leave balances.
* Travel owns itinerary and DSA.
* Procurement owns procurement methods and awards.
* Budget owns commitments.
* PIF owns activity planning.
* Risk owns risk acceptance.
* Audit owns audit findings.

## 3.3 People & Authority owns

* users;
* positions;
* reporting lines;
* roles;
* approval authority;
* acting appointments;
* delegations;
* signature authority.

## 3.4 Document Service owns

* files;
* document versions;
* hashes;
* previews;
* signatures;
* immutable final documents.

## 3.5 Notification Service owns

* email delivery;
* in-app notifications;
* mobile push;
* delivery status;
* retries and preferences.

---

# 4. Existing Implementation Consideration

The current PIF implementation already contains workflow, notification, delegation, attachment, approval and audit machinery. 

The new module should therefore:

1. audit the existing implementation;
2. identify reusable components;
3. migrate them into the shared workflow platform;
4. retain current working PIF behaviour;
5. prevent module-specific workflow forks;
6. avoid replacing working functions with temporary implementations.

The migration must be regression-tested against existing PIF submission, approval, delegation, notifications and audit logs. 

---

# 5. Business Objectives

The module must:

1. Standardise approval behaviour across Nexus.
2. Preserve module-specific approval chains.
3. enforce organisational hierarchy.
4. validate approval authority server-side.
5. support sequential and parallel stages.
6. support conditional workflow paths.
7. prevent self-approval.
8. enforce segregation of duties.
9. support formal delegation and acting appointments.
10. preserve record and document versions.
11. make the current holder visible.
12. provide reliable reminders and escalation.
13. prevent skipped approval stages.
14. support controlled workflow changes.
15. create a complete institutional decision record.
16. prevent business modules from implementing inconsistent approval engines.
17. support email and web actions without requiring a personal mobile application.
18. remain extensible to new Nexus modules.

---

# 6. Workflow Concepts

The engine must distinguish the following concepts.

## 6.1 Workflow Definition

The reusable description of a process.

Example:

**Leave Application Workflow**

## 6.2 Workflow Definition Version

The effective-dated version of that process.

Example:

**Leave Workflow v3 — effective 1 August 2026**

## 6.3 Workflow Instance

The process running for one specific record.

Example:

**Leave Application LEV/2026/0041**

## 6.4 Stage

A defined point in the process.

Example:

**Administration Certification**

## 6.5 Approval Task

The actionable item assigned to a named user or authorised queue.

## 6.6 Actor Selector

The rule used to determine who should act.

Examples:

* applicant’s supervisor;
* Head of Department;
* Director Finance;
* Secretary General;
* Project Accountant;
* position holder;
* committee;
* authorised user with value threshold.

## 6.7 Decision

The action taken by the assigned actor.

## 6.8 Transition

The movement from one stage to another.

## 6.9 Condition

A rule determining whether a stage applies or which path follows.

---

# 7. Supported Workflow Patterns

The engine must support:

## 7.1 Sequential Workflow

A → B → C → D

Example:

Applicant → HOD → HR → SG

## 7.2 Parallel Workflow

Several actions occur at the same time.

Example:

Finance Review + Administration Logistics Review

## 7.3 Parallel-All

All assigned actors must complete before proceeding.

## 7.4 Parallel-Any

One authorised actor may complete the stage.

## 7.5 Quorum Approval

A defined number or percentage of actors must approve.

## 7.6 Conditional Workflow

The route changes based on record values.

Example:

Procurement amount determines approval authority.

## 7.7 Hybrid Workflow

Sequential and parallel stages are combined.

## 7.8 Repeating Workflow

A stage may repeat after amendment or periodic review.

## 7.9 Sub-Workflow

A main workflow may invoke another controlled process.

Example:

Procurement approval invokes budget confirmation.

---

# 8. Stage Types and Meanings

## 8.1 Prepare

Creates or completes the record.

Does not confer approval.

## 8.2 Submit

Formally sends the record into workflow.

The submitter confirms completeness and declarations.

## 8.3 Review

Examines correctness, completeness or suitability.

A review does not necessarily authorise expenditure.

## 8.4 Recommend

Expresses support or non-support to the next authority.

A recommendation is not final approval.

## 8.5 Verify

Confirms that evidence, facts or an action can be validated.

## 8.6 Certify

Confirms compliance with a defined specialist requirement.

Examples:

* leave balance;
* budget availability;
* payroll eligibility;
* procurement compliance.

## 8.7 Authorise

Grants authority for a specified action, commitment or expenditure.

## 8.8 Approve

Provides the final institutional decision within the workflow scope.

## 8.9 Sign

Binds an authorised signer to an exact document version.

## 8.10 Release

Permits the approved output to proceed to implementation, payment, booking, dispatch or publication.

## 8.11 Acknowledge

Confirms receipt or awareness.

## 8.12 Information Only

Provides visibility without requiring a decision.

---

# 9. Decision Types

Configurable stage decisions include:

* Submit
* Recommend
* Do Not Recommend
* Verify
* Verification Failed
* Certify
* Certification Failed
* Authorise
* Decline Authorisation
* Approve
* Reject
* Return for Correction
* Request Clarification
* Acknowledge
* Sign
* Refuse to Sign
* Release
* Hold
* Recuse
* Escalate
* Withdraw
* Cancel
* Abstain, where committee rules permit
* Record No Objection
* Other controlled decision

Every decision type must have explicit transition behaviour.

---

# 10. Generic Workflow Statuses

Nexus-wide workflow statuses:

* Draft
* Submitted
* Pending Review
* Pending Recommendation
* Pending Verification
* Pending Certification
* Pending Authorisation
* Pending Approval
* Pending Signature
* Pending Release
* Returned for Correction
* Resubmitted
* On Hold
* Escalated
* Approved
* Rejected
* Withdrawn
* Cancelled
* Completed
* Closed
* Superseded
* Archived

Modules may display friendlier labels but must map them to shared workflow states.

---

# 11. Current Holder Requirement

Every workflow-enabled record must display:

* Current workflow stage
* Current holder
* Current holder position
* Current holder department
* Date assigned
* Time in stage
* Due date
* Days remaining or overdue
* Required action
* Next stage
* Previous stage
* Escalation status
* Delegated/acting indicator
* Full workflow history

`Submitted` alone is not an adequate user-facing status.

---

# 12. Workflow Tracker

Recommended tracker:

1. Submitted by Applicant — Completed
2. HOD Recommendation — Completed
3. Finance Certification — Currently with Project Accountant
4. Director Finance Authorisation — Pending
5. Secretary General Approval — Pending
6. Final Signature — Pending

Each completed stage shows:

* person;
* position;
* decision;
* date/time;
* comments;
* delegation;
* authority;
* document version.

---

# 13. Workflow Definition

A definition must include:

* Definition ID
* Name
* Module
* Record type
* Description
* Trigger
* Version
* Effective dates
* Applicability conditions
* Stages
* Transitions
* actor selectors
* authority rules
* deadlines
* reminders
* escalation
* return behaviour
* rejection behaviour
* cancellation behaviour
* document requirements
* signature requirements
* completion event
* policy source
* approval of workflow configuration
* status

---

# 14. Definition Statuses

* Draft
* Under Review
* Approved Future
* Active
* Suspended
* Superseded
* Retired
* Archived

Only approved active definitions may start production workflows.

---

# 15. Workflow Versioning

Workflow changes must create a new definition version.

Examples:

* approver changed;
* new Finance stage introduced;
* authority threshold changed;
* SLA changed;
* signature requirement changed;
* conditional branch added.

The system must never silently rewrite the workflow definition that governed a historical approval.

---

# 16. In-Flight Workflow Rule

When a new workflow version becomes active:

* new submissions use the new version;
* existing instances continue under their original version by default;
* migration to the new version requires a controlled action;
* migration must explain stage mapping and impact;
* completed decisions remain immutable.

Do not automatically insert or remove approval stages from active requests.

---

# 17. Workflow Configuration Approval

Workflow definitions must not be changed directly in production by a developer or ordinary System Administrator.

Recommended process:

1. Change proposed.
2. Business owner reviews.
3. Policy/Finance/HR review where relevant.
4. Security/segregation review.
5. authorised authority approves.
6. future effective date assigned.
7. configuration published.
8. audit event created.

---

# 18. Actor Resolution

Actor selectors should support:

* Named person
* Position holder
* Applicant’s supervisor
* Applicant’s Head of Department
* Department Director
* Finance Officer
* Project Accountant
* Director Finance
* HR/Admin Officer
* Secretary General
* Record owner
* Budget owner
* Project manager
* Committee
* Role within scope
* Authority holder
* Delegated/acting officer
* Custom approved selector

Position and authority are preferable to hard-coded person names.

---

# 19. Actor Resolution Timing

Recommended hybrid model:

## At submission

The engine creates a workflow plan containing:

* required stages;
* selector rules;
* known applicability conditions;
* workflow version.

## At stage activation

The engine resolves the current authorised actor using:

* organisational structure;
* active position assignment;
* acting appointment;
* delegation;
* authority scope;
* current date;
* record context.

## At decision time

The engine revalidates:

* actor identity;
* active account;
* role permission;
* authority;
* scope;
* threshold;
* self-approval rules;
* delegation validity.

Once assigned, the stage holder remains snapshotted unless formally rerouted.

---

# 20. Actor Resolution Snapshot

Each stage must store:

* selector used;
* selected person;
* selected position;
* department;
* role;
* authority record;
* delegation or acting appointment;
* resolution date/time;
* resolution reason;
* candidate users considered;
* fallback rule used.

This is essential for audit and troubleshooting.

---

# 21. Missing Actor Handling

If no eligible actor can be resolved:

Status:

**Workflow Routing Exception**

The engine must:

1. stop progression;
2. avoid routing to a random administrator;
3. notify workflow administrator and business owner;
4. show the unresolved selector;
5. allow controlled reassignment;
6. preserve the exception history.

---

# 22. Multiple Eligible Actors

Where several users match:

Options must be configured:

* assign to primary position holder;
* create queue claim;
* assign by workload;
* assign by project;
* allow any authorised actor;
* require administrator selection;
* use deterministic fallback.

The engine must not select unpredictably.

---

# 23. Approval Queues

Queues may be used for operational stages such as:

* Finance Review Queue
* HR Certification Queue
* Registry Queue
* Stores Queue

A queue task must be claimed by a named user before decision.

Audit records:

* queue;
* claimed by;
* claim time;
* decision actor.

Final institutional approvals should normally resolve directly to a named authority holder.

---

# 24. Hierarchy Routing

The People & Authority Module provides:

* supervisor;
* HOD;
* Director;
* SG;
* acting positions;
* delegation.

Workflow must consume that structure rather than maintain separate supervisor fields.

The Administrative Rules require processes and communication to respect the organisational hierarchy. 

---

# 25. Authority Validation

Before permitting a decision, the engine calls the shared Authority Check Service using:

* actor;
* decision action;
* module;
* record type;
* stage;
* department;
* project;
* amount;
* currency;
* risk rating;
* confidentiality;
* requester;
* date/time;
* delegation;
* acting appointment.

A visible button is not proof of authority.

---

# 26. Amount-Based Authority

Conditional approval routes may depend on:

* amount;
* currency;
* procurement method;
* budget line;
* source of funds;
* donor requirements.

The engine must use:

* original amount and currency;
* base/reporting amount where required;
* approved exchange-rate method;
* applicable authority-policy version.

Never perform threshold checks using uncontrolled frontend conversion.

---

# 27. Authority Changes During Workflow

If an actor loses authority before acting:

* the pending task is invalidated or rerouted;
* the original assignment history is preserved;
* a new eligible actor is resolved;
* affected users are notified.

If authority changes after a valid completed approval:

* the historical approval remains valid;
* the authority snapshot remains attached.

---

# 28. Self-Approval Prevention

The engine must prevent a user from approving their own request where separation is required.

Self-approval checks include:

* applicant equals approver;
* preparer equals final approver;
* beneficiary equals approver;
* supplier creator equals award approver;
* adjustment initiator equals adjustment approver;
* action owner equals independent verifier.

A delegation must not bypass self-approval restrictions.

---

# 29. Segregation of Duties

The Accounting Manual requires no single officer to execute a transaction from beginning to conclusion and requires independent checks during processing. 

The engine must therefore support incompatible-stage rules.

Example:

* requester cannot final approve;
* Finance preparer cannot be sole Finance authoriser;
* Procurement evaluator cannot approve award where prohibited;
* Asset Disposal requester cannot complete disposal alone;
* Audit Action Owner cannot verify their own corrective action.

---

# 30. Segregation Conflict Handling

Possible outcomes:

* hard block;
* reroute;
* require secondary approver;
* require compensating control;
* create exception request;
* escalate to authorised authority.

Every override requires:

* reason;
* authority;
* duration/scope;
* compensating control;
* audit record.

---

# 31. Conflict of Interest

A stage may require a conflict declaration before action.

Declaration:

* No conflict
* Potential conflict declared
* Actual conflict declared
* Unsure — review required

Where conflict exists:

* user may recuse;
* task reroutes;
* declaration is retained;
* substitute is selected;
* relevant officer is notified.

A conflict declaration must not be overwritable by another user.

---

# 32. Recusal

Recusal fields:

* actor;
* stage;
* reason;
* conflict classification;
* date;
* supporting note;
* replacement actor;
* decision authority where required.

Recusal is not a rejection of the business request.

---

# 33. Delegation

Workflow uses formal delegation from People & Authority.

The engine must verify:

* principal;
* delegate;
* action scope;
* module;
* record type;
* amount limit;
* start/end;
* exclusions;
* principal authority;
* self-approval restrictions.

Delegated decision display:

> Approved by Jane Doe on behalf of Director Programmes under delegation DLG/2026/0042.

---

# 34. Acting Appointment

An acting position may become the stage actor where the appointment covers that authority.

The engine must apply:

* effective dates;
* authority restrictions;
* excluded executive powers;
* value limits;
* module scope.

An Acting Secretary General must not automatically receive every SG authority where the Administrative Rules restrict executive powers. 

---

# 35. No Credential Sharing

An assistant or delegate must use their own account.

The system must never provide:

* shared approver passwords;
* shared MFA;
* another user’s signature;
* impersonation login.

Preparation and submission on behalf are recorded through formal delegation.

---

# 36. Conditional Routing

Conditions may depend on:

* amount;
* funding source;
* donor;
* employee category;
* leave type;
* travel method;
* vehicle use;
* procurement method;
* capital/operational classification;
* risk rating;
* confidentiality;
* project;
* country;
* contract type;
* conflict declaration;
* attachment presence;
* policy exception.

---

# 37. Condition Engine

Conditions must be:

* declarative;
* versioned;
* testable;
* auditable;
* validated before activation.

Example:

```text
IF travel.vehicle_type = "private"
THEN require Administration Vehicle Review
```

Example:

```text
IF procurement.total_value > authority_limit
THEN route to next approval authority
```

Business users should configure approved conditions without editing source code.

---

# 38. Condition Evaluation Snapshot

For every conditional route, preserve:

* condition;
* source values;
* result;
* policy version;
* evaluation time;
* branch selected.

This explains why a stage was included or skipped.

---

# 39. Stage Applicability

A stage may be:

* Required
* Conditionally Required
* Not Applicable
* Waived through authorised exception
* Completed externally with evidence

The workflow history must distinguish `Not Applicable` from `Skipped`.

---

# 40. Stage Skipping

Ordinary users cannot skip stages.

A stage may only be bypassed through:

* definition condition;
* authorised workflow exception;
* migration;
* formally documented external approval.

The system records:

* stage;
* reason;
* authority;
* evidence;
* date.

---

# 41. Parallel Stages

For parallel approval:

* each task has an independent owner;
* each decision is separately recorded;
* completion rule is configured;
* one actor cannot satisfy multiple independent roles where segregation applies.

Completion rules:

* all approved;
* quorum achieved;
* any one approved;
* lead decision plus supporting reviews;
* no objections by deadline.

---

# 42. Committee and Governance Decisions

Where approval belongs to a committee or governance body, the engine should support:

* meeting reference;
* body;
* members present;
* quorum;
* decision;
* resolution reference;
* voting result where relevant;
* chair confirmation;
* signed minutes/extract.

Do not create a false impression that one staff user personally made the committee decision.

---

# 43. Committee Actor Model

The assigned Nexus user may act as:

* committee secretary;
* decision recorder;
* chair;
* authorised resolution certifier.

The decision record must identify:

**Decision authority:** Finance Sub-Committee
**Recorded by:** Governance Secretariat Officer

---

# 44. Submission

Submission must:

1. validate module business rules;
2. validate mandatory attachments;
3. capture declarations;
4. determine workflow definition/version;
5. create approval package snapshot;
6. calculate applicable stages;
7. create workflow instance;
8. assign first task;
9. lock protected fields;
10. notify the actor;
11. record submission event.

---

# 45. Approval Package

Every submission must have an approval package containing:

* record ID;
* record version;
* business-data snapshot;
* critical calculated values;
* attachment list;
* attachment versions/hashes;
* declarations;
* applicant;
* preparer;
* submission date;
* workflow version.

Approvers must know exactly what they are deciding on.

---

# 46. Record Locking

After submission:

* protected business fields become read-only;
* authorised return permits correction;
* changes create a new record version;
* resubmission creates a new approval package;
* prior decisions remain linked to the version they reviewed.

Do not allow an applicant to change an amount or itinerary while approval continues unnoticed.

---

# 47. Material vs Non-Material Changes

Configuration may distinguish:

### Material change

Requires reapproval.

Examples:

* amount;
* funding source;
* traveller;
* dates;
* supplier;
* procurement method;
* leave dates;
* risk rating;
* contract terms.

### Non-material administrative correction

May be corrected by authorised officer without full restart.

Examples:

* typo;
* formatting;
* non-substantive contact detail.

Every correction is audited.

---

# 48. Change Impact Analysis

When a submitted record changes, the engine must determine:

* which completed stages are invalidated;
* whether workflow restarts;
* whether it returns to a specific stage;
* whether only downstream stages repeat;
* whether signatures become invalid;
* whether commitments or linked records are affected.

The rule must be defined per workflow.

---

# 49. Return for Correction

The approver must specify:

* fields/sections requiring correction;
* reason;
* required evidence;
* return destination;
* resubmission deadline;
* whether prior approvals remain valid.

Status becomes:

**Returned for Correction**

The original submission remains immutable.

---

# 50. Resubmission

On resubmission:

* new record version created;
* changed fields highlighted;
* prior version remains accessible;
* applicant reconfirms declaration;
* workflow resumes according to definition;
* invalidated stages repeat;
* current actor is notified.

Approvers should see a version comparison.

---

# 51. Request Clarification

Clarification differs from return.

### Clarification

* record stays in current stage;
* approver asks a question;
* applicant/respondent provides information;
* no business fields necessarily change.

### Return

* workflow moves back;
* applicant edits the record;
* resubmission is required.

---

# 52. Rejection

Rejection must capture:

* decision;
* reason;
* policy basis where applicable;
* rejecting authority;
* record version;
* date/time;
* whether appeal/reconsideration is possible.

Rejected records are not deleted.

---

# 53. Withdrawal

The applicant may withdraw where allowed.

Rules depend on stage:

* before approval: generally permitted;
* after commitments/bookings: may require approval;
* after payment or release: not a simple withdrawal;
* after final approval: cancellation/amendment workflow may be required.

Withdrawal must not silently reverse external consequences.

---

# 54. Cancellation

Cancellation is an authorised institutional action.

It must capture:

* reason;
* effective date;
* authority;
* linked consequences;
* commitment release;
* booking cancellation;
* accounting impact;
* notification.

The business module executes the relevant reversal actions.

---

# 55. Recall

A submitter may request recall before the next actor acts, where policy permits.

Recall should:

* verify no decision has occurred;
* cancel current task;
* return to Draft;
* preserve submission history.

Recall after an approval requires a controlled return or amendment process.

---

# 56. Hold

An authorised actor may place a workflow on hold.

Fields:

* reason;
* holder;
* expected resolution;
* review date;
* impact;
* notification.

A hold pauses applicable SLA calculations where configured.

---

# 57. Workflow Exceptions

Exception types:

* Missing approver
* Emergency processing
* Policy exception
* Segregation conflict
* Technical outage
* External approval
* Authority unavailable
* Deadline override
* Supporting document exception
* Other

Exceptions must never be invisible shortcuts.

---

# 58. Emergency Approval

Emergency workflows may support:

* shortened routing;
* urgent alternate actor;
* retrospective supporting documents;
* enhanced notification;
* mandatory post-event review.

Emergency processing still requires:

* documented reason;
* competent authority;
* authority validation;
* audit history;
* later compliance review.

---

# 59. External Approval

Where approval occurs outside Nexus:

* approval body/person;
* date;
* decision;
* reference;
* signed evidence;
* entered by;
* verified by;
* authority basis.

The system records that it was an external decision, not a Nexus click.

---

# 60. Stage Deadlines

Each stage may have:

* assignment deadline;
* acknowledgement deadline;
* decision deadline;
* escalation schedule;
* working-day calendar;
* pause rules;
* priority-based variation.

Deadlines may derive from:

* fixed duration;
* record date;
* activity date;
* policy deadline;
* next meeting;
* payroll cutoff.

---

# 61. Working-Day Calculations

The engine must use:

* institutional work calendar;
* duty-station holidays;
* weekends;
* emergency schedules;
* approved calendar exceptions.

The definition must specify whether the deadline uses:

* calendar days;
* working days;
* exact hours.

---

# 62. Reminders

Configurable reminders:

* on assignment;
* after no acknowledgement;
* 7 days before due;
* 3 days;
* 1 day;
* due day;
* overdue;
* recurring overdue reminder.

Priority and workflow type may alter the schedule.

---

# 63. Escalation

Escalation may notify:

* current actor;
* supervisor;
* HOD;
* Director;
* SG Office;
* workflow business owner;
* administrator.

Escalation does not automatically transfer authority unless explicitly configured.

---

# 64. Escalation vs Rerouting

### Escalation

Notifies a higher authority but retains the current holder.

### Rerouting

Changes the responsible actor.

The engine must distinguish these actions.

---

# 65. User Absence

When the assigned actor is on approved leave or unavailable:

Options:

* apply valid delegation;
* use acting appointment;
* route to approved fallback;
* retain until return;
* escalate for manual decision.

The engine must not route high-risk approval to an unauthorised substitute merely to meet an SLA.

---

# 66. Workflow Reassignment

Controlled reassignment captures:

* previous actor;
* new actor;
* reason;
* authority;
* stage;
* outstanding time;
* delegation/acting basis;
* reassignment date.

The previous actor’s task is closed as reassigned, not deleted.

---

# 67. Notification Channels

Workflow notifications must support:

* in-app;
* email;
* optional mobile push.

Email must contain:

* workflow reference;
* high-level action;
* due date;
* secure Nexus link.

Confidential information must not appear in subject lines.

---

# 68. Action from Email

Where secure email action is introduced:

* user must authenticate;
* authority must be revalidated;
* one-click unauthenticated approval is prohibited;
* exact record/document version must be displayed;
* MFA may be required for high-risk actions.

Email should primarily direct users into the secure Nexus interface.

---

# 69. Approval Inbox

Main Menu → **My Approvals**

Views:

* Awaiting My Action
* Due Soon
* Overdue
* Clarifications
* Delegated to Me
* Acting Capacity
* Returned by Me
* Completed Decisions
* Watching
* Queue Tasks

Filters:

* module;
* action type;
* priority;
* department;
* amount;
* due date;
* confidentiality.

---

# 70. Approval Task Card

Each task shows:

* Record type
* Reference
* Request title
* Applicant
* Department
* Amount/currency where relevant
* Current action required
* Date submitted
* Time in stage
* Due date
* Previous decisions
* Delegation/acting indicator
* Conflict declaration
* Key warnings

---

# 71. Approval Detail View

The approver must see:

* full request;
* source documents;
* business-rule checks;
* budget/funding information;
* prior decisions;
* comments;
* approval-package version;
* changed-field comparison after resubmission;
* authority to be used;
* available actions.

Do not require approvers to approve from a summary without access to underlying evidence.

---

# 72. Approval Comments

Comment rules may be configured:

* optional on approval;
* mandatory on rejection;
* mandatory on return;
* mandatory on exception;
* mandatory where recommendation is negative;
* mandatory for authority override.

Comments should be visible according to confidentiality and workflow rules.

---

# 73. Internal Notes

Internal approval notes may be:

* stage team only;
* Finance only;
* HR only;
* Management only;
* auditor-visible;
* excluded from applicant view.

The interface must clearly distinguish:

* applicant-visible comments;
* restricted internal notes.

---

# 74. Bulk Approval

Bulk approval is high risk.

It may only be enabled for:

* low-risk;
* homogeneous;
* individually validated records.

Bulk action must still:

* display each record;
* authority-check each record;
* create one decision per record;
* reject partial failures clearly;
* require explicit confirmation.

Bulk approval must not be available for contracts, high-value procurement, risk acceptance or sensitive HR matters by default.

---

# 75. Digital Signatures

Where a stage requires signing:

1. all prior required stages complete;
2. final document generated;
3. document hash calculated;
4. signer authority checked;
5. signer reviews exact version;
6. step-up authentication performed;
7. signature applied;
8. signed version locked;
9. stage decision recorded.

A workflow approval must not automatically apply a visible signature unless the workflow explicitly requires signing.

---

# 76. Approval vs Signature

These actions are different:

### Approve

Records a business decision.

### Sign

Applies an authenticated signature to a document.

A workflow may require:

* approval only;
* signature only after approval;
* combined approval and signing action.

The configured meaning must be explicit.

---

# 77. Signature Invalidated by Change

If the signed document changes:

* previous signature remains attached to prior version;
* new document requires new approval/signature;
* current record shows signature no longer applies to revised version.

---

# 78. Module Integration: Leave

Default workflow example:

1. Applicant submits.
2. HOD recommends or does not recommend.
3. HR/Admin certifies entitlement and balance.
4. Head of Institution/SG authorises.
5. Leave ledger updates.
6. Notifications issued.

This reflects the structure of FORM-005. 

---

# 79. Module Integration: Travel

Default workflow example:

1. Traveller submits.
2. Supervisor/HOD recommends.
3. Administration completes logistics/itinerary.
4. Finance calculates DSA.
5. Director Finance confirms funds and logistics.
6. SG approves.
7. approved document signed.
8. booking/implementation released.

The official form and policy distinguish recommendation, Finance confirmation and final SG approval.  

---

# 80. Module Integration: PIF

Default workflow example:

1. Programme/Requesting Officer submits.
2. Activity authorised by responsible programme authority.
3. Project Accountant/Finance confirms budget line and availability.
4. Director Finance authorises funds, procurement and rates.
5. Secretary General approves.
6. final PIF locked.
7. Procurement, Travel and M&E hand-offs enabled.

This follows the PIF signatory structure. 

---

# 81. Module Integration: Salary Advance

Default workflow example:

1. Employee submits.
2. Supervisor recommends where configured.
3. Finance verifies salary, existing balance and 50% cap.
4. Director Finance certifies recovery readiness.
5. SG approves.
6. payroll recovery instruction generated.

The workflow must not allow approval to bypass Finance validation.

---

# 82. Module Integration: Procurement

Procurement workflows may include:

* request approval;
* budget certification;
* method approval;
* specification approval;
* solicitation release;
* evaluation declaration;
* evaluation approval;
* award approval;
* PO/contract approval;
* delivery acceptance;
* variation approval;
* closure.

Conditional routes must follow value, method and policy.

---

# 83. Module Integration: Correspondence

Outgoing official correspondence may require:

* drafter;
* HOD/Director review;
* Legal review where relevant;
* SG approval;
* reference assignment;
* signature;
* dispatch release.

Correspondence owns the final dispatch record.

---

# 84. Module Integration: Risk

Risk workflows may include:

* proposal review;
* risk registration;
* assessment review;
* treatment approval;
* risk acceptance;
* risk closure.

Critical/high risk acceptance must route to the proper authority and cannot be self-approved by the Risk Owner.

---

# 85. Module Integration: Audit

Audit workflows may include:

* audit-plan review;
* engagement approval;
* finding issuance;
* management response;
* final report review;
* corrective-action verification;
* finding closure.

Internal Audit independence and Management ownership must remain enforced.

---

# 86. Module Integration: Assets and Stock

Examples:

* asset transfer;
* maintenance approval;
* stock adjustment;
* stock write-off;
* disposal;
* valuation;
* stocktake discrepancy.

The workflow engine must enforce initiator/approver separation.

---

# 87. Downstream Release Events

Final workflow completion may emit events such as:

* `LeaveApproved`
* `TravelApproved`
* `ProgrammeApproved`
* `ProcurementAwardApproved`
* `CorrespondenceSigned`
* `BudgetTransferApproved`
* `RiskAccepted`
* `AuditFindingClosed`

Business modules consume these events idempotently.

Workflow must not directly manipulate every module’s specialised ledger.

---

# 88. Post-Approval Failure

If a downstream action fails after approval:

Example:

Travel approved, but commitment creation fails.

The workflow remains approved, but implementation status becomes:

**Approved — Release Failed**

The system must:

* record failure;
* retry safely;
* alert responsible team;
* prevent duplicate side effects;
* preserve approval decision.

---

# 89. Workflow Completion

Completion criteria may include:

* all required stages complete;
* all required signatures complete;
* no unresolved rejection/return;
* completion condition passed;
* downstream release initiated.

Workflow completion is separate from business-process closure.

Example:

Travel workflow completed when approved.

Travel record closes only after travel retirement.

---

# 90. Workflow History

History must include:

* workflow created;
* version selected;
* stage activated;
* actor resolved;
* task assigned;
* viewed/acknowledged;
* clarification requested;
* comments;
* decision;
* authority used;
* delegation;
* return;
* resubmission;
* reassignment;
* escalation;
* exception;
* signature;
* completion;
* cancellation.

History is immutable to ordinary users.

---

# 91. Approval Certificate

Nexus should generate an approval certificate or embedded approval page containing:

* record reference;
* workflow definition/version;
* submitted version;
* stage;
* decision;
* actor;
* position;
* authority;
* delegation;
* timestamp;
* comments;
* document hash;
* verification reference.

This supports external review and audit.

---

# 92. Dashboards

## 92.1 Employee Dashboard

* My submitted requests
* Current stage
* Current holder
* Returned requests
* Approved/rejected
* Actions required from me

## 92.2 Approver Dashboard

* Awaiting action
* Due soon
* Overdue
* Delegated actions
* Acting-authority actions
* Clarifications
* Completed decisions

## 92.3 Management Dashboard

* Pending final approvals
* High-value requests
* Critical overdue workflows
* Requests by department
* Average cycle time
* Rejection/return rates
* authority exceptions

## 92.4 Workflow Administration Dashboard

* Routing exceptions
* Missing actors
* Failed notifications
* Failed downstream events
* definition changes
* stuck instances
* expired delegations affecting workflows

---

# 93. Reports

Required reports:

* Workflow Instance Register
* Pending Approval Report
* Current Holder Report
* Approval Ageing Report
* Overdue Approvals
* Approval Cycle-Time Report
* Returned Requests
* Rejected Requests
* Withdrawn/Cancelled Requests
* Decisions by Stage
* Decisions by Authority
* Delegated Decisions
* Acting-Capacity Decisions
* Workflow Exceptions
* Segregation Conflicts
* Self-Approval Attempts
* Stage SLA Performance
* Workflow Definition Register
* Workflow Version History
* Authority Validation Failures
* Failed Release Events
* Approval Audit Report

---

# 94. Workflow Analytics

Appropriate analytics:

* average time by stage;
* median approval time;
* bottleneck stages;
* overdue rates;
* return reasons;
* rejection reasons;
* rerouting frequency;
* delegation usage;
* exception frequency;
* downstream release failures.

Analytics must not become simplistic employee-performance scoring.

---

# 95. Workflow Definition Data Model

Recommended entities:

### workflow_definitions

* id
* name
* module
* record_type
* business_owner
* status

### workflow_definition_versions

* id
* workflow_definition_id
* version_number
* effective_from
* effective_to
* policy_reference
* approved_by
* published_at
* configuration_hash

### workflow_stage_definitions

### workflow_transition_definitions

### workflow_condition_definitions

### workflow_actor_selectors

### workflow_sla_definitions

### workflow_escalation_definitions

### workflow_document_requirements

---

# 96. Runtime Data Model

### workflow_instances

* id
* uuid
* reference
* definition_version_id
* subject_type
* subject_id
* subject_reference_snapshot
* applicant_id
* prepared_by_id
* submitted_by_id
* record_version
* approval_package_hash
* status
* current_stage_instance_id
* started_at
* completed_at
* cancelled_at

### workflow_stage_instances

### workflow_tasks

### workflow_decisions

### workflow_actor_resolutions

### workflow_transition_events

### workflow_clarifications

### workflow_exceptions

### workflow_reassignments

### workflow_escalations

### workflow_approval_packages

### workflow_release_events

### workflow_audit_events

---

# 97. Stage Instance Model

Suggested fields:

* workflow_instance_id
* stage_definition_id
* sequence
* stage_type
* status
* actor_selector_snapshot
* resolved_actor_id
* resolved_position_id
* authority_assignment_id
* delegation_id
* acting_appointment_id
* activated_at
* assigned_at
* due_at
* completed_at
* decision_id
* skipped_reason
* version

---

# 98. Decision Model

Fields:

* workflow_instance_id
* stage_instance_id
* task_id
* decision_type
* actor_person_id
* actor_account_id
* position_snapshot
* department_snapshot
* authority_snapshot
* delegation_snapshot
* acting_appointment_snapshot
* record_version
* approval_package_hash
* comments
* decided_at
* authentication_strength
* document_signature_event_id
* result_transition_id

Decisions must never be overwritten.

---

# 99. Workflow Task Model

Fields:

* stage_instance_id
* assigned_user_id
* assigned_queue_id
* status
* assigned_at
* acknowledged_at
* due_at
* completed_at
* claimed_at
* claimed_by
* reassigned_from
* escalation_level
* confidentiality

---

# 100. Workflow API Requirements

Definitions:

* `GET /workflow-definitions`
* `POST /workflow-definitions`
* `POST /workflow-definitions/{id}/versions`
* `POST /workflow-versions/{id}/validate`
* `POST /workflow-versions/{id}/approve`
* `POST /workflow-versions/{id}/publish`
* `POST /workflow-versions/{id}/retire`

Instances:

* `POST /workflows/start`
* `GET /workflows/{id}`
* `GET /workflows/{id}/timeline`
* `GET /workflows/{id}/current-task`
* `POST /workflows/{id}/withdraw`
* `POST /workflows/{id}/cancel`
* `POST /workflows/{id}/hold`
* `POST /workflows/{id}/resume`

Tasks:

* `GET /approval-tasks`
* `POST /approval-tasks/{id}/claim`
* `POST /approval-tasks/{id}/acknowledge`
* `POST /approval-tasks/{id}/decide`
* `POST /approval-tasks/{id}/request-clarification`
* `POST /approval-tasks/{id}/reassign`
* `POST /approval-tasks/{id}/recuse`

Administration:

* `POST /workflow-instances/{id}/resolve-exception`
* `POST /workflow-instances/{id}/migrate-version`
* `POST /workflow-instances/{id}/retry-release`
* `POST /workflow-instances/{id}/record-external-decision`

---

# 101. Authority Check API

Before rendering and before accepting a decision:

`POST /authority/check`

Input:

* user;
* action;
* workflow stage;
* subject;
* amount;
* currency;
* requester;
* project;
* department;
* decision time.

Response:

* authorised;
* authority ID;
* position;
* delegation;
* acting appointment;
* threshold result;
* segregation result;
* self-approval result;
* denial reason.

---

# 102. Module Integration Contract

Each business module must provide:

* subject type and ID;
* reference;
* workflow context;
* record version;
* submission snapshot;
* applicant/preparer;
* conditional-routing values;
* authority-check values;
* document list;
* business validation callback;
* change-impact callback;
* completion callback;
* cancellation callback.

Modules must not expose unrestricted executable code to the workflow configuration.

---

# 103. Workflow Events

Suggested events:

* `WorkflowStarted`
* `WorkflowStageActivated`
* `WorkflowTaskAssigned`
* `WorkflowTaskOverdue`
* `WorkflowDecisionRecorded`
* `WorkflowReturned`
* `WorkflowResubmitted`
* `WorkflowRejected`
* `WorkflowApproved`
* `WorkflowSigned`
* `WorkflowCompleted`
* `WorkflowWithdrawn`
* `WorkflowCancelled`
* `WorkflowRoutingFailed`
* `WorkflowReleaseFailed`

Events must be idempotent.

---

# 104. Permissions

Recommended permissions:

* `workflows.view-own`
* `workflows.view-department`
* `workflows.view-all`
* `workflows.submit`
* `workflows.act`
* `workflows.recommend`
* `workflows.certify`
* `workflows.authorise`
* `workflows.approve`
* `workflows.sign`
* `workflows.release`
* `workflows.withdraw`
* `workflows.cancel`
* `workflows.reassign`
* `workflows.resolve-exception`
* `workflows.manage-definitions`
* `workflows.approve-definitions`
* `workflows.publish-definitions`
* `workflows.view-audit`
* `workflows.export`
* `workflows.admin`

A permission alone does not replace business authority validation.

---

# 105. Security Requirements

The module must enforce:

* server-side authorisation;
* MFA for privileged decisions;
* step-up authentication for high-risk approval/signing;
* record-level access;
* authority checks;
* delegation checks;
* segregation-of-duties controls;
* self-approval prevention;
* secure attachments;
* protected exports;
* CSRF protection;
* IDOR prevention;
* mass-assignment protection;
* replay protection;
* signed action tokens where used;
* immutable audit logs.

---

# 106. Concurrency Controls

Prevent:

* two actors deciding the same task;
* decision against outdated record version;
* applicant editing while approval occurs;
* actor reassignment while decision is being submitted;
* duplicate stage activation;
* duplicate workflow completion;
* duplicate downstream release;
* approval after authority expiry;
* signing while document version changes.

Use:

* transactions;
* row locks;
* optimistic version checks;
* unique constraints;
* idempotency keys.

---

# 107. Idempotency

Required for:

* workflow start;
* submission;
* decision;
* stage transition;
* signature;
* workflow completion;
* release event;
* cancellation;
* notification enqueueing.

A network retry must not create duplicate approvals or downstream actions.

---

# 108. Error Handling

Examples:

### Authority Expired

> Your authority for this action expired before the decision was submitted. The task has been rerouted for review.

### Record Changed

> This request changed after you opened it. Review the latest version before taking action.

### Already Decided

> This approval task has already been completed.

### Self-Approval Conflict

> You cannot approve this request because you are the applicant, beneficiary or initiator.

### Delegation Outside Scope

> The active delegation does not cover this module, action or value.

### Routing Failure

> Nexus could not resolve an authorised actor for the next stage. The business owner and workflow administrator have been notified.

### Signature Version Mismatch

> The document changed before signature. Open and review the new version.

---

# 109. Audit Trail

Audit events include:

* definition created;
* version changed;
* version approved;
* workflow started;
* approval package created;
* actor resolved;
* task assigned;
* task claimed;
* record viewed;
* clarification requested;
* decision attempted;
* authority validated;
* authority denied;
* conflict declared;
* recusal;
* delegation applied;
* stage completed;
* record returned;
* version resubmitted;
* task reassigned;
* escalation;
* exception;
* signature;
* workflow completed;
* downstream release;
* release failure;
* cancellation;
* export.

Audit history must be immutable to ordinary workflow administrators.

---

# 110. Retention

Workflow decisions form part of the authoritative business record.

Retention must align with:

* source module;
* financial requirements;
* HR requirements;
* donor rules;
* audit/legal holds;
* contract period;
* records-management policy.

Deleting the source record must not orphan or destroy required workflow history.

---

# 111. Migration

Existing workflow sources may include:

* PIF approval tables;
* Leave approvals;
* Travel approvals;
* salary-advance approvals;
* Procurement approvals;
* email approval trails;
* uploaded signed forms;
* module-specific status histories.

Migration sequence:

1. inventory all current workflow implementations;
2. map statuses and actions;
3. identify duplicate engines;
4. create canonical stage semantics;
5. create workflow definitions;
6. migrate active instances;
7. preserve historical decisions;
8. validate current holders;
9. reconcile delegations;
10. regression-test modules.

---

# 112. Active Workflow Migration

For each active request:

* identify current module status;
* identify completed approvals;
* verify record version;
* identify current holder;
* select target workflow definition;
* map current stage;
* preserve historical signatures;
* obtain business-owner validation;
* activate migrated instance.

Do not restart every active request from the beginning without need.

---

# 113. Historical Workflow Migration

Historical records may be imported as:

* complete structured workflow;
* approval-history summary;
* signed external approval;
* metadata only.

Mark:

* Migrated — Structured
* Migrated — Historical
* Migrated — External Approval
* Migrated — Data Incomplete

Do not fabricate missing stage decisions.

---

# 114. Workflow Definition Validation

Before publication, automated validation must detect:

* unreachable stages;
* missing transitions;
* infinite loops;
* no final state;
* missing actor selector;
* invalid authority action;
* contradictory conditions;
* missing rejection route;
* parallel stage with no completion rule;
* signature without document requirement;
* self-approval vulnerability;
* incompatible stage roles;
* unsupported source fields.

---

# 115. Workflow Simulation

Administrators should be able to simulate a definition using test records.

Simulation should display:

* stages selected;
* conditions evaluated;
* actors resolved;
* authority results;
* deadlines;
* expected path;
* possible rejection/return routes.

Simulation must not create production approvals.

---

# 116. Backend Testing

Must cover:

* definition versioning;
* sequential workflow;
* parallel workflow;
* quorum;
* conditional routing;
* actor resolution;
* hierarchy routing;
* acting appointments;
* delegation;
* authority checks;
* value thresholds;
* self-approval;
* segregation conflicts;
* recusal;
* submission locking;
* record versioning;
* return/resubmit;
* clarification;
* rejection;
* withdrawal;
* cancellation;
* escalation;
* signatures;
* release events;
* idempotency;
* concurrency;
* audit.

---

# 117. Frontend / E2E Testing

Must cover:

* submit Leave request;
* view current holder;
* HOD recommendation;
* HR certification;
* SG approval;
* submit Travel request;
* parallel Administration/Finance processing where configured;
* conditional vehicle stage;
* return for correction;
* compare versions;
* resubmit;
* delegated approval;
* acting-position approval;
* recusal;
* overdue escalation;
* final signing;
* approval certificate;
* workflow search and reports.

---

# 118. Security Testing

Must prove:

* user cannot approve a task not assigned to them;
* frontend button removal is not the only control;
* applicant cannot self-approve;
* expired delegation is rejected;
* delegate cannot exceed principal authority;
* actor cannot approve above value threshold;
* System Administrator cannot business-approve by default;
* record changes invalidate stale decisions;
* signed document cannot be replaced;
* duplicate decision requests are idempotent;
* confidential records do not leak through inbox/search/notifications;
* role or authority revocation takes effect before decision.

---

# 119. Performance Requirements

* Approval inbox should load within normal application performance targets.
* Lists must paginate.
* Actor-resolution rules must be indexed/cached safely.
* Authority checks must remain strongly consistent.
* Workflow events and notifications should use queues.
* Stage activation must not duplicate tasks.
* Dashboards should use aggregate projections.
* Document previews should not block workflow progression.
* Large workflow histories should paginate.

---

# 120. Production Acceptance Criteria

The module is production-ready only when:

1. Workflow definitions can be configured.
2. Definitions are effective-dated and versioned.
3. Definitions require authorised publication.
4. Sequential workflows work.
5. Parallel workflows work.
6. Quorum rules work.
7. Conditional routing works.
8. Stage types preserve distinct meanings.
9. One current stage is identifiable.
10. One current holder or controlled parallel set is identifiable.
11. Current holder and next stage are visible.
12. Actor resolution uses organisational structure.
13. Acting appointments work.
14. Delegations work.
15. Delegates use their own accounts.
16. Authority is revalidated at decision time.
17. Amount thresholds work.
18. Self-approval is prevented.
19. Segregation-of-duties rules work.
20. Conflict declaration and recusal work.
21. Missing actor exceptions are controlled.
22. Submission creates an immutable approval package.
23. Protected fields lock after submission.
24. Material changes trigger reapproval.
25. Return for correction works.
26. Version comparison works.
27. Resubmission preserves history.
28. Clarification works without unnecessary restart.
29. Rejection works.
30. Withdrawal rules work.
31. Cancellation is controlled.
32. Stage deadlines work.
33. Working-day calculations work.
34. Reminders work.
35. Escalations work.
36. Reassignment preserves history.
37. Approval and signature are separate.
38. Digital signatures bind to document hashes.
39. Signed versions are immutable.
40. Workflow completion emits idempotent events.
41. Downstream release failures are visible and retryable.
42. Approval Inbox works.
43. Workflow tracker works in every integrated module.
44. Approval certificates can be generated.
45. Reports and analytics work.
46. Complete workflow audit history exists.
47. Existing PIF workflow behaviour passes regression tests.
48. Leave, Travel, PIF, Salary Advance and Procurement workflows pass end-to-end tests.
49. People & Authority, Document, Notification and Audit-Trail integrations pass regression testing.
50. No module relies on a temporary independent approval engine.

---

# 121. Phase 1 — Production Critical

Implement:

* Workflow definitions
* Definition versioning
* Sequential stages
* Conditional routing
* Actor selectors
* Organisational hierarchy routing
* Authority checks
* delegation and acting support
* current holder and next stage
* Approval Inbox
* submission locking
* approval package snapshots
* return/resubmit
* rejection
* withdrawal/cancellation
* reminders and escalation
* digital-signature integration
* audit history
* approval certificates
* PIF migration
* Leave integration
* Travel integration
* Salary Advance integration
* Procurement integration

---

# 122. Phase 2

Add:

* parallel stages;
* quorum workflows;
* governance-body decisions;
* advanced SLA rules;
* workflow simulation;
* visual no-code workflow designer;
* advanced workload routing;
* external approvals;
* advanced workflow analytics;
* automated definition linting;
* secure email-action enhancements.

---

# 123. Phase 3

Optional:

* AI-assisted workflow configuration;
* bottleneck predictions;
* suggested approver resolution;
* anomaly detection;
* policy-to-workflow comparison;
* natural-language workflow search.

AI must never automatically:

* publish a workflow;
* approve a transaction;
* grant authority;
* skip a stage;
* resolve a segregation conflict;
* apply a signature;
* accept an exception.

---

# 124. Critical Architecture Rules

The implementation team must treat these as non-negotiable:

> **Business modules own business data. The Workflow Engine owns progression and decisions.**

> **Review, recommendation, certification, authorisation, approval and signature are different actions.**

> **Every workflow-enabled record must show its current holder, current stage and next stage.**

> **Workflow definitions are versioned and approved.**

> **Historical instances remain tied to the workflow version that governed them.**

> **Actor selection should normally use positions and authority, not hard-coded names.**

> **Authority must be revalidated when the action is taken.**

> **A technical permission does not constitute business approval authority.**

> **Delegation never exceeds the principal’s authority.**

> **Delegation and acting appointments must not bypass self-approval or segregation rules.**

> **Applicants cannot alter material record data unnoticed after submission.**

> **Every approval applies to a specific record and document version.**

> **A signed document cannot be edited in place.**

> **A stage cannot be silently skipped.**

> **A downstream integration failure does not erase the approval decision.**

> **Workflow administrators cannot act as business approvers merely through technical access.**

> **Modules must not implement separate temporary approval engines.**

---

# 125. Final Product Rule

An applicant should be able to open any Nexus request and immediately answer:

**Where is my request?**
→ current stage

**Who currently has it?**
→ named holder and position

**What must they do?**
→ stage action

**What happens next?**
→ next stage

**When is the action due?**
→ stage deadline

**Why was it returned or rejected?**
→ decision comments

**What changed after resubmission?**
→ version comparison

An approver should be able to answer:

**Why was this sent to me?**
→ actor-resolution explanation

**What authority am I using?**
→ Authority Register record

**Am I acting or delegated?**
→ appointment/delegation

**What exact version am I deciding on?**
→ approval package

**What checks have already been completed?**
→ prior workflow history

**What happens if I approve, return or reject?**
→ configured transition

An auditor should be able to answer:

**Who performed every stage?**
→ decision history

**Was the person authorised at that time?**
→ authority snapshot

**Was segregation of duties preserved?**
→ control result

**What version was approved or signed?**
→ record and document hash

**Were any stages skipped or overridden?**
→ exception register

That gives SADC PF Nexus one coherent, secure approval architecture across every internal administrative process.
</user_query>