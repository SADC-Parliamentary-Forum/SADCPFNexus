# Procurement Phase 2 Implementation Plan

**Goal:** Ship PRD §79 Phase 2 deferred pack on existing Procurement module after Phase 1 (`f5eb79f`).  
**Spec:** `docs/superpowers/specs/2026-07-25-procurement-phase2-design.md`  
**Branch:** `feat/procurement-phase2-2026-07-25`  
**Locked:** Phase 1 thresholds/budget/stars/FA-Stock/COI; no Salary Advance; no AI awarding.

---

## Task 1: Schema + config

Migration(s) `2026_07_26_10000*` creating:

- `tender_committees`, `tender_committee_members`, `tender_committee_meetings`
- `tenders`
- `contract_milestones`
- `annual_procurement_plans`, `annual_procurement_plan_items`
- `vendor_catalogue_items`, `vendor_catalogue_item_versions`
- columns on `procurement_requests`: `split_authorised_by`, `split_authorised_at`, `split_authorisation_notes`
- columns on `procurement_quotes`: `version`, `supersedes_quote_id`, `technical_score`, `envelope` (technical|financial|combined)
- `attachments.expires_at`
- `config/procurement.php`: `split_enforcement` => hard, `document_expiry_days` => 30
- GRANT for app_user

## Task 2: Hard split authorisation (TDD first)

- Extend `detectSplitPurchase` / submit flow: with hard mode, after justification still block approve/issueRfq/publish until authorised.
- `POST requests/{id}/authorise-split`
- Tests: soft still works; hard blocks award path; authorise then proceed.

## Task 3: Sealed bids + versioned replacements (TDD)

- Service `SealedBidService`: redact financials; lock after deadline; version on replace.
- Wire QuoteController index/show + SupplierPortal submitQuote.
- Tender `open-bids` sets `bids_opened_at`.
- Tests: redaction before open; visible after; post-deadline 422; version increment.

## Task 4: Tenders + evaluations + bid submissions list (TDD)

- Models/services/controllers/routes.
- Minimal web pages under `/procurement/tenders`, `/bid-submissions`, `/evaluations`.

## Task 5: Tender Committee (TDD)

- CRUD + members + meetings + quorum check helper.
- Web `/procurement/tender-committee`.

## Task 6: Contract milestones (TDD)

- Nested API + contract detail tab.

## Task 7: Planning + Catalogue (TDD)

- CRUD APIs + list/create pages + nav.

## Task 8: Compliance reminders (TDD)

- Command `procurement:send-document-expiry-reminders`
- Schedule daily in `routes/console.php`
- Optional `expires_at` on vendor attachment upload validation.

## Task 9: Nav + Settings stub

- Sidebar children.
- Settings: show split_enforcement + multi-donor stub note.

## Task 10: Verify, commit, merge, deploy

```bash
cd api && php artisan test tests/Feature/Procurement
```

Push branch → merge main → deploy `sadcpf-nexus-prod` → `/up`.

---

## Completion note (2026-07-25 — Phase 2 stream)

Shipped on branch `feat/procurement-phase2-2026-07-25`:
- Hard split authorisation (default), sealed bids + versioned portal replacements
- Tender portal lifecycle, tender committee + quorum meetings
- Contract milestones, annual plans, supplier catalogue + history
- Vendor document expiry reminders (scheduled)
- Nav: Tenders, Bid Submissions, Evaluations, Tender Committee, Planning, Catalogue
- Settings: split_enforcement + multi-donor stub

Deferred: AI awarding, public notice board, full multi-donor engine, mobile parity.

