# SADC PF Nexus

# Notifications & Communications Delivery Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System
**Module:** Notifications & Communications Delivery
**Short name:** Notifications
**Document status:** Updated implementation PRD
**Module type:** Shared event-driven notification, delivery, reminder, escalation and user-inbox service

The Accounting Manual requires relevant information to be identified, captured and communicated in a form and timeframe that enables people to carry out their responsibilities, with communication flowing down, across and up the institution. 

The Administrative Rules also require official information to remain confidential, communication to follow the organisational hierarchy and urgent communications to be delivered promptly with evidence of transmission where appropriate.  

The existing PIF implementation already includes working notifications alongside workflow, delegation, approvals, attachments and audit logging. This shared module must consolidate and extend that working capability without breaking the existing PIF functionality. 

---

# 1. Executive Summary

The Notifications Module will provide one central communication-delivery service for all Nexus modules.

It will manage:

* in-app notifications;
* transactional email;
* optional mobile push notifications;
* reminders;
* escalations;
* approval-task alerts;
* digest messages;
* delivery tracking;
* retries;
* failed-message handling;
* multilingual templates;
* notification preferences;
* confidentiality-safe content;
* secure record links;
* notification history;
* administrative monitoring;
* complete delivery auditability.

The module must answer:

* What system event generated the notification?
* Who should receive it?
* Why is that person a recipient?
* Which channel should be used?
* Is the notification mandatory or optional?
* What language should be used?
* Is the content confidential?
* Was the notification queued?
* Was it sent?
* Did the provider accept it?
* Did it fail or bounce?
* Was it retried?
* Is it available in the Nexus inbox?
* Has the user read or acknowledged it?
* Was an escalation delivered?
* Was a duplicate notification prevented?
* Which template version produced the message?
* What secure record does the notification relate to?

The primary product rule is:

> Nexus notifications alert users to institutional records and required actions. They must not become an alternative source of truth, an unofficial approval mechanism or a channel that exposes confidential information.

---

# 2. Core Product Principle

The notification lifecycle is:

> **Business Event → Recipient Resolution → Policy Evaluation → Template Selection → Secure Rendering → Channel Selection → Queue → Delivery Attempt → Provider Result → Retry or Completion → User Interaction → Audit**

The module must separate:

1. business event;
2. notification instruction;
3. recipient;
4. in-app inbox item;
5. channel delivery;
6. delivery attempt;
7. template;
8. user preference;
9. escalation;
10. acknowledgement.

These are related but must not be represented by one generic `notifications` table alone.

---

# 3. Product Boundary

## 3.1 Notifications owns

* notification events consumed from Nexus modules;
* recipient resolution instructions;
* notification-policy evaluation;
* message templates;
* language rendering;
* in-app inbox records;
* email delivery;
* mobile push delivery;
* delivery retries;
* bounce/failure processing;
* notification preferences;
* digests;
* delivery logs;
* notification administration.

## 3.2 Business modules own

* the underlying business record;
* business status;
* current holder;
* due date;
* approval result;
* financial or HR consequence;
* record confidentiality;
* business escalation decision.

Example:

Workflow owns:

> Travel approval task is overdue and must escalate to the Director.

Notifications owns:

> Deliver the escalation message to the Director by approved channels.

## 3.3 Correspondence owns official communication

Notifications are not official outgoing correspondence.

An email alert such as:

> A draft official letter is awaiting your approval.

is a notification.

The signed and dispatched official letter remains in the Correspondence Register.

## 3.4 Authentication owns identity security

Authentication owns:

* login;
* MFA;
* sessions;
* password reset;
* credential recovery.

Notifications may deliver security alerts and approved recovery messages, but it must not independently verify identity.

## 3.5 People & Authority owns recipient identity

People & Authority owns:

* user;
* official email;
* position;
* department;
* supervisor;
* delegation;
* acting appointment;
* language preference;
* account status.

---

# 4. Existing Implementation Requirement

The PIF code audit confirms that workflow notifications are already functioning and must remain unaffected by new PIF development. 

Implementation must therefore begin with:

1. inventorying the current notification implementation;
2. identifying existing channels, event classes, queues and templates;
3. retaining current PIF behaviour;
4. moving reusable logic into the shared service;
5. introducing compatibility adapters;
6. testing existing PIF events before migration;
7. eliminating duplicate module-specific delivery code only after successful migration.

There must be no temporary notification path that coexists indefinitely with the shared service.

---

# 5. Business Objectives

The module must:

1. Notify the correct user at the correct time.
2. Make required actions difficult to miss.
3. Provide one central in-app inbox.
4. support reliable email delivery.
5. support optional mobile push.
6. protect confidential information.
7. prevent duplicate messages.
8. provide delivery retries and failure visibility.
9. support workflow reminders and escalations.
10. allow useful user preferences without disabling mandatory notices.
11. provide multilingual messages.
12. reduce notification fatigue.
13. support daily and weekly digests.
14. keep the underlying Nexus record authoritative.
15. preserve complete delivery and interaction history.
16. support every Nexus module through a stable integration contract.
17. avoid requiring employees to install the mobile application.
18. prevent approvals from being completed through insecure email links.

---

# 6. Supported Channels

## 6.1 In-App Notifications

Mandatory core channel for active Nexus users.

## 6.2 Email

Mandatory transactional channel for important workflow and institutional alerts, subject to delivery policy.

## 6.3 Mobile Push

Optional channel for users who:

* have the Nexus mobile application;
* have registered a device;
* have enabled push;
* are authorised for the content.

## 6.4 SMS

Not Phase 1.

May later be approved for:

* security recovery;
* emergency institutional alerts;
* time-critical operational notices.

## 6.5 WhatsApp or Other Messaging Platforms

Not a core Phase 1 delivery channel.

Any future integration requires:

* approved institutional account;
* privacy assessment;
* records-management decision;
* provider terms review;
* message-template approval;
* clear distinction from official correspondence.

---

# 7. Channel Principle

Every important notification should exist in the in-app inbox even when email or push is also used.

This ensures:

* Nexus has an authoritative alert history;
* provider failure does not erase the alert;
* the user can find prior notifications;
* security-sensitive content can remain inside Nexus.

---

# 8. Notification Categories

Configurable categories:

* Workflow Action Required
* Workflow Status Update
* Approval Decision
* Return for Correction
* Clarification Request
* Reminder
* Escalation
* Assignment
* Correspondence
* Leave
* Travel
* PIF
* M&E
* Procurement
* Budget
* Salary Advance
* Assets
* Stock
* Timesheets
* Weekly Summary
* Risk
* Audit
* Security
* Account
* Signature
* Delegation
* Acting Appointment
* Document
* Report
* System Maintenance
* Data Export
* Integration Failure
* General Institutional Notice

---

# 9. Notification Importance

Importance levels:

* Informational
* Normal
* Important
* Urgent
* Critical

Importance affects:

* channel selection;
* delivery timing;
* retry behaviour;
* quiet-hours override;
* digest eligibility;
* escalation;
* visual presentation.

Users must not be able to label ordinary notices `Critical` without authorised rules.

---

# 10. Delivery Classes

## 10.1 Mandatory Transactional

Cannot be disabled by the user.

Examples:

* approval task assigned;
* request returned;
* critical security alert;
* signature revoked;
* account suspended;
* risk acceptance required;
* payroll-impacting correction;
* audit finding action assigned.

## 10.2 Operational

May have limited user channel preferences.

Examples:

* Assignment update;
* review completed;
* stock ready for collection;
* weekly summary accepted.

## 10.3 Digest Eligible

Can be combined into a daily or weekly digest.

Examples:

* low-priority status updates;
* informational changes;
* upcoming deadlines.

## 10.4 Broadcast

Institutional announcements sent to an approved audience.

## 10.5 Security Sensitive

Uses strict templates, minimal external content and enhanced logging.

---

# 11. Notification Event

A source module publishes a business event.

Example:

`WorkflowTaskAssigned`

Event payload should contain:

* event ID;
* event type;
* source module;
* source record type;
* source record ID;
* source reference;
* source version;
* event timestamp;
* actor;
* target recipient rule;
* importance;
* confidentiality;
* template key;
* secure-link context;
* idempotency key;
* correlation ID.

The event must not contain unrestricted confidential documents or excessive personal data.

---

# 12. Notification Command vs Business Event

A business event describes what happened:

> Leave application returned.

A notification command describes how users should be informed:

> Notify applicant immediately by in-app and email using template `leave.returned.v2`.

Modules may publish domain events, while notification policies determine delivery.

This prevents every module from hard-coding channel behaviour.

---

# 13. Recipient Types

Recipients may be resolved as:

* named user;
* applicant;
* requester;
* current workflow holder;
* supervisor;
* HOD;
* Director;
* Secretary General;
* record owner;
* Assignment owner;
* reviewer;
* watcher;
* delegate;
* acting position holder;
* department;
* role within a scope;
* project team;
* distribution group;
* external email recipient, where authorised.

---

# 14. Recipient Resolution

Recipient resolution must use People & Authority.

For each recipient, record:

* person;
* account;
* official email;
* position;
* department;
* language;
* time zone;
* account status;
* delegation or acting basis;
* reason selected;
* resolution timestamp.

Do not copy email addresses permanently into every business module.

---

# 15. Recipient Resolution Failure

If no valid recipient can be identified:

Status:

**Recipient Resolution Failed**

The service must:

1. preserve the notification request;
2. identify the unresolved selector;
3. notify the module owner/administrator;
4. avoid sending to an arbitrary substitute;
5. support controlled correction and retry;
6. record the failure in audit logs.

---

# 16. Inactive or Disabled Recipient

If the recipient account is disabled:

* do not deliver confidential in-app content to an inaccessible account without review;
* check acting/delegation rules;
* notify the business process owner;
* reroute only where the originating module authorises it;
* preserve the original intended recipient.

Notification service must not independently reassign business responsibility.

---

# 17. Multiple Recipients

One event may produce several recipient-specific notifications.

Example:

Travel approved:

* traveller;
* Administration;
* Finance;
* supervisor.

Each recipient may receive:

* a different template;
* different content;
* different secure link;
* different channels;
* different confidentiality treatment.

Do not send one unrestricted message to a broad recipient list by default.

---

# 18. CC and Watchers

The system should distinguish:

* Action Recipient
* Information Recipient
* Watcher
* Escalation Recipient
* Copy Recipient

Only the Action Recipient should see:

> Action required from you.

Others see:

> For your information.

---

# 19. Distribution Groups

Groups may include:

* Management
* All Employees
* Department
* Project Team
* Finance Team
* HODs
* Directors
* Nexus Administrators
* Risk Owners
* Internal Audit Team

Group membership must resolve dynamically from People & Authority.

Historical delivery records must preserve the actual recipients selected at send time.

---

# 20. External Recipients

External notification delivery must be tightly controlled.

Use cases:

* applicant without Nexus account;
* external auditor;
* supplier registration;
* consultant;
* authorised partner;
* recipient acknowledgement.

Controls:

* approved template;
* authorised source module;
* validated email;
* minimum information;
* secure token where applicable;
* token expiry;
* no unauthorised internal record access;
* audit logging.

---

# 21. Notification Template

Templates must contain:

* Template key
* Name
* Category
* Channel
* Language
* Subject/title
* Message body
* Short push body
* Action label
* Secure-link rule
* Importance
* Confidentiality profile
* Required variables
* Optional variables
* Version
* Effective dates
* Status
* Approved by

---

# 22. Template Versioning

Changing a template creates a new version.

Historical delivery records must retain:

* template key;
* version;
* rendered content or secure content snapshot;
* language;
* variables used.

Do not silently rewrite the message that was historically sent.

---

# 23. Template Statuses

* Draft
* Under Review
* Approved Future
* Active
* Suspended
* Superseded
* Retired
* Archived

Only approved active templates may be used in production.

---

# 24. Template Governance

Template changes should require review where they affect:

* legal/security wording;
* official branding;
* privacy;
* financial approvals;
* HR notices;
* audit notices;
* password recovery;
* external recipients.

Ordinary developers should not change high-risk production templates without business approval.

---

# 25. Template Variables

Examples:

* recipient name;
* request reference;
* request type;
* current stage;
* action required;
* due date;
* department;
* applicant;
* decision;
* secure record link;
* support contact.

The rendering engine must:

* escape unsafe content;
* prevent script/HTML injection;
* reject missing required variables;
* enforce content length;
* apply confidentiality rules.

---

# 26. Confidentiality Profiles

Suggested profiles:

## Public/General

May include ordinary record descriptions.

## Internal

May include normal internal workflow context.

## Restricted

External channels use reduced content.

## Confidential

Email/push includes only a generic alert and secure link.

## Highly Confidential

May use in-app only unless explicit policy permits another channel.

## Security Sensitive

Uses security-specific delivery and logging rules.

---

# 27. Privacy-Safe Email Subject Lines

Avoid:

> Salary advance for Jane Doe rejected because salary is insufficient.

Use:

> Action completed on your confidential Nexus request.

Avoid:

> Investigation into Employee X assigned to you.

Use:

> A restricted Nexus matter requires your attention.

The Administrative Rules require official information and documents to be protected from unauthorised disclosure. 

---

# 28. Secure Links

Notification links must:

* use HTTPS;
* point to Nexus, not directly to an attachment;
* require authentication;
* recheck authorisation;
* avoid exposing sensitive IDs where practical;
* expire when tokenised external access is used;
* reject revoked/expired access;
* preserve the intended destination after login.

Possession of a link must not be sufficient authority.

---

# 29. Attachments in Email

Default rule:

> Do not attach confidential Nexus records directly to notification emails.

Use a secure Nexus link.

Limited attachments may be permitted for:

* non-sensitive public documents;
* approved official outputs;
* authorised external dispatch.

Attachment policy must consider:

* confidentiality;
* file size;
* malware scanning;
* document version;
* recipient authority;
* retention.

---

# 30. In-App Notification Centre

Main Menu → **Notifications**

Views:

* All
* Unread
* Action Required
* Due Soon
* Overdue
* Mentions
* Approvals
* Assignments
* Security
* System
* Archived

Actions:

* Open Record
* Mark Read
* Mark Unread
* Acknowledge
* Archive
* Mute Similar Optional Notices
* Adjust Preferences

Mandatory notifications must not be permanently deleted through ordinary user actions.

---

# 31. Notification Card

Each card should show:

* icon/category;
* title;
* concise message;
* source module;
* source reference;
* action required;
* current stage;
* due date;
* importance;
* received time;
* unread state;
* secure action link.

Confidential items may display a generic title.

---

# 32. Read vs Acknowledged

These are different.

## Read

The user opened or marked the notification as read.

## Acknowledged

The user explicitly confirmed awareness.

Acknowledgement may be required for:

* urgent Management instruction;
* security alert;
* policy notice;
* audit request;
* service outage;
* official operational instruction.

Acknowledgement does not complete the underlying business action.

---

# 33. Notification Statuses

Overall notification statuses:

* Created
* Suppressed
* Scheduled
* Queued
* Processing
* Partially Delivered
* Delivered
* Delivery Failed
* Expired
* Cancelled
* Archived

Recipient/channel states are stored separately.

---

# 34. In-App States

* Unread
* Read
* Acknowledged
* Archived
* Expired
* Revoked

A notification may be read but still require an outstanding workflow action.

---

# 35. Email Delivery States

* Pending
* Queued
* Provider Accepted
* Sent
* Delivered, where provider confirms
* Temporarily Deferred
* Soft Bounce
* Hard Bounce
* Rejected
* Complained/Reported
* Suppressed
* Failed
* Cancelled
* Expired

Do not claim `Delivered` when the provider only confirms message acceptance.

---

# 36. Push Delivery States

* Pending
* Queued
* Provider Accepted
* Delivered, where supported
* Device Token Invalid
* Application Uninstalled
* Permission Disabled
* Failed
* Expired

A failed push must not remove the in-app notification.

---

# 37. Email Read Tracking

Default recommendation:

* do not depend on tracking pixels;
* do not treat an email-open signal as proof of reading;
* do not treat non-opening as proof that the user ignored the message.

The authoritative signals should be:

* Nexus login;
* in-app read;
* explicit acknowledgement;
* completion of the business action.

---

# 38. Delivery Evidence

The Administrative Rules historically required evidence of fax transmission, including date, time and status. The digital equivalent should retain provider responses and delivery attempts without treating them as proof that the recipient understood the message. 

---

# 39. Notification Preferences

Users may configure:

* email enabled for optional notifications;
* push enabled;
* daily digest;
* weekly digest;
* quiet hours;
* preferred language;
* categories to digest;
* category-specific channel choices;
* sound/badge preferences on mobile.

Users may not disable mandatory security, workflow or compliance notices.

---

# 40. Mandatory Preference Overrides

Examples that cannot be fully disabled:

* password/security alerts;
* account suspension;
* privileged-role changes;
* workflow task assignment;
* final approval/rejection on own request;
* returned requests;
* audit evidence request;
* risk-treatment assignment;
* overdue payroll-impacting action;
* signature revocation.

Users may sometimes choose the channel mix, but at least the in-app channel remains mandatory.

---

# 41. Quiet Hours

Quiet hours may delay non-urgent email/push.

Critical or urgent notifications may override quiet hours when authorised.

In-app notifications may be created immediately while email/push waits.

Time calculations use the user’s configured time zone.

---

# 42. Language Support

Templates should support:

* English
* French
* Portuguese

The language is selected from:

1. recipient preference;
2. workflow/record language where appropriate;
3. institutional default.

A missing translation should use an approved fallback, normally English, and record the fallback.

---

# 43. Multilingual Template Controls

Every translated template must preserve:

* the same business meaning;
* action requirement;
* due date;
* confidentiality treatment;
* secure-link purpose.

Translation status:

* Draft
* Reviewed
* Approved
* Active
* Outdated

---

# 44. Digests

Digest types:

* Daily Action Digest
* Daily Information Digest
* Weekly Work Digest
* Manager Team Digest
* Overdue Action Digest
* Optional System Summary

A digest may group:

* assignments due;
* approvals pending;
* returned requests;
* reminders;
* informational updates.

Critical notifications must still be sent immediately.

---

# 45. Digest Content

A digest should include:

* total pending actions;
* due today;
* overdue;
* new items;
* high-priority items;
* secure links.

Confidential items should remain generically described.

---

# 46. Digest Deduplication

An event already delivered immediately should not be repeated as a new alert in a confusing manner.

A digest may show:

> Still pending

rather than:

> New action assigned

when the user already received the assignment.

---

# 47. Reminder Policy

Reminders may be generated for:

* approval due;
* assignment due;
* weekly report due;
* timesheet due;
* risk review due;
* audit evidence due;
* delegation expiring;
* contract/signature authority expiring;
* warranty expiring;
* stock expiring;
* document retention action due.

The source module or workflow defines when the reminder is required.

Notification service delivers it.

---

# 48. Escalation Policy

The source module determines:

* escalation trigger;
* escalation recipient;
* escalation level;
* whether business ownership changes.

Notification service records and delivers:

* escalation message;
* recipients;
* channels;
* delivery results.

Escalation delivery must not itself reassign the underlying record.

---

# 49. Notification Suppression

Suppression may occur when:

* event is duplicated;
* recipient is the triggering actor and policy excludes self-notification;
* record was cancelled before delivery;
* newer event supersedes the old one;
* recipient has opted out of optional category;
* quiet-hours delay applies;
* recipient email is hard-bounced;
* security policy blocks the channel.

Every suppression requires a reason.

---

# 50. Self-Notification Rules

The system should avoid unnecessary messages such as:

> You submitted your own request.

But it may still notify the actor when:

* submission confirmation is required;
* action has external consequences;
* a record reference is issued;
* audit evidence is needed;
* security-relevant activity occurred.

Rules must be category-specific.

---

# 51. Duplicate Prevention

Duplicate protection must use:

* event ID;
* idempotency key;
* recipient;
* channel;
* template;
* logical notification purpose;
* source version.

A network retry or repeated event consumer must not send the same email twice.

---

# 52. Notification Coalescing

High-frequency updates may be combined.

Example:

Ten comments added to one Assignment over five minutes.

Possible message:

> Five new updates were added to Assignment ASN/2026/0042.

Coalescing must not delay critical action notices.

---

# 53. Notification Storm Protection

The service must detect:

* integration loops;
* repeated state events;
* bulk import floods;
* mass reassignment;
* provider retries creating duplicates.

Controls:

* rate limits;
* event caps;
* batching;
* circuit breakers;
* administrative pause;
* incident alert.

Do not silently discard mandatory notifications.

---

# 54. Queue Architecture

Notification delivery must use background queues.

Recommended queues:

* critical notifications;
* transactional email;
* normal in-app;
* push;
* digests;
* bulk/broadcast;
* retries;
* dead-letter processing.

Critical workflow notifications must not wait behind a large newsletter or bulk broadcast.

---

# 55. Retry Policy

Transient failures should retry using controlled backoff.

Example:

* first retry after a short interval;
* subsequent retries with increasing delay;
* maximum attempt count;
* movement to dead-letter queue after exhaustion.

Exact timings must be configurable.

---

# 56. Permanent vs Temporary Failure

## Temporary

* provider timeout;
* connection failure;
* temporary mailbox rejection;
* rate limit.

Retry.

## Permanent

* invalid email;
* hard bounce;
* invalid device token;
* prohibited recipient;
* malformed template.

Do not retry indefinitely.

---

# 57. Dead-Letter Queue

Failed delivery records enter an administrative queue containing:

* notification;
* recipient;
* channel;
* provider;
* error;
* attempts;
* first failure;
* last failure;
* recommended action.

Actions:

* Retry
* Correct Recipient Data
* Switch Approved Channel
* Suppress with Reason
* Escalate to ICT
* Close Failure

---

# 58. Provider Abstraction

The delivery service should support interchangeable providers.

Email provider interface:

* send;
* status callback;
* bounce callback;
* complaint callback;
* provider message ID.

Push interface:

* register device;
* send;
* invalidate token;
* status callback.

Business modules must not call a provider directly.

---

# 59. Email Provider Configuration

Configuration should support the institution’s approved email infrastructure, likely through its existing official-email environment.

Fields:

* provider type;
* sender mailbox;
* reply-to;
* tenant/domain;
* authentication method;
* throttling;
* approved sender names;
* bounce handling;
* test mode;
* status.

Credentials must be stored in a secure secret manager, not application tables or source code.

---

# 60. Sender Identities

Approved sender identities may include:

* SADC PF Nexus
* SADC PF Registry
* SADC PF Human Resources
* SADC PF Finance
* SADC PF Security

Use limited, centrally controlled sender identities.

Do not allow arbitrary users or modules to spoof sender names.

---

# 61. Reply Handling

Transactional alerts should generally use:

* a monitored reply-to mailbox; or
* a clear no-reply address with support instructions.

Replies must not silently disappear.

Official correspondence replies should flow through the Correspondence process, not remain hidden in the notification service.

---

# 62. Email Bounce Handling

Hard bounce actions:

* mark address delivery problem;
* stop repeated attempts;
* notify ICT/HR or profile owner;
* preserve in-app delivery;
* request correction of official email.

Soft bounce actions:

* retry according to policy;
* escalate after threshold.

---

# 63. Mobile Device Registration

Device record:

* User
* Device ID
* Platform
* Push token
* Application version
* Registered date
* Last active
* Notification permission
* Token status
* Revoked date

Do not store unnecessary personal device details.

---

# 64. Device Token Security

Requirements:

* tokens encrypted or protected;
* user-bound;
* replaced on refresh;
* invalid tokens removed;
* tokens revoked on logout where appropriate;
* disabled account tokens deactivated;
* no use for authentication.

---

# 65. Push Notification Privacy

Lock-screen messages must be minimal.

Example:

> Nexus: A new approval task requires your attention.

Do not show:

* salary amounts;
* medical leave type;
* audit allegation;
* confidential risk title;
* procurement-sensitive bid details.

The full message is shown only after secure application access.

---

# 66. Broadcast Notifications

Authorised users may send institutional notices.

Broadcast fields:

* title;
* message;
* audience;
* importance;
* channel;
* language;
* start time;
* expiry;
* acknowledgement required;
* attachment/secure link;
* sender authority;
* approval status.

---

# 67. Broadcast Approval

High-impact broadcasts should require review.

Examples:

* all-staff security alert;
* institutional outage;
* policy announcement;
* emergency office closure;
* mandatory compliance notice.

The notification service must not become an uncontrolled mass-email tool.

---

# 68. Scheduled Notifications

Support scheduling for:

* future reminders;
* approved broadcasts;
* expiry alerts;
* periodic digests;
* planned maintenance.

Scheduled notifications must revalidate:

* recipient;
* record status;
* confidentiality;
* cancellation;
* channel availability;

before delivery.

---

# 69. Cancellation of Pending Notifications

If the source event becomes obsolete before delivery:

Example:

An approval task is reassigned before the notification sends.

The system should:

* cancel or supersede the stale pending message;
* issue the correct new message;
* record the cancellation reason.

Already delivered messages cannot be recalled reliably, but in-app notifications may be marked superseded.

---

# 70. Expiry

Some notifications are no longer actionable after:

* task completion;
* record cancellation;
* deadline expiry;
* token expiry;
* user offboarding.

Expired notifications remain in history but clearly show:

> This action is no longer available.

---

# 71. Acknowledgement Campaigns

For important institutional notices, the module may support:

* required acknowledgement;
* acknowledgement deadline;
* reminder;
* escalation;
* acknowledgement report.

Examples:

* new ICT security instruction;
* confidentiality policy notice;
* emergency procedure;
* mandatory internal circular.

Acknowledgement does not prove comprehension or training completion.

---

# 72. Workflow Integration

Workflow events include:

* task assigned;
* task reassigned;
* due soon;
* overdue;
* clarification requested;
* record returned;
* record resubmitted;
* approval recorded;
* rejection recorded;
* workflow completed;
* release failed.

Each message must show the current holder and stage where relevant.

---

# 73. Assignment Integration

Assignment notifications:

* assigned;
* acceptance required;
* contributor added;
* due soon;
* overdue;
* blocker added;
* clarification;
* completion submitted;
* review required;
* returned;
* verified;
* reassigned;
* cancelled.

---

# 74. Correspondence Integration

Notifications:

* correspondence registered;
* SG routing required;
* assigned for action;
* response draft required;
* response overdue;
* approval required;
* ready for dispatch;
* delivery failed;
* external response received.

The official correspondence itself remains in the Correspondence Register.

---

# 75. PIF Integration

Notifications:

* PIF submitted;
* returned;
* Finance review required;
* approval required;
* approved;
* rejected;
* Procurement hand-off;
* M&E intake available;
* support officer assigned.

The current PIF implementation’s automatic notification behaviour must continue during migration. 

---

# 76. Leave Integration

Notifications:

* application submitted;
* HOD action required;
* HR certification required;
* approved;
* rejected;
* returned;
* cancellation request;
* upcoming leave;
* delegation/handover suggestion;
* TOIL expiry.

Sensitive leave type information must not be exposed externally.

---

# 77. Travel Integration

Notifications:

* requisition submitted;
* itinerary input required;
* DSA calculation required;
* Finance confirmation required;
* SG approval required;
* approved;
* booking action;
* visa/insurance deadline;
* travel amendment;
* retirement due;
* retirement overdue.

---

# 78. Procurement Integration

Notifications:

* procurement submitted;
* budget certification required;
* RFQ ready;
* evaluation assigned;
* conflict declaration required;
* award approval required;
* PO/contract approval;
* delivery due;
* delivery delayed;
* supplier performance review;
* procurement exception.

Supplier/bid-sensitive information must be restricted.

---

# 79. Budget and Finance Integration

Notifications:

* budget review required;
* commitment failed;
* low budget availability;
* transfer/revision approval;
* variance threshold exceeded;
* reconciliation issue;
* payroll export failure;
* salary-advance recovery issue.

Financial details in email/push must be minimised.

---

# 80. Assets and Stock Integration

Notifications:

* asset assigned;
* acknowledgement required;
* asset return due;
* verification campaign;
* missing asset;
* maintenance due;
* warranty expiry;
* stock low;
* stock request ready;
* stocktake assigned;
* variance approval;
* expiry/write-off required.

---

# 81. Timesheet Integration

Notifications:

* period opened;
* submission due;
* missing hours;
* returned timesheet;
* supervisor review;
* overtime request;
* overtime approved/rejected;
* HR validation;
* payroll export;
* TOIL credited.

---

# 82. Weekly Summary Integration

Notifications:

* period opened;
* report due;
* report missing;
* report returned;
* supervisor review;
* department consolidation;
* Management decision;
* support request assigned.

---

# 83. Risk Integration

Notifications:

* risk proposed;
* ownership assigned;
* assessment required;
* review due;
* treatment action;
* KRI breach;
* tolerance breach;
* incident linked;
* acceptance required;
* acceptance expiring;
* risk escalated.

---

# 84. Audit Integration

Notifications:

* audit engagement notice;
* evidence request;
* overdue evidence;
* draft observation;
* Management response;
* corrective action;
* verification required;
* finding reopened;
* final report issued.

Confidential audit notifications require minimal external wording.

---

# 85. People & Authority Integration

Notifications:

* account invitation;
* role assigned;
* privileged role approval;
* role revoked;
* delegation requested;
* delegation activated;
* delegation expiring;
* acting appointment;
* signature enrolment;
* signature suspended;
* access review;
* offboarding action.

---

# 86. System and Security Alerts

Examples:

* password changed;
* MFA enrolled/removed;
* suspicious login;
* privileged role changed;
* account locked;
* session revoked;
* bulk export;
* integration failure;
* backup failure;
* service outage;
* planned maintenance.

Security alert content must be designed with the Authentication and Security modules.

---

# 87. Notification Dashboard

User metrics:

* unread;
* action required;
* overdue;
* urgent;
* recently completed;
* archived.

Administrator metrics:

* notifications generated;
* queued;
* sent;
* failed;
* hard bounces;
* retrying;
* dead-letter records;
* provider latency;
* duplicate suppression;
* template failures;
* recipient-resolution failures.

---

# 88. Delivery Health Dashboard

Show by channel and provider:

* queue depth;
* average delivery time;
* success rate;
* failure rate;
* bounce rate;
* retry count;
* oldest queued message;
* provider outage;
* dead-letter volume.

Alerts should trigger when service thresholds are breached.

---

# 89. Notification Search

Search by:

* recipient;
* source reference;
* category;
* channel;
* status;
* date;
* provider ID;
* template;
* correlation ID;
* failure reason.

Search results must respect administrative permissions and confidentiality.

---

# 90. Reports

Required reports:

* Notification Register
* In-App Notification Report
* Email Delivery Report
* Push Delivery Report
* Failed Notifications
* Bounce Report
* Retry Report
* Dead-Letter Report
* Recipient Resolution Failures
* Notification by Module
* Notification by Category
* Mandatory Notification Report
* Overdue Reminder Delivery
* Escalation Delivery Report
* Broadcast Delivery Report
* Acknowledgement Report
* Template Usage Report
* Template Version Report
* User Preference Report
* Notification Audit Report
* Provider Performance Report

---

# 91. Data Model

Recommended entities:

### notification_events

### notification_requests

### notifications

### notification_recipients

### in_app_notifications

### notification_channel_deliveries

### notification_delivery_attempts

### notification_templates

### notification_template_versions

### notification_policies

### notification_preferences

### notification_devices

### notification_digests

### notification_digest_items

### notification_schedules

### notification_suppressions

### notification_acknowledgements

### notification_provider_events

### notification_dead_letters

### notification_audit_events

---

# 92. Notification Event Model

Suggested fields:

* id
* uuid
* event_key
* event_type
* source_module
* source_type
* source_id
* source_reference_snapshot
* source_version
* actor_id
* occurred_at
* importance
* confidentiality
* correlation_id
* idempotency_key
* payload
* status

Payload must be schema-validated and encrypted where sensitive.

---

# 93. Notification Record Model

Fields:

* event_id
* notification_type
* template_key
* template_version_id
* recipient_policy
* importance
* confidentiality
* action_required
* expires_at
* status
* created_at
* cancelled_at
* superseded_by_id

---

# 94. Recipient Model

Fields:

* notification_id
* person_id
* account_id
* recipient_role
* position_snapshot
* department_snapshot
* language
* time_zone
* resolution_reason
* resolved_at
* status

---

# 95. In-App Model

Fields:

* notification_recipient_id
* title
* body
* action_label
* secure_route
* read_at
* acknowledged_at
* archived_at
* expired_at
* status

Do not store an unrestricted external URL supplied by source modules.

---

# 96. Channel Delivery Model

Fields:

* notification_recipient_id
* channel
* provider
* destination_snapshot
* template_version_id
* rendered_subject
* rendered_body_hash
* provider_message_id
* status
* scheduled_at
* queued_at
* sent_at
* delivered_at
* failed_at
* failure_code
* attempt_count

Sensitive rendered bodies may be encrypted or retained according to policy.

---

# 97. Delivery Attempt Model

Fields:

* channel_delivery_id
* attempt_number
* attempted_at
* provider_request_id
* result
* response_code
* response_summary
* temporary_failure
* next_retry_at
* duration_ms

Provider secrets and complete sensitive responses must not be stored.

---

# 98. Preference Model

Fields:

* person_id
* category
* in_app_enabled
* email_enabled
* push_enabled
* digest_mode
* quiet_hours_start
* quiet_hours_end
* preferred_language
* updated_at

Mandatory-policy rules override user settings at runtime.

---

# 99. Policy Model

A notification policy defines:

* triggering event;
* recipients;
* channels;
* template;
* importance;
* confidentiality;
* timing;
* digest eligibility;
* acknowledgement;
* retry profile;
* expiry;
* suppression rules;
* effective dates;
* policy version.

Policies must be versioned.

---

# 100. API Requirements

User:

* `GET /notifications`
* `GET /notifications/unread-count`
* `GET /notifications/{id}`
* `POST /notifications/{id}/read`
* `POST /notifications/{id}/unread`
* `POST /notifications/{id}/acknowledge`
* `POST /notifications/{id}/archive`
* `GET /notification-preferences`
* `PUT /notification-preferences`

Devices:

* `POST /notification-devices`
* `DELETE /notification-devices/{id}`
* `POST /notification-devices/{id}/refresh-token`

Templates and policy:

* `GET /notification-templates`
* `POST /notification-templates`
* `POST /notification-templates/{id}/versions`
* `POST /notification-template-versions/{id}/approve`
* `POST /notification-template-versions/{id}/publish`
* `POST /notification-policies`

Administration:

* `GET /notification-admin/deliveries`
* `GET /notification-admin/failures`
* `POST /notification-deliveries/{id}/retry`
* `POST /notification-deliveries/{id}/suppress`
* `GET /notification-admin/dead-letters`
* `POST /notification-dead-letters/{id}/resolve`

Broadcast:

* `POST /notification-broadcasts`
* `POST /notification-broadcasts/{id}/submit`
* `POST /notification-broadcasts/{id}/approve`
* `POST /notification-broadcasts/{id}/cancel`

---

# 101. Internal Event Contract

Modules should publish through a standard event bus or outbox pattern.

Required fields:

* event ID;
* event type;
* aggregate/source;
* aggregate ID;
* aggregate version;
* timestamp;
* actor;
* correlation ID;
* idempotency key;
* schema version;
* minimal payload.

Modules must not directly call email providers.

---

# 102. Transactional Outbox

For critical business events, use a transactional outbox.

Example:

1. Workflow decision commits.
2. `WorkflowTaskAssigned` outbox record commits in the same database transaction.
3. background publisher sends the event.
4. notification consumer processes idempotently.
5. outbox marks published.

This prevents:

* business action completing without notification event;
* notification being sent for a rolled-back transaction.

---

# 103. Delivery Semantics

Preferred model:

* at-least-once event delivery;
* idempotent event consumption;
* exactly-once logical notification per recipient/channel through unique constraints.

Do not rely on an unrealistic assumption of exactly-once network delivery.

---

# 104. Permissions

Recommended permissions:

* `notifications.view-own`
* `notifications.manage-own-preferences`
* `notifications.acknowledge`
* `notifications.view-delivery-status`
* `notifications.manage-templates`
* `notifications.approve-templates`
* `notifications.manage-policies`
* `notifications.send-broadcast`
* `notifications.approve-broadcast`
* `notifications.retry`
* `notifications.suppress`
* `notifications.manage-providers`
* `notifications.view-failures`
* `notifications.view-audit`
* `notifications.export`
* `notifications.admin`

---

# 105. Separation of Duties

At minimum:

* ordinary module users cannot create unrestricted mass broadcasts;
* template authors should not unilaterally publish high-risk security templates;
* provider administrators cannot create business events;
* System Administrators cannot fabricate approval notifications as business decisions;
* users cannot mark another user’s mandatory notice as acknowledged;
* broadcast sender and approver should be separate for high-impact notices;
* notification administrators cannot change the source record.

---

# 106. Security Requirements

The module must enforce:

* encrypted transport;
* secure provider authentication;
* secret-management integration;
* server-side recipient authorisation;
* record-level access;
* content minimisation;
* template escaping;
* anti-injection controls;
* secure links;
* token expiry;
* device-token protection;
* rate limiting;
* anti-spam controls;
* idempotency;
* protected administrative exports;
* immutable audit logs.

---

# 107. Notification Impersonation Protection

Every email must:

* use an approved sender;
* use institutional domains where configured;
* avoid asking users to send passwords;
* link only to approved Nexus domains;
* carry standard security wording where appropriate.

Security-sensitive templates should warn:

> Nexus will never ask you to share your password or MFA code by email.

---

# 108. Approval Security

Email or push must not contain an unauthenticated:

* Approve
* Reject
* Sign
* Release Payment
* Accept Risk

action.

The user must:

1. open the secure link;
2. authenticate;
3. pass MFA or step-up authentication where required;
4. review the record;
5. complete the decision inside Nexus.

---

# 109. Retention

Retention may differ for:

* in-app operational notices;
* security alerts;
* approval notifications;
* acknowledgement campaigns;
* delivery logs;
* provider responses;
* broadcasts.

Notification retention must align with:

* source-record retention;
* audit requirements;
* privacy minimisation;
* security investigation requirements.

Deleting an old inbox item must not delete the source business record or its audit trail.

---

# 110. Audit Trail

Audit events:

* event received;
* policy selected;
* recipient resolved;
* recipient resolution failed;
* notification created;
* template selected;
* message rendered;
* message suppressed;
* queued;
* delivery attempted;
* provider accepted;
* delivered;
* bounced;
* failed;
* retried;
* moved to dead-letter;
* read;
* acknowledged;
* archived;
* broadcast approved;
* template changed;
* preference changed;
* device registered/revoked;
* administrative retry/suppression;
* export generated.

---

# 111. Concurrency Controls

Prevent:

* duplicate notifications from parallel consumers;
* duplicate email sends during retry races;
* acknowledgement recorded twice with conflicting users;
* device-token refresh overwriting a newer token;
* template publication conflicts;
* broadcast cancellation while workers continue sending;
* stale scheduled notification after source cancellation.

Use:

* unique idempotency constraints;
* row locks;
* status-transition checks;
* queue visibility locks;
* optimistic versioning.

---

# 112. Failure Handling

Examples:

### Invalid Recipient

> The recipient does not have a valid active delivery address. The in-app notification remains available and the responsible profile administrator has been alerted.

### Template Error

> Notification rendering failed because required data was missing. No external message was sent.

### Provider Unavailable

> Delivery has been delayed and will be retried automatically.

### Hard Bounce

> Email delivery has been suppressed until the official address is corrected.

### Access Revoked

> The record is no longer available to this recipient. The notification has been marked expired.

---

# 113. Migration

Existing notification sources may include:

* PIF notifications;
* module-specific email functions;
* workflow emails;
* reminder cron jobs;
* hard-coded email templates;
* mobile push logic;
* database notification tables;
* direct SMTP calls;
* approval-email jobs.

Migration steps:

1. inventory every producer;
2. identify events and templates;
3. identify duplicate delivery code;
4. classify mandatory vs optional;
5. create canonical policies;
6. migrate templates;
7. introduce outbox/event integration;
8. retain compatibility adapters;
9. test current PIF delivery;
10. cut over module by module;
11. remove legacy paths after verification.

---

# 114. Legacy Notification Handling

Historical messages may be retained as:

* existing in-app record;
* delivery-log summary;
* email-log reference;
* migration metadata.

Do not resend historical notifications during migration.

---

# 115. Backend Testing

Must cover:

* event ingestion;
* outbox publishing;
* idempotent consumption;
* recipient resolution;
* acting/delegated recipients;
* disabled users;
* multilingual templates;
* mandatory-policy override;
* confidentiality rendering;
* in-app creation;
* email delivery;
* push delivery;
* provider callback;
* retries;
* hard/soft bounces;
* suppression;
* digest generation;
* quiet hours;
* scheduled delivery;
* cancellation;
* acknowledgement;
* broadcast approval;
* dead-letter handling;
* security;
* audit events.

---

# 116. Frontend / E2E Testing

Must test:

* notification inbox;
* unread counter;
* open linked record;
* mark read/unread;
* acknowledge notice;
* archive;
* action-required filters;
* preference management;
* multilingual notification display;
* confidential generic message;
* email link authentication;
* push registration;
* failed delivery dashboard;
* retry flow;
* broadcast creation/approval;
* digest display.

---

# 117. Security Testing

Must prove:

* notification link does not bypass record authorisation;
* email cannot approve a workflow without authentication;
* user cannot view another user’s notification;
* confidential content is not exposed in subject/push;
* template variables are escaped;
* users cannot inject arbitrary links;
* provider credentials are not stored in code/database records;
* disabled users cannot retain valid secure tokens;
* device token cannot authenticate a user;
* one user cannot acknowledge another user’s notice;
* mass-broadcast permissions are enforced;
* duplicate events do not create repeated deliveries.

---

# 118. Performance and Reliability Requirements

* In-app notification creation should normally occur promptly after the event is committed.
* Critical events must use a priority queue.
* Delivery workers must scale horizontally.
* Database lists must paginate.
* Unread count must be efficiently indexed/cached.
* Provider failures must not block business transactions.
* Queue backlog must be monitored.
* Digests must run in background jobs.
* Bulk broadcasts must be throttled.
* Provider callbacks must be idempotent.
* The notification service must degrade gracefully when email or push providers are unavailable.

---

# 119. Observability

Metrics:

* events received;
* notifications generated;
* delivery latency;
* queue depth;
* success/failure rate;
* bounce rate;
* retry count;
* dead-letter count;
* duplicate events;
* recipient-resolution failures;
* template errors;
* provider response time;
* acknowledgement rate;
* digest generation duration.

Logs must use correlation IDs and exclude secrets and unnecessary confidential content.

---

# 120. Production Acceptance Criteria

The module is production-ready only when:

1. All active Nexus users have an in-app inbox.
2. Notifications are linked to authoritative Nexus records.
3. Business modules publish standard events.
4. Critical events use a transactional outbox or equivalent reliability control.
5. Duplicate event consumption does not create duplicate notifications.
6. Recipient resolution uses People & Authority.
7. Acting appointments are considered.
8. Delegations are considered where the business process requires them.
9. Recipient-resolution failures enter a controlled queue.
10. In-app notifications work.
11. Transactional email works.
12. Optional mobile push works.
13. A push failure does not remove the in-app alert.
14. Templates are versioned.
15. Templates require approval where applicable.
16. English templates work.
17. French templates work.
18. Portuguese templates work.
19. Language fallback is controlled and recorded.
20. Confidential notifications use privacy-safe external wording.
21. Email/push links require authentication and authorisation.
22. Email cannot approve or sign a request without secure login.
23. Mandatory notifications cannot be fully disabled.
24. Optional preferences work.
25. Quiet hours work.
26. Urgent-notification override works.
27. Daily digests work.
28. Weekly digests work.
29. Immediate alerts are not confusingly duplicated in digests.
30. Reminder delivery works.
31. Escalation delivery works.
32. Delivery attempts are recorded.
33. Temporary failures retry.
34. Permanent failures do not retry indefinitely.
35. Hard bounces are handled.
36. Invalid push tokens are revoked.
37. Dead-letter processing works.
38. Provider health is visible.
39. Broadcast approval works.
40. Acknowledgement campaigns work.
41. Scheduled notifications revalidate source status before sending.
42. Stale notifications can be cancelled or superseded.
43. Notification storms are controlled.
44. Notification search respects permissions.
45. Delivery and acknowledgement reports work.
46. Full notification audit history exists.
47. PIF notifications pass regression tests.
48. Workflow, Assignment, Leave, Travel, Procurement, Risk and Audit events pass integration tests.
49. Notification outages do not roll back valid business decisions.
50. No business module sends directly through an ungoverned email provider.

---

# 121. Phase 1 — Production Critical

Implement:

* Event integration contract
* Transactional outbox
* Recipient resolution
* In-app inbox
* Transactional email
* Notification policies
* Versioned templates
* English/French/Portuguese support
* Mandatory/optional categories
* Privacy-safe rendering
* Secure links
* Reminders
* Escalations
* User preferences
* Quiet hours
* Daily/weekly digests
* Queue priorities
* Delivery attempts
* Retry handling
* Bounce handling
* Dead-letter queue
* Administrative delivery dashboard
* Audit trail
* PIF notification migration
* Workflow integration
* Assignment integration

---

# 122. Phase 2

Add:

* full mobile push integration;
* acknowledgement campaigns;
* advanced broadcast management;
* provider failover;
* advanced notification coalescing;
* richer delivery analytics;
* calendar-aware reminders;
* mobile deep links;
* external recipient portal notifications;
* institution-wide maintenance alerts.

---

# 123. Phase 3

Optional enhancements:

* approved SMS delivery;
* approved WhatsApp Business delivery;
* intelligent digest summarisation;
* suggested preference optimisation;
* notification-fatigue analysis;
* predictive delivery-channel selection;
* natural-language inbox search.

AI must never:

* fabricate a business event;
* change a recipient’s authority;
* approve a request;
* expose confidential content;
* suppress a mandatory alert without an approved policy;
* rewrite legal or security wording without human approval.

---

# 124. Governance Decisions Required

Before final configuration, SADC PF must approve:

1. Official email-delivery provider and sending mailboxes.
2. Which notification categories are mandatory.
3. Which categories may be digested.
4. Quiet-hours rules.
5. Critical-notification override rules.
6. Email and delivery-log retention periods.
7. Whether acknowledgements are required for institutional circulars.
8. Whether external recipients may receive secure token links.
9. Mobile push rollout approach.
10. Whether SMS or WhatsApp will ever be approved.
11. Approved broadcast senders.
12. Template approval authority.
13. Acceptable delivery service targets.
14. Bounce and invalid-address escalation responsibility.
15. Whether email open tracking is prohibited or permitted.
16. Which confidential categories are in-app only.

The Administrative Rules state that detailed electronic-mail rules are to be provided through the ICT Policy, so Nexus should not invent all institutional email-governance rules in code. 

---

# 125. Critical Architecture Rules

The implementation team must treat these as non-negotiable:

> **The underlying Nexus record is the source of truth, not the email or push message.**

> **Every important notification must exist in the in-app inbox.**

> **Business modules publish events; they do not call email providers directly.**

> **Notification delivery must not occur before the business transaction commits.**

> **Event processing must be idempotent.**

> **A network retry must not send the same logical message twice.**

> **Confidential details must not appear in email subjects or lock-screen push messages.**

> **A notification link never replaces authentication or record authorisation.**

> **Email and push must not provide unauthenticated approval, signature or payment actions.**

> **Notification preferences cannot disable mandatory security, workflow or compliance notices.**

> **The source module decides business escalation. The Notifications Module only delivers it.**

> **Delivery-provider acceptance is not the same as recipient acknowledgement.**

> **Email-open tracking must not be treated as proof that a user read or understood a message.**

> **A failed provider must not roll back a valid business decision.**

> **Official correspondence remains in the Correspondence Module.**

> **Mobile application installation is optional. Web and email workflows must remain fully functional.**

> **Existing working PIF notifications must pass regression testing before legacy paths are removed.**

---

# 126. Final Product Rule

An employee should be able to open Nexus and immediately answer:

**What requires my action?**
→ Action Required inbox

**What is due soon or overdue?**
→ reminders and deadlines

**Which request was returned?**
→ secure notification linked to the record

**Has my request been approved or rejected?**
→ decision alert

**Which notices must I acknowledge?**
→ acknowledgement queue

**Can I control optional notifications?**
→ preferences

An administrator should be able to answer:

**Was the notification generated?**
→ event and notification record

**Who was selected as recipient and why?**
→ recipient-resolution history

**Which channels were used?**
→ channel deliveries

**Was the email accepted, delivered, deferred or bounced?**
→ provider status

**Was the message retried?**
→ delivery attempts

**Why was a message suppressed?**
→ suppression reason

**Are notifications stuck?**
→ queue and dead-letter dashboard

**Which template produced the message?**
→ template version

**Was confidential content protected?**
→ confidentiality policy and rendered-message audit

That gives Nexus one reliable and secure communication-delivery platform across all modules, without allowing email, push notifications or provider failures to weaken institutional workflow controls.
</user_query>