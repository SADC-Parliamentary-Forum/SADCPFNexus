---
name: sadc-pf
description: >
  SADC Parliamentary Forum (SADC PF) Paperless System — complete domain knowledge across
  seven functional areas: HR & Leave Administration, Salary Advance & Payroll Governance,
  Programme & Activity Management, Travel & Mission Administration, Procurement & Compliance,
  Governance & Institutional Knowledge, and Financial Oversight & Budget.
  Use this skill when any staff member, finance officer, HR administrator, procurement
  officer, programme officer, or governance official asks about SADC PF internal processes,
  policies, forms, calculations, compliance requirements, or workflow steps.
  Example triggers: "How do I apply for leave?", "What is the salary advance limit?",
  "How do I fill in the travel requisition?", "What DSA rate applies?", "How many quotes
  do I need?", "What is the quorum for the Executive Committee?", "How do I structure a
  programme budget?", "When must I retire my advance?", "What procurement method applies?",
  "Can I approve my own overtime?", "What happens to TOIL after 30 days?".
  Invoke the sadc-pf-agent-pack agent for autonomous processing/validation; use this skill
  for guidance, reference lookups, policy questions, and form completion support.
---

# SADC PF Paperless System — Skill Guide

## Overview

This skill provides reference knowledge across seven SADC PF workflow domains. Load only the
reference file(s) relevant to the user's question — do not load all files at once.

## Domain map — which reference file to load

| Domain | Load when user asks about… | Reference file |
|--------|---------------------------|----------------|
| 1. HR & Leave | Leave application, sick leave, study leave, compassionate, TOIL, overtime, personnel files, Namibian labour law | `references/hr-leave.md` |
| 2. Salary Advance & Payroll | Salary advance application, 50% threshold, payroll deductions, gratuity, recovery scheduling | `references/salary-advance.md` |
| 3. Programme Management | Programme implementation forms, budget lines, DSA variance, consultants, interpretation, hybrid meetings, stakeholders | `references/programme.md` |
| 4. Travel & Mission | Travel authorisation, DSA rates, itinerary, terminal allowance, vehicle/driver, imprest retirement, multi-sector approvals | `references/travel.md` |
| 5. Procurement | SIDA procurement methods (open/restricted/simplified/negotiated), ToR, evaluation committees, eligibility, conflict of interest | `references/procurement.md` |
| 6. Governance | Plenary, Executive Committee, Standing Committees, quorum, resolutions, minutes, Constitution, legal personality | `references/governance.md` |
| 7. Financial Oversight | Budget preparation, financial year, external audit, asset management, fund authorisation, accountability reporting | `references/finance-budget.md` |

## When to invoke the agent vs. use this skill

| Situation | Action |
|-----------|--------|
| Processing, validating, or formally deciding a request | Invoke `sadc-pf-agent-pack` agent |
| Policy question, form guidance, quick reference lookup | Use this skill's reference files |
| DSA calculation or compliance check | Invoke `sadc-pf-agent-pack` agent |
| Explaining what a policy means or what a form requires | Use this skill's reference files |

## Universal guardrails (always apply)

1. **No hallucination**: If specific rates, amounts, or clauses are not in the reference
   files, say so explicitly and advise the user to consult Finance/HR/the relevant Director.
2. **Segregation of duties**: Preparer ≠ Approver — flag whenever the same person fills both roles.
3. **Confidentiality**: HR/disciplinary/medical content = [CONFIDENTIAL — RESTRICTED ACCESS].
4. **Policy-only answers**: Cite the document and clause for every decision or recommendation.
5. **Locked records**: Approved records cannot be silently edited — changes require a new
   version with change-reason and authorisation.
6. **Escalation**: When policy is silent, state: _"Policy is silent on this point. Recommend
   escalation to [SG / Finance Director / HR Director / Legal]."_

## Standard policy response format

```
**Policy Answer**: [exact quote or close paraphrase]
**Source**: [Document name, Section/Clause]
**Relevant Form**: [Form number/name if applicable]
**Note**: [Caveats, related clauses, or escalation recommendation]
```
