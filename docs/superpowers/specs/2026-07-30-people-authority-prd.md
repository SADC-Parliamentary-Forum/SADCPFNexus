# SADC PF Nexus

# User Profiles, Organisational Structure, Digital Signatures & Delegation Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** User Profiles, Organisational Structure, Digital Signatures & Delegation
**Short name:** People & Authority
**Document status:** Updated implementation PRD
**Module type:** Institutional identity, position, reporting-line, authority and secure-signing foundation

The next module is **User Profiles, Organisational Structure, Digital Signatures & Delegation**.

This is a foundational Nexus module. Every approval, assignment, signature, dashboard, access decision and audit record depends on knowing:

* who the user is;
* what position the person occupies;
* which department they belong to;
* who supervises them;
* what authority their position carries;
* whether they are acting for someone;
* whether they may prepare, recommend, certify, approve or sign;
* whether that authority was valid at the moment an action occurred.

The Administrative Rules require staff to operate within the prevailing organisational hierarchy and require communication and reporting relationships to follow that hierarchy. They also require duties to be assigned according to job descriptions, competence and qualifications. 

The Rules require Human Resources to maintain separate open and confidential personnel files, while changes to job descriptions or promotions must be documented in writing and signed by both the Secretary General and employee.  The Constitution further provides that agreements between SADC PF and other parties must be signed by persons duly authorised by the Executive Committee. 

---

# 1. Executive Summary

The People & Authority Module will provide the institutional foundation for:

* user profiles;
* employee records;
* organisational units;
* positions;
* reporting lines;
* job descriptions;
* employment assignments;
* acting appointments;
* temporary assignments;
* approval authority;
* signing authority;
* formal delegation;
* preparation on behalf of another person;
* secure digital signatures;
* role assignment;
* onboarding;
* transfers and promotions;
* offboarding;
* staff directory;
* organisation charts;
* workflow routing;
* signature verification;
* authority history;
* complete auditability.

The module must answer:

* Who is this user?
* Is the person an active employee, consultant, auditor or guest?
* Which position does the person substantively occupy?
* Are they acting in another position?
* Which department and supervisor apply?
* What duties and job description apply?
* What system roles do they have?
* What business authority does their position carry?
* Can they prepare, recommend, certify, approve or sign this record?
* Are they acting under a valid delegation?
* When does the delegation begin and end?
* Is the delegation limited by value, module, document or action?
* Was the person authorised when the historical action occurred?
* Has their signature been securely applied?
* Has their account or authority been suspended or revoked?

---

# 2. Core Product Principle

The module must distinguish:

1. **Person**
2. **Employment relationship**
3. **Position**
4. **Organisational unit**
5. **User account**
6. **System role**
7. **Business authority**
8. **Acting appointment**
9. **Delegation**
10. **Digital-signing identity**

These are related but not interchangeable.

The primary architecture rule is:

> Access and authority must be granted to a verified person through an active account, valid position or explicit appointment, approved role and effective-dated authority—not merely because the person’s name appears in a database.

---

# 3. Product Boundary

## 3.1 This module owns

* people and employee profiles;
* organisation structures;
* departments and directorates;
* positions;
* substantive position assignments;
* reporting relationships;
* acting appointments;
* business authority;
* approval and signing mandates;
* delegation records;
* signature enrolment and status;
* profile lifecycle;
* onboarding/offboarding coordination.

## 3.2 Authentication Module owns

* usernames;
* passwords;
* MFA;
* password reset;
* login sessions;
* account lockout;
* credential recovery;
* identity verification during registration;
* refresh/access tokens.

The People & Authority Module references the authentication account but must not store passwords.

## 3.3 Workflow Engine owns

* workflow instances;
* approval stages;
* current holder;
* routing;
* return/resubmit;
* workflow decisions.

People & Authority determines who is eligible to act.

## 3.4 HR records remain restricted

This module may hold or link employee information but must not become an uncontrolled general HR database.

---

# 4. Business Objectives

The module must:

1. Establish one authoritative staff identity.
2. Maintain an accurate organisational hierarchy.
3. Separate people from positions.
4. Preserve historical position and reporting records.
5. Route workflows according to current approved hierarchy.
6. enforce least privilege.
7. prevent credential and signature sharing.
8. support formal acting appointments and delegation.
9. distinguish authority from application permissions.
10. secure digital signatures.
11. support employee onboarding, movement and departure.
12. preserve authority snapshots for historical approvals.
13. reduce manual profile duplication across Nexus.
14. protect confidential personnel data.
15. support organisation charts and staff directories.
16. provide complete profile and authority audit trails.

---

# 5. Critical Architecture Distinctions

## 5.1 Person vs User Account

A person may exist before an account is created.

A person may also remain in historical records after their account has been disabled.

## 5.2 Position vs Employee

A position exists independently of the employee occupying it.

Example:

**Position:** ICT Officer
**Occupant:** Ronald Windwaai

If the employee leaves, the position becomes vacant; it is not deleted.

## 5.3 System Role vs Job Title

A job title does not automatically define every technical permission.

Example:

**Position:** Finance Officer
**System roles:** Finance User, Budget Reviewer

## 5.4 Permission vs Approval Authority

A user may have permission to open the approval screen but still lack authority to approve a specific transaction.

## 5.5 Acting Appointment vs Delegation

An acting appointment assigns broader responsibility for a position.

A delegation authorises specific actions for a defined period and scope.

## 5.6 Signature Image vs Digital Signature

A visible signature image is not, by itself, sufficient evidence of an authorised digital signing action.

---

# 6. Policy Basis

The Administrative Rules require:

* confidential official material to be protected;
* staff to exercise discretion over official information;
* duties to be assigned according to job descriptions, competence and qualifications;
* staff to respect the organisational hierarchy;
* reporting and communication relationships to conform to that hierarchy. 

The Rules also require:

* separate open and confidential personnel files;
* records of leave, overtime, employment, contracts and other personnel information;
* changes to job descriptions and promotions to be formally documented and signed. 

The Constitution establishes the Secretariat under the Secretary General, who administers the Forum’s affairs and manages Secretariat staff under the general direction of the Executive Committee. 

The Accounting Manual requires organisational controls that define authority and responsibility, segregation of duties and approval at appropriate authority levels. 

---

# 7. Module Navigation

Main Menu → **People & Authority**

Employee menu:

* My Profile
* My Position
* My Reporting Line
* My Roles
* My Authority
* My Signature
* My Delegations
* Acting Appointments
* Staff Directory
* Organisation Chart

HR/Admin menu:

* People Directory
* Employee Profiles
* Personnel Files
* Organisational Units
* Positions
* Position Assignments
* Reporting Relationships
* Job Descriptions
* Acting Appointments
* Delegations
* Authority Register
* Signature Register
* Onboarding
* Transfers and Promotions
* Offboarding
* Profile Change Requests
* Reports
* Settings

Security/Admin menu:

* User Accounts
* Role Assignments
* Permission Reviews
* Privileged Access
* Dormant Accounts
* Access Recertification
* Security Exceptions

---

# 8. Primary Roles

* Employee
* Supervisor
* Head of Department
* Director
* HR Officer
* Administration Officer
* ICT/System Administrator
* Security Administrator
* Secretary General
* Executive Assistant
* Internal Auditor
* External Auditor Guest
* Consultant/Temporary User
* Role Administrator
* Authority Administrator
* Signature Administrator
* Delegation Administrator

No one role should control the entire identity lifecycle.

---

# 9. Person Master Record

Each individual must have one stable person record.

Fields:

* Person UUID
* Employee/person number
* Legal first name
* Legal surname
* Preferred name
* Former names, restricted where applicable
* Title
* Initials
* Profile photograph
* Official email
* Secondary official email, optional
* Official phone
* Office location
* Duty station
* Time zone
* Preferred language
* Other working languages
* Nationality, restricted if required
* Person type
* Status
* Authentication account reference

Sensitive personal information must be minimised.

---

# 10. Person Types

Supported types:

* Permanent Employee
* Fixed-Term Employee
* Temporary Employee
* Part-Time Employee
* Seconded Employee
* Consultant
* Intern
* Contractor
* External Auditor
* Guest Reviewer
* Governance User
* Technical Service Account
* Other approved type

Service accounts must not be represented as human employees.

---

# 11. Profile Information Levels

## 11.1 Directory information

Visible to authorised staff:

* name;
* title;
* department;
* official email;
* official telephone;
* office;
* supervisor;
* profile photograph.

## 11.2 Operational information

Visible to relevant modules:

* position;
* reporting line;
* duty station;
* employment status;
* work schedule;
* approval authority;
* delegation.

## 11.3 Confidential HR information

Restricted:

* contract;
* salary;
* bank details;
* medical documentation;
* performance appraisals;
* disciplinary records;
* salary advances;
* private addresses;
* family information.

The Administrative Rules expressly distinguish open and confidential personnel files. Nexus must preserve that principle. 

---

# 12. Employee Profile

Employee-specific fields:

* Employee number
* Employment type
* Employment status
* Appointment date
* Start date
* Contract start
* Contract end
* Confirmation/probation status
* Regional/local position
* Substantive position
* Department
* Directorate
* Supervisor
* Duty station
* Work schedule
* Leave policy
* Payroll identifier
* Asset-clearance status
* Confidentiality agreement status
* Job description
* Profile effective date

---

# 13. Personnel Files

Nexus should support two logical personnel-file classifications:

## Open Personnel File

May contain:

* Employee Record Form
* CV
* qualifications
* approved employment information
* leave records
* overtime records
* official furniture/asset records
* other non-highly-confidential HR records.

## Confidential Personnel File

May contain:

* medical records;
* employment contracts;
* appointment letters;
* bank information;
* salary records;
* appraisal records;
* salary advances;
* loans;
* sensitive HR records.

Access must be permission-controlled at document level. 

---

# 14. Personnel Document Rules

Every personnel document must have:

* Employee
* Document category
* Document title
* Effective date
* Expiry date, where applicable
* Confidentiality level
* Uploaded by
* Verified by
* Source
* Version
* Retention classification

Users must not upload sensitive records into the open file accidentally.

---

# 15. Organisational Structure

The structure must support:

* Secretariat
* Directorate
* Department
* Unit
* Programme
* Project
* Functional Team
* Temporary Task Team
* Office
* Governance body where needed for routing

Each organisational unit has:

* unique code;
* name;
* type;
* parent unit;
* head position;
* effective date;
* status;
* cost centre where applicable.

---

# 16. Effective-Dated Organisation Chart

Organisational structures change.

The system must preserve:

* previous structure;
* current structure;
* approved future structure.

Example:

A department may move from one Directorate to another on a specified date.

Historical approvals must continue to show the structure that applied at the time.

---

# 17. Organisational Unit Statuses

* Proposed
* Approved Future
* Active
* Under Restructuring
* Inactive
* Abolished
* Archived

Inactive or abolished units remain available for historical reporting.

---

# 18. Position Register

Every approved position must have:

* Position ID
* Position code
* Official title
* Organisational unit
* Grade/category
* Employment classification
* Regional/local classification
* Reports-to position
* Supervisory status
* Managerial status
* Job-description reference
* Approval authority template
* Role template
* Headcount
* Effective dates
* Status

---

# 19. Position Statuses

* Proposed
* Approved
* Vacant
* Occupied
* Temporarily Vacant
* Acting Occupant
* Frozen
* Under Review
* Abolished
* Archived

---

# 20. Position vs Occupant

The position record must not contain only the current employee’s details.

Use a separate:

**Position Assignment**

Fields:

* Position
* Person
* Assignment type
* Effective start
* Effective end
* Substantive/acting/temporary
* Appointment reference
* Approved by
* Status

---

# 21. Position Assignment Types

* Substantive
* Acting
* Temporary
* Secondment
* Interim
* Additional Assignment
* Project Assignment
* Functional Responsibility
* Other approved assignment

One employee may have:

* one substantive position;
* one acting position;
* several project responsibilities.

---

# 22. Job Descriptions

Job-description record:

* Position
* Job title
* Purpose
* Key duties
* Reporting line
* Supervisory responsibility
* Required qualifications
* Required competence
* Approval authority
* Effective date
* Version
* Approved by
* Employee acknowledgement
* Signed document

Duties must be linked to positions rather than copied into every user profile.

---

# 23. Job-Description Changes

The Rules require changes to job descriptions or promotions to be documented in writing and signed by the Secretary General and employee. 

Workflow:

1. Change proposed.
2. HR reviews.
3. Supervisor/Director recommends.
4. SG approves.
5. Employee acknowledges/signs.
6. New version becomes effective.
7. Previous version retained.
8. Personnel file updated.
9. Roles and authority reviewed.

---

# 24. Reporting Relationships

The system must support:

* Line Manager
* Functional Manager
* Project Manager
* Acting Supervisor
* Dotted-Line Supervisor
* Escalation Manager
* Reviewer

One primary line supervisor must be identifiable.

---

# 25. Reporting-Line Rules

The organisation hierarchy must prevent:

* circular reporting;
* employee reporting to themselves;
* orphaned active positions;
* expired supervisor relationships;
* conflicting primary supervisors.

The Administrative Rules require communication and reporting relationships to follow the prevailing hierarchy. 

---

# 26. Supervisor Resolution

When a workflow asks for `Employee Supervisor`, Nexus must resolve:

1. active substantive reporting relationship;
2. active acting supervisor, where formally appointed;
3. approved delegated supervisor;
4. escalation path if none exists.

The result must be recorded as a workflow snapshot.

---

# 27. Organisation Chart

Provide visual and list views.

Users should be able to see:

* organisational units;
* head positions;
* occupied positions;
* vacancies;
* reporting relationships;
* acting occupants;
* contact details, subject to permission.

Do not expose confidential HR data in the chart.

---

# 28. User Account Lifecycle

Account statuses:

* Not Created
* Invitation Pending
* Registration Pending
* Active
* Temporarily Suspended
* Locked
* Disabled
* Terminated
* Archived

Account status must be separate from employment status.

---

# 29. Employment Statuses

* Pre-Employment
* Probation
* Active
* Approved Leave
* Seconded
* Suspended
* Notice Period
* Contract Ended
* Resigned
* Retired
* Terminated
* Deceased
* Historical

Employment status changes must trigger relevant access reviews.

---

# 30. Onboarding

Recommended onboarding workflow:

1. Appointment approved.
2. Person record created.
3. Employment record created.
4. Position assigned.
5. Supervisor confirmed.
6. Job description attached.
7. Confidentiality agreement signed.
8. Official email created.
9. Nexus invitation sent.
10. Identity registered.
11. MFA enrolled.
12. Role template proposed.
13. Security/manager approval completed.
14. Signature enrolled where authorised.
15. Assets issued.
16. Work schedule assigned.
17. Onboarding completed.

---

# 31. Role Provisioning During Onboarding

Roles should be proposed based on:

* position;
* department;
* employee type;
* project;
* temporary responsibility.

Role assignment must not be blindly automatic for privileged positions.

Recommended:

* standard low-risk roles may be automatically provisioned after approved onboarding;
* privileged roles require explicit approval;
* financial and administrative authority requires separate confirmation.

---

# 32. Transfers

Employee transfer workflow:

1. Transfer approved.
2. Effective date captured.
3. New position/department selected.
4. New supervisor confirmed.
5. Existing roles reviewed.
6. Old department permissions scheduled for removal.
7. New permissions approved.
8. open assignments reviewed.
9. workflow ownership reviewed.
10. asset custody reviewed.
11. delegation reviewed.
12. new structure becomes effective.

Do not retain obsolete access merely because the person still works for SADC PF.

---

# 33. Promotions

Promotion must create:

* new position assignment or position version;
* new grade/category;
* job-description version;
* effective date;
* authority review;
* role review;
* signed employee acknowledgement;
* historical record.

It must not overwrite the former position history.

---

# 34. Offboarding

Offboarding must coordinate:

* account disablement;
* session/token revocation;
* MFA deactivation;
* signature suspension;
* role removal;
* delegation revocation;
* open workflow reassignment;
* Assignment handover;
* correspondence handover;
* asset return;
* document ownership transfer;
* leave/payroll clearance;
* audit preservation;
* final account archival.

---

# 35. Access Termination Timing

For planned departures:

* access removal may occur at the approved end time.

For urgent security or disciplinary suspension:

* authorised immediate account suspension must be supported.

HR employment termination and ICT account disabling are distinct but linked actions.

---

# 36. Historical Attribution

Disabling an account must never replace historical records with:

> Deleted User

Approvals and audit entries must retain:

* user’s name;
* employee number;
* position at time;
* department at time;
* authority used;
* delegation, if any.

---

# 37. Roles

System roles may include:

* Employee
* Supervisor
* HOD
* Director
* HR Officer
* Finance Officer
* Procurement Officer
* Stores Officer
* Asset Officer
* Programme Officer
* M&E Officer
* Auditor
* System Administrator

Roles are technical access groupings.

They are not sufficient proof of business approval authority.

---

# 38. Permission Model

Permissions should use explicit actions such as:

* `leave.create-own`
* `leave.certify`
* `travel.recommend`
* `procurement.evaluate`
* `budget.certify`
* `correspondence.route`
* `audit.issue-finding`
* `risk.accept`
* `documents.sign`

Avoid one broad permission such as:

`admin.all`

for normal business users.

---

# 39. Role Assignment

Every role assignment must contain:

* User
* Role
* Scope
* Effective date
* Expiry date
* Reason
* Requested by
* Approved by
* Source position/appointment
* Status

Scopes may include:

* own records;
* department;
* project;
* programme;
* institution;
* specific record.

---

# 40. Role Assignment Statuses

* Proposed
* Pending Approval
* Active
* Suspended
* Expired
* Revoked
* Rejected
* Archived

---

# 41. Role Templates

Position templates may propose standard roles.

Example:

**Position:** Procurement Officer

Proposed roles:

* Procurement User
* Supplier Viewer
* Stock Intake Viewer

Templates must not automatically grant final approval or payment authority without explicit policy.

---

# 42. Privileged Access

Privileged roles include:

* System Administrator
* Security Administrator
* Role Administrator
* Finance Approval Administrator
* Signature Administrator
* Audit Administrator
* Database/Infrastructure Service roles

Requirements:

* explicit approval;
* MFA;
* limited duration where possible;
* justification;
* enhanced logging;
* periodic review.

---

# 43. No Business Authority from Technical Administration

A System Administrator may maintain the platform but must not automatically:

* approve leave;
* approve procurement;
* sign contracts;
* certify budgets;
* accept risks;
* close audit findings.

Technical privilege and business authority must remain separate.

---

# 44. Approval Authority

Business authority must be represented through an:

**Authority Register**

Authority types:

* Prepare
* Submit
* Recommend
* Review
* Verify
* Certify
* Approve
* Authorise
* Sign
* Witness
* Release
* Reopen
* Cancel
* Accept Risk
* Dispose
* Other

---

# 45. Authority Scope

Authority may depend on:

* Module
* Document type
* Organisational unit
* Project
* Donor
* Currency
* Amount
* Risk rating
* Confidentiality
* Employment category
* Geographic scope
* Effective dates

Example:

> May certify Travel DSA for the Finance Department, but may not grant final Travel approval.

---

# 46. Authority Register Fields

* Authority ID
* Authority name
* Action
* Position or person
* Module
* Record/document type
* Scope
* Amount threshold
* Currency
* Conditions
* Effective date
* Expiry date
* Source policy
* Policy version
* Approved by
* Status

---

# 47. Position-Based Authority

Preferred model:

Authority attaches to a **position**.

The active occupant receives the authority while validly assigned.

This reduces manual role changes when position occupants change.

Person-specific authority should be exceptional and justified.

---

# 48. Authority Matrix

Example matrix:

| Record         | Prepare           | Recommend  | Certify  | Final Approve        | Sign                 |
| -------------- | ----------------- | ---------- | -------- | -------------------- | -------------------- |
| Leave          | Employee          | HOD        | HR/Admin | SG                   | SG                   |
| Travel         | Traveller/Admin   | HOD        | Finance  | SG                   | SG                   |
| PIF            | Programme Officer | Director   | Finance  | SG                   | SG                   |
| Salary Advance | Employee          | Supervisor | Finance  | SG                   | SG                   |
| Procurement    | Requester         | HOD        | Finance  | Authority per policy | Authorised signatory |

The actual matrix must be configurable and policy-versioned.

---

# 49. Signing Authority

The Constitution requires agreements to be signed by persons duly authorised by the Executive Committee. 

Signing authority must therefore record:

* signatory;
* position;
* document type;
* authority source;
* Executive Committee or other mandate reference;
* value threshold;
* conditions;
* effective period;
* revocation.

Possession of a stored signature must never create signing authority.

---

# 50. Contract-Signing Rules

The Accounting Manual contains contract-signing levels based on value and role. 

Because the Manual is older and authority structures may have changed:

* thresholds must be configured;
* policy source/version must be stored;
* conflicts with newer governance decisions must be resolved institutionally;
* Nexus must not permanently hard-code historical authority levels.

---

# 51. Authority Validation

Before an action is accepted, the server must check:

1. active user account;
2. active employment/guest relationship;
3. valid role permission;
4. active position assignment;
5. active authority;
6. transaction scope;
7. amount/currency conditions;
8. delegation or acting authority;
9. self-approval restrictions;
10. segregation-of-duties rules.

Frontend visibility alone is insufficient.

---

# 52. Authority Snapshot

Every approval/signing event must preserve:

* person;
* position;
* department;
* authority ID;
* authority policy version;
* delegated/acting status;
* threshold used;
* workflow stage;
* timestamp.

Later organisational changes must not alter the historical approval record.

---

# 53. Acting Appointments

An acting appointment must contain:

* substantive employee;
* substantive position;
* acting position;
* acting start;
* acting end;
* appointment reference;
* appointing authority;
* responsibilities transferred;
* responsibilities excluded;
* approval/signing limits;
* acting allowance applicability;
* status.

---

# 54. Acting Secretary General

The Administrative Rules currently provide that:

* the Assistant Secretary General may be appointed to act;
* if unavailable, a Director may be appointed;
* the Acting Secretary General does not assume unrestricted executive authority;
* matters requiring the SG’s consideration remain subject to consultation;
* the appointment may not exceed 30 days;
* the acting officer becomes the point of contact. 

Nexus must model these restrictions explicitly rather than giving the Acting SG every SG permission.

---

# 55. Acting Allowance Boundary

The Rules state that acting allowance eligibility requires, among other things:

* written appointment;
* acting in a higher position;
* authority assigned continuously for at least one month. 

The system must distinguish:

* acting system access;
* acting appointment;
* acting allowance eligibility.

A short workflow delegation must not automatically create an acting allowance.

Payroll/HR determines the allowance.

---

# 56. Acting Appointment Workflow

1. Appointment proposed.
2. Position and period selected.
3. Conflicts checked.
4. Responsibilities selected.
5. Authority restrictions configured.
6. HR reviews.
7. Appropriate authority approves.
8. Employee notified.
9. Roles activated on effective date.
10. Authority expires automatically.
11. Roles removed or reviewed on expiry.
12. appointment archived.

---

# 57. Delegation

Delegation types:

* Preparation Delegation
* Workflow Action Delegation
* Approval Delegation
* Signing Delegation
* Supervisor Delegation
* Acting Coverage
* Review Delegation
* Administrative Assistance
* View-Only Delegation

Each type carries different risks and controls.

---

# 58. Delegation Principle

> A delegate never receives more authority than the principal possesses and never gains authority outside the approved scope.

Delegation is not credential sharing.

The delegate uses their own account and MFA.

---

# 59. Delegation Record

Fields:

* Delegation reference
* Principal
* Delegate
* Delegation type
* Reason
* Start date/time
* End date/time
* Modules
* Actions
* Record types
* Department/project scope
* Amount limits
* Exclusions
* Approval authority
* Notification rules
* Status
* Revocation details

---

# 60. Delegation Statuses

* Draft
* Pending Principal Confirmation
* Pending Approval
* Scheduled
* Active
* Suspended
* Expired
* Revoked
* Rejected
* Cancelled
* Archived

---

# 61. Preparation on Behalf of Another User

Assistants may prepare records for:

* Secretary General;
* Director;
* HOD;
* employee;
* programme officer.

The record must show:

* Record owner/applicant
* Prepared by
* Submitted by
* Delegation authority
* Date/time

The preparer must not be misrepresented as the applicant.

---

# 62. Submission on Behalf

Submission on behalf should require explicit delegation.

Example audit text:

> Submitted by User B on behalf of User A under delegation DLG/2026/0042.

For high-risk transactions, the principal may still be required to confirm submission.

---

# 63. Approval Delegation

Approval delegation must be more restricted than preparation delegation.

Controls:

* explicit action scope;
* effective period;
* authority ceiling;
* no self-approval;
* no delegation beyond principal authority;
* enhanced audit;
* principal notification;
* optional post-action digest.

---

# 64. Signing Delegation

Signing delegation requires:

* explicit signing mandate;
* document types;
* authority source;
* value threshold;
* effective period;
* authorised signatory approval;
* possible Executive Committee mandate where applicable.

A general workflow delegation must not imply contract-signing authority.

---

# 65. No Transitive Delegation

Default rule:

A delegate cannot delegate delegated authority to a third person.

Any further delegation requires a new formally authorised record.

---

# 66. Delegation During Leave or Travel

When approved leave/travel overlaps with responsibilities, Nexus may suggest:

* create delegation;
* appoint acting officer;
* reassign pending workflows;
* create handover.

It must not automatically grant authority without approval.

---

# 67. Delegation Conflicts

The system must detect:

* delegate is the applicant/requester;
* delegate would approve own transaction;
* delegate reports to conflicting party;
* overlapping delegations;
* expired principal authority;
* principal account suspended;
* delegation exceeds amount limit;
* prohibited role combinations.

---

# 68. Delegation Expiry

At expiry:

* delegated roles/actions stop immediately;
* new workflow items no longer route to delegate;
* open items may return to principal or configured fallback;
* historical actions remain attributed;
* principal receives expiry notice.

---

# 69. Delegation Revocation

Revocation requires:

* reason;
* effective time;
* revoked by;
* impacted workflows;
* handback decision.

Revocation must not erase actions already performed legitimately.

---

# 70. Digital Signature Principle

A secure digital signing event must include:

* authenticated user;
* signing intention;
* document version;
* document hash;
* position;
* signing authority;
* delegation, if any;
* signing timestamp;
* signature meaning;
* immutable audit record.

A pasted signature image is insufficient.

---

# 71. Signature Meanings

Supported meanings:

* Prepared by
* Submitted by
* Recommended by
* Reviewed by
* Certified by
* Verified by
* Approved by
* Authorised by
* Signed by
* Witnessed by
* Acknowledged by
* Received by

The meaning must appear on the document/signature block.

---

# 72. Signature Enrolment

Signature enrolment workflow:

1. User requests/enrols signature.
2. Identity/account confirmed.
3. Signature specimen captured or uploaded.
4. Administrator verifies quality and ownership.
5. User accepts signing terms.
6. Signature activated.
7. Activation audited.

For senior signatories, additional verification may be required.

---

# 73. Signature Types

The system may support:

* Typed name signature
* Drawn signature
* Uploaded signature specimen
* Server-applied institutional signature mark
* Certificate-based digital signature
* External trusted e-signature provider

The underlying authenticated signing event remains mandatory.

---

# 74. Signature Image Security

Signature specimens must:

* be encrypted;
* be access-restricted;
* never be publicly addressable;
* never be available as a normal downloadable file;
* only be applied by the trusted signing service;
* be excluded from ordinary document browsing.

---

# 75. Step-Up Authentication

High-risk signing should require recent authentication.

Possible requirements:

* MFA confirmation;
* password re-entry;
* security-key/passkey;
* short signing-session validity;
* additional confirmation text.

Examples:

* contracts;
* payment authorisations;
* risk acceptance;
* disposal approval;
* official correspondence;
* final audit reports.

---

# 76. Document Hashing

Before signing:

1. Final document version generated.
2. Cryptographic hash calculated.
3. User reviews exact document.
4. User signs.
5. hash, authority and timestamp stored.
6. signed version locked.

Any later document change invalidates the prior signature for the changed version.

---

# 77. Signature Block

A document signature block may contain:

* visible signature
* full name
* official position
* action meaning
* date/time
* Nexus verification reference
* delegation indicator
* document verification code/QR

Do not place unnecessary private information in the signature block.

---

# 78. Signed Document Immutability

After signature:

* the signed binary/version becomes immutable;
* revisions require a new version;
* changed documents require reapproval and re-signing;
* previous signed versions remain preserved.

---

# 79. Multiple Signatories

Support:

* sequential signatures;
* parallel signatures;
* joint signatories;
* witness signatures;
* countersignatures.

The signature order and completion rules must be defined by the workflow/document type.

---

# 80. Signature Revocation

Signature status may be:

* Pending Enrolment
* Active
* Suspended
* Revoked
* Expired
* Re-enrolment Required
* Archived

Revocation prevents future signing.

It does not invalidate legitimate historical signatures automatically.

---

# 81. Signature Verification

Authorised users should be able to verify:

* document reference;
* signer;
* signing time;
* signature meaning;
* document hash;
* document version;
* signing authority;
* delegation;
* verification status.

Public verification should expose only approved metadata.

---

# 82. Digital Signature Legal Boundary

Nexus must distinguish:

* an authenticated internal approval/signing record;
* an advanced or certificate-based electronic signature;
* a signature legally required in a specific external context.

Legal or governance requirements for external contracts and instruments must be confirmed before replacing all wet-ink signatures.

---

# 83. User Initials

Initials are used in some document-reference schemes.

Store:

* official initials;
* effective dates;
* collision/duplicate warning;
* historical snapshot.

Do not derive initials afresh every time if the organisation has approved official initials.

---

# 84. Staff Directory

Directory fields:

* Name
* Position
* Department
* Official email
* Official phone
* Office
* Supervisor
* Availability indicator, privacy-controlled
* Languages
* Profile photo

Do not expose confidential personnel information.

---

# 85. Profile Change Requests

Employees may request changes to:

* preferred name;
* profile photograph;
* official contact;
* office location;
* language preference.

HR-controlled changes:

* legal name;
* position;
* supervisor;
* employee number;
* contract;
* authority;
* employment status.

---

# 86. Profile Change Workflow

1. Change requested.
2. Supporting evidence attached where required.
3. HR/administrator reviews.
4. Approved/rejected.
5. effective date recorded.
6. dependent modules notified.
7. history preserved.

Critical identity changes must not be self-approved.

---

# 87. User Status and Availability

Optional operational status:

* Available
* On Leave
* On Official Travel
* Working Remotely
* Acting in Position
* Unavailable
* Departed

Detailed leave type/reason must not be exposed through the directory.

---

# 88. Role-Based Dashboards

Dashboard selection should use:

* roles;
* position;
* organisational unit;
* assignments;
* authority;
* delegated authority.

A user may have several dashboards but must not see unauthorised data merely because a dashboard tile is visible.

---

# 89. Access Recertification

Periodic reviews must confirm:

* active employees;
* current positions;
* current roles;
* privileged roles;
* delegated authority;
* project access;
* external user access;
* dormant accounts.

Recommended frequencies:

* privileged access: more frequent;
* ordinary roles: periodic;
* project/guest access: at expiry or project review.

Frequency must be configurable.

---

# 90. Access Review Workflow

1. Review campaign created.
2. Managers receive user/role list.
3. Manager confirms, removes or changes access.
4. Security/ICT validates.
5. changes applied.
6. exceptions escalated.
7. campaign closed.

Review evidence must be retained.

---

# 91. Dormant Accounts

Accounts with no login/activity for a configured period should be flagged.

Actions:

* confirm ongoing need;
* suspend;
* disable;
* retain where justified;
* remove privileged roles.

Do not delete historical identity records.

---

# 92. External and Guest Users

Guest access must have:

* sponsor;
* purpose;
* access scope;
* start date;
* expiry;
* confidentiality acceptance;
* MFA;
* approval;
* periodic review.

Examples:

* external auditor;
* consultant;
* temporary reviewer;
* service provider.

---

# 93. Guest Account Expiry

Guest accounts must expire automatically.

Extension requires:

* sponsor confirmation;
* reason;
* new expiry;
* approval.

No indefinite external access by default.

---

# 94. Service Accounts

Service accounts must contain:

* technical owner;
* business owner;
* purpose;
* system;
* credentials-management method;
* permissions;
* expiry/review date;
* interactive login allowed: Yes/No;
* audit/logging requirements.

Service accounts must not be used for personal approvals or digital signatures.

---

# 95. Segregation of Duties

The Accounting Manual requires duties to be separated so that one officer does not process and record a financial transaction from beginning to end. 

Nexus must support incompatible-role rules.

Examples:

* requester and final approver;
* supplier creator and payment approver;
* stock adjustment initiator and approver;
* Asset Disposal requester and final authoriser;
* auditor and corrective-action verifier;
* System Administrator and business approver.

---

# 96. Incompatible Role Rules

Fields:

* Role/permission A
* Role/permission B
* Scope
* Severity
* Block or warn
* Exception authority
* Effective dates
* Policy source

---

# 97. Segregation Exception

A controlled exception requires:

* business reason;
* duration;
* compensating control;
* approving authority;
* review date;
* enhanced monitoring.

Permanent exceptions should be avoided.

---

# 98. Authority and Access Reports

Required reports:

* Staff Directory
* Organisation Chart
* Position Register
* Vacant Positions
* Position Assignment History
* Reporting-Line Report
* Acting Appointment Register
* Delegation Register
* Active Delegations
* Delegations Expiring
* Role Assignment Register
* Privileged Access Report
* Dormant Accounts
* Guest Accounts
* Access Review Report
* Authority Register
* Signing Authority Register
* Signature Register
* Signature Actions Report
* Segregation-of-Duties Conflicts
* Onboarding Status
* Offboarding Status
* User Access Audit Report

---

# 99. Data Model

Recommended entities:

### people

### user_accounts

### employment_records

### organisational_units

### organisational_unit_versions

### positions

### position_versions

### position_assignments

### reporting_relationships

### job_descriptions

### job_description_versions

### role_definitions

### permission_definitions

### user_role_assignments

### position_role_templates

### authority_definitions

### authority_assignments

### acting_appointments

### delegations

### delegation_scopes

### signature_profiles

### signature_enrolments

### document_signature_events

### profile_change_requests

### access_review_campaigns

### access_review_items

### onboarding_cases

### offboarding_cases

### person_documents

### identity_audit_events

---

# 100. Person and Account Model

`people` stores institutional identity.

`user_accounts` stores the authentication-system reference.

Relationship:

* one person may have zero or one normal active account;
* historical/migrated accounts may be linked;
* service accounts use a separate account type.

Do not duplicate personal profile fields across every module.

---

# 101. Position Assignment Model

Suggested fields:

* position_id
* person_id
* assignment_type
* substantive
* start_at
* end_at
* appointment_document_id
* approved_by
* status
* reason
* created_by

Database rules should prevent impossible overlapping substantive assignments unless explicitly approved.

---

# 102. Reporting Relationship Model

Fields:

* subordinate_position_id
* supervisor_position_id
* relationship_type
* primary
* effective_from
* effective_to
* source
* approved_by
* status

Prefer position-to-position reporting relationships rather than person-to-person only.

---

# 103. Authority Assignment Model

Fields:

* authority_definition_id
* assignee_type:

  * Position
  * Person
  * Acting Appointment
  * Delegation
* assignee_id
* scope
* value_limit
* currency
* effective_from
* effective_to
* source_policy_id
* approved_by
* status

---

# 104. Delegation Model

Fields:

* reference
* principal_person_id
* delegate_person_id
* delegation_type
* start_at
* end_at
* reason
* authority_source
* status
* approved_by
* activated_at
* revoked_at
* revocation_reason

Scopes should use relational child records, not an unvalidated free-text JSON object.

---

# 105. Signature Event Model

Fields:

* document_id
* document_version_id
* document_hash
* signer_person_id
* signer_account_id
* position_snapshot
* department_snapshot
* signature_meaning
* authority_assignment_id
* delegation_id
* acting_appointment_id
* signed_at
* authentication_strength
* signature_method
* verification_reference
* status

---

# 106. API Requirements

Profiles:

* `GET /people`
* `POST /people`
* `GET /people/{id}`
* `PUT /people/{id}`
* `GET /people/{id}/profile`
* `POST /people/{id}/change-requests`

Organisation:

* `GET /organisation/units`
* `POST /organisation/units`
* `GET /organisation/chart`
* `POST /positions`
* `POST /positions/{id}/assign`
* `POST /positions/{id}/vacate`
* `POST /reporting-relationships`

Roles:

* `GET /roles`
* `POST /users/{id}/roles`
* `POST /user-roles/{id}/approve`
* `POST /user-roles/{id}/revoke`

Authority:

* `GET /authorities`
* `POST /authorities`
* `POST /authority-assignments`
* `POST /authority/check`

Acting and delegation:

* `POST /acting-appointments`
* `POST /acting-appointments/{id}/approve`
* `POST /delegations`
* `POST /delegations/{id}/approve`
* `POST /delegations/{id}/revoke`

Signatures:

* `POST /signatures/enrol`
* `POST /signatures/{id}/activate`
* `POST /documents/{id}/sign`
* `GET /documents/{id}/signatures`
* `POST /signatures/{id}/suspend`
* `POST /signatures/{id}/revoke`

Lifecycle:

* `POST /onboarding`
* `POST /offboarding`
* `POST /access-reviews`

---

# 107. Authority Check Service

All business modules should call one shared service.

Input:

* user;
* action;
* module;
* record type;
* department/project;
* amount;
* currency;
* requester;
* transaction context;
* date/time.

Output:

* authorised: Yes/No;
* authority used;
* role used;
* position;
* delegation;
* acting appointment;
* limitations;
* self-approval conflict;
* reason for denial.

---

# 108. Server-Side Enforcement

The system must never rely solely on:

* hidden buttons;
* frontend menus;
* user-supplied role names;
* client-side amount checks.

All authority checks must occur server-side.

---

# 109. Permission Requirements

Recommended permissions:

* `people.view-directory`
* `people.view-profile`
* `people.view-confidential`
* `people.manage`
* `organisation.view`
* `organisation.manage`
* `positions.manage`
* `reporting-lines.manage`
* `roles.view`
* `roles.assign`
* `roles.approve`
* `roles.revoke`
* `authorities.manage`
* `acting-appointments.create`
* `acting-appointments.approve`
* `delegations.create`
* `delegations.approve`
* `delegations.revoke`
* `signatures.enrol`
* `signatures.verify`
* `signatures.administer`
* `documents.sign`
* `access-reviews.manage`
* `onboarding.manage`
* `offboarding.manage`
* `people.export`
* `identity.audit`

---

# 110. Separation of Duties

At minimum:

* a user cannot approve their own privileged role;
* a user cannot grant themselves signing authority;
* Signature Administrator cannot sign documents as another person;
* System Administrator cannot assign themselves business authority;
* HR manages employment data but does not independently grant all system privileges;
* ICT provisions access but does not determine employment authority;
* delegated users cannot approve their own requests;
* offboarding cannot be closed before required access actions are confirmed.

---

# 111. Delegated Action Audit

Every delegated action must show:

* principal;
* delegate;
* delegation reference;
* action;
* module;
* record;
* date;
* scope check;
* authority result.

Example:

> Approved by Jane Doe on behalf of Director Programmes under delegation DLG/2026/0018.

---

# 112. Notifications

Notify when:

* account invitation issued;
* role assigned;
* privileged role awaiting approval;
* role expiring;
* authority assigned/revoked;
* acting appointment created;
* acting period approaching;
* delegation requested;
* delegation approved/rejected;
* delegation activated;
* delegation expiring;
* delegation revoked;
* signature enrolment required;
* signature suspended/revoked;
* access review required;
* offboarding action required.

---

# 113. Notification Privacy

Sensitive notifications should not include:

* salary;
* medical details;
* disciplinary details;
* bank information;
* confidential HR document names.

Use secure Nexus links.

---

# 114. Audit Trail

Audit events:

* Person created
* Profile changed
* Employment created/changed
* Position created
* Position assigned/vacated
* Reporting line changed
* Job description issued
* Job description acknowledged
* Role requested
* Role approved/revoked
* Authority assigned/revoked
* Acting appointment approved
* Delegation created/approved/activated/expired/revoked
* Signature enrolled/activated/suspended/revoked
* Document signed
* Access review completed
* Account suspended/disabled
* Onboarding completed
* Offboarding completed
* Export generated

Audit records must capture previous and new values.

---

# 115. Security Requirements

The module must enforce:

* MFA for privileged operations;
* least privilege;
* server-side authorisation;
* record-level access;
* encryption of confidential data;
* encryption of signature assets;
* secure document storage;
* malware scanning;
* session revocation;
* IDOR prevention;
* mass-assignment protection;
* role escalation prevention;
* protected exports;
* audit logging;
* immutable signing events.

---

# 116. Concurrency

Prevent:

* two active substantive occupants of a single-incumbent position;
* duplicate active accounts for one employee;
* two administrators approving conflicting role changes;
* signing while document version changes;
* delegation approval after principal authority expires;
* account disablement while privileged action is being completed without revalidation.

---

# 117. Idempotency

Required for:

* person creation;
* account invitation;
* position assignment;
* role assignment;
* delegation creation;
* signing action;
* offboarding;
* access revocation.

Network retries must not create duplicate identities, roles or signatures.

---

# 118. Migration

Potential sources:

* HR employee register;
* personnel files;
* organisation charts;
* email directory;
* payroll employee list;
* Active Directory/Microsoft 365;
* existing application users;
* signature files;
* job descriptions;
* approval matrices;
* delegation letters;
* acting appointment letters.

---

# 119. Migration Process

1. Establish canonical person list.
2. Deduplicate names/emails.
3. Confirm employee numbers.
4. Import organisational units.
5. Import positions.
6. validate reporting lines.
7. map people to positions.
8. reconcile authentication accounts.
9. map roles and permissions.
10. import valid authority records.
11. import active acting/delegation records.
12. verify signature specimens.
13. obtain HR/Management certification.
14. activate.

---

# 120. Migration Safeguards

Do not:

* infer authority from old application access alone;
* infer signing authority from possession of a signature image;
* assume every person with an `admin` role is authorised;
* automatically activate expired acting letters;
* import duplicate employee profiles as separate people.

---

# 121. Backend Testing

Must test:

* person/account separation;
* organisation versioning;
* position assignments;
* reporting-line resolution;
* circular-hierarchy prevention;
* onboarding;
* transfer;
* offboarding;
* role assignment;
* privileged-role approval;
* authority validation;
* amount thresholds;
* acting appointments;
* delegation;
* delegation expiry;
* self-approval prevention;
* signature enrolment;
* document hashing;
* multiple signatures;
* signature revocation;
* historical authority snapshots;
* permissions;
* audit events.

---

# 122. Frontend / E2E Testing

Must test:

* create employee profile;
* create department and position;
* assign employee to position;
* view organisation chart;
* change supervisor;
* process promotion;
* assign role;
* approve privileged role;
* create acting appointment;
* create delegation;
* prepare record on behalf;
* approve under delegation;
* enrol signature;
* sign document;
* verify signature;
* expire delegation;
* transfer employee;
* offboard employee;
* search historical approval.

---

# 123. Security Testing

Must prove:

* user cannot view confidential personnel file without permission;
* user cannot grant themselves a role;
* System Administrator cannot grant themselves business authority;
* user cannot download another person’s signature image;
* user cannot sign as another person;
* expired delegation cannot be used;
* delegate cannot exceed principal authority;
* delegate cannot self-approve;
* document modification invalidates prior signing context;
* suspended user cannot sign;
* disabled account cannot continue using active sessions;
* guest access expires;
* search and exports do not leak confidential HR information.

---

# 124. Production Acceptance Criteria

The module is production-ready only when:

1. One canonical person record exists per individual.
2. Person and account are separate entities.
3. Employee profiles can be created.
4. Open and confidential personnel information is separated.
5. Organisational units can be configured.
6. Organisational structures are effective-dated.
7. Positions exist independently of people.
8. Substantive and acting assignments are supported.
9. Position history is retained.
10. Job descriptions are versioned.
11. Employees can acknowledge signed job-description changes.
12. Reporting lines are position-based.
13. Circular reporting is prevented.
14. Organisation chart works.
15. Staff directory respects privacy.
16. Onboarding works.
17. Transfers and promotions work.
18. Offboarding disables access and preserves history.
19. Roles and permissions are separated from positions.
20. Privileged roles require approval.
21. Technical roles do not create business authority.
22. Authority Register works.
23. Authority can be scoped by module, action and value.
24. Authority policies are versioned.
25. Authority is validated server-side.
26. Historical authority snapshots are preserved.
27. Acting appointments work.
28. Acting SG restrictions can be modelled.
29. Acting access does not automatically create acting allowance.
30. Delegation types are supported.
31. Preparation on behalf works.
32. Approval delegation works.
33. Delegation cannot exceed principal authority.
34. Self-approval remains prohibited.
35. Delegation expires automatically.
36. Delegated actions are clearly attributed.
37. Signature enrolment works.
38. Signature specimens are protected.
39. Signing requires authenticated user action.
40. document hashes are preserved.
41. Signed documents are immutable.
42. Multiple signatures are supported.
43. Revocation blocks future signing.
44. Historical signatures remain verifiable.
45. Access reviews work.
46. Dormant and guest accounts are controlled.
47. Segregation-of-duties conflicts are detected.
48. Complete audit history exists.
49. Authentication, Workflow, Document, Notification and Audit-Trail integrations pass regression testing.

---

# 125. Phase 1 — Production Critical

Implement:

* Person and employee profiles
* Open/confidential profile separation
* Organisational units
* Positions
* Position assignments
* Reporting relationships
* Job descriptions
* Staff directory
* Organisation chart
* User-account linking
* Role assignments
* Authority Register
* Acting appointments
* Delegation
* Preparation on behalf
* Signature enrolment
* Secure signing service
* Authority snapshots
* Onboarding
* Transfers
* Offboarding
* Access reviews
* Notifications
* Reports
* Audit trail

---

# 126. Phase 2

Add:

* certificate-based signatures;
* trusted external e-sign provider integration;
* Microsoft 365/directory synchronisation;
* automated role recertification;
* advanced segregation-of-duties analysis;
* organisational scenario planning;
* deeper payroll/HR integration;
* public document-signature verification.

---

# 127. Phase 3

Optional:

* position-succession planning;
* skills and competence directory;
* automated access recommendations;
* anomalous privilege detection;
* natural-language organisation search;
* advanced organisational analytics.

AI recommendations must never automatically grant:

* access;
* authority;
* delegation;
* signing rights;
* privileged roles.

---

# 128. Critical Architecture Rules

The implementation team must treat these as non-negotiable:

> **A person is not the same as a user account.**

> **A person is not the same as a position.**

> **A job title is not a system role.**

> **A system permission is not approval authority.**

> **Possession of a signature image is not signing authority.**

> **Authority should normally attach to a position and be effective-dated.**

> **Every historical approval must retain the authority snapshot that applied at the time.**

> **Acting appointment and delegation are different concepts.**

> **Delegation never exceeds the principal’s authority.**

> **Delegates use their own accounts; password sharing is prohibited.**

> **A delegate cannot self-approve or bypass segregation of duties.**

> **A general delegation does not create contract-signing authority.**

> **A short workflow delegation does not automatically create an acting allowance.**

> **Digital signing must bind the authenticated signer to an exact document version and hash.**

> **Signed documents must not be edited in place.**

> **Technical administrators must not automatically receive business approval powers.**

> **Disabling an account must not erase the person’s historical institutional actions.**

---

# 129. Final Product Rule

An employee should be able to open Nexus and answer:

**What profile does SADC PF hold for me?**
→ My Profile

**What position do I occupy?**
→ Position Assignment

**Who do I report to?**
→ Reporting Line

**What duties apply to my position?**
→ Job Description

**What roles and permissions do I have?**
→ My Roles

**What may I recommend, approve or sign?**
→ My Authority

**Am I acting for someone?**
→ Acting Appointment

**Who is delegated to act for me?**
→ Delegations

**Is my signature active and secure?**
→ Signature Profile

A workflow must be able to answer:

**Who is the applicant’s current supervisor?**
→ organisational hierarchy

**Who is authorised for this approval stage?**
→ Authority Register

**Does the approver have sufficient value authority?**
→ threshold validation

**Is the approver acting or delegated?**
→ appointment/delegation

**Was the authority valid at the time of action?**
→ effective-dated snapshot

**Was the exact approved document signed?**
→ document hash and signature event

That gives Nexus a secure institutional identity and authority foundation rather than a collection of usernames, profile photographs and uploaded signature images.
