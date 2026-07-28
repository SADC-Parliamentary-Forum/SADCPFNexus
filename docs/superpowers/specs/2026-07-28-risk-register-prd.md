# SADC PF Nexus

# Risk Register & Risk Treatment Management Module

## Full Updated Product Requirements Document

**System:** SADC PF Nexus Internal Paperless Administration System  
**Module:** Risk Register & Risk Treatment Management  
**Short name:** Risk  
**Document status:** Updated implementation PRD  
**Module type:** Enterprise risk identification, assessment, treatment, acceptance, review and assurance module  
**Sections:** 131  
**Authoritative date:** 2026-07-28  

> This PRD is the Phase 1 implementation authority for Risk. Critical non-negotiable architecture rules are restated in §130. Phase scope is in §127–§129.

---

# 1. Executive Summary

The Risk Module provides SADC PF with an institutional risk register and treatment management capability covering:

* risk proposals and intake;
* enterprise, department and project registers;
* linkage of every risk to a strategic (or approved operational) objective;
* clear ownership (Risk Owner, Control Owner, Treatment Action Owner);
* cause → event → consequence structuring;
* inherent and residual assessment with preserved history;
* control register and effectiveness rating;
* risk matrix, appetite, tolerance and acceptance authority;
* treatment plans executed through the shared Assignments module;
* formal reviews, escalation and time-bound risk acceptance;
* incidents (distinct from risks and issues);
* dashboards, reports, confidentiality, notifications and audit.

It must answer: What can prevent objectives? Who owns each risk? What is inherent vs residual? Which controls exist and how effective are they? What treatments are underway? What has been formally accepted, by whom, until when? What materialised into an incident without closing the risk prematurely?

---

# 2. Core Product Principle

Risk management follows:

> **Propose → Intake → Register → Link Objective → Assign Owner → Describe Cause/Event/Consequence → Assess Inherent → Identify Controls → Assess Residual → Decide Treatment → Assign Actions → Review → Escalate/Accept → Monitor → Materialise/Close (deliberate)**

Risk is not a spreadsheet of worries. It is an accountable governance record tied to objectives.

---

# 3. Critical Product Boundaries

* **Risk ≠ Issue ≠ Incident.** A risk is uncertain future effect on objectives. An issue is a present problem. An incident is a realised adverse event. Nexus must not collapse these into one status field.
* Fixed Assets, Stock, Correspondence, Assignments, Weekly Summaries and Audit Finding modules remain separate; Risk integrates, does not absorb them.
* Internal Audit provides assurance; it does not own management risks/controls or accept risks for Management.

---

# 4. Users & Personas

Secretariat staff, Heads of Department, Directors, Governance Officer, Risk Champions, Control Owners, Treatment Action Owners, Secretary General, Committee members, Internal Auditor (assurance only), System Admin.

---

# 5. Permissions (Phase 1)

`risk.view`, `risk.create`, `risk.submit`, `risk.review`, `risk.approve`, `risk.manage`, `risk.admin`, plus `risk.accept`, `risk.confidential`, `risk.assurance` (IA read/assurance actions without ownership).

---

# 6. Register Scopes

Enterprise register, Department register, Project/Programme register. A risk belongs to exactly one primary scope but may be visible on dashboards according to ACL and confidentiality.

---

# 7. Objective Linkage (Mandatory)

Every registered risk must link to at least one `strategic_objective_id` (M&E Strategic Objective). Risks without an objective cannot leave draft/proposal state.

---

# 8. Ownership Model

* **Risk Owner** — one accountable person (not multi-dept vague ownership).
* **Control Owner** — distinct; owns design/operation of controls.
* **Treatment Action Owner** — owns specific treatment Assignments.
* Internal Auditor must not be Risk Owner or Control Owner on management register entries.

---

# 9. Cause / Event / Consequence

Each risk record stores structured: cause (why), event (what may happen), consequence (effect on objective). Free-text title/description remain for human readability.

---

# 10. Inherent Assessment

Likelihood (1–5) × Impact (1–5) → inherent score and level. Assessment is stored as an immutable `risk_assessments` row (`type=inherent`). Updating creates a new assessment; history is never overwritten.

---

# 11. Residual Assessment

Residual likelihood and impact are **separately judged** after considering controls.  
**Forbidden:** any automatic formula such as `residual = inherent × (1 − control_effectiveness%)`.  
Residual assessments are versioned identically to inherent.

---

# 12. Control Register

Controls are first-class records: code, title, type (preventive/detective/corrective/directive), owner, effectiveness (none|partial|adequate|strong|ineffective), status, linked risks. Effectiveness informs residual judgment but never auto-computes it.

---

# 13. Risk Matrix & Levels

Default bands: low (1–5), medium (6–10), high (11–15), critical (16–25). Bands are configurable via versioned appetite policy.

---

# 14. Appetite / Tolerance / Authority

Versioned `risk_appetite_policies` define matrix thresholds, tolerance statements, and who may accept which residual levels. Only one active version per tenant at a time; prior versions retained.

---

# 15. Treatment Strategies

Mitigate, Accept, Transfer, Avoid, Share. Treatment plans document the chosen strategy and required actions.

---

# 16. Treatment Actions → Assignments

Creating a treatment action must create (or reuse) an Assignment via `POST /assignments/from-source` with `source_type=risk`, idempotent on `(source_type, source_id, source_purpose)`. Completing the Assignment does **not** automatically reduce residual risk; a residual reassessment is required.

---

# 17. Risk Acceptance

Acceptance is a formal, time-bound record with justification, proposer, approver, expiry.  
High/critical residual risks cannot be accepted by the Risk Owner alone — require Director / SG / Governance Officer (or authority matrix). Acceptance ≠ inaction.

---

# 18. Reviews

Review frequency (monthly|quarterly|bi_annual|annual), next review date, review notes, reviewer. Overdue reviews surface on dashboards and notifications.

---

# 19. Escalation

Escalation levels: departmental → directorate → SG → committee. Escalation preserves prior status in history.

---

# 20. Materialisation

When a risk materialises into an issue/incident, record `materialised_at` and optionally link an incident. **Do not auto-close** the risk. Closure requires deliberate close with evidence.

---

# 21. Incidents

Separate `risk_incidents` entity. May link to a risk. Closing an incident does not close the risk.

---

# 22. Issues

Present problems may be logged as `record_kind=issue` or linked issue references, distinct from risk and incident workflows. Phase 1: light issue flag / link; deep issue management deferred if needed.

---

# 23. Proposals & Intake

Staff (and Weekly Summary items) may propose risks. Intake queue: proposed → accepted into register / returned / rejected. Acceptance into register requires objective + Risk Owner.

---

# 24. Weekly Summaries Integration

Weekly emerging risks (`weekly_report_risks`) and decision follow-ups may escalate to a Risk proposal via create-risk. Formal Risk Register owns the risk after creation.

---

# 25. Confidentiality

`is_confidential` / confidentiality level. Confidential risks must not leak via list, search, dashboards, notifications, or exports to unauthorised users. ACL: owner, submitter, risk.confidential / risk.admin / designated roles.

---

# 26. Notifications

Events: submitted, reviewed, approved, escalated, review due, acceptance expiring, treatment overdue, materialised, confidential-safe payloads only.

---

# 27. Audit Trail

Immutable `risk_history` with hash; plus system `audit_logs`. No silent edits to assessments or acceptance records.

---

# 28. Dashboards

Heat map, open by level, overdue reviews, overdue treatments, acceptances due, materialised open risks, by department/objective. Confidential filtering applied.

---

# 29. Reports

Register export, treatment status, acceptance register, incident linkage — with confidentiality redaction.

---

# 30. Documents & Evidence

Reuse attachments morph; closure evidence and acceptance justification required where applicable.

---

# 31–50. Lifecycle Detail

31. Draft creation  
32. Proposal intake validation  
33. Submit gates (objective + owner required)  
34. Review start  
35. Approve into monitoring  
36. Residual reassessment workflow  
37. Treatment plan approval  
38. Assignment issue from treatment  
39. Assignment complete → reassessment flag  
40. Review cycle execution  
41. Escalation path  
42. Acceptance request  
43. Acceptance approval / rejection  
44. Acceptance expiry / renewal  
45. Materialisation recording  
46. Incident creation from materialisation  
47. Deliberate close with evidence  
48. Archive (closed only)  
49. Reopen to submitted/monitoring  
50. Soft-delete drafts only; closed never hard-deleted  

---

# 51–70. Data Model

51. `risks` (extended)  
52. `risk_assessments`  
53. `risk_controls`  
54. `risk_control_links`  
55. `risk_actions` (+ `assignment_id`)  
56. `risk_acceptances`  
57. `risk_incidents`  
58. `risk_appetite_policies`  
59. `risk_history` (existing)  
60. `risk_policy` / policies library (existing)  
61. `risk_reviews`  
62. Source linkage fields  
63. Confidentiality fields  
64. Materialisation fields  
65. Register scope fields  
66. Cause/event/consequence fields  
67. Ownership FKs  
68. Objective FK  
69. Indexes for list/search ACL  
70. Soft deletes / no ordinary hard-delete of closed  

---

# 71–90. API Surface (Phase 1)

71. `GET /risk/risks` (confidentiality-filtered)  
72. `POST /risk/risks`  
73. `GET /risk/risks/{id}`  
74. `PUT /risk/risks/{id}`  
75. Workflow: submit, start-review, approve, escalate, close, archive, reopen  
76. `POST /risk/risks/{id}/assessments` (inherent|residual)  
77. `GET /risk/risks/{id}/assessments`  
78. Controls CRUD + link to risk  
79. Treatment actions CRUD + `create-assignment`  
80. `POST /risk/risks/{id}/acceptances`  
81. Approve/reject acceptance  
82. Incidents CRUD + link risk  
83. `POST /risk/risks/{id}/materialise`  
84. Appetite policy versions  
85. Matrix endpoint (policy-aware)  
86. Dashboard (ACL)  
87. Audit trail  
88. Proposals queue  
89. Weekly escalate-to-risk  
90. Reports export  

---

# 91–110. UX

91. All Risks register  
92. Enterprise / Department / Project filters  
93. Create / propose risk wizard (objective, owner, CEC)  
94. Risk detail with assessment history  
95. Controls panel  
96. Treatment & Assignments panel  
97. Acceptance panel  
98. Incidents panel  
99. Matrix view  
100. Dashboard  
101. Analytics  
102. Audit trail  
103. Policy library  
104. Appetite admin  
105. Confidential badges + redaction  
106. Weekly “Create risk proposal” action  
107. Phase 2 stub: KRI automation  
108. Phase 2 stub: Control testing campaigns  
109. Phase 3 stub: AI assist / insurance-BCP depth  
110. Mobile read of assigned treatments via Assignments  

---

# 111–126. Non-Functional & Governance

111. Tenant isolation  
112. RLS grants for new tables  
113. Performance: paginated lists  
114. Search ACL before ilike  
115. Notification redaction  
116. Export ACL  
117. IA assurance role separation  
118. Separation of duties on acceptance  
119. Immutable assessment rows  
120. Idempotent Assignment creation  
121. Observability / audit tags `risk`  
122. i18n-ready labels  
123. Accessibility of matrix colours (not colour-only)  
124. Backup / retain closed risks  
125. No secrets in risk records  
126. Demo data seeder compatibility  

---

# 127. Phase 1 Scope (Implement Now)

Risk proposals + intake; enterprise/department/project registers; objective linkage; ownership separation; cause/event/consequence; inherent assessment; control register + effectiveness; residual assessment (no arbitrary formula); matrix + tolerance; treatment plans; Assignment linkage; reviews; escalation; risk acceptance; incidents; dashboards; reports; confidentiality; notifications; audit.

---

# 128. Phase 2 (Defer — stub nav)

Automated KRIs, control-testing campaigns, deeper issue management, advanced analytics.

---

# 129. Phase 3 (Defer — stub nav)

AI-assisted risk language, insurance register depth, BCP/DR playbook depth.

---

# 130. Critical Non-Negotiable Architecture Rules

1. Risk must link to an objective.  
2. Risk ≠ issue ≠ incident.  
3. One accountable Risk Owner (not vague multi-dept ownership).  
4. Risk Owner, Control Owner, Treatment Action Owner are separate roles.  
5. Inherent and residual assessed separately and preserved (never overwrite history).  
6. Residual must NOT use arbitrary “controls reduce X%” formula.  
7. Appetite/tolerance/authority versioned and configurable.  
8. Treatment actions use shared Assignments module (`from-source` / create-assignment).  
9. Completing Assignment ≠ risk automatically reduced — reassessment required.  
10. High/critical cannot be casually accepted by owner alone.  
11. Acceptance is formal, time-bound — not inaction.  
12. Internal Audit provides assurance; must NOT own management risks/controls or accept risks for Management.  
13. Materialised ≠ automatically closed.  
14. Closed risks remain in record (no ordinary hard-delete).  
15. Confidential risks must not leak via search/dashboards/notifications/exports.

---

# 131. Acceptance Criteria (Phase 1)

* PHPUnit covers: objective required; one owner; inherent≠residual history; no arbitrary residual formula; high/critical acceptance not by owner alone; treatment creates Assignment idempotently; IA cannot be Risk Owner; closed not hard-deleted; confidentiality on list/search; materialised stays open until deliberate close.  
* Manual UAT: create with objective + CEC; assess residual explicitly; accept high risk as owner alone fails; treatment Assignment appears; weekly escalate creates proposal; confidential redacted for staff without privilege.

---

## Assumptions

1. Full 131-section narrative PRD content was specified by product owner intent and §130/§127; this file is the saved authoritative Phase 1 PRD for implementation.  
2. M&E `strategic_objectives` is the objective master for linkage.  
3. Assignments Phase 1 `from-source` with `source_type=risk` is available on main.  
4. Existing Risk workflow (draft→…→closed) is extended, not replaced.  
5. Interactive brainstorm gate waived for subagent delivery under parent Phase 1 mandate.

