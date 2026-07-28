
The next module is **Assignments / Task Tracking**.

This module must become the shared accountability layer used by Correspondence, PIF, M&E, Procurement, Travel, Management decisions, meeting resolutions, Risk, Weekly Summaries and routine Secretariat work. It should not become a separate project-management universe disconnected from the rest of Nexus.

The Administrative Rules require employees to observe the organisational hierarchy and reporting relationships, and require duties to be assigned according to job descriptions, competence and qualifications.  They also require annual performance appraisals containing both employee self-assessment and supervisor assessment. Assignment information can support those appraisals, but raw task counts must not automatically become employee-performance scores. 

The implementation should reuse the workflow, notification, delegation, attachment, approval and audit infrastructure already operating in Nexus rather than create parallel services. 

# SADC PF Nexus

# Assignments / Task Tracking Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Assignments / Task Tracking
**Short name:** Assignments
**Document status:** Updated implementation PRD
**Module type:** Institutional work assignment, follow-up, deadline and accountability module

---

# 1. Executive Summary

The Assignments Module will provide SADC PF with one shared system for assigning, accepting, carrying out, monitoring, reviewing and closing institutional work.

Assignments may originate from:

* incoming correspondence;
* outgoing correspondence follow-up;
* Programme Implementation Forms;
* approved activities;
* M&E recommendations;
* meeting decisions;
* Management instructions;
* Secretary General instructions;
* Director or HOD instructions;
* procurement actions;
* travel preparations;
* budget-control actions;
* audit recommendations;
* risk treatments;
* weekly summary follow-ups;
* routine departmental work;
* user-created work items;
* recurring institutional obligations.

The module must show:

* what must be done;
* why it must be done;
* who is primarily accountable;
* who is supporting;
* who assigned it;
* when it was assigned;
* when it is due;
* what priority it has;
* whether it has been accepted;
* what progress has been made;
* whether it is blocked;
* what evidence supports completion;
* who reviewed completion;
* whether the work was accepted;
* whether follow-up remains outstanding.

The central product rule is:

> Every actionable institutional instruction must have one accountable owner, a clear due date where applicable, visible progress, evidence of completion and an auditable closure decision.

---

# 2. Product Boundary

The Assignments Module is:

* an institutional task register;
* a responsibility-assignment system;
* a deadline tracker;
* a work-progress tracker;
* a review and completion-verification process;
* a cross-module follow-up mechanism;
* a workload visibility tool;
* an institutional accountability record.

It is not:

* the PIF;
* the M&E module;
* a timesheet;
* employee surveillance software;
* a performance appraisal system;
* a disciplinary system;
* an email replacement;
* a full software-development project-management platform;
* a payroll or assignment-allowance system.

Assignments may feed other modules, but they must not assume ownership of those modules’ business records.

---

# 3. Demo Changes Incorporated

The module must explicitly incorporate the changes and operational concerns raised during the Nexus demo.

## 3.1 One accountable owner

A task may involve several people, but it must always have:

* one Primary Assignee;
* zero or more Contributors;
* zero or more Reviewers;
* zero or more Watchers.

The system must avoid ambiguous assignments such as:

> Assigned to Programmes, Finance, Administration and ICT.

Instead:

**Primary owner:** Programme Officer A
**Contributors:** Finance Officer B, ICT Officer C
**Reviewer:** Director Programmes

---

## 3.2 Current holder and next action

A generic status such as `In Progress` is insufficient.

Every assignment must display:

* Current stage
* Currently with
* Primary assignee
* Responsible department
* Next required action
* Due date
* Days remaining or overdue
* Last update
* Escalation status

---

## 3.3 Cross-module assignments

Users must be able to create assignments from:

* Correspondence;
* PIF;
* M&E;
* Procurement;
* Travel;
* Budget;
* Risk;
* meeting records;
* management decisions;
* weekly summary entries.

The source record remains authoritative.

Assignments only owns the work required to act on that source.

---

## 3.4 Notifications

Assignments must support:

* email;
* in-app notification;
* optional mobile push.

The mobile application must not be mandatory on personal devices.

---

## 3.5 Formal delegation

Users must not share credentials when another officer is covering their responsibilities.

Nexus delegation must support:

* acting appointments;
* temporary delegation;
* leave coverage;
* travel coverage;
* limited task delegation;
* approval delegation.

All delegated actions must remain attributable.

---

## 3.6 Completion requires evidence

Clicking `Completed` must not always close the assignment.

Where review is required:

1. Assignee submits completion.
2. Evidence is attached or linked.
3. Reviewer checks it.
4. Reviewer accepts or returns the work.
5. Assignment becomes Verified/Closed.

---

## 3.7 Weekly summary integration

Completed, active, delayed and blocked assignments should be available to the Weekly Summary module.

The employee should not have to retype the same task status into a weekly report.

---

## 3.8 Workload visibility

Supervisors should be able to see workload distribution before assigning more work.

This must be used for planning, not simplistic productivity scoring.

---

# 4. Business Objectives

The module must:

1. Establish clear accountability.
2. Reduce forgotten instructions and missed deadlines.
3. Prevent work from disappearing in email or verbal conversations.
4. Connect official source records to the actions they generate.
5. Give employees a clear view of their current responsibilities.
6. Give supervisors a reliable view of work status.
7. Escalate delayed work appropriately.
8. Preserve completion evidence.
9. Improve Management follow-up.
10. Support weekly reporting without duplicate entry.
11. Support workload planning.
12. Distinguish incomplete, completed and verified work.
13. Preserve organisational hierarchy and delegation.
14. Avoid turning task data into unfair automated performance scores.

---

# 5. Module Navigation

Main Menu → **Assignments**

Employee-facing menu:

* My Assignment Dashboard
* My Assignments
* Assigned by Me
* Tasks Awaiting My Review
* Team Assignments, where authorised
* Calendar
* Recurring Tasks
* Completed Assignments
* Archived Assignments

Management/administrative menu:

* Assignment Register
* Unassigned Work Queue
* Overdue Assignments
* Blocked Assignments
* Escalations
* Department Workload
* Templates
* Recurring Obligations
* Reports
* Assignment Settings

---

# 6. Assignment Sources

Supported source types:

* Manual Assignment
* Correspondence
* Management Instruction
* Secretary General Instruction
* Director/HOD Instruction
* Meeting Decision
* Meeting Resolution
* PIF
* M&E Recommendation
* M&E Follow-Up Action
* Procurement
* Purchase Order/Contract
* Travel
* Budget Variance
* Audit Finding
* Risk Treatment
* Weekly Summary
* HR/Admin Action
* ICT Service Action
* Other Nexus Record

Every source-linked assignment must preserve:

* source module;
* source record ID;
* source reference;
* source title;
* source link;
* creation event;
* source owner.

---

# 7. Source Ownership Rule

Example:

A donor letter requires a response.

**Correspondence owns:**

* the letter;
* routing;
* official response;
* dispatch.

**Assignments owns:**

* `Prepare draft response`;
* due date;
* responsible officer;
* progress;
* completion evidence.

Closing the assignment does not automatically close the correspondence unless the configured integration confirms the source requirement has been satisfied.

---

# 8. Assignment Types

Configurable types should include:

* Action Item
* Deliverable
* Review
* Approval Preparation
* Drafting
* Research
* Follow-Up
* Administrative
* Financial
* Procurement
* Travel Preparation
* Event Preparation
* ICT Support
* Communications
* Translation
* Documentation
* Monitoring
* Audit Action
* Risk Treatment
* Decision Implementation
* Recurring Obligation
* Other

Assignment type affects:

* default workflow;
* evidence requirement;
* reviewer requirement;
* reminder rules;
* confidentiality.

---

# 9. Assignment Lifecycle

Recommended statuses:

* Draft
* Awaiting Assignment
* Assigned
* Awaiting Acceptance
* Accepted
* In Progress
* Awaiting Input
* Blocked
* On Hold
* Submitted for Review
* Returned for Correction
* Resubmitted
* Completed
* Verified
* Closed
* Cancelled
* Superseded
* Archived

`Overdue` should normally be a derived deadline condition, not a replacement for the work status.

Example:

Status:
In Progress

Deadline state:
Overdue by 3 days

---

# 10. Deadline States

Derived states:

* No Due Date
* Future
* Due Soon
* Due Today
* Overdue
* Completed on Time
* Completed Late
* Cancelled Before Due Date

The module must distinguish:

* assignment status;
* deadline status;
* review status.

Do not collapse them into one field.

---

# 11. Assignment Priorities

Configurable priorities:

* Low
* Normal
* High
* Urgent
* Critical

Priority must not automatically change the due date without a configured rule.

Critical and Urgent priorities should require justification where overuse becomes a problem.

---

# 12. Assignment Creation Form

## 12.1 Basic information

Fields:

* Assignment reference, auto-generated
* Title
* Description
* Assignment type
* Source module
* Source reference
* Requesting/assigning officer
* Responsible department
* Primary assignee
* Contributors
* Reviewer
* Watchers
* Priority
* Start date
* Due date/time
* Confidentiality
* Tags/categories

---

## 12.2 Expected result

Every assignment should clearly define what completion means.

Fields:

* Expected outcome
* Required deliverable
* Acceptance criteria
* Evidence required
* Review required: Yes/No
* Final reviewer
* Completion instructions

Example:

**Task:** Prepare draft response.

**Expected result:** Draft official letter using the approved SADC PF template.

**Acceptance criteria:**

* addresses all issues raised;
* uses correct reference;
* includes required attachments;
* submitted to Director Programmes by due date.

---

## 12.3 Context

Fields:

* Background/context
* Related records
* Dependencies
* Constraints
* Relevant policy/document
* Supporting attachments
* Internal notes

The source document should preferably be linked rather than uploaded again.

---

# 13. Assignment Reference

Example:

`ASN/2026/00482`

or:

`TASK/2026/00482`

The reference scheme must be configurable.

References must be:

* server generated;
* unique;
* non-reusable;
* preserved after cancellation.

---

# 14. Primary Assignee

The Primary Assignee is the user accountable for ensuring the work progresses.

The Primary Assignee may:

* accept;
* request clarification;
* update progress;
* add contributors;
* propose reassignment where permitted;
* submit completion;
* identify blockers.

The Primary Assignee remains accountable even where contributors perform part of the work, unless the task is formally reassigned.

---

# 15. Department Assignment

An assignment may initially be sent to:

* department;
* role;
* team;
* functional queue.

However, it must be claimed or assigned to a named user within a configured period.

Example:

Assignment sent to:
Finance Department

Required:

Finance Director assigns Primary Assignee within one working day.

A department-only assignment must not remain ownerless indefinitely.

---

# 16. Contributors

Contributors may:

* view task details;
* update assigned sub-work;
* add comments;
* upload/link evidence;
* mark their contribution complete.

Contributors cannot close the main assignment unless they have explicit authority.

---

# 17. Reviewer

The Reviewer determines whether the submitted work satisfies the acceptance criteria.

Reviewer actions:

* Accept
* Return for Correction
* Request Additional Evidence
* Accept with Follow-Up
* Reassign Review, where authorised

Reviewer comments are mandatory when returning work.

---

# 18. Watchers

Watchers receive visibility and notifications but are not accountable for delivery.

Examples:

* SG Office;
* Director;
* source-record owner;
* meeting secretariat;
* audit officer.

Watchers must not be counted as assignees.

---

# 19. Assignment Acceptance

Configurable behaviour:

### Automatic acceptance

Useful for routine supervisor-to-employee assignments.

### Explicit acceptance

Useful for cross-department or complex work.

Assignee actions:

* Accept
* Request Clarification
* Decline with Reason
* Propose Alternative Owner

Declining does not cancel the assignment.

It returns it to the assigning officer for resolution.

---

# 20. Acceptance Deadline

For urgent or cross-department work, configure an acceptance deadline.

Example:

Assigned:
08:00

Acceptance due:
12:00

Failure to accept may trigger reminder/escalation.

---

# 21. Reassignment

Assignments may be reassigned only through a controlled action.

Capture:

* previous assignee;
* new assignee;
* reason;
* reassigned by;
* date/time;
* due-date impact;
* acknowledgement.

History must remain intact.

---

# 22. Delegation vs Reassignment

These are different.

## Delegation

The original position-holder remains the principal, and another user acts temporarily under formal authority.

## Reassignment

Responsibility permanently moves to another user for that assignment.

The audit trail must distinguish both.

---

# 23. Leave and Travel Coverage

When the Primary Assignee has approved leave or travel overlapping the due period, Nexus should warn the assigning officer.

Options:

* keep assignment with employee;
* change due date;
* add contributor;
* assign acting officer;
* formally reassign;
* create handover.

Do not automatically reassign every task without review.

---

# 24. Acting Appointments

Where an acting officer is formally appointed, the system may route new role-based assignments to that officer during the acting period.

Existing assignments should be handled through:

* handover;
* delegation;
* selective reassignment.

The acting appointment must have:

* start date;
* end date;
* role scope;
* authority limits.

---

# 25. Assignment Handover

Handover record:

* Assignment
* Outgoing assignee
* Incoming assignee
* Current progress
* Pending actions
* Key documents
* Blockers
* Handover date
* Acknowledgement

Useful for:

* leave;
* travel;
* staff transfer;
* resignation;
* acting appointments.

---

# 26. Subtasks

Complex assignments may contain subtasks.

Each subtask may have:

* title;
* assignee;
* due date;
* status;
* evidence;
* dependency;
* completion.

The main assignment remains accountable to the Primary Assignee.

---

# 27. Checklist Items

For routine tasks, use checklist items rather than creating excessive subtasks.

Example travel-preparation assignment:

* Invitation verified
* Ticket issued
* Hotel confirmed
* Visa status confirmed
* Insurance uploaded
* Travel pack shared

Checklist items may be:

* optional;
* mandatory;
* ordered;
* individually assigned.

---

# 28. Dependency Management

Assignments may depend on:

* another assignment;
* source-module approval;
* external response;
* document;
* meeting;
* procurement delivery.

Dependency types:

* Cannot Start Until
* Cannot Complete Until
* Related To
* Blocks
* Blocked By

The system must prevent closure where a mandatory dependency remains unresolved, unless an authorised override reason is recorded.

---

# 29. Blocked Assignments

When blocked, capture:

* blocker type;
* description;
* responsible external/internal party;
* date blocked;
* expected resolution;
* escalation required;
* supporting record.

Blocker categories:

* Waiting for Approval
* Waiting for Information
* Waiting for External Party
* Resource Constraint
* Budget
* Procurement
* Travel
* Technical
* Legal
* Management Decision
* Staff Availability
* Other

---

# 30. Blocker Responsibility

The assignment should distinguish:

* person responsible for the task;
* person/party responsible for removing the blocker.

A blocked task is not automatically evidence of poor performance by the assignee.

This distinction is essential for fair reporting.

---

# 31. Progress Updates

Assignee may record:

* percentage complete;
* status update;
* work completed;
* next step;
* blocker;
* expected completion date;
* attachment/evidence;
* time spent, optional or linked to Timesheets.

Percentage complete must not be mandatory for every simple task.

---

# 32. Progress Percentage

Where used:

* 0%
* 25%
* 50%
* 75%
* 100%

or a precise percentage.

However, 100% progress does not necessarily equal Verified completion.

Recommended:

* progress reaches 100%;
* assignee submits for review;
* reviewer verifies.

---

# 33. Comments and Collaboration

Comments should support:

* plain text;
* mentions;
* attachments;
* source links;
* timestamps;
* editing history where edits are allowed.

Comments must be classified as:

* General Task Comment
* Internal Management Note
* Reviewer Feedback
* Blocker Update
* Completion Note

Sensitive internal notes must respect permissions.

---

# 34. Mentions

Users may mention authorised colleagues.

Mention creates a notification but does not make that person an assignee or contributor unless explicitly added.

---

# 35. Attachments and Evidence

Evidence types:

* Draft document
* Final document
* Email confirmation
* Meeting minutes
* Screenshot
* Report
* Receipt
* Approval
* Correspondence
* M&E evidence
* Link to Nexus record
* Other

Prefer linking the authoritative Nexus record rather than uploading duplicates.

---

# 36. Completion Submission

When assignee submits completion:

Required where configured:

* completion summary;
* deliverable;
* evidence;
* completed date;
* unresolved follow-up;
* related records;
* declaration.

Suggested declaration:

> I confirm that the work described in this completion submission has been carried out and the supporting evidence provided is accurate to the best of my knowledge.

---

# 37. Completion vs Verification

## Completed

The assignee states the work is finished.

## Verified

The authorised reviewer confirms the acceptance criteria were met.

## Closed

All required follow-up and administrative actions are finished.

For simple tasks with no reviewer requirement:

Completed may transition directly to Closed.

---

# 38. Return for Correction

Reviewer must identify:

* acceptance criterion not met;
* required correction;
* due date;
* comments;
* evidence required.

The assignment status becomes:

`Returned for Correction`

The previous completion submission remains in history.

---

# 39. Completion with Follow-Up

A reviewer may accept the main deliverable but identify additional work.

Recommended behaviour:

1. Verify original assignment.
2. Create linked follow-up assignment.
3. Do not keep the original task artificially open if its defined deliverable was completed.

This preserves clear scope.

---

# 40. Cancellation

Cancellation requires:

* reason;
* cancelled by;
* authority;
* date;
* source-module impact;
* open subtask treatment.

Reasons:

* No Longer Required
* Duplicate
* Superseded
* Source Cancelled
* Scope Changed
* Created in Error
* Other

Cancellation does not delete history.

---

# 41. Superseded Assignment

Where task scope materially changes:

* close original as Superseded;
* create replacement assignment;
* link both records.

Do not rewrite the original assignment so extensively that historical accountability is lost.

---

# 42. Recurring Assignments

Support recurrence:

* Daily
* Weekly
* Monthly
* Quarterly
* Annually
* Custom schedule

Examples:

* weekly programme summary;
* monthly budget variance review;
* quarterly supplier compliance check;
* annual asset verification preparation;
* monthly server backup verification.

---

# 43. Recurring Assignment Architecture

Use:

**Recurring Assignment Template**

which generates individual assignment instances.

Do not keep one assignment open forever for monthly obligations.

Each occurrence requires its own:

* due date;
* status;
* evidence;
* completion;
* audit.

---

# 44. Recurrence Rules

Support:

* start date;
* end date;
* occurrence count;
* day of week;
* day of month;
* due-time;
* holiday/weekend behaviour;
* default assignee;
* fallback assignee;
* reviewer;
* reminder schedule.

---

# 45. Assignment Templates

Templates improve consistency.

Examples:

* Prepare Official Correspondence Response
* Organise Programme Activity
* Process Travel Documentation
* Review Budget Variance
* Conduct Supplier Evaluation
* Complete M&E Report
* Prepare Weekly Summary
* Close Audit Finding
* Implement Risk Treatment

Template fields:

* title pattern;
* description;
* type;
* checklist;
* evidence requirements;
* default duration;
* default roles;
* reviewer;
* confidentiality;
* escalation rules.

---

# 46. Meeting Decision Integration

Meeting records should be able to create assignments from decisions.

Transferred fields:

* meeting;
* agenda item;
* decision;
* responsible officer;
* due date;
* priority;
* meeting minute reference.

Meeting decision remains authoritative.

Assignment tracks implementation.

---

# 47. Management Instruction Integration

SG/Management may create a formal instruction containing multiple assignments.

Example:

Management Decision:
Prepare 59th Plenary readiness plan.

Assignments:

* ICT readiness — ICT Officer
* Accreditation — Administration
* Documentation — Programme team
* Media plan — Communications
* Travel readiness — Administration

The instruction should show consolidated status without losing individual accountability.

---

# 48. PIF Integration

A PIF may generate assignments for:

* concept note;
* budget;
* agenda;
* participant list;
* procurement preparation;
* interpretation;
* travel arrangements;
* communications;
* documentation;
* post-approval hand-offs.

Approved PIF source data should be linked, not copied unnecessarily.

---

# 49. M&E Integration

M&E recommendations and follow-up actions may create assignments.

Example:

M&E Recommendation:
Submit missing attendance register.

Assignment:

* Primary assignee
* Due date
* Evidence required
* Linked M&E record

Closing the assignment updates the M&E follow-up status through an authorised integration event.

---

# 50. Correspondence Integration

Correspondence routing may create assignments for:

* draft response;
* provide advice;
* supply information;
* review legal implications;
* prepare nomination;
* follow up with sender.

Correspondence remains the official record.

Assignment shows action status.

---

# 51. Procurement Integration

Procurement may create assignments for:

* prepare specifications;
* confirm budget;
* evaluate bids;
* complete conflict declaration;
* inspect delivery;
* evaluate supplier;
* resolve contract issue.

The procurement workflow remains authoritative.

---

# 52. Travel Integration

Travel may create assignments for:

* prepare itinerary;
* submit visa documents;
* book ticket;
* calculate DSA;
* upload retirement documents;
* resolve travel reconciliation.

---

# 53. Risk Integration

Risk treatment actions should use Assignments for operational follow-up.

Risk owns:

* risk;
* likelihood;
* impact;
* treatment plan;
* residual risk.

Assignments owns:

* who performs each treatment;
* due date;
* evidence;
* completion.

---

# 54. Audit Integration

Audit findings may create corrective-action assignments.

Required linkage:

* audit finding;
* recommendation;
* management response;
* action owner;
* due date;
* completion evidence;
* auditor verification.

---

# 55. Weekly Summary Integration

The Weekly Summary module should read:

* completed assignments during the week;
* active assignments;
* delayed assignments;
* blockers;
* upcoming deadlines.

The user may select which items to include and add narrative context.

Assignments should not automatically publish confidential tasks into ordinary weekly summaries.

---

# 56. Timesheet Integration

Assignments may be linked to Timesheet entries.

Timesheets own:

* date;
* duration;
* work hours;
* overtime;
* time category.

Assignments own:

* responsibility;
* deliverable;
* status.

A completed assignment does not prove how many hours were worked.

---

# 57. Performance Appraisal Integration

Assignment data may support appraisal evidence, but safeguards are mandatory.

The system may provide:

* assignments completed;
* major deliverables;
* overdue items with explanations;
* blocked work;
* supervisor verification;
* employee self-selected achievements.

The system must not automatically calculate:

* employee performance score;
* promotion eligibility;
* disciplinary outcome;
* merit increment;

from task counts or overdue percentages.

The Administrative Rules require appraisal to include employee self-assessment, supervisor assessment and authorised approval, so assignment information is supporting evidence rather than the appraisal itself. 

---

# 58. Fair Performance Safeguards

Reports must distinguish:

* completed on time;
* completed late;
* overdue;
* blocked by third party;
* paused by Management;
* reassigned;
* cancelled;
* scope changed;
* no due date.

A task blocked by budget or external response must not appear as unexplained employee delay.

---

# 59. Workload Dashboard

Supervisors should see:

* open assignments per employee;
* high-priority assignments;
* tasks due soon;
* overdue assignments;
* blocked assignments;
* review workload;
* planned leave/travel;
* estimated effort, where used.

This is capacity planning, not a simplistic productivity leaderboard.

---

# 60. Estimated Effort

Optional fields:

* Small
* Medium
* Large
* Extra Large

or estimated hours/days.

Use effort to assist workload balancing.

Do not require exact estimates for all routine tasks.

---

# 61. Capacity Warning

Before assigning:

> This employee currently has 12 active assignments, including 4 high-priority assignments due this week.

The assigning officer may continue but should acknowledge the warning where thresholds are exceeded.

---

# 62. No Public Rankings

The module must not provide:

* employee leaderboards;
* public “worst performer” lists;
* gamified completion rankings;
* automatic disciplinary flags based only on task metrics.

Management reporting should be contextual and permission-controlled.

---

# 63. Employee Dashboard

Show:

* Due Today
* Due This Week
* Overdue
* High/Urgent Priority
* Awaiting My Acceptance
* In Progress
* Blocked
* Awaiting Review
* Returned for Correction
* Recently Completed

Primary actions:

* Accept
* Start
* Update
* Report Blocker
* Submit Completion

---

# 64. Supervisor Dashboard

Show:

* Team workload
* Assignments awaiting acceptance
* Tasks due soon
* Overdue tasks
* Blocked tasks
* Work awaiting review
* Unassigned departmental work
* Staff on leave/travel
* Recently verified deliverables

---

# 65. Management Dashboard

Aggregate metrics:

* Open assignments
* Due soon
* Overdue
* Blocked
* Critical actions
* Tasks by department
* Tasks from Management decisions
* Meeting actions outstanding
* Audit actions outstanding
* Risk treatments outstanding
* Correspondence actions outstanding

Management must be able to drill down subject to confidentiality.

---

# 66. Assignment Views

Required views:

* List
* Kanban
* Calendar
* Due-date timeline
* My Work
* Team Work
* Source-based view
* Department view

Kanban columns should follow controlled lifecycle states.

Users must not drag tasks into states they are not authorised to perform.

---

# 67. Calendar

Calendar displays:

* start date;
* due date;
* milestones;
* recurrence.

Filters:

* assignee;
* department;
* priority;
* source;
* status;
* confidentiality;
* reviewer.

---

# 68. Search

Search by:

* assignment reference;
* title;
* description;
* assignee;
* assigning officer;
* department;
* source reference;
* priority;
* status;
* due date;
* tag;
* related document.

Search must respect record-level confidentiality.

---

# 69. Confidentiality

Classifications:

* General Internal
* Department Restricted
* Management Restricted
* Confidential
* HR Confidential
* Finance Confidential
* Legal Privileged
* Audit Restricted
* Other

An assignment created from a confidential source record should inherit the source classification by default.

---

# 70. Confidentiality Inheritance

Example:

Confidential correspondence creates a task.

The task must not expose:

* correspondence subject;
* sender;
* attachment;
* description;

to users not authorised for the source.

A restricted assignee must receive only the minimum information necessary for their role.

---

# 71. Notifications

Notify when:

* assignment created;
* assignment assigned;
* acceptance required;
* clarification requested;
* due date approaching;
* overdue;
* blocker reported;
* contributor added;
* mentioned in comment;
* completion submitted;
* review required;
* returned for correction;
* verified;
* reassigned;
* cancelled;
* escalation triggered.

---

# 72. Notification Frequency

Avoid notification overload.

Support:

* immediate notification for critical events;
* daily digest;
* weekly digest;
* user preference within institutional policy.

Urgent tasks should not be buried in digests.

---

# 73. Reminder Rules

Configurable:

* at assignment;
* 7 days before due;
* 3 days;
* 1 day;
* due day;
* daily/periodic after overdue.

Rules may depend on priority and assignment type.

---

# 74. Escalation Rules

Example:

1 day overdue:
Assignee reminder

3 days:
Supervisor notified

5 days:
HOD notified

10 days:
Director/SG Office notified

Escalation must account for:

* approved extension;
* blocked status;
* paused assignment;
* leave/travel;
* weekends and public holidays.

---

# 75. Due-Date Extension

Assignee may request an extension.

Fields:

* current due date;
* proposed due date;
* reason;
* impact;
* blocker;
* requested by;
* approval;
* comments.

The original due date remains in history.

---

# 76. Extension Approval

Depending on source:

* assigning officer;
* supervisor;
* source-record owner;
* Management.

An assignee must not silently change their own deadline unless policy permits.

---

# 77. Service-Level Deadlines

Some templates may calculate due dates automatically.

Example:

Correspondence draft response:
5 working days

Procurement evaluation:
3 working days after closing

Rules should be configurable.

Working-day calculations use the institutional holiday calendar.

---

# 78. Comments vs Formal Updates

The system should distinguish:

### Comment

Conversation or clarification.

### Progress Update

Formal status/progress report.

### Completion Submission

Formal claim of completion.

### Review Decision

Formal acceptance/return.

This improves audit and reporting quality.

---

# 79. Assignment Activity Timeline

Timeline includes:

* created;
* assigned;
* accepted;
* started;
* contributor added;
* progress update;
* blocker;
* due-date change;
* reassignment;
* completion submission;
* review;
* verification;
* closure.

---

# 80. Assignment Register

Columns:

* Reference
* Title
* Source
* Assigning Officer
* Primary Assignee
* Department
* Priority
* Start Date
* Due Date
* Status
* Deadline State
* Progress
* Reviewer
* Completion Date
* Verification Date

---

# 81. Reports

Required reports:

* Assignment Register
* My Assignment Report
* Department Assignment Report
* Assignments by Source
* Assignments by Type
* Assignments by Priority
* Assignments by Status
* Due Soon
* Overdue
* Blocked Assignments
* Awaiting Acceptance
* Awaiting Review
* Returned for Correction
* Completed Assignments
* Verified Deliverables
* Cancelled/Superseded Assignments
* Recurring Task Compliance
* Management Decision Actions
* Meeting Action Report
* Correspondence Action Report
* M&E Follow-Up Report
* Audit Action Report
* Risk Treatment Action Report
* Workload Report
* Assignment Cycle-Time Report
* Assignment Audit Report

Exports:

* PDF
* Excel
* CSV where appropriate.

---

# 82. Cycle-Time Metrics

Measure:

* created to assigned;
* assigned to accepted;
* accepted to started;
* started to completion;
* completion to review;
* review to verification;
* total cycle time.

Late duration should exclude approved paused periods where configured.

---

# 83. Status Duration

Track time spent in:

* awaiting acceptance;
* in progress;
* blocked;
* awaiting review;
* returned for correction.

This helps identify workflow bottlenecks.

It must not automatically blame the assignee for review delays.

---

# 84. Assignment Documents

Supported:

* instruction;
* source document;
* work product;
* draft;
* final deliverable;
* evidence;
* review comments;
* supporting materials.

Use shared Nexus document storage.

---

# 85. Record Immutability

After verification:

* title/scope should not be freely editable;
* completion evidence should remain preserved;
* review decision must remain preserved.

Corrections use:

* amendment;
* reopening;
* linked follow-up assignment.

---

# 86. Reopening

A verified assignment may be reopened only by an authorised user.

Capture:

* reason;
* reopened by;
* date;
* new due date;
* required action.

Previous verification remains in history.

---

# 87. Data Model

Recommended entities:

### assignments

* id
* uuid
* reference
* title
* description
* assignment_type_id
* source_type
* source_id
* source_reference_snapshot
* source_title_snapshot
* assigned_by_id
* primary_assignee_id
* department_id
* reviewer_id
* priority
* confidentiality
* start_at
* due_at
* status
* progress_percentage
* expected_outcome
* acceptance_criteria
* evidence_required
* review_required
* accepted_at
* started_at
* submitted_for_review_at
* completed_at
* verified_at
* closed_at

### assignment_contributors

### assignment_watchers

### assignment_subtasks

### assignment_checklist_items

### assignment_dependencies

### assignment_comments

### assignment_progress_updates

### assignment_blockers

### assignment_completion_submissions

### assignment_reviews

### assignment_due_date_changes

### assignment_reassignments

### assignment_handovers

### assignment_templates

### recurring_assignment_rules

### assignment_source_links

### assignment_documents

### assignment_audit_events

---

# 88. Source Relationship Design

A polymorphic source relation is recommended:

* `source_type`
* `source_id`

But it must be constrained to an explicit allow-list of Nexus source models.

Do not permit arbitrary model names from request payloads.

The API must resolve and authorise the source server-side.

---

# 89. Multiple Source Links

Some assignments relate to multiple records.

Use:

* one Primary Source;
* zero or more Related Sources.

Example:

Primary Source:
Correspondence

Related Sources:
PIF, Travel, Procurement

Do not overload one source field with an unstructured array.

---

# 90. Assignment Participants Model

Separate relation tables:

* Primary assignee stored on assignment
* Contributors
* Watchers
* Reviewers where multiple-stage review is required

Do not store participant IDs as an unaudited JSON list where relational querying and permissions are needed.

---

# 91. Checklist Model

Checklist item fields:

* assignment_id;
* title;
* description;
* sequence;
* mandatory;
* assignee_id;
* due_at;
* completed;
* completed_by;
* completed_at;
* evidence_document_id.

---

# 92. Review Model

Fields:

* assignment_id;
* submission_version;
* reviewer_id;
* decision;
* comments;
* reviewed_at;
* acceptance_criteria_results;
* follow-up_required.

Review decisions must not be overwritten.

---

# 93. API Requirements

Suggested endpoints:

### Core

`GET /assignments`

`POST /assignments`

`GET /assignments/{id}`

`PUT /assignments/{id}`

### Assignment actions

`POST /assignments/{id}/assign`

`POST /assignments/{id}/accept`

`POST /assignments/{id}/request-clarification`

`POST /assignments/{id}/start`

`POST /assignments/{id}/progress`

`POST /assignments/{id}/block`

`POST /assignments/{id}/unblock`

`POST /assignments/{id}/submit-completion`

`POST /assignments/{id}/review`

`POST /assignments/{id}/verify`

`POST /assignments/{id}/close`

`POST /assignments/{id}/cancel`

`POST /assignments/{id}/reopen`

### Participants

`POST /assignments/{id}/contributors`

`DELETE /assignments/{id}/contributors/{user}`

`POST /assignments/{id}/watchers`

### Structure

`POST /assignments/{id}/subtasks`

`POST /assignments/{id}/checklist`

`POST /assignments/{id}/dependencies`

### Governance

`POST /assignments/{id}/reassign`

`POST /assignments/{id}/handover`

`POST /assignments/{id}/request-extension`

`POST /assignments/{id}/approve-extension`

### Recurring

`POST /assignment-templates`

`POST /recurring-assignments`

---

# 94. Source Module API

Other modules should use a shared command such as:

`POST /assignments/from-source`

Payload should contain:

* source type;
* source ID;
* assignment template/type;
* assignee;
* due date;
* expected result;
* idempotency key.

The assignment service resolves source metadata and permissions.

---

# 95. Event-Based Assignment Creation

Modules may emit events such as:

* `CorrespondenceActionAssigned`
* `ProgrammeApproved`
* `MeFollowUpCreated`
* `AuditRecommendationAccepted`
* `RiskTreatmentApproved`

The Assignment service may consume configured events.

Automatic creation must be:

* explicit;
* idempotent;
* traceable;
* configurable.

Do not automatically create dozens of unnecessary tasks from every source record.

---

# 96. Idempotency

Network retries or repeated source events must not create duplicate assignments.

Use:

* source type;
* source ID;
* source action key;
* idempotency key;
* unique constraint.

---

# 97. Concurrency

Prevent:

* two users simultaneously accepting the same queue assignment;
* completion submitted against an outdated assignment version;
* task reassigned while another user closes it;
* due date changed while reviewer verifies old scope.

Use transactional state checks and optimistic locking/versioning where appropriate.

---

# 98. Validation

Must enforce:

* title required;
* valid assignee;
* valid source;
* assignee authorised to view necessary source data;
* due date after start date;
* reviewer cannot equal assignee where separation is required;
* completed task must meet mandatory checklist/evidence requirements;
* blocked status requires blocker details;
* return decision requires comments;
* cancellation requires reason;
* reassignment requires reason;
* closure requires permitted state.

---

# 99. Permissions

Recommended permissions:

* `assignments.view-own`
* `assignments.view-team`
* `assignments.view-department`
* `assignments.view-all`
* `assignments.create`
* `assignments.assign`
* `assignments.accept`
* `assignments.update-own`
* `assignments.manage-contributors`
* `assignments.review`
* `assignments.verify`
* `assignments.reassign`
* `assignments.extend-due-date`
* `assignments.cancel`
* `assignments.reopen`
* `assignments.manage-templates`
* `assignments.manage-recurring`
* `assignments.export`
* `assignments.audit`
* `assignments.admin`

---

# 100. Separation of Duties

At minimum:

* ordinary assignee cannot verify own work where independent review is required;
* contributor cannot close the parent assignment without authority;
* drafter cannot approve an official source record through the Assignment module;
* task administrator cannot change source-module approvals;
* system administrator does not automatically become business reviewer;
* confidential-source access must remain enforced.

---

# 101. Audit Trail

Audit events include:

* Assignment created
* Source linked
* Assigned
* Accepted
* Clarification requested
* Started
* Contributor added/removed
* Progress updated
* Blocker recorded
* Blocker resolved
* Due date changed
* Extension requested
* Extension approved/rejected
* Reassigned
* Handover completed
* Completion submitted
* Returned for correction
* Resubmitted
* Verified
* Closed
* Cancelled
* Reopened
* Archived
* Export generated

Audit fields:

* user;
* role;
* timestamp;
* assignment;
* previous value;
* new value;
* reason;
* delegation;
* source reference;
* device/IP where available.

---

# 102. Security Requirements

Must enforce:

* RBAC;
* record-level authorisation;
* source-level permission inheritance;
* secure attachments;
* prevention of IDOR;
* mass-assignment protection;
* encrypted transport;
* secure notifications;
* confidential search controls;
* audit logging;
* protected exports.

Users must not access a confidential source document merely because they received a generic task relating to it.

---

# 103. Notification Privacy

Email subject lines should not expose sensitive task details.

Example:

Use:

> New confidential assignment in Nexus

rather than:

> Investigate salary complaint against Employee X

The secure Nexus link contains the authorised detail.

---

# 104. Retention

Assignment records connected to official records should inherit or align with the source retention policy.

Examples:

* correspondence action;
* audit finding;
* risk treatment;
* procurement evaluation.

Assignments should not be deleted while the authoritative source record requires retention.

---

# 105. Migration

Existing assignment sources may include:

* Excel trackers;
* email instructions;
* meeting action tables;
* management follow-up lists;
* weekly summary action logs;
* correspondence registers;
* audit action plans;
* risk-treatment sheets.

Migration priority:

1. Current open assignments
2. Current overdue actions
3. Current Management decisions
4. Current correspondence actions
5. Active audit/risk actions
6. Selected historical items

---

# 106. Migrated Assignment

Fields:

* Legacy source
* Legacy reference
* Original assignment date
* Original due date
* Current assignee
* Current status
* Migration batch
* Migrated by
* Validation status

Mark:

`Migrated / Historical`

where appropriate.

---

# 107. Opening Assignment Reconciliation

Before go-live:

* identify duplicates;
* confirm owners;
* confirm due dates;
* close obsolete actions;
* identify confidential items;
* obtain department/HOD validation.

Do not import thousands of obsolete tasks as active work.

---

# 108. Backend Testing

Must cover:

* task creation;
* source linking;
* source access;
* primary assignee;
* contributors;
* acceptance;
* department queue claiming;
* progress;
* blocker handling;
* subtasks;
* dependencies;
* checklists;
* completion;
* review;
* return/resubmission;
* verification;
* recurring generation;
* reassignment;
* delegation;
* due-date extension;
* escalation;
* confidentiality;
* idempotency;
* concurrency;
* audit.

---

# 109. Frontend / E2E Testing

Must cover:

* create manual assignment;
* create from Correspondence;
* assign primary owner;
* add contributors;
* accept;
* start;
* update progress;
* report blocker;
* complete checklist;
* submit evidence;
* return for correction;
* resubmit;
* verify;
* close;
* reassign;
* extend due date;
* recurring task creation;
* workload dashboard;
* weekly-summary selection.

---

# 110. Security Testing

Must prove:

* user cannot access another confidential assignment;
* source permissions are enforced;
* contributor cannot verify parent task without permission;
* assignee cannot change protected source data;
* assignee cannot self-extend deadline where approval is required;
* task cannot be closed without mandatory evidence;
* direct API cannot bypass review;
* System Admin cannot act as business reviewer without permission;
* notifications and search do not leak confidential information.

---

# 111. Performance Requirements

* assignment lists must paginate;
* dashboard queries must be indexed;
* source links should resolve efficiently;
* recurring generation should run in background jobs;
* notifications should be queued;
* large attachments should use the shared document service;
* workload dashboards must not load full task histories.

---

# 112. Production Acceptance Criteria

The module is production-ready only when:

1. A user can create an assignment.
2. Assignments can originate from Nexus source modules.
3. Source records remain authoritative.
4. Source documents are linked rather than duplicated.
5. One Primary Assignee is mandatory.
6. Contributors can be added.
7. Reviewer can be assigned.
8. Watchers can be added.
9. Department queues can be used.
10. Department work is claimed by a named user.
11. Assignee can accept or request clarification.
12. Assignment lifecycle works.
13. Current stage and current holder are visible.
14. Due dates and deadline states work.
15. Working-day deadlines respect holidays.
16. Priorities work.
17. Progress updates work.
18. Blockers can be recorded.
19. Blockers are distinguished from assignee delay.
20. Subtasks work.
21. Checklists work.
22. Dependencies work.
23. Completion evidence can be submitted.
24. Completion and verification are separate where required.
25. Reviewer can return work.
26. Corrected work can be resubmitted.
27. Verified tasks can close.
28. Follow-up assignments can be generated.
29. Reassignment preserves history.
30. Formal delegation works.
31. Leave/travel conflicts produce warnings.
32. Handover works.
33. Recurring assignment instances are generated.
34. Templates work.
35. Notifications work.
36. Escalations work.
37. Due-date extensions are controlled.
38. Correspondence integration works.
39. PIF integration works.
40. M&E follow-up integration works.
41. Procurement and Travel integration work.
42. Risk and Audit integration points work.
43. Weekly Summary can reuse assignment data.
44. Timesheets can link to assignments.
45. Confidentiality is enforced.
46. Audit trail is complete.
47. Reports export correctly.
48. Raw task counts do not automatically become performance scores.
49. Existing Nexus Workflow, Notification, Delegation, Document and Audit services pass regression testing.

---

# 113. Phase 1 — Production Critical

Implement:

* Assignment Register
* My Assignments
* Team Assignments
* Manual assignment creation
* Cross-module source links
* Primary assignee
* Contributors
* Reviewer
* Watchers
* Acceptance
* Progress
* Blockers
* Due dates
* Reminders
* Escalation
* Subtasks
* Checklists
* Evidence
* Review/verification
* Reassignment
* Delegation
* Recurring tasks
* Dashboards
* Search
* Reports
* Audit
* Correspondence/PIF/M&E integration
* Weekly Summary integration contract

---

# 114. Phase 2

Add:

* advanced dependency planning;
* workload forecasting;
* event/meeting action packs;
* advanced recurring schedules;
* richer capacity planning;
* calendar synchronisation;
* assignment handover packs;
* deeper Timesheet integration.

---

# 115. Phase 3

Optional enhancements:

* AI-assisted task summaries;
* suggested assignees based on role and workload;
* automatic blocker classification;
* suggested due dates;
* meeting-minute action extraction;
* natural-language task search.

All AI-generated assignments, owners and deadlines require human confirmation.

---

# 116. Critical Architecture Rules

The implementation team must treat the following as non-negotiable:

> **Every actionable assignment must have one accountable Primary Assignee.**

> **Contributors are not substitutes for accountability.**

> **A department queue cannot remain the final owner indefinitely.**

> **The source module remains authoritative.**

> **Do not duplicate source documents or source statuses.**

> **Assignment completion is not automatically accepted completion.**

> **Where review is required, verification is a separate action.**

> **A blocked task must identify the blocker and blocker owner.**

> **Overdue status must not erase the actual work status.**

> **Reassignment and deadline changes must preserve history.**

> **Recurring work creates separate assignment instances.**

> **Do not convert task counts into automated employee-performance scores.**

> **Do not build employee leaderboards.**

> **Confidentiality must inherit from the source record.**

> **Delegation must be formal and auditable. Password sharing is prohibited.**

> **Verified assignments must not be silently edited.**

---

# 117. Final Product Rule

An employee should be able to open Nexus and immediately understand:

**What do I need to do?**
→ My Assignments

**Why do I need to do it?**
→ Source and context

**Who assigned it?**
→ Assigning officer

**What exactly is expected?**
→ Deliverable and acceptance criteria

**When is it due?**
→ Due date and countdown

**Who is helping me?**
→ Contributors

**Who will review it?**
→ Reviewer

**What is preventing progress?**
→ Blocker

**What evidence must I submit?**
→ Completion requirements

**Has my work been accepted?**
→ Verification status

A supervisor should be able to answer:

**Who owns each action?**
→ Primary assignee

**Which work is at risk?**
→ overdue, blocked and due-soon views

**Is work delayed by the employee or another dependency?**
→ blocker analysis

**Who is overloaded?**
→ workload view

**Which Management, meeting, correspondence and audit actions remain unresolved?**
→ source-based dashboards

That gives SADC PF a genuine institutional accountability system without reducing professional work to a simplistic task counter.
