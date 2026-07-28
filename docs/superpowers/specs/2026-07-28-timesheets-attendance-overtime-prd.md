# SADC PF Nexus

# Timesheets, Attendance & Overtime Management Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Timesheets, Attendance & Overtime Management
**Short name:** Timesheets
**Document status:** Updated implementation PRD
**Module type:** Work-time recording, project allocation, attendance reconciliation, overtime authorisation and payroll-input module

The next module is **Timesheets**. It should connect directly to Assignments, PIF, projects, travel, leave, overtime, payroll and weekly summaries without duplicating their records.

The current Administrative Rules establish a Monday-to-Friday workweek, normal office hours from 08:00 to 17:00 and a lunch break from 13:00 to 14:00. Employees may be required to work outside normal hours and on weekends under authorised overtime arrangements. 

Overtime must be approved before it is worked. Overtime on a normal working day is paid at one-and-a-half times the normal rate, while time off in lieu must normally be used within 30 days unless the Secretary General authorises an exception.  The Accounting Manual further requires Heads of Department to obtain advance authority, monitor actual overtime and submit overtime sheets through HR/Administration to Finance. It also identifies time records as the source for basic and overtime payroll inputs. 

---

# 1. Executive Summary

The Timesheets Module will provide SADC PF with a controlled system for:

* recording work performed;
* allocating time to assignments, programmes and projects;
* reconciling expected working time with approved leave and travel;
* preparing donor/project time records;
* authorising overtime before it is worked;
* recording actual overtime;
* determining whether approved overtime is payable or converted to time off in lieu;
* submitting verified payroll inputs;
* feeding weekly summary reports;
* supporting workforce planning;
* preserving an auditable history of time submissions, approvals and corrections.

The system must distinguish five separate concepts:

1. **Attendance** — whether an employee was expected and present for duty.
2. **Timesheet allocation** — what authorised work the employee performed.
3. **Assignment progress** — whether a task or deliverable has been completed.
4. **Overtime** — authorised work outside normal hours.
5. **Payroll input** — approved payable time transmitted to Finance.

These concepts may be related, but they must not be treated as interchangeable.

---

# 2. Product Principle

The module must answer:

* Was the employee expected to work on this date?
* Was the employee on approved leave or official travel?
* What work was performed?
* Which assignment, programme, project or activity consumed the time?
* How many ordinary working hours were recorded?
* Was any work performed outside normal hours?
* Was that overtime authorised before it was worked?
* How many overtime hours were approved?
* How many were actually worked?
* Is the overtime payable, convertible to TOIL or ineligible?
* Has the supervisor verified the record?
* Has HR validated the overtime entitlement?
* Has Finance received the approved payroll input?
* Was the time already included in a weekly summary?

The governing product rule is:

> Timesheets record verified time against authorised institutional work. They do not independently approve work, create payroll entitlement or grant leave in lieu.

---

# 3. Demo Changes Incorporated

## 3.1 Assignment integration

Employees must be able to select existing assignments rather than re-entering task descriptions.

Selecting an Assignment should prefill:

* assignment reference;
* title;
* source module;
* programme/project;
* responsible department;
* related PIF or correspondence;
* confidentiality.

Timesheets record time spent.

Assignments remain authoritative for:

* responsibility;
* deliverable;
* progress;
* completion;
* review.

---

## 3.2 PIF and project integration

Time may be allocated to:

* approved PIF activity;
* programme;
* project;
* donor framework;
* committee;
* statutory activity;
* internal administration.

This enables programme and donor reporting without adding detailed time reporting to the PIF itself.

---

## 3.3 Weekly summary integration

The Weekly Summary Module must be able to reuse:

* assignments worked on;
* hours recorded;
* key activities;
* completed work;
* blockers;
* travel/activity days.

Employees should not have to type the same work description twice.

Timesheet data should assist the weekly summary, but hours alone must not automatically generate a narrative report.

---

## 3.4 Travel and weekend duty

Approved travel must appear in the timesheet calendar.

Travel dates should not automatically be treated as overtime.

The employee or supervisor must identify:

* actual duty performed;
* travel-only time;
* ordinary activity time;
* authorised weekend/public-holiday duty;
* rest/personal time.

---

## 3.5 Leave integration

Approved leave must prefill the employee’s timesheet as unavailable time.

Employees must not record normal work against periods of approved leave without a controlled correction or authorised exception.

---

## 3.6 Overtime and leave in lieu

The demo requested a connection between overtime, travel and leave in lieu.

The module must therefore support:

**Advance Overtime Authorisation → Actual Overtime Record → Supervisor Verification → HR Validation → Payroll Payment or TOIL Credit**

It must not directly add TOIL to the Leave balance before HR validation.

---

## 3.7 No employee surveillance design

The module must not become:

* constant GPS tracking;
* screenshot capture;
* keyboard/mouse monitoring;
* webcam monitoring;
* productivity scoring;
* mandatory tracking of every minute.

The purpose is institutional accountability and cost allocation, not intrusive surveillance.

---

# 4. Business Objectives

The module must:

1. Replace paper and spreadsheet timesheets.
2. Provide reliable project/donor time allocation.
3. Reduce duplicate reporting.
4. Support payroll overtime controls.
5. Ensure overtime is authorised before it is performed.
6. Connect actual overtime to Leave/TOIL.
7. Reconcile leave, travel and attendance.
8. Give supervisors timely visibility of missing timesheets.
9. Prevent users from recording impossible or overlapping time.
10. Preserve all corrections and approvals.
11. Provide Finance with verified payroll inputs.
12. Provide Management with aggregate capacity information.
13. Avoid using timesheets as an automatic performance appraisal.
14. Support staff, temporary employees and project personnel according to their contracts.

---

# 5. Product Boundaries

## 5.1 Timesheets owns

* time periods;
* time entries;
* work-hour allocation;
* ordinary-hour totals;
* overtime requests;
* actual overtime entries;
* timesheet submission;
* supervisor review;
* HR overtime validation;
* payroll export status;
* time-record audit history.

## 5.2 Other modules remain authoritative

### Assignments

Owns task responsibility and completion.

### Leave

Owns approved absence and TOIL balances.

### Travel

Owns official travel authorisation and travel dates.

### PIF

Owns approved activity planning.

### M&E

Owns activity results and evidence.

### Payroll

Owns salary and overtime payment calculation.

### User Profiles / HR

Owns employment category, work schedule and supervisor.

---

# 6. Module Navigation

Main Menu → **Timesheets**

Employee menu:

* Timesheet Dashboard
* My Current Timesheet
* My Timesheets
* Record Time
* My Overtime Requests
* My Approved Overtime
* My Timesheet History
* Calendar

Supervisor menu:

* Team Timesheets
* Pending My Approval
* Missing Timesheets
* Overtime Requests
* Team Time Allocation
* Corrections

HR/Admin menu:

* Timesheet Register
* Overtime Validation
* Attendance Exceptions
* Leave/Travel Reconciliation
* Work Schedules
* Timesheet Compliance
* TOIL Transfer Queue
* Reports
* Settings

Finance menu:

* Approved Overtime Queue
* Payroll Export
* Payroll Reconciliation
* Overtime Reports

---

# 7. Primary Roles

* Employee
* Temporary Employee
* Part-Time Employee
* Project Employee
* Consultant, where contractually required
* Supervisor
* Head of Department
* Programme Manager
* Project Manager
* HR / Administration Officer
* Payroll Officer
* Finance Officer
* Director Finance and Corporate Services
* Secretary General
* Auditor
* System Administrator

---

# 8. Work Schedules

Every employee must have an applicable work schedule.

Default SADC PF schedule:

* Monday to Friday
* Workday start: 08:00
* Lunch start: 13:00
* Lunch end: 14:00
* Workday end: 17:00
* Expected ordinary hours: 8 hours

The schedule must be configurable and effective-dated because policy, contracts or specific employee arrangements may differ. 

---

# 9. Work Schedule Fields

* Schedule name
* Effective from
* Effective to
* Applicable employee category
* Workdays
* Start time
* End time
* Break duration
* Expected hours per day
* Expected hours per week
* Flexible schedule permitted
* Part-time schedule
* Public-holiday calendar
* Time zone
* Active status

---

# 10. Employee Schedule Assignment

An employee’s profile must identify:

* applicable schedule;
* duty station;
* employee category;
* full-time/part-time;
* supervisor;
* contract dates;
* overtime eligibility;
* applicable project/donor rules.

Historical timesheets must retain the schedule snapshot applicable during that period.

---

# 11. Timesheet Periods

The module should support configurable timesheet periods.

Recommended default:

* weekly employee submission;
* monthly payroll consolidation.

Possible period types:

* Weekly
* Fortnightly
* Monthly
* Project-specific

A period must have:

* start date;
* end date;
* submission deadline;
* supervisor approval deadline;
* HR validation deadline;
* payroll cutoff date;
* status.

---

# 12. Timesheet Period Lifecycle

Statuses:

* Upcoming
* Open
* Submission Due
* Supervisor Review
* HR Review
* Finance Processing
* Locked
* Closed
* Reopened
* Archived

A locked payroll period must not be casually edited.

---

# 13. Employee Timesheet Lifecycle

Statuses:

* Not Started
* Draft
* Incomplete
* Ready for Submission
* Submitted
* Pending Supervisor Review
* Returned for Correction
* Resubmitted
* Supervisor Approved
* Pending HR Validation
* HR Validated
* Payroll Exported
* Locked
* Closed
* Reopened

Not every ordinary timesheet requires HR review.

HR review should be required where the period contains:

* overtime;
* attendance exception;
* payroll impact;
* TOIL request;
* disputed time;
* manual adjustment.

---

# 14. Timesheet Header

Fields:

* Timesheet reference
* Employee
* Employee number
* Position
* Department
* Supervisor
* Employment category
* Work schedule
* Period start
* Period end
* Expected working hours
* Leave hours
* Travel hours
* Ordinary work hours
* Overtime hours
* Total recorded hours
* Status
* Submitted date
* Approved date
* Payroll status

---

# 15. Daily Timesheet View

Each day should display:

* Date
* Day of week
* Workday/non-workday
* Public holiday
* Approved leave
* Approved travel
* Expected hours
* Recorded ordinary hours
* Recorded overtime
* Missing hours
* Exception status

The employee should be able to expand a day and record one or more work entries.

---

# 16. Time Entry Fields

Each entry must include:

* Date
* Work category
* Duration
* Optional start time
* Optional end time
* Assignment
* Programme/project
* PIF/activity
* Department
* Donor/funding source, where relevant
* Work description
* Work location/type
* Billable/reportable classification where relevant
* Overtime indicator
* Supporting note
* Evidence/link, optional
* Created by
* Last updated

---

# 17. Duration-Based Entry

The standard form should allow:

* 1 hour
* 1.5 hours
* 4 hours
* 8 hours

without forcing users to enter exact start and end times for every office task.

Start/end times may be required for:

* overtime;
* temporary/hourly employees;
* attendance exceptions;
* specific donor requirements;
* field/event work.

---

# 18. Work Categories

Configurable categories:

* Assignment Work
* Programme Activity
* Project Activity
* Committee / Parliamentary Business
* PIF Activity
* M&E / Reporting
* Correspondence
* Procurement
* Travel Administration
* Finance / Budget
* ICT Support
* Communications
* Research
* Translation / Interpretation
* Management / Supervision
* Internal Administration
* Training
* Meeting
* Official Travel Duty
* Other

---

# 19. Internal Administration Categories

Examples:

* Staff meeting
* Planning
* Filing/documentation
* Email/correspondence
* General administration
* Professional development
* System administration
* Leave handover
* Other

The module must allow legitimate internal work that is not linked to a PIF or formal Assignment.

---

# 20. Source Linking

A time entry may have:

* one Primary Work Source;
* optional related records.

Primary source types:

* Assignment
* PIF
* M&E Activity
* Correspondence
* Procurement
* Travel
* Risk
* Meeting
* Project
* Departmental Administration
* Other

Do not store only mutable free-text titles where stable source IDs exist.

---

# 21. Assignment Integration

Selecting an Assignment should:

* verify the employee is an assignee/contributor or otherwise authorised;
* show assignment reference and title;
* inherit programme/project metadata;
* prevent access to restricted source details;
* show active/closed status.

Time may still be recorded after assignment closure for a controlled grace period where work occurred before closure.

---

# 22. Assignment Progress Rule

Recording eight hours against an Assignment must not automatically change it to:

* 50% complete;
* complete;
* verified.

Timesheet time and Assignment progress remain separate.

The user may optionally update Assignment progress through an explicit linked action.

---

# 23. Project and Donor Allocation

Projects may require employees to allocate time across:

* institutional/core work;
* Sida project;
* GIZ project;
* other donor work;
* statutory work.

The module must support:

* project code;
* donor;
* activity/output;
* cost centre;
* percentage of period;
* hours.

Donor-specific requirements must be configurable.

---

# 24. Time Allocation Validation

The system must prevent:

* same time interval recorded twice;
* more than 24 hours in one day;
* ordinary work exceeding configured thresholds without explanation;
* recording work during full-day leave;
* recording ordinary office work during incompatible travel periods;
* negative or zero duration;
* time outside contract dates;
* time against inaccessible projects.

---

# 25. Overlapping Entries

Where start/end times are used, the system must detect:

* Entry A: 08:00–12:00
* Entry B: 11:00–13:00

The overlap must be blocked or resolved.

Duration-only entries must be validated against daily maximums.

---

# 26. Expected Hours Reconciliation

For each period:

**Expected Work Hours**

minus

**Approved Leave Hours**

minus

**Approved Public Holiday Hours**

equals

**Required Accountable Hours**

The employee must account for required hours through:

* ordinary work;
* approved travel duty;
* authorised absence;
* other configured categories.

Overtime must not be used to hide missing ordinary hours.

---

# 27. Leave Integration

Approved leave should prepopulate:

* leave type;
* leave dates;
* full/half-day hours;
* reference.

Leave time is read-only in the Timesheet Module.

Corrections must be made through Leave or an authorised reconciliation process.

---

# 28. Sick Leave Privacy

The ordinary supervisor timesheet view should show:

* Approved Leave
  or
* Authorised Absence

without unnecessarily displaying medical details.

HR retains access according to Leave permissions.

---

# 29. Travel Integration

Approved travel should prepopulate:

* travel reference;
* destination;
* travel dates;
* activity/PIF;
* programme/project.

The employee then records, where required:

* official duty hours;
* travel/transit hours;
* ordinary scheduled hours;
* authorised overtime.

---

# 30. Travel Time Rule

Not every hour spent travelling is automatically:

* ordinary work;
* payable overtime;
* TOIL.

The applicable policy and prior overtime authorisation determine treatment.

The module must not invent travel-time compensation rules.

---

# 31. Public Holidays

Public holidays are derived from the applicable duty-station calendar.

Work recorded on a public holiday should trigger:

* overtime-authorisation check;
* non-working-day classification;
* supervisor/HR review.

---

# 32. Attendance vs Timesheets

Timesheets answer:

> What work did the employee report performing?

Attendance answers:

> Was the employee present or otherwise authorised to be absent?

The module may support attendance reconciliation, but timesheet completion alone must not be treated as indisputable proof of physical attendance.

---

# 33. Attendance Data Sources

Optional sources:

* employee declaration;
* reception/attendance register;
* access-control system;
* approved remote-work record;
* travel;
* leave;
* official event attendance;
* manual authorised correction.

Biometric attendance should not be required unless separately approved and legally assessed.

---

# 34. Attendance Statuses

Per day:

* Present
* Approved Remote Work
* Official Travel
* Approved Leave
* Public Holiday
* Weekend / Non-Working Day
* Authorised Overtime
* Unauthorised Absence Pending Review
* Attendance Exception
* Not Applicable

---

# 35. Attendance Exception

Examples:

* expected hours not accounted for;
* timesheet submitted while on full-day leave;
* access record absent;
* overlapping travel and office work;
* missing entry;
* unauthorised overtime.

An exception requires review.

It must not automatically become a disciplinary finding.

---

# 36. Remote Work

Where formally permitted, capture:

* Remote work: Yes/No
* Approved arrangement
* Location category
* Supervisor approval/reference
* Hours
* Work performed

The Timesheet Module must not create remote-work policy.

---

# 37. Overtime Principle

Overtime must follow:

**Need Identified → Advance Authorisation → Work Performed → Actual Hours Recorded → Supervisor Verification → HR Validation → Payment or TOIL**

The system must prevent normal overtime payment processing where advance authorisation is absent, unless a controlled exceptional process is approved.

---

# 38. Advance Overtime Requisition

Before overtime is worked, create an Overtime Requisition.

Fields:

* Requisition reference
* Employee(s)
* Department
* Supervisor
* HOD
* Assignment/activity
* Date
* Planned start
* Planned end
* Planned hours
* Reason
* Operational necessity
* Expected deliverable
* Workday type
* Proposed treatment:

  * Payment
  * TOIL
  * To be determined according to policy
* Budget/payroll consideration
* SG/designate approval
* Approval date

---

# 39. Group Overtime Requisition

One authorised event may involve several employees.

Example:

Plenary technical support.

The requisition may list multiple staff, but each employee must later have an individual actual-overtime record.

This supports differing actual hours and outcomes.

---

# 40. Overtime Approval Workflow

The Accounting Manual assigns responsibilities to:

* Supervisor — prepares overtime requisition;
* Head of Department — approves/monitors;
* Secretary General/designate — advance authority;
* HR/Administration — records and validates;
* Finance — processes approved payment. 

Recommended workflow:

1. Supervisor prepares.
2. HOD recommends.
3. SG/designate approves.
4. Employee works.
5. Employee/supervisor records actual hours.
6. HOD verifies.
7. HR validates entitlement.
8. Finance processes payment or Leave receives TOIL credit.

---

# 41. Actual Overtime Entry

Fields:

* Approved overtime requisition
* Employee
* Date
* Actual start
* Actual end
* Breaks
* Actual hours
* Work completed
* Assignment/activity
* Supervisor verification
* Difference from approved hours
* Difference explanation
* Evidence
* Proposed final treatment

---

# 42. Approved vs Actual Hours

Example:

Approved:
18:00–21:00, 3 hours

Actually worked:
18:00–20:15, 2.25 hours

Only verified actual eligible hours proceed.

If actual hours exceed approval:

* excess hours are flagged;
* supervisor explains;
* SG/designate exception approval may be required;
* excess is not automatically payable.

---

# 43. Overtime Eligibility

The system must support employee-category rules.

Fields in policy:

* eligible employee types;
* eligible grades;
* managerial/non-managerial treatment;
* payable overtime permitted;
* TOIL permitted;
* minimum unit;
* rounding rules;
* maximum hours;
* rest requirements;
* approval authority.

Do not assume all staff categories receive the same overtime treatment.

---

# 44. Overtime Rates

Current explicit rule:

* overtime on a normal working day: **1.5 times the normal rate**. 

The supplied policy extract does not establish every possible weekend/public-holiday multiplier.

Therefore:

* normal-day 1.5 may be configured from the current policy;
* weekend/public-holiday rates must not be invented;
* Finance/HR must configure them only from an approved policy source;
* the system may mark them `Policy Confirmation Required` until configured.

---

# 45. Overtime Rate Policy

Versioned fields:

* policy version;
* employee category;
* day type;
* time band;
* multiplier;
* minimum unit;
* rounding method;
* maximum payable hours;
* payment/TOIL eligibility;
* effective dates;
* approved authority;
* source document.

Historical calculations retain the applied policy version.

---

# 46. Overtime Calculation

The module may calculate:

* eligible hours;
* applicable multiplier;
* overtime units;
* indicative value.

However, Payroll remains authoritative for the monetary payment based on:

* applicable salary/rate;
* approved payroll rules;
* deductions;
* payroll period.

Timesheets should transmit verified hours and the policy reference, not independently post salary payments.

---

# 47. Payment vs TOIL

After validation, overtime treatment may be:

* Payable Overtime
* Time Off in Lieu
* Split Treatment, only if policy permits
* Not Eligible
* Exception Pending

The decision must record:

* policy basis;
* employee category;
* approved hours;
* approving officer;
* payroll/leave destination.

---

# 48. TOIL Transfer

Validated TOIL must be sent to the Leave Module.

Transferred fields:

* employee;
* source overtime record;
* duty date;
* approved amount;
* unit;
* validation date;
* expiry basis;
* SG exception where applicable.

Leave creates the actual TOIL credit and manages its use and expiry.

---

# 49. TOIL Expiry

The Administrative Rules require time off in lieu to be taken within 30 days after accrual unless the Secretary General authorises otherwise. 

Timesheets must preserve:

* source overtime date;
* validation date;
* amount transferred;
* Leave credit reference.

Leave remains authoritative for the expiry and remaining balance.

---

# 50. No Double Compensation

The same overtime hours must not result in both:

* payroll payment;
  and
* TOIL credit.

Use a unique settlement record and transactional controls.

Possible settlement statuses:

* Unsettled
* Sent to Payroll
* Paid
* Sent to Leave
* TOIL Credited
* Rejected
* Reversed

---

# 51. Overtime Amendment

Changes to approved planned overtime require:

* original hours;
* revised hours;
* reason;
* approval;
* timestamp.

Do not edit approved requisition history invisibly.

---

# 52. Emergency Overtime

Unexpected emergency work may occur without practical advance approval.

A controlled exception workflow may support:

* emergency description;
* reason advance approval was impossible;
* actual hours;
* supervisor confirmation;
* HOD recommendation;
* SG/designate retrospective decision;
* HR validation.

Retrospective approval must remain an exception report category.

---

# 53. Timesheet Submission

Before submission, the system validates:

* all required working days accounted for;
* no overlapping entries;
* daily totals valid;
* leave/travel reconciled;
* overtime linked to approval where required;
* descriptions present;
* required project allocation completed;
* employee declaration confirmed.

---

# 54. Employee Declaration

Suggested declaration:

> I confirm that the time recorded in this timesheet accurately reflects the authorised work and absence information for the stated period to the best of my knowledge.

Record:

* employee;
* declaration version;
* date/time;
* submitted total hours.

---

# 55. Supervisor Review

Supervisor sees:

* expected hours;
* ordinary hours;
* leave;
* travel;
* overtime;
* allocation by Assignment/project;
* exceptions;
* employee comments.

Actions:

* Approve
* Return for Correction
* Request Clarification
* Escalate Exception

Supervisor must not alter employee entries silently.

---

# 56. Returned Timesheet

When returning, supervisor must specify:

* date/entry;
* issue;
* required correction;
* due date;
* comment.

The original submitted version remains preserved.

---

# 57. HR Validation

HR reviews:

* schedule;
* leave reconciliation;
* overtime authorisation;
* actual hours;
* employee eligibility;
* payment/TOIL treatment;
* attendance exceptions.

HR may:

* Validate
* Return
* Mark Ineligible
* Request SG Exception
* Send to Payroll
* Send to Leave/TOIL

---

# 58. Finance / Payroll Processing

Finance receives only:

* HR-validated payable overtime;
* employee/payroll number;
* payroll period;
* approved hours;
* rate-policy reference;
* authorisation references;
* supporting sheet.

Finance records:

* payroll batch;
* processed hours;
* payment reference;
* processing status;
* variance/rejection.

---

# 59. Payroll Segregation

The Accounting Manual emphasises payroll segregation and states that overtime information originates from time records while HR/Admin submits the approved information to Finance. 

The system must therefore ensure:

* employee records time;
* supervisor verifies;
* HR validates;
* Finance processes;
* Finance does not modify the original time record;
* adjustment history is preserved.

---

# 60. Payroll Export Statuses

* Not Applicable
* Awaiting HR
* Ready for Payroll
* Exported
* Accepted by Payroll
* Rejected by Payroll
* Processed
* Reconciled
* Reversed

---

# 61. Payroll Reconciliation

Compare:

* approved overtime hours;
* exported hours;
* payroll-processed hours;
* rejected hours;
* amount reference where returned by Payroll.

Differences require explanation.

---

# 62. Temporary and Hourly Employees

For hourly-paid or casual staff, time records may directly support basic-pay calculations.

Additional controls:

* mandatory start/end times;
* mandatory supervisor approval;
* contract maximum;
* applicable hourly rate reference;
* attendance validation;
* payroll export.

The Accounting Manual specifically identifies attendance hours as an input for hourly-paid employee payroll. 

---

# 63. Consultants

Consultants should use Timesheets only where their contract requires time-based reporting.

Consultant timesheets must link to:

* contract;
* deliverable;
* project;
* rate arrangement;
* invoice/milestone.

The module must not treat consultants as employees for payroll or leave purposes.

---

# 64. Timesheet Corrections

Corrections depend on state.

## Draft

Employee edits freely.

## Submitted

Supervisor returns for correction.

## Approved but not payroll-exported

Controlled reopen.

## Payroll-exported

Correction requires:

* adjustment request;
* HR approval;
* Finance notification;
* possible payroll adjustment.

## Closed period

Formal correction transaction/version.

---

# 65. No Silent Editing

Supervisors, HR and administrators must not silently change employee-submitted time.

They may:

* return;
* propose correction;
* create authorised adjustment;
* reopen.

All changes must be attributable.

---

# 66. Timesheet Versioning

Every submission/revision creates a version.

Example:

* Draft
* Submitted v1
* Returned
* Resubmitted v2
* Approved v2
* Correction v3

Payroll exports identify the exact approved version.

---

# 67. Reopening

Authorised reopening requires:

* reason;
* requested by;
* approved by;
* affected period;
* payroll impact;
* new deadline.

Locked periods should remain locked unless the correction process is approved.

---

# 68. Missing Timesheets

The system must identify:

* not started;
* incomplete;
* overdue submission;
* pending supervisor review;
* pending HR validation.

Notifications should escalate according to configured deadlines.

---

# 69. Notifications

Notify when:

* timesheet period opens;
* submission is due;
* timesheet is overdue;
* supervisor review required;
* timesheet returned;
* timesheet approved;
* overtime request submitted;
* overtime approved/rejected;
* actual overtime confirmation required;
* HR validation required;
* payroll export processed;
* TOIL transferred;
* correction requested.

---

# 70. Timesheet Calendar

Calendar should display:

* working days;
* weekends;
* public holidays;
* approved leave;
* travel;
* timesheet completion status;
* overtime;
* submission deadline.

---

# 71. Employee Dashboard

Show:

* Current period
* Hours required
* Hours recorded
* Missing hours
* Overtime pending
* Submission deadline
* Returned corrections
* Recently approved timesheets
* TOIL transfer status

Primary action:

**Complete Timesheet**

---

# 72. Supervisor Dashboard

Show:

* Timesheets pending review
* Missing submissions
* Returned/resubmitted
* Overtime requests
* Team expected vs recorded hours
* Attendance exceptions
* Project allocation
* Leave/travel conflicts

---

# 73. HR Dashboard

Show:

* Overtime awaiting validation
* Unauthorised overtime
* Emergency retrospective requests
* Attendance exceptions
* Leave conflicts
* TOIL transfer queue
* Missing timesheets
* Employee schedule issues
* Payroll cutoff risks

---

# 74. Finance Dashboard

Show:

* Approved payable overtime
* Payroll exports
* Rejected payroll lines
* Reconciliation differences
* Overtime by department
* Overtime by period
* Overtime cost reference
* Unprocessed approved overtime

---

# 75. Management Dashboard

Aggregate information:

* Timesheet compliance
* Ordinary hours by department
* Project time allocation
* Donor-funded time
* Overtime trends
* Weekend/public-holiday work
* Unauthorised overtime exceptions
* Staff capacity distribution
* Missing submissions

Management views must not become minute-by-minute employee surveillance.

---

# 76. Weekly Summary Integration

The Weekly Summary Module may suggest:

* assignments with recorded time;
* projects worked on;
* activities attended;
* notable overtime/event support;
* incomplete or blocked work.

Employee selects and adds narrative.

Sensitive entries must respect Weekly Summary permissions.

---

# 77. M&E and Programme Reporting

M&E may read aggregate staff-time information where authorised:

* hours supporting a programme;
* hours supporting an activity;
* staff categories involved.

Timesheets must not populate M&E outcomes or results automatically.

---

# 78. Project Costing

Where Finance has authorised staff-cost allocation, the system may calculate an indicative project time cost using:

* approved costing rate;
* recorded hours;
* project.

This must remain separate from payroll salary disclosure.

Ordinary Programme Officers should not see confidential salary rates.

---

# 79. Costing Rate Privacy

Use project-costing rates such as:

* standard hourly cost;
* donor-agreed rate;
* grade-based burdened rate;

rather than exposing actual salary unnecessarily.

Rates require Finance permission.

---

# 80. Performance Appraisal Safeguard

Timesheet data may support evidence of work performed.

It must not automatically produce:

* performance scores;
* productivity rankings;
* disciplinary findings;
* promotion decisions.

Hours worked are not equivalent to outcomes achieved.

Assignment and appraisal reviews remain separate.

---

# 81. Reports

Required reports:

* Timesheet Register
* Employee Timesheet Report
* Department Timesheet Report
* Missing Timesheets
* Timesheet Compliance
* Hours by Programme
* Hours by Project
* Hours by Donor
* Hours by PIF/Activity
* Hours by Assignment
* Administrative Time Report
* Travel Duty Time Report
* Leave/Timesheet Reconciliation
* Attendance Exception Report
* Overtime Requisition Register
* Approved Overtime
* Actual Overtime
* Unauthorised Overtime
* Retrospective Overtime
* Overtime by Department
* Payable Overtime Report
* TOIL Transfer Report
* Payroll Export Report
* Payroll Reconciliation Report
* Timesheet Correction Report
* Audit Report

---

# 82. Timesheet PDF

Generate an official period timesheet containing:

* employee;
* employee number;
* position;
* department;
* period;
* daily entries;
* project/activity allocation;
* ordinary hours;
* overtime;
* leave/travel;
* employee declaration;
* supervisor decision;
* HR overtime validation;
* payroll status;
* workflow history.

---

# 83. Overtime Sheet PDF

The overtime sheet should include the Accounting Manual’s required information:

* employee name and number;
* date;
* reason;
* planned overtime hours;
* actual hours;
* prior authority;
* supervisor;
* HOD;
* SG/designate approval;
* HR validation;
* payment/TOIL treatment. 

---

# 84. Export Formats

* PDF
* Excel
* CSV where appropriate
* Payroll-specific structured export
* Donor/project timesheet export

Exports must identify:

* period;
* filter;
* generated by;
* generation time;
* version;
* confidentiality.

---

# 85. Data Model

Recommended entities:

### timesheet_periods

### employee_work_schedules

### employee_schedule_assignments

### timesheets

### timesheet_days

### timesheet_entries

### timesheet_entry_source_links

### timesheet_submissions

### timesheet_reviews

### timesheet_exceptions

### attendance_records

### attendance_exceptions

### overtime_requisitions

### overtime_requisition_employees

### overtime_actual_entries

### overtime_validations

### overtime_settlements

### payroll_export_batches

### payroll_export_lines

### timesheet_corrections

### timesheet_documents

### timesheet_audit_events

---

# 86. Timesheet Entry Model

Suggested fields:

* id
* timesheet_id
* employee_id
* work_date
* duration_minutes
* start_time, nullable
* end_time, nullable
* entry_type
* work_category_id
* primary_source_type
* primary_source_id
* programme_id
* project_id
* pif_id, nullable
* assignment_id, nullable
* department_id
* description
* ordinary_minutes
* overtime_minutes
* location_type
* status
* created_by
* timestamps

Use minutes as the authoritative duration unit to avoid floating-point errors.

---

# 87. Overtime Requisition Model

Fields:

* reference
* department_id
* requested_by
* supervisor_id
* hod_id
* approver_id
* source_type
* source_id
* reason
* planned_date
* planned_start
* planned_end
* planned_minutes
* day_type
* proposed_treatment
* status
* approved_at
* policy_version_id

Employee participants should be relational child records, not an unstructured JSON array.

---

# 88. Overtime Settlement Model

Fields:

* overtime_actual_entry_id
* eligible_minutes
* settlement_type
* payroll_export_line_id, nullable
* toil_credit_reference, nullable
* policy_version_id
* settled_by
* settled_at
* status

Apply a uniqueness constraint preventing duplicate settlement.

---

# 89. API Requirements

Core:

* `GET /timesheets/dashboard`
* `GET /timesheets/periods`
* `GET /timesheets/current`
* `GET /timesheets/{id}`
* `POST /timesheets/{id}/entries`
* `PUT /timesheet-entries/{id}`
* `DELETE /timesheet-entries/{id}`
* `POST /timesheets/{id}/submit`
* `POST /timesheets/{id}/return`
* `POST /timesheets/{id}/supervisor-approve`
* `POST /timesheets/{id}/reopen`

Overtime:

* `POST /overtime-requisitions`
* `POST /overtime-requisitions/{id}/submit`
* `POST /overtime-requisitions/{id}/recommend`
* `POST /overtime-requisitions/{id}/approve`
* `POST /overtime-requisitions/{id}/reject`
* `POST /overtime-requisitions/{id}/actuals`
* `POST /overtime-actuals/{id}/verify`
* `POST /overtime-actuals/{id}/hr-validate`
* `POST /overtime-actuals/{id}/send-to-payroll`
* `POST /overtime-actuals/{id}/send-to-toil`

Payroll:

* `POST /timesheets/payroll-exports`
* `POST /timesheets/payroll-exports/{id}/reconcile`

---

# 90. Permission Model

Recommended permissions:

* `timesheets.view-own`
* `timesheets.create-own`
* `timesheets.edit-own-draft`
* `timesheets.submit`
* `timesheets.view-team`
* `timesheets.review-team`
* `timesheets.return`
* `timesheets.approve`
* `timesheets.manage-schedules`
* `timesheets.manage-periods`
* `timesheets.view-attendance`
* `timesheets.manage-attendance-exceptions`
* `overtime.request`
* `overtime.recommend`
* `overtime.approve`
* `overtime.verify-actual`
* `overtime.hr-validate`
* `overtime.send-payroll`
* `overtime.send-toil`
* `timesheets.export`
* `timesheets.audit`
* `timesheets.admin`

---

# 91. Separation of Duties

At minimum:

* employee cannot supervisor-approve own timesheet;
* employee cannot approve own overtime;
* supervisor cannot create payroll payment;
* HR validates but does not process payroll payment;
* Finance cannot alter employee time records;
* TOIL transfer requires HR validation;
* system administrator does not automatically receive business approval authority;
* overtime requester and SG/designate approval remain separately attributable.

---

# 92. Delegation

Formal delegation may support:

* acting supervisor;
* temporary HOD;
* SG designate;
* leave/travel coverage.

Audit must show:

> Approved by User B on behalf of User A under delegation DLG-XXXX.

Delegation must not allow an employee to approve their own time through acting authority.

---

# 93. Concurrency Controls

Prevent:

* employee editing while supervisor approves;
* two supervisors approving same timesheet;
* overtime sent to Payroll and Leave simultaneously;
* duplicate payroll export;
* duplicate TOIL transfer;
* correction posted against stale version.

Use transactions and record version checks.

---

# 94. Idempotency

Required for:

* timesheet submission;
* supervisor approval;
* overtime settlement;
* payroll export;
* TOIL transfer.

Network retries must not create duplicate financial or leave consequences.

---

# 95. Audit Trail

Events:

* Period opened
* Timesheet created
* Entry created/edited/deleted
* Leave imported
* Travel imported
* Exception created
* Timesheet submitted
* Timesheet returned
* Timesheet resubmitted
* Supervisor approved
* Overtime requested
* Overtime recommended
* Overtime approved/rejected
* Actual overtime entered
* Actual overtime verified
* HR validated
* Sent to Payroll
* Sent to Leave
* Payroll accepted/rejected
* Correction requested
* Period reopened
* Period locked
* Export generated

Audit records must preserve:

* user;
* role;
* timestamp;
* previous value;
* new value;
* reason;
* source;
* delegation;
* version.

---

# 96. Security and Privacy

The module must enforce:

* record-level access;
* salary/rate confidentiality;
* project confidentiality;
* secure donor/project records;
* protected payroll exports;
* restricted attendance exceptions;
* mass-assignment protection;
* IDOR prevention;
* secure attachment access;
* confidential search restrictions;
* audit logging.

Employees must not see colleagues’ detailed timesheets unless authorised.

---

# 97. Migration

Potential sources:

* paper overtime sheets;
* Excel timesheets;
* donor project timesheets;
* attendance registers;
* payroll overtime schedules.

Migration priority:

1. Current open payroll period
2. Outstanding overtime
3. Current donor reporting period
4. Current TOIL source records
5. Selected historical records

Do not import unreliable historical detail as verified data.

---

# 98. Historical Records

Migrated records should show:

* legacy source;
* original period;
* imported by;
* validation status;
* source attachment;
* migration batch.

Statuses:

* Migrated — Verified
* Migrated — Unverified
* Historical Summary Only

---

# 99. Backend Tests

Must cover:

* work schedules;
* expected-hour calculation;
* public holidays;
* leave import;
* travel import;
* ordinary entries;
* overlapping entries;
* daily limits;
* assignment/project links;
* submission;
* return/resubmission;
* supervisor approval;
* overtime advance approval;
* actual vs planned overtime;
* normal-day 1.5 policy;
* unconfigured day-type rate handling;
* HR validation;
* payroll export;
* TOIL transfer;
* duplicate-settlement prevention;
* corrections;
* locking;
* permissions;
* audit.

---

# 100. Frontend / E2E Tests

Must cover:

* current timesheet dashboard;
* add Assignment time;
* add project time;
* leave prefill;
* travel prefill;
* missing-hour warning;
* overlap warning;
* submit;
* supervisor return;
* correct and resubmit;
* approve;
* create overtime requisition;
* SG approval;
* record actual overtime;
* HR validation;
* send to Payroll;
* send to TOIL;
* weekly summary reuse;
* reports.

---

# 101. Security Tests

Must prove:

* employee cannot view another employee’s private timesheet;
* employee cannot approve own timesheet;
* employee cannot approve own overtime;
* direct API cannot create payable overtime without approval;
* Finance cannot modify actual hours;
* same overtime cannot be paid and credited as TOIL;
* confidential project time is protected;
* closed payroll periods cannot be silently edited;
* search and exports respect access controls;
* delegated approval cannot bypass self-approval restrictions.

---

# 102. Production Acceptance Criteria

The module is production-ready only when:

1. Employee work schedules can be configured.
2. Default SADC PF office schedule is supported.
3. Weekly/monthly periods can be configured.
4. Employees can record time.
5. Duration-based entries work.
6. Optional start/end times work.
7. Assignment links work.
8. PIF/project links work.
9. Internal administrative time works.
10. Approved leave prefills correctly.
11. Approved travel prefills correctly.
12. Public holidays calculate correctly.
13. Expected hours calculate correctly.
14. Missing hours are shown.
15. Overlapping entries are blocked.
16. Daily maximums are controlled.
17. Employees can submit timesheets.
18. Supervisor review works.
19. Returned timesheets preserve prior versions.
20. HR exception review works.
21. Overtime must be requested in advance.
22. HOD recommendation works.
23. SG/designate approval works.
24. Actual overtime is recorded separately from planned overtime.
25. Excess actual hours are flagged.
26. Normal working-day 1.5 rule can be applied.
27. Unapproved weekend/public-holiday multipliers are not invented.
28. HR can validate overtime eligibility.
29. Approved overtime can be sent to Payroll.
30. Approved overtime can be sent to Leave as TOIL.
31. Same overtime cannot receive both settlements.
32. TOIL source traceability is preserved.
33. Payroll exports are versioned.
34. Payroll reconciliation works.
35. Closed periods require controlled correction.
36. Weekly Summary can reuse approved data.
37. Management reports use aggregate data appropriately.
38. Timesheets do not automatically score employee performance.
39. Notifications work.
40. Full audit trail exists.
41. Existing Assignment, Leave, Travel, Payroll, PIF, M&E and Weekly Summary integrations pass regression testing.

---

# 103. Phase 1 — Production Critical

Implement:

* Employee schedules
* Timesheet periods
* Daily time entries
* Assignment links
* Programme/project/PIF links
* Leave integration
* Travel integration
* Expected-hour reconciliation
* Submission and supervisor review
* Overtime requisitions
* Advance approvals
* Actual overtime
* HR validation
* Payroll export
* TOIL transfer
* Notifications
* Reports
* PDF/Excel exports
* Audit trail
* Permissions
* Weekly Summary integration contract

---

# 104. Phase 2

Add:

* donor-specific templates;
* deeper accounting/payroll API integration;
* optional attendance-system integration;
* advanced workforce-capacity analytics;
* project-cost allocation;
* offline field timesheets;
* calendar integration.

---

# 105. Phase 3

Optional:

* suggested time entries from Assignments/calendar;
* automated missing-entry prompts;
* AI-assisted weekly summaries;
* anomaly detection;
* project forecasting.

Suggestions must require employee confirmation.

The system must never fabricate worked hours automatically.

---

# 106. Critical Architecture Rules

The implementation team must treat the following as non-negotiable:

> **Timesheets are not Assignment completion records.**

> **Timesheets are not automatic proof of physical attendance.**

> **Overtime must be authorised before it is performed, except through a controlled emergency exception.**

> **Planned overtime and actual overtime must be separate records.**

> **The employee cannot self-approve a timesheet or overtime.**

> **HR validates entitlement; Finance processes payment.**

> **The same overtime cannot result in both pay and TOIL.**

> **Travel over a weekend does not automatically create overtime or TOIL.**

> **Leave and travel data must be linked from their authoritative modules, not retyped.**

> **Supervisors and administrators must not silently edit employee submissions.**

> **Closed/payroll-exported periods require controlled corrections.**

> **Do not invent weekend or public-holiday overtime rates that are not present in an approved policy.**

> **Do not turn time records into employee surveillance or automatic performance rankings.**

> **Every payroll and TOIL consequence must be traceable to an authorised source record.**

---

# 107. Final Product Rule

An employee should be able to open Nexus and immediately answer:

**How many hours must I account for this week?**
→ expected hours

**What leave or travel is already included?**
→ integrated calendar

**Which assignments did I work on?**
→ Assignment links

**Which project or activity should receive the time?**
→ project/PIF selection

**Is any time missing or overlapping?**
→ validation

**Was my overtime approved before I worked it?**
→ overtime requisition

**How many overtime hours were verified?**
→ actual record

**Will the overtime be paid or converted to TOIL?**
→ settlement status

**Has my supervisor approved the timesheet?**
→ workflow tracker

**Has Finance received the approved overtime?**
→ payroll status

A supervisor, HR Officer and Finance Officer must each see only the information and actions relevant to their responsibilities.
