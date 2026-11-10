# Invoice/Quotation-to-LPO (Procurement)

Source specifications: `SADC_PF_Nexus_Invoice_Quote_to_LPO_PRD_v1_1.md` (v1.1, 10 Nov 2026) and `SADC_PF_Nexus_LPO_Implementation_Instructions.md`. This PRD distils them, records the decisions taken on 10 Nov 2026, and overrides them where stated. The source PRD's 48 acceptance tests remain the detailed acceptance baseline (§13, §22 of the source).

## Problem
Administration, Procurement and Finance staff at SADC PF receive supplier invoices and quotations (Word, PDF, scans) and retype them into purchase orders by hand. Invoices frequently arrive for services already delivered, often several per supplier (e.g. a freelance translator billing per word), and are later covered by one LPO. Without a structured intake → LPO → invoice match → payment trail, data is rekeyed, duplicates and arithmetic errors slip through, bank details are handled informally, and auditors cannot trace an LPO back to its source documents and approvals.

## Evidence
- LPO **S05008** (16 Oct 2026, Dave Dewnarain, US$937.92) bundles four invoices issued before it (PF2665, PF2666, PF2667, PF2668) — the real current practice is a retrospective, multi-invoice LPO.
- Four Dave Dewnarain translation invoices: PF2658 (29 Sep 2026, US$1,001.64, 2 lines), PF2659 (2 Oct 2026, US$230.04), PF2662 (10 Oct 2026, US$58.32 incl. a 668-word zero-charge line), PF2663 (14 Oct 2026, US$33.96). All are Word tables with supplier block, BILL TO, invoice number/date, per-word rate, footnotes and bank details in the body.
- The S05008 layout records quantity as `1` with the word count inside the description while the unit price is the per-word rate — the printed form does not reconcile qty × price = total.
- Volume of invoices without a prior LPO, rekeying time and error rate — **Assumption — needs validation via Finance/Procurement register analytics.**
- Audit findings or complaints driving this — **Assumption — needs validation via Finance/Internal Audit interview.**

## Users
- **Primary**: Administration / Procurement officers who receive supplier invoices and quotations and prepare LPOs; triggered by each incoming document.
- **Secondary**: Requesters (originate quotation-based purchases); Finance officers (budget, tax, currency, duplicate and bank checks, payment); Heads of Department and authorised signatories (approve); Auditors (read-only trace).
- **Not for**: Suppliers (no supplier-facing submission in this PRD; the existing supplier portal is unchanged); System Administrators gain no implicit business-approval power.

## Hypothesis
We believe **uploading an invoice or quotation into an editable, extracted draft that flows into a templated, sequentially numbered LPO and invoice match** will **remove manual rekeying and give a complete audit trail** for **Procurement and Finance staff**.
We'll know we're right when **≥90% of new LPOs are generated from an uploaded source document, every issued LPO links to its source invoices/quotation and approvals, and the S05008 layout is reproduced from system data**.

## Success Metrics
| Metric | Target | How measured |
|---|---|---|
| LPOs created from an uploaded source document | ≥90% of new LPOs within 2 months of go-live | LPO register: share with a linked source document |
| Extraction accuracy on the supplied invoices | 100% of supplier, number, date, currency, lines and totals correct after review on PF2658/2659/2662/2663 | Fixture test suite |
| Issued LPOs with full trace (source → approvals → receipt → invoice → payment) | 100% | Audit trace report |
| Duplicate invoices (same supplier + number) paid | 0 | Duplicate-control report |
| Time from invoice receipt to LPO issue | TBD — needs baseline via Finance timing sample | Status timestamps |

## Scope
**MVP** — the full source PRD, phases A, B and C (decision 10 Nov 2026), extending the existing Procurement module rather than building a parallel one:
- **Intake & drafts**: upload Invoice / Quotation / Pro forma / Contract / Unknown (editable type); immediate persistent draft; My drafts / All documents; continue editing, autosave, save draft, conflict detection, version history; manual creation when extraction fails.
- **Extraction & review**: side-by-side original and editable fields with source evidence and confidence; never invent values; distinct Supplier, Bill to, Attention to, Delivery contact and Approver identities; individual vs company/institution suppliers; search/create supplier with duplicate suggestions; audited corrections.
- **Routes**: quotation → requisition → budget check → approvals → LPO; invoice → match existing LPO/contract → goods receipt / service certification → finance → payment; invoices without a prior commitment may be **grouped by supplier into one LPO** (see Decisions); manual route with mandatory explanation.
- **Line items**: multi-line descriptions, unit of measure (word/hour/day/item/service/other), exact decimal quantities and rates, zero-value lines kept, footnotes preserved, mismatches flagged not overwritten, one invoice split across budget lines.
- **Status-aware actions**: edit/delete own drafts (soft delete, recycle bin, restore); recall before any decision; reviewer return-for-correction; no deletion or silent edit of approved/issued/posted/paid records — controlled amend/cancel/void only.
- **Official LPO**: render from the S05008 template (versioned, field-mapped); DRAFT watermark with a draft ID; official serial allocated atomically at authorisation, never reused; immutable issued PDF with hash; preview, download, configurable file name; uncontrolled Word copy only for authorised staff.
- **Email**: issued LPOs only; editable composer; exact issued PDF attached; send log (actor, recipients, version, hash, provider ID, status, retries); idempotent; failures never marked sent; resends labelled.
- **Bulk operations**: one selection pattern across every Procurement register (row/page/all-matching selection, counter, clear, eligibility preview, per-record outcomes); bulk delete eligible drafts, archive, ZIP download, export; bulk approve/issue/pay/email disabled by default.
- **Controls**: no self-approval enforced server-side; duplicate detection (supplier + normalised invoice number, file hash auxiliary); hard stops and soft warnings per source §10; restricted, masked bank profiles with dual-control verification; configurable effective procurement-tier and signatory policy (N$ method tiers separate from US$ signatory levels) with donor overrides; split-purchase alerts.
- **Finance & reporting**: source-currency amounts kept separate from approved N$ equivalent and booked rate; Sage ACCPAC staging/export records (no assumed direct posting); notifications and reports per source §10.

**Out of scope**
- Supplier self-submission of invoices via the portal or email ingestion — source P2.
- Automatic payment release from extraction or LPO approval — prohibited by the source PRD.
- Batch conversion of historical invoices into LPOs — prohibited by the source production gates.
- Direct posting into Sage ACCPAC — staging/export only until an integration is tested.
- Statistical fraud/anomaly detection and per-layout OCR tuning — source P2.

## Decisions (10 Nov 2026)
1. **Retrospective, multi-invoice LPOs are allowed without an exception step.** One LPO may cover several existing invoices from the same supplier, as in S05008. This **overrides** source PRD §1, §4 Route C, §11 and acceptance test 11. Retained safeguards: true creation/authorisation dates (no backdating), each source invoice kept as its own record and shown as a group heading on the LPO, duplicate control, no self-approval, and normal approval of the LPO itself.
2. **Scope is phases A + B + C** in this PRD.
3. **Official template** is LPO S05008 (supplied). Source §18's "template pending" dependency is resolved; faithful rendering still requires visual sign-off against the original.
4. **Fixtures** are PF2658, PF2659, PF2662, PF2663 and S05008 (expected-output reference). Dr KC Mulamba 03/2023 tests (source tests 4, 5, 6, 28) stay in scope but are **blocked until that PDF is supplied**.

## Delivery Milestones
| # | Milestone | Outcome | Status | Plan |
|---|---|---|---|---|
| 1 | Persistent drafts & review | Staff upload an invoice/quotation, see original beside editable extracted fields, save, reopen and correct supplier and lines; fixtures PF2658/2659/2662/2663 extract correctly | pending | — |
| 2 | Status-aware actions & safe bulk delete | Own drafts can be edited, deleted (recycle bin) and recalled; committed records cannot; Invoice/Quote register has multi-select with eligibility preview | pending | — |
| 3 | Routing to LPO & invoice match | Quotations flow through requisition approvals to an LPO; invoices match an LPO/contract or are grouped by supplier into a new LPO; receipts/service certificates gate payment | pending | — |
| 4 | Official LPO output | An authorised LPO renders on the S05008 layout with an atomic serial, DRAFT watermark before issue, immutable hashed PDF and download | pending | — |
| 5 | Email dispatch | Issued LPOs are emailed to verified supplier contacts with a full, idempotent send log | pending | — |
| 6 | Policy & finance controls | Effective procurement tiers/signatory matrix and donor overrides configurable; split-purchase alerts; bank-profile dual control; multi-currency audit; Sage ACCPAC export staging | pending | — |
| 7 | Bulk actions across Procurement | Every Procurement register uses the same selection and bulk-action pattern (archive, ZIP, export, delete drafts) | pending | — |
| 8 | Reporting & notifications | LPO register, unpaid invoices, commitments vs budget, invoice-to-LPO coverage, exceptions and spend reports with drill-down; workflow notifications | pending | — |

## Open Questions
- [ ] How should the LPO quantity column print? S05008 shows `1` with the word count in the description and the per-word rate as unit price — keep that print style while storing the real quantity, or print the real quantity (e.g. 4,593 words × 0.12)?
- [ ] What does the `S` prefix in S05008 mean (services vs goods series?), and what is the next serial / numbering policy per series?
- [ ] What goes in the LPO `Code:` field — budget line, GL code, or cost centre?
- [ ] Who are the current authorised LPO signatories and thresholds? The 2012 manual's titles (e.g. Director of Administration and HR) may be outdated — needs Finance sign-off.
- [ ] Which N$ procurement-method tiers apply above N$100,000 (selective vs competitive tender)? Source marks `REQUIRES FINANCE POLICY CONFIRMATION`.
- [ ] Recycle-bin retention window and who may restore or purge.
- [ ] Outbound email identity (SMTP / Microsoft 365 sender) and how supplier contacts are verified.
- [ ] Which donor/grant agreements carry their own procurement rules, and how a document is tagged to one?
- [ ] Should a grouped retrospective LPO show any notice that it covers already-rendered services, or match S05008 exactly with no notice?
- [ ] Is the Dr KC Mulamba 03/2023 PDF available for the blocked fixture tests?

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Allowing retrospective multi-invoice LPOs without an exception step weakens procurement control and may draw audit findings | Medium | High | Keep true timestamps, per-invoice records, duplicate checks and normal LPO approval; report retrospective LPOs separately so Finance can review; revisit after Finance sign-off |
| Policy thresholds/signatories configured from the 2012 manual are out of date | High | High | Make policy versioned and configurable; block production until Finance/Procurement sign off the effective matrix |
| Template rendering does not faithfully match S05008 (logos, text-box layout, duplicated header blocks in the Word file) | Medium | Medium | Visual comparison against the original; reviewed field map; sign-off before go-live |
| Extraction errors on varied supplier layouts | Medium | Medium | Native text parsing first, field evidence and confidence, mandatory human review, manual entry route |
| Bank-detail fraud via changed account details on invoices | Low | High | Restricted, masked bank profiles; independent verification and dual control; never auto-update beneficiary |
| Very large scope (A + B + C) delays delivery of the core intake → LPO path | High | Medium | Deliver milestones in order; each milestone shippable on its own |
| Overlap with existing Procurement features (document intake, PO templates/numbering, invoices, receipts, exceptions) causes duplication | Medium | Medium | `/plan` must audit and extend existing capabilities before adding new ones |

---
*Status: DRAFT — requirements only. Implementation planning pending via /plan.*
