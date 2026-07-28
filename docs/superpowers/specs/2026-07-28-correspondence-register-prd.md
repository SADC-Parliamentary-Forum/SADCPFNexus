The next module should be **Correspondence Register & Records Management**.

This is a core governance module, not merely a digital incoming/outgoing mail spreadsheet. The Administrative Rules require official incoming mail to be registered by the registry/secretarial function, routed through the Secretary General or a designated officer, and then directed to the appropriate officer for action. Outgoing official correspondence must be approved by the Secretary General, issued on SADC PF letterhead, registered, and assigned a formal reference number. The Rules also require internal communications to respect the organisational hierarchy and require confidential material to be protected from unauthorised access.  

The existing paper-era rule creates a top copy for the addressee, a chronological Master File copy, and a subject-file copy. Nexus should preserve that **records-management principle digitally**, but it should not generate three duplicate files. The authoritative digital document can be stored once and linked simultaneously to the chronological register and relevant subject/file classification. 

# SADC PF Nexus

# Correspondence Register & Records Management Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Correspondence Register & Records Management
**Short name:** Correspondence
**Document status:** Updated implementation PRD
**Module type:** Institutional incoming/outgoing correspondence, routing, action-tracking and official-record management module

---

# 1. Executive Summary

The Correspondence Module will provide SADC PF with a secure institutional registry for:

* incoming correspondence;
* outgoing correspondence;
* internal memoranda;
* official letters;
* diplomatic correspondence;
* circulars;
* partner correspondence;
* Member Parliament correspondence;
* donor correspondence;
* government correspondence;
* contracts and formal notices where relevant;
* physical mail;
* email received through designated official channels;
* hand-delivered correspondence;
* courier correspondence;
* correspondence requiring response;
* correspondence requiring assignment;
* dispatch and delivery records;
* subject files;
* master chronological register;
* document references;
* confidentiality controls;
* deadlines;
* reminders;
* workflow;
* search;
* audit;
* institutional archiving.

The module must answer:

* What correspondence was received?
* When was it received?
* Who sent it?
* Who registered it?
* Has the Secretary General seen or routed it?
* Who is responsible for action?
* What action is due?
* What is the response deadline?
* Has a response been drafted?
* Who approved the response?
* Was it dispatched?
* How was it sent?
* Was delivery confirmed?
* What subject/file does it belong to?
* Is there related earlier correspondence?
* Where is the authoritative institutional copy?
* Who accessed or changed the record?

---

# 2. Core Product Principle

Correspondence must operate according to:

> **Receive → Register → Classify → Route → Assign → Act → Respond → Approve → Dispatch → File → Close**

For outgoing correspondence:

> **Draft → Review → Approve → Register → Reference → Sign → Dispatch → Confirm Delivery → File → Close**

The Correspondence Register is the authoritative institutional history of official communications.

---

# 3. Demo Feedback Incorporated

The module must incorporate the wider Nexus demo decisions.

## 3.1 Paperless but institutionally controlled

The system should replace:

* handwritten registers;
* uncontrolled shared folders;
* multiple email copies;
* paper routing slips;
* duplicate document copies.

But it must preserve:

* official registration;
* SG routing;
* organisational hierarchy;
* formal reference numbers;
* subject filing;
* chronological filing;
* auditability.

---

## 3.2 Current holder must always be visible

Every correspondence item requiring action must display:

* Current stage
* Currently with
* Assigned officer
* Responsible department
* Next action
* Due date
* Escalation status

A status such as `Received` is not enough.

---

## 3.3 Correspondence can create assignments

During the demo, Assignments/Task Tracking was identified as a separate Nexus capability.

Correspondence must therefore be able to create one or more linked Assignments.

Example:

Incoming letter:

> Request for nomination of SADC PF representatives.

SG routes to:

Director Programmes.

Director creates assignments:

* Programme Officer — draft response
* Administration — confirm travel implications

Correspondence owns the official communication.

Assignments owns the work/tasks generated from it.

---

## 3.4 No duplicate document storage

The same official letter should not be uploaded independently into:

* correspondence;
* assignment;
* PIF;
* procurement;
* travel.

Use the shared Nexus document repository and link the same document where possible.

---

## 3.5 Notifications

Users must receive:

* email;
* in-app;
* optional mobile push.

Native mobile installation must not be required.

---

## 3.6 Delegation

SG's Office, Executive Assistant, Registry and other authorised officers may perform registration/routing functions under formal role/delegation.

Passwords must not be shared.

---

# 4. Policy Basis

The current Administrative Rules establish that:

* outgoing official correspondence is approved by the Secretary General;
* outgoing correspondence must use SADC PF letterhead;
* incoming official correspondence is addressed to the Secretary General and passes through the SG's office before dispatch to the appropriate office;
* internal communications follow the organisational hierarchy;
* incoming mail is registered by the secretary/registry clerk;
* registry distinguishes official and non-official mail;
* official correspondence is forwarded to the Secretary General or designated officer;
* outgoing letters must be registered;
* outgoing correspondence receives a formal reference number;
* chronological Master File and subject-file copies must be maintained;
* confidential documents must be kept from unauthorised persons. 

Nexus must implement these controls digitally.

---

# 5. Scope

## 5.1 In scope

* Incoming correspondence register
* Outgoing correspondence register
* Internal correspondence
* Registration/reference numbers
* SG routing
* Department routing
* Action assignment
* Response tracking
* Deadlines
* Related correspondence threads
* Document drafting
* Letter templates
* Letterhead
* Approval
* Digital signature support
* Dispatch
* Proof of delivery
* Master register
* Subject filing
* Confidentiality
* Retention
* Search
* Audit
* Reports

---

## 5.2 Out of scope

The module is not:

* a full email client;
* WhatsApp messaging;
* Assignment Management;
* Procurement;
* contract lifecycle management;
* PIF;
* M&E;
* generic document editing;
* public website communications;
* personal employee correspondence.

Those systems may link to Correspondence.

---

# 6. Correspondence Types

Configurable types should include:

### Incoming

* Letter
* Note Verbale
* Memorandum
* Circular
* Invitation
* Request
* Complaint
* Report
* Government Communication
* Member Parliament Communication
* Donor Communication
* Partner Communication
* Legal Correspondence
* Invoice/Financial Correspondence
* Contractual Notice
* Email
* Courier Package
* Other

### Outgoing

* Official Letter
* Note Verbale
* Memorandum
* Circular
* Invitation
* Response
* Acknowledgement
* Notification
* Request
* Confirmation
* Legal Notice
* Donor Correspondence
* Member Parliament Correspondence
* Other

### Internal

* Internal Memorandum
* Circular
* Management Instruction
* Internal Notice
* Briefing Note
* Other

---

# 7. Correspondence Channels

Supported channels:

* Physical Mail
* Hand Delivery
* Courier
* Official Email
* Scanned Letter
* Diplomatic Bag
* Fax, if still used
* Portal Submission
* Other authorised official channel

Channel must be recorded.

---

# 8. Official vs Non-Official Mail

Registry must classify incoming mail as:

* Official
* Personal / Non-Official
* Unclear / Requires Review

Personal/non-official correspondence must not automatically enter the institutional official-record workflow.

For privacy:

* metadata should be minimised;
* personal mail should be handed to the intended recipient;
* contents should not be unnecessarily scanned into Nexus.

---

# 9. Module Navigation

Main Menu → **Correspondence**

Recommended submenus:

* Correspondence Dashboard
* Register Incoming
* Incoming Register
* Draft Outgoing
* Outgoing Register
* Internal Correspondence
* My Action Items
* Pending SG Routing
* Pending Department Action
* Pending Drafts
* Pending Approval
* Ready for Dispatch
* Delivery Follow-Up
* Overdue Responses
* Subject Files
* Correspondence Threads
* Archive
* Reports
* Correspondence Settings

---

# 10. Primary Roles

* Registry Clerk
* Reception/Registry Officer
* Executive Assistant to Secretary General
* Private Secretary
* Secretary General
* Director
* Head of Department
* Programme Officer
* Administration Officer
* Finance Officer
* Legal Officer
* Communications Officer
* Correspondence Drafter
* Authorised Signatory
* Dispatch Officer
* Records Officer
* Auditor
* System Administrator

---

# 11. Registry Role

Registry may:

* register incoming correspondence;
* scan/upload;
* classify;
* capture sender;
* record receipt details;
* assign initial subject/file;
* forward to SG/SG Office;
* register outgoing correspondence;
* generate/reference numbers;
* record dispatch;
* manage physical-mail movement.

Registry must not necessarily see confidential content beyond their authorised classification.

---

# 12. Secretary General Role

The SG or authorised designate may:

* review incoming correspondence;
* route to department/officer;
* assign action;
* add instruction;
* set priority;
* set response deadline;
* approve outgoing official correspondence;
* sign correspondence;
* return drafts;
* mark for information only;
* close items where no further action is required.

---

# 13. Director / HOD Role

May:

* receive routed correspondence;
* assign responsible officer;
* create linked tasks;
* add instructions;
* review draft responses;
* escalate;
* return work;
* recommend closure.

---

# 14. Responsible Officer

May:

* view assigned correspondence;
* acknowledge receipt;
* prepare action;
* draft response;
* add internal notes;
* attach supporting material;
* create linked assignment;
* submit response for review.

May not:

* alter original incoming correspondence;
* erase routing history;
* issue unapproved official response.

---

# 15. Incoming Correspondence Lifecycle

Statuses:

* Received
* Registration Pending
* Registered
* Pending SG Routing
* Routed
* Assigned
* Acknowledged
* Action in Progress
* Response Required
* Draft Response in Progress
* Pending Review
* Pending Approval
* Response Approved
* Ready for Dispatch
* Responded
* No Response Required
* Closed
* Archived

Exception statuses:

* Returned to Registry
* Misrouted
* Duplicate
* Personal/Non-Official
* Confidential Restricted
* Cancelled/Withdrawn by Sender

---

# 16. Incoming Registration

Every official incoming item receives:

* Incoming reference
* Date received
* Time received
* Date of correspondence
* Sender
* Sender organisation
* Sender country
* Sender contact
* Subject/title
* Correspondence type
* Channel
* Original sender reference
* Attention/addressee
* Summary
* Priority
* Confidentiality
* Attachments
* Registered by
* Registration timestamp

---

# 17. Incoming Reference Number

Use a configurable institutional numbering format.

Example:

`IN/2026/00457`

or:

`CORR/IN/2026/00457`

The incoming registry number must be unique and sequential within the configured numbering scope.

Never reuse references.

---

# 18. Sender Register

Correspondents may include:

* Member Parliament
* Government Ministry
* Embassy
* SADC
* Donor
* Partner
* Civil Society Organisation
* International Organisation
* Supplier
* Consultant
* Individual
* Other

The system should maintain reusable contacts/organisations.

Do not create duplicate sender entities unnecessarily.

---

# 19. Member Parliament Integration

Member Parliaments should be selectable from a canonical institutional register.

Fields may prefill:

* Parliament
* Country
* Clerk/Secretary General
* Presiding Officer
* Official contact details

Correspondence should not maintain conflicting copies of this data.

---

# 20. Incoming Document Capture

Physical mail may be scanned.

Store:

* original digital scan;
* page count;
* file type;
* uploaded by;
* timestamp;
* document hash/checksum;
* source type:

  * Original Electronic
  * Scanned Physical Original
  * Copy

The original scan must not be overwritten.

---

# 21. Physical Original Tracking

Where a physical original must be retained:

Fields:

* Physical original retained: Yes/No
* File/storage location
* Box/file number
* Received by
* Movement history
* Return requirement

This prevents Nexus from becoming digital while physical originals disappear.

---

# 22. Urgent Correspondence

Registry may mark:

* Routine
* Normal
* High
* Urgent
* Immediate

Urgent items must produce prominent alerts.

The existing Rules already require particular attention to urgent communications in the context of fax/mail handling; digital workflow should preserve this principle. 

---

# 23. SG Routing

Once registered, official incoming correspondence enters:

**Pending SG Routing**

SG/authorised designate actions:

* For Information
* Route for Action
* Route for Advice
* Route for Draft Response
* Route for Comment
* Route to Multiple Departments
* Acknowledge Receipt
* Close — No Action Required

---

# 24. Routing Instruction

Fields:

* Routed to
* Department
* Officer
* Action required
* Instruction
* Priority
* Due date
* Response required
* Response due date
* Copy to
* Routed by
* Routed at

---

# 25. Multiple Routing

One item may require action from multiple functions.

Example:

Invitation to conference:

* Programmes — participation recommendation
* Finance — funding availability
* Administration — logistics
* SG Office — final response

The system must support:

### Primary Action Owner

One accountable owner.

### Supporting Action Owners

Multiple supporting users.

This prevents ambiguity.

---

# 26. Primary Accountability

There must always be one clearly identified person/role responsible for progressing actionable correspondence.

Avoid:

> Assigned to Programmes, Finance and Administration.

with no accountable owner.

Use:

**Primary Owner:** Director Programmes

**Supporting:** Finance, Administration

---

# 27. Acknowledgement

Assigned officer may be required to acknowledge:

* Viewed
* Accepted for Action
* Misrouted

Record:

* user;
* timestamp.

Misrouting does not delete the original route.

---

# 28. Response Deadline

Correspondence may have:

* sender deadline;
* internally assigned deadline;
* statutory/contractual deadline;
* event deadline.

Store separately.

Example:

Sender deadline:
15 August

Internal draft deadline:
10 August

Final response deadline:
14 August

---

# 29. Deadline Engine

Statuses:

* On Track
* Due Soon
* Due Today
* Overdue
* Completed

Configurable reminder intervals:

* 14 days
* 7 days
* 3 days
* 1 day
* overdue

---

# 30. Escalation

When overdue:

Level 1:
Responsible Officer

Level 2:
Supervisor/HOD

Level 3:
Director

Level 4:
SG Office

Rules configurable.

Not every correspondence requires the full escalation chain.

---

# 31. Assignment Integration

Correspondence may create a formal linked Assignment.

Fields transferred:

* correspondence reference;
* subject;
* required action;
* responsible user;
* due date;
* priority;
* source document.

Assignment status feeds back as read-only.

Correspondence must not duplicate the Assignment task history.

---

# 32. Correspondence Action Log

Even without a formal Assignment, the correspondence record should maintain an action timeline.

Examples:

* Registered
* Routed
* Acknowledged
* Draft requested
* Draft uploaded
* Reviewed
* Returned
* Approved
* Dispatched

---

# 33. Internal Notes

Users may add internal notes.

Note visibility:

* Working Team
* Department
* Management
* SG Office
* Restricted

Internal notes must never accidentally appear in outgoing correspondence.

---

# 34. Related Correspondence

One item may relate to prior correspondence.

Example:

Incoming:
`IN/2026/00457`

is a response to:

Outgoing:
`123/BS/EA/0109`

Create relationships:

* Reply To
* Response To
* Follow-Up To
* Related
* Supersedes
* Amends
* Enclosure To

---

# 35. Correspondence Thread

The system should render a thread:

1. SADC PF outgoing invitation
2. Parliament acknowledgement
3. Parliament nomination
4. SADC PF confirmation
5. Follow-up amendment

This gives institutional context without searching folders manually.

---

# 36. Subject Files

The current rules require a subject-file copy of outgoing correspondence. 

Digitally:

one authoritative document may be linked to one or more subject files.

Example subject files:

* 59th Plenary Assembly
* SRHR Programme
* Member Parliament — Namibia
* Model Law on Prison Oversight
* HR
* Finance
* Procurement
* Legal
* Donor — Sida

---

# 37. File Plan

Create a configurable institutional File Plan.

Hierarchy example:

**01 Governance**

* 01.01 Constitution
* 01.02 Plenary
* 01.03 Executive Committee

**02 Programmes**

* 02.01 SRHR
* 02.02 Model Laws

**03 Administration**

* 03.01 HR
* 03.02 Procurement

etc.

Do not hard-code the final structure until approved.

---

# 38. Master File

The paper rule requires a Master File following running mail registration numbers. 

Nexus implements this as the immutable:

**Chronological Correspondence Register**

Every outgoing/incoming registered item automatically appears in chronological sequence.

No duplicate file copy is required.

---

# 39. Digital Filing Principle

One file/document object may have:

* chronological-register link;
* correspondence record;
* subject-file links;
* assignment link;
* programme link.

Do not generate unnecessary binary duplicates.

---

# 40. Outgoing Correspondence Lifecycle

Statuses:

* Draft
* Under Preparation
* Pending HOD Review
* Pending Director Review
* Pending Legal Review, where required
* Pending SG Approval
* Returned for Revision
* Approved
* Pending Signature
* Signed
* Registered
* Ready for Dispatch
* Dispatched
* Delivery Confirmed
* Delivery Failed
* Response Expected
* Closed
* Archived

---

# 41. Outgoing Draft

Fields:

* Proposed recipient
* Organisation
* Country
* Correspondence type
* Subject
* Purpose
* Related incoming correspondence
* Responsible drafter
* Proposed signatory
* Department
* Priority
* Required dispatch date
* Response requested
* Attachments

---

# 42. Drafting Approach

Nexus should support:

1. Upload a prepared DOCX/PDF; or
2. Use an institutional letter template.

Do not require every correspondence item to be drafted inside a complex word processor.

---

# 43. Letter Templates

Configurable templates:

* Standard Official Letter
* Note Verbale
* Invitation
* Acknowledgement
* Circular
* Internal Memorandum
* Confirmation
* Request Letter
* Other

Templates may contain merge fields:

* Date
* Reference
* Recipient
* Title
* Organisation
* Subject
* Signatory
* Position

---

# 44. Official Letterhead

Outgoing official correspondence must use approved institutional letterhead. 

System-generated letters must use centrally managed:

* SADC PF logo;
* address;
* contacts;
* approved footer;
* current branding.

Ordinary users must not independently modify institutional letterhead.

---

# 45. Reference Number

The Administrative Rules currently show a structure such as:

`123/ABC/XYZ/0009`

where:

* `123` = file number
* `ABC` = signatory initials
* `XYZ` = typist initials
* `0009` = outgoing register number. 

Nexus should support the existing reference rule, but it must be implemented as a **configurable reference-numbering policy**.

---

# 46. Digital Interpretation of “Typist”

The paper-era `typist initials` should map to:

**Document Preparer / Drafter**

rather than requiring a literal typist role.

Example:

`123/BS/RW/0009`

Where:

* 123 = subject/file number
* BS = signatory initials
* RW = preparer initials
* 0009 = outgoing sequence

If Management later modernises the format, Nexus can change the policy without rewriting historical references.

---

# 47. Reference Generation Timing

Do not assign final outgoing reference too early.

Recommended:

Reference assigned when:

* draft is approved; or
* Registry accepts item for final dispatch.

This prevents wasted/gapped references due to abandoned drafts.

If references must be reserved earlier, Nexus must show cancelled/voided numbers rather than silently reusing them.

---

# 48. Reference Uniqueness

Rules:

* sequence generated server-side;
* uniqueness database-enforced;
* no manual duplicate;
* no sequence reuse;
* voided references retained.

---

# 49. Outgoing Approval

Current rule:

> All outgoing official correspondence is approved by the Secretary General. 

Default production workflow must therefore preserve SG approval unless a formal approved delegation/policy applies.

A normal user cannot bypass this requirement.

---

# 50. Outgoing Workflow

Default:

1. Officer prepares draft.
2. Supervisor/HOD reviews.
3. Director reviews where applicable.
4. Legal review where applicable.
5. SG approves.
6. Final reference assigned.
7. Letter generated on letterhead.
8. SG/authorised signatory signs.
9. Registry registers.
10. Dispatch.
11. Delivery recorded.
12. Response tracked if required.
13. Closed/filed.

Workflow can vary by correspondence type.

---

# 51. Legal Review

Optional conditional step for:

* contracts;
* legal notices;
* MOUs;
* formal obligations;
* dispute correspondence;
* sensitive regulatory matters.

Legal comments remain internal.

---

# 52. Digital Signatures

The module should use User Profile / Signature capability.

Signature requirements:

* signatory identity;
* role;
* signing timestamp;
* document version/hash;
* approval authority;
* audit event.

A stored image of a signature alone is insufficient security.

---

# 53. Signature Security

Users must not be able to download another executive's signature image and paste it freely.

Preferred:

* server-applied signature after authorised action;
* document-specific signature event;
* protected signature asset.

---

# 54. Document Versioning

Outgoing drafts require versions.

Example:

* Draft v1
* HOD revision v2
* SG returned v3
* Final approved v4
* Signed final

Once signed/dispatched:

the official version becomes immutable.

---

# 55. Material Post-Signature Changes

Any change to signed correspondence requires:

* new version;
* reapproval;
* re-signature;
* new dispatch.

Never edit the binary/PDF of an already signed institutional record in place.

---

# 56. Dispatch

Dispatch channels:

* Email
* Courier
* Postal Mail
* Hand Delivery
* Diplomatic Channel
* Portal
* Fax
* Other

Record:

* dispatch date/time;
* dispatched by;
* recipient;
* destination;
* channel;
* tracking/reference;
* document version sent.

---

# 57. Email Dispatch

Where integrated with institutional email:

Nexus may send from an authorised mailbox.

Store:

* From
* To
* CC
* Subject
* message ID
* sent timestamp
* attachment version
* delivery/bounce status where available.

The email system remains the transport service; Correspondence remains the institutional record.

---

# 58. Email Ingestion

Do **not** automatically ingest every employee email into Correspondence.

Recommended integration:

* designated registry mailbox;
* user action `Register as Official Correspondence`;
* explicit shared-mailbox rules.

This prevents:

* privacy problems;
* spam/noise;
* duplicate records;
* personal email ingestion.

---

# 59. Delivery Confirmation

Evidence types:

* Email accepted/sent event
* Courier tracking
* Signed delivery note
* Hand-delivery acknowledgement
* Portal acknowledgement
* Recipient response

Statuses:

* Not Sent
* Dispatched
* Delivery Pending
* Delivered
* Failed
* Returned
* Acknowledged

---

# 60. Hand Delivery

Capture:

* delivered by;
* recipient name;
* recipient organisation;
* delivery date/time;
* signature/acknowledgement;
* delivery proof.

---

# 61. Courier

Capture:

* courier;
* tracking number;
* date collected;
* expected delivery;
* actual delivery;
* proof.

---

# 62. Response Expected

Outgoing correspondence may expect a reply.

Fields:

* Response required: Yes/No
* Expected by
* Responsible follow-up officer

System creates follow-up reminders.

Incoming response can later be linked to the outgoing record.

---

# 63. Incoming Response Requirement

Incoming correspondence may require:

* Acknowledgement only
* Formal response
* Action but no response
* Information only
* Decision
* Submission/document
* Meeting/appointment

This should be explicit.

---

# 64. Automatic Acknowledgement

Optional feature:

After official registration, Nexus may send:

> Your correspondence has been received and registered under reference IN/2026/00457.

Only use for channels/correspondents where appropriate.

This is not the substantive response.

---

# 65. Correspondence Categories

Configurable subject categories:

* Governance
* Parliamentary Business
* Programmes
* Human Resources
* Finance
* Procurement
* Administration
* ICT
* Legal
* Partnerships
* Donors
* Member Parliaments
* Plenary Assembly
* Standing Committees
* Model Laws
* Communications
* Protocol
* Other

---

# 66. Confidentiality

Classification:

* Internal
* General Official
* Restricted
* Confidential
* Highly Confidential / Management
* Privileged / Legal
* HR Confidential
* Finance Confidential

Access rules depend on classification.

---

# 67. Confidential Incoming Mail

Registry may need metadata access but not unrestricted content access.

Example:

**Confidential — SG Only**

Registry captures:

* sender;
* date;
* reference;
* classification.

Content may be restricted to:

* SG;
* authorised executive office users.

---

# 68. Confidentiality Inheritance

Attachments should inherit correspondence classification by default.

Users may apply stricter classification to individual attachments.

A child document must not accidentally become less restricted than its correspondence without authorised action.

---

# 69. Access Control

Record-level access must consider:

* role;
* department;
* routing;
* classification;
* correspondence type;
* explicit sharing.

Being a Nexus user does not imply access to every correspondence record.

---

# 70. Search Security

Search results must respect access controls.

A restricted item's:

* title;
* sender;
* summary;
* attachments;

must not leak through global search to unauthorised users.

---

# 71. Document Download Audit

For confidential correspondence, record:

* viewed;
* downloaded;
* printed/exported where technically trackable.

This is particularly useful for legal/HR/management records.

---

# 72. Retention

The module should support configurable retention schedules.

Retention fields:

* Record category
* Retention period
* Trigger
* Disposal action
* Legal hold support
* Archival status

The exact retention periods should be approved institutionally rather than invented in software.

---

# 73. Legal Hold

Authorised Legal/Records officers may place:

**Legal Hold**

Result:

* record cannot be deleted/disposed;
* retention expiration suspended;
* hold reason recorded;
* authorised users notified.

---

# 74. Record Disposal

Records reaching approved end-of-retention must not automatically vanish.

Process:

1. Eligible for disposal.
2. Records Officer reviews.
3. Legal/audit hold checked.
4. Approval obtained.
5. Dispose/archive according to policy.
6. Retain disposal audit record.

---

# 75. Soft Delete vs Official Records

Official registered correspondence should generally not support normal user deletion.

Incorrect records may be:

* Void
* Duplicate
* Misregistered
* Superseded

The original registration remains auditable.

---

# 76. Duplicate Detection

Possible duplicate indicators:

* same sender;
* same date;
* same sender reference;
* same subject;
* same file hash;
* same email message ID.

Warn Registry before creating duplicate record.

Do not blindly merge different documents.

---

# 77. Email Message-ID Deduplication

For email integration:

`message_id` should have a duplicate guard for the same source mailbox.

This prevents registering the same email multiple times.

---

# 78. Attachment Integrity

Store:

* file hash;
* size;
* MIME type;
* uploader;
* timestamp.

After formal registration, original attachments should be immutable.

New versions may be appended where appropriate.

---

# 79. Virus / Malware Scanning

All uploaded correspondence must use the shared secure-document pipeline.

Requirements:

* malware scan;
* allowed file types;
* file-size limits;
* quarantine;
* secure storage.

---

# 80. Correspondence Dashboard

Metrics:

* Incoming today
* Incoming this week
* Pending SG Routing
* Awaiting Action
* Due Soon
* Overdue
* Draft Responses
* Pending SG Approval
* Ready for Dispatch
* Delivery Failed
* Response Expected
* Closed this month

---

# 81. SG Dashboard

Show:

* New correspondence requiring routing
* Urgent correspondence
* Responses awaiting approval
* Overdue departmental actions
* Confidential correspondence
* Delivery/response exceptions

---

# 82. Registry Dashboard

Show:

* Items awaiting registration
* Physical originals pending scan
* Incoming registered today
* Outgoing awaiting reference
* Ready for dispatch
* Courier follow-up
* Delivery failures
* Filing exceptions

---

# 83. Staff Dashboard

Show:

* Correspondence assigned to me
* Due soon
* Overdue
* Draft response required
* Returned drafts
* Waiting for HOD/SG
* Recently completed

---

# 84. Department Dashboard

HOD/Director sees:

* correspondence assigned to department;
* current owners;
* due dates;
* overdue;
* drafts pending review;
* response times;
* closed items.

---

# 85. Response-Time Analytics

Track:

* Receipt → Registration
* Registration → SG Routing
* Routing → Acknowledgement
* Assignment → Draft
* Draft → Approval
* Approval → Dispatch
* Overall response time

This helps identify operational bottlenecks.

---

# 86. Service Targets

Optional configurable service targets.

Example:

* register official correspondence within same working day;
* route urgent correspondence immediately;
* acknowledge assignment within one working day.

These should be institutional configuration, not hard-coded policy assumptions.

---

# 87. Correspondence Register

Incoming Register columns:

* Incoming Ref
* Date Received
* Sender
* Sender Ref
* Subject
* Type
* Priority
* Routed To
* Responsible Officer
* Due Date
* Status

Outgoing Register:

* Outgoing Ref
* Date
* Recipient
* Subject
* Drafter
* Signatory
* Dispatch Channel
* Dispatch Date
* Delivery Status
* Response Expected
* Status

---

# 88. Master File View

Provide chronological view:

**2026**

* 0001
* 0002
* 0003
* …

Filters:

* incoming/outgoing;
* month;
* subject file;
* sender/recipient;
* department.

This replaces the paper chronological Master File without creating physical duplicate copies.

---

# 89. Subject File View

Opening a subject file shows:

* file code;
* title;
* owner department;
* security classification;
* incoming correspondence;
* outgoing correspondence;
* internal memoranda;
* attachments;
* linked assignments;
* related PIFs/events where applicable.

---

# 90. File Closure

Subject file may be:

* Open
* Closed
* Archived

Closing a subject file prevents routine new filing but does not delete records.

A reopened file requires authorised action.

---

# 91. Cross-Module Linking

Correspondence may link to:

* PIF
* M&E
* Travel
* Procurement
* Supplier
* Contract
* Leave
* Assignment
* Risk
* Plenary/event
* Committee
* Member Parliament
* Staff profile
* Other institutional record

Linking does not transfer ownership.

---

# 92. PIF Example

Incoming donor letter approving activity funding:

Correspondence owns:

* donor letter.

PIF may reference the correspondence/document.

Do not upload a separate duplicate donor letter.

---

# 93. Procurement Example

Supplier sends contractual notice.

Correspondence record links to:

* procurement;
* contract;
* supplier.

Procurement retains procurement state.

Correspondence retains the official communication.

---

# 94. Travel Example

Embassy sends visa correspondence.

It may be linked to:

* traveller;
* travel requisition.

Access remains confidential/restricted.

---

# 95. Assignment Example

Incoming request requires a policy brief.

Correspondence creates:

Assignment:
`Prepare policy brief`

The response draft may link back to both.

---

# 96. Risk Integration

Serious correspondence can trigger:

**Create Risk**

Example:

* donor suspension notice;
* legal threat;
* major supplier breach;
* cybersecurity notice.

Risk module owns the risk afterwards.

---

# 97. Internal Memorandum

Internal memo fields:

* From
* To
* CC
* Subject
* Department
* Purpose
* Action required
* Deadline
* Classification
* Attachments

Internal communication must follow organisational hierarchy. 

---

# 98. Internal Memo Workflow

Configurable:

Draft → Supervisor → Director → Recipient

or:

Authorised Manager → Recipient

Not every internal memo should require SG approval unless policy requires it.

The system must distinguish:

**Internal communication**

from:

**Outgoing official correspondence to an external party.**

---

# 99. Circulars

Support one-to-many recipients.

Example:

Circular to all Member Parliaments.

Do not create 15 independent letter records unless each response must be independently tracked.

Use:

**One Outgoing Correspondence**

with:

**Recipient Distribution List**

and per-recipient delivery state.

---

# 100. Distribution Lists

Examples:

* All Member Parliaments
* Clerks
* Speakers/Presiding Officers
* SADC PF Staff
* Management
* Standing Committee Members
* Partner Group

Lists should reuse canonical contacts.

---

# 101. Per-Recipient Delivery

For circulars track:

* Recipient
* Address/email
* Sent
* Delivered
* Failed
* Acknowledged
* Response received

---

# 102. Mail Merge

Templates may generate personalised copies while preserving one correspondence campaign.

Example:

Same invitation with individual:

* name;
* Parliament;
* title.

Store:

* master template;
* generated recipient copy/version.

---

# 103. Note Verbale

Note Verbale template should support:

* recipient mission/embassy;
* formal diplomatic wording;
* institutional reference;
* date;
* subject;
* official letterhead/format.

No need to hard-code substantive language.

---

# 104. Multilingual Correspondence

Supported languages:

* English
* French
* Portuguese
* Other

Record:

* primary language;
* translation required;
* translated versions.

Translation may connect to the language/document workflow where implemented.

---

# 105. Translation Versions

One correspondence may have:

* English authoritative version;
* French translation;
* Portuguese translation.

Each version should be linked to the same correspondence.

Do not register translations as unrelated letters.

---

# 106. Authoritative Version

Where required, mark:

* Authoritative Original
* Approved Translation
* Working Translation

This prevents confusion.

---

# 107. Drafting and AI

Future AI may assist with:

* summaries;
* draft responses;
* classification;
* routing suggestions.

But:

* AI does not approve correspondence;
* AI does not sign;
* AI does not dispatch automatically;
* human review is mandatory;
* confidential-document processing must follow approved AI/data policies.

AI is Phase 3 only.

---

# 108. Reference Number Data Model

Recommended fields:

* reference_scheme_id
* file_number
* signatory_initials_snapshot
* preparer_initials_snapshot
* sequence_number
* formatted_reference
* financial/calendar year
* reserved_at
* issued_at
* voided_at
* void_reason

Snapshots are important because employee initials may later change.

---

# 109. File Number

The first component of the legacy outgoing reference represents the subject/file number. 

Nexus should link:

`file_number`

to a structured subject/file-plan record rather than an uncontrolled free-text number.

---

# 110. Data Model

Recommended core entities:

### correspondence_records

* id
* uuid
* direction
* incoming_reference
* outgoing_reference
* correspondence_type_id
* subject
* summary
* correspondence_date
* received_at
* registered_at
* sender_party_id
* recipient_party_id
* sender_reference
* channel
* priority
* confidentiality
* primary_subject_file_id
* current_stage
* current_owner_id
* current_department_id
* response_required
* response_due_at
* status
* registered_by_id

### correspondence_parties

### correspondence_party_contacts

### correspondence_documents

### correspondence_routes

### correspondence_action_items

### correspondence_relationships

### correspondence_subject_files

### correspondence_file_plan_nodes

### correspondence_drafts

### correspondence_approvals

### correspondence_signatures

### correspondence_dispatches

### correspondence_dispatch_recipients

### correspondence_delivery_events

### correspondence_deadlines

### correspondence_internal_notes

### correspondence_reference_sequences

### correspondence_retention_rules

### correspondence_legal_holds

### correspondence_audit_events

---

# 111. Routing Table

`correspondence_routes`:

* correspondence_id
* routed_from
* routed_to_user
* routed_to_department
* primary_owner
* instruction
* action_type
* due_at
* routed_by
* routed_at
* acknowledged_at
* completed_at
* status

Never overwrite old routes.

---

# 112. Relationship Table

`correspondence_relationships`:

* parent_correspondence_id
* related_correspondence_id
* relationship_type
* created_by
* created_at

This supports correspondence threads cleanly.

---

# 113. Document Table

Documents should use the shared Nexus Attachment/Document service where possible.

Correspondence-specific relation should store:

* correspondence_id;
* document_id;
* document_role:

  * Original
  * Enclosure
  * Draft
  * Final
  * Signed Final
  * Proof of Delivery
  * Translation.

Avoid storing raw binaries repeatedly.

---

# 114. API Requirements

Suggested endpoints:

### Incoming

`POST /correspondence/incoming`

`GET /correspondence/incoming`

`GET /correspondence/{id}`

`POST /correspondence/{id}/register`

`POST /correspondence/{id}/route`

`POST /correspondence/{id}/acknowledge`

### Action

`POST /correspondence/{id}/assign`

`POST /correspondence/{id}/create-assignment`

`POST /correspondence/{id}/complete-action`

### Outgoing

`POST /correspondence/outgoing`

`PUT /correspondence/{id}/draft`

`POST /correspondence/{id}/submit-review`

`POST /correspondence/{id}/approve`

`POST /correspondence/{id}/return`

`POST /correspondence/{id}/sign`

`POST /correspondence/{id}/register-outgoing`

### Dispatch

`POST /correspondence/{id}/dispatch`

`POST /correspondence/{id}/delivery-event`

### Filing

`POST /correspondence/{id}/subject-files`

`POST /correspondence/{id}/relationships`

### Close

`POST /correspondence/{id}/close`

`POST /correspondence/{id}/archive`

---

# 115. Email Integration API

Optional:

`POST /correspondence/import-email`

Must accept only:

* authorised mailbox item;
* message ID;
* sender;
* recipients;
* body;
* attachments.

Duplicate message IDs blocked.

Do not allow uncontrolled scraping of all staff mailboxes.

---

# 116. Workflow Engine

Use shared Nexus sequential workflow infrastructure.

Requirements:

* configurable workflow;
* role-based steps;
* delegation;
* return/resubmit;
* comments;
* notification;
* current holder;
* audit.

Do not build a second independent correspondence-only workflow engine where the shared one can be reused.

---

# 117. Permissions

Recommended permissions:

* `correspondence.view-own`
* `correspondence.view-department`
* `correspondence.view-all`
* `correspondence.register-incoming`
* `correspondence.route`
* `correspondence.assign`
* `correspondence.draft-outgoing`
* `correspondence.review`
* `correspondence.approve-outgoing`
* `correspondence.sign`
* `correspondence.register-outgoing`
* `correspondence.dispatch`
* `correspondence.manage-files`
* `correspondence.manage-retention`
* `correspondence.view-confidential`
* `correspondence.export`
* `correspondence.audit`
* `correspondence.admin`

---

# 118. Separation of Duties

At minimum:

* Registry registers but does not automatically approve outgoing correspondence.
* Drafter does not self-approve externally issued official correspondence.
* Final signatory action is separately attributable.
* Dispatch Officer cannot change signed content.
* Records Officer cannot change the original document.
* System Administrator cannot business-approve correspondence merely because of technical access.

---

# 119. Delegation

SG or other approvers may delegate through formal Nexus delegation.

Audit must show:

> Routed/approved by X on behalf of Y under delegation DLG-XXXX.

Delegation must include:

* effective dates;
* scope;
* action permissions.

---

# 120. Validation

Incoming:

* sender required for official mail;
* subject required;
* receipt date required;
* channel required;
* original document required where applicable.

Outgoing:

* recipient required;
* subject required;
* final document required;
* final approval required before external dispatch;
* reference required before dispatch;
* signatory required;
* signed final required where signature is applicable.

---

# 121. Concurrency

Prevent:

* duplicate reference generation;
* two SG users/delegates routing the same item concurrently without reconciliation;
* final document being replaced during signature;
* dispatch of superseded draft.

Use transactional state checks.

---

# 122. Idempotency

Register/dispatch actions must be idempotent.

A browser/network retry must not:

* create second registration;
* allocate second reference;
* send duplicate email;
* create duplicate dispatch.

---

# 123. Error Handling

Examples:

### Already Registered

> This correspondence has already been registered as IN/2026/00457.

### Final Approval Missing

> Outgoing official correspondence cannot be dispatched before the required final approval.

### Reference Missing

> Registry must assign an official outgoing reference before dispatch.

### Superseded Document

> This document is no longer the approved final version.

### Access Restricted

> You do not have access to this confidential correspondence.

---

# 124. Audit Trail

Audit events:

* incoming captured;
* registered;
* scanned;
* classification changed;
* subject file assigned;
* routed;
* acknowledged;
* reassigned;
* deadline changed;
* internal note added;
* assignment created;
* draft created;
* draft revised;
* review completed;
* SG approved;
* reference assigned;
* signed;
* dispatched;
* delivery confirmed;
* delivery failed;
* response received;
* relationship created;
* record closed;
* record archived;
* legal hold placed/released;
* export/download.

---

# 125. Audit Fields

* User
* Role
* Timestamp
* Action
* Record
* Previous value
* New value
* Reason
* Delegation reference
* IP/device where available

Audit trail must be immutable to ordinary users.

---

# 126. Reports

Required reports:

* Incoming Correspondence Register
* Outgoing Correspondence Register
* Correspondence Master Register
* Correspondence by Department
* Correspondence by Officer
* Correspondence by Sender
* Correspondence by Recipient
* Correspondence by Member Parliament
* Correspondence by Country
* Correspondence by Subject File
* Correspondence by Type
* Correspondence by Priority
* Confidential Correspondence Register, restricted
* Pending SG Routing
* Pending Action
* Due Soon
* Overdue Correspondence
* Response-Time Report
* Outgoing Pending Approval
* Dispatch Register
* Delivery Failure Report
* Response Awaited Report
* Closed Correspondence
* Audit Report

Exports:

* PDF
* Excel
* CSV where appropriate.

---

# 127. Correspondence Register PDF

Official register should include:

* reference;
* date;
* sender/recipient;
* sender reference;
* subject;
* department;
* responsible officer;
* status;
* due date;
* action/response status.

Confidential content may be redacted based on export permissions.

---

# 128. Individual Correspondence PDF / Routing Sheet

Nexus may generate an institutional record showing:

* Correspondence reference
* Sender
* Subject
* Date received
* Registry details
* Routing instruction
* Assigned officers
* Action dates
* Response reference
* Closure status

This replaces the paper routing slip.

---

# 129. Dashboards and Institutional Memory

The module should provide a powerful search experience because correspondence is a major part of institutional memory.

Users should be able to find:

> All correspondence with Parliament of Botswana concerning the 59th Plenary.

or:

> All Sida letters related to the SRHR project in 2026.

subject to access permissions.

---

# 130. Full-Text Search

Search authorised document text and metadata by:

* reference;
* sender;
* recipient;
* subject;
* date;
* country;
* organisation;
* department;
* officer;
* subject file;
* related activity;
* keywords.

Search results must respect security classification.

---

# 131. OCR

Where scanned correspondence contains no embedded text, OCR may be performed asynchronously if the institutional document service supports it.

However:

* original scan remains authoritative;
* OCR is searchable derived text;
* users must not mistake OCR errors for official wording.

---

# 132. Records Integrity

Once registered:

* registration timestamp cannot be silently altered;
* original reference cannot be silently changed;
* original document cannot be silently replaced;
* sender reference remains historical.

Corrections require:

* correction event;
* reason;
* authorised user.

---

# 133. Reference Correction

If reference was entered incorrectly:

Do not rewrite history invisibly.

Record:

* previous reference;
* corrected reference;
* reason;
* changed by;
* timestamp.

Generated outgoing reference numbers should generally be immutable after dispatch.

---

# 134. Voided Outgoing Reference

If a reference is allocated but letter is cancelled:

Status:

**Voided**

Store:

* reference;
* reason;
* user;
* date.

Never assign the same number to another letter.

---

# 135. Migration

Existing correspondence registers should be migrated where feasible.

Sources may include:

* Excel registers;
* physical register books;
* shared folders;
* outgoing mail files;
* SG Office files;
* Registry files;
* historical scanned letters.

---

# 136. Migration Priority

Phase migration:

### Priority 1

Current/open actionable correspondence.

### Priority 2

Current financial/calendar year.

### Priority 3

High-value institutional historical correspondence.

### Priority 4

Older archives according to resources.

Do not delay production indefinitely to digitise every historical paper file.

---

# 137. Historical Record

Migrated correspondence marked:

**Migrated / Historical**

Fields include:

* legacy reference;
* legacy file number;
* source;
* migration batch;
* migrated by.

---

# 138. Historical Physical Location

Where document is not scanned:

Nexus may register:

* metadata;
* physical archive location.

Example:

`Archive Room / Box 14 / File 123`

---

# 139. Backend Tests

Must cover:

* incoming registration;
* unique references;
* official/non-official classification;
* SG routing;
* multiple routes;
* primary owner;
* assignment creation;
* deadline calculation;
* escalation;
* outgoing draft;
* approval;
* reference generation;
* reference concurrency;
* signature;
* dispatch;
* delivery;
* related correspondence;
* subject filing;
* confidentiality;
* retention;
* legal hold;
* audit.

---

# 140. Frontend / E2E Tests

Must cover:

* register incoming letter;
* upload scan;
* route through SG;
* assign to department;
* create task;
* draft response;
* return for correction;
* approve;
* generate reference;
* sign;
* dispatch;
* record delivery;
* link incoming reply;
* show correspondence thread;
* subject-file lookup;
* confidential item access.

---

# 141. Security Tests

Must prove:

* ordinary employee cannot see SG-confidential correspondence;
* Registry metadata access does not automatically provide unrestricted content access;
* user cannot alter original incoming scan;
* drafter cannot bypass SG approval;
* outgoing reference cannot be forged via API;
* signed final cannot be replaced;
* dispatch cannot send unapproved draft;
* global search does not leak confidential subjects/content;
* download access is checked server-side;
* delegated action is correctly attributed.

---

# 142. Performance Requirements

* Register lists should paginate.
* Full-text search should be indexed.
* Reference generation must remain fast under concurrency.
* Large attachments should not block the workflow.
* Document preview should use secure streaming.
* Dashboards should aggregate without loading full documents.

---

# 143. Production Acceptance Criteria

The module is production-ready only when:

1. Incoming official correspondence can be registered.
2. Personal/non-official mail can be excluded.
3. Incoming references are unique.
4. Physical scans can be uploaded securely.
5. Original documents are immutable after registration.
6. SG routing works.
7. Designated SG delegate works.
8. One Primary Action Owner is enforceable.
9. Supporting action owners can be added.
10. Current holder/stage is visible.
11. Deadlines can be assigned.
12. Reminders work.
13. Escalation works.
14. Correspondence can create linked Assignments.
15. Outgoing drafts can be prepared.
16. HOD/Director review works.
17. SG final approval works.
18. Official letterhead is supported.
19. Outgoing reference generation works.
20. Legacy reference format is supported.
21. Reference numbers cannot be duplicated/reused.
22. Approved correspondence can be digitally signed.
23. Signature security prevents unauthorised reuse.
24. Dispatch can be recorded.
25. Delivery can be confirmed.
26. Failed delivery can be followed up.
27. Response expected dates can be tracked.
28. Incoming and outgoing items can be threaded.
29. Subject files work.
30. Master chronological register works.
31. Files are stored once and linked, not duplicated.
32. Internal memos can be handled separately.
33. Circulars can have multiple recipients.
34. Multilingual versions can link to one record.
35. Confidentiality is record-level enforced.
36. Search respects security.
37. Retention/legal hold is supported.
38. Official records cannot be casually deleted.
39. Full audit trail works.
40. PDF/Excel register exports work.
41. Existing Workflow, Notification, User Profile, Assignment and Document services pass regression tests.

---

# 144. Phase 1 — Production Critical

Implement:

* Incoming Register
* Outgoing Register
* Registry references
* Scanned documents
* SG routing
* Primary/supporting owners
* Deadlines
* Notifications
* Assignment linkage
* Outgoing drafting
* Approval workflow
* Reference numbering
* Letterhead
* Digital signature integration
* Dispatch
* Delivery evidence
* Correspondence threading
* Subject files
* Master register
* Confidentiality
* Search
* Reports
* Audit

---

# 145. Phase 2

Add:

* designated registry mailbox integration;
* automatic email registration suggestions;
* courier API tracking;
* advanced records retention;
* legal holds;
* mail merge;
* multilingual document workflow;
* advanced archive migration.

---

# 146. Phase 3

Optional:

* AI correspondence summarisation;
* suggested routing;
* draft-response assistance;
* auto-classification;
* deadline extraction;
* related-record recommendations.

All AI results require human verification.

---

# 147. Critical Architecture Rules

The implementer must treat these as non-negotiable:

> **Incoming official correspondence passes through the institutional Registry/SG routing process.**

> **Outgoing official correspondence requires the appropriate SG approval under the current rules.**

> **The register is not merely a document upload folder.**

It must track responsibility and action.

> **One responsible action owner must be identifiable.**

> **The original incoming document is immutable.**

> **Signed outgoing correspondence is immutable.**

> **Never reuse outgoing reference numbers.**

> **Voided numbers remain part of the register.**

> **Do not create three digital copies merely because the paper policy required three physical copies.**

The same authoritative document should be linked to:

* addressee/dispatch record;
* Master Register;
* subject file.

> **Internal notes must never accidentally be included in an external outgoing letter.**

> **Correspondence and Assignment Management remain separate but linked.**

> **Do not automatically ingest every employee email.**

> **Search must never bypass confidentiality.**

---

# 148. Final Product Rule

An authorised SADC PF user should be able to open any official correspondence record and immediately answer:

**What is this?**
→ subject/type

**Where did it come from?**
→ sender

**When did we receive it?**
→ registry timestamp

**What is its official reference?**
→ incoming/outgoing reference

**Has the SG seen it?**
→ routing history

**Who currently owns the action?**
→ responsible officer

**What must they do?**
→ instruction

**When is it due?**
→ deadline

**Has a response been drafted?**
→ linked draft

**Who approved it?**
→ approval history

**Was it signed?**
→ digital signing event

**Was it sent?**
→ dispatch

**Did the recipient receive it?**
→ delivery status

**What came back in response?**
→ correspondence thread

**Which institutional file does it belong to?**
→ subject file

**Who accessed or changed it?**
→ audit trail

That transforms the Correspondence Register from a passive logbook into a secure institutional action-and-record system while remaining faithful to the SADC PF rules on registry, hierarchy, official approval and filing.