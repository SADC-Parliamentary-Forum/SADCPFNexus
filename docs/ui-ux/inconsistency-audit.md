# SADC PF Nexus — UI/UX Inconsistency Audit

**Date:** 2026-07-31  
**Scope:** `web/app/(app)/**`, `web/components/**`, auth, dashboard, shared layouts  
**Method:** Static code review vs canonical patterns (`ModulePageHeader`, `PageBreadcrumbs`, `FormSection`/`FormField`, `RegisterShell`, `WorkflowStatusBanner`, `EmptyState`, design-system Button/Input/Badge/Table, brand CSS tokens).  
**Branch tip noted:** `e71cea6` Leave/PIF polish present; findings are remaining gaps.

## Summary

| Metric | Count |
| --- | ---: |
| **Total findings** | **364** |
| P0 | 15 |
| P1 | 241 |
| P2 | 108 |

### By category

| Category | Count |
| --- | ---: |
| Cross-module “same job, different UI” duplicates | 50 |
| Layout chrome / page headers / breadcrumbs | 47 |
| Navigation / sidebar / My Work / feature-only orphans | 23 |
| Forms (labels, sections, validation presentation, steppers) | 20 |
| Registers/lists (filters, density, pagination, bulk actions) | 19 |
| Admin vs operational module visual split | 17 |
| Empty / loading / error / 403-404 states | 17 |
| Status badges / colors / semantics | 17 |
| Color / legacy CSS bridges / dark-light issues | 15 |
| Detail pages / tabs / workflow banners | 15 |
| Accessibility (focus, labels, contrast, hit targets) | 14 |
| Buttons / CTAs / destructive actions | 14 |
| Mobile / responsive breakpoints | 13 |
| Copy/tone / microcopy inconsistency | 12 |
| Print/export affordances | 11 |
| Search / filters UX | 10 |
| Tables vs cards vs lists | 10 |
| Attachment / document upload UX | 9 |
| Dashboard widgets / badge counts | 6 |
| Date/time/currency/number formatting | 6 |
| Icons / illustration inconsistency | 6 |
| Approval / inbox patterns | 5 |
| Spacing / typography / density | 5 |
| Modals / drawers / dialogs | 3 |

### Worst offender modules (by finding count)

| Module | Findings |
| --- | ---: |
| `platform` | 117 |
| `people` | 41 |
| `admin` | 27 |
| `assets` | 27 |
| `audit` | 21 |
| `approvals` | 13 |
| `leave` | 10 |
| `finance` | 9 |
| `travel` | 9 |
| `my-work` | 8 |
| `procurement` | 7 |
| `stock` | 7 |
| `correspondence` | 6 |
| `hr` | 6 |
| `dashboard` | 5 |

### Top themes (P0/P1)

1. Canonical primitives exist but are barely adopted (Leave/PIF gold path vs rest of app).
2. People & Audit (and much of Access) ship stub/JSON/tooling UI in the production sidebar.
3. Dual surfaces for the same job: Approvals vs Inbox; admin/roles vs access/roles; organogram vs people/org-chart; finance/advances vs salary-advances; leave vs hr/leave.
4. Legacy CSS bridges (`page-container`, `btn btn-*`, `table-wrap`, `alert`) still dominate Assets (+ stock scan, correspondence retention).
5. Design-system React `Button` / `Input` / `Select` / `Badge` have ~zero imports; CSS class variants diverge (and `badge-info` / `alert-info` are undefined).
6. Workflow detail chrome (`WorkflowStatusBanner`, timelines) not standardized outside Leave/PIF.
7. Double padding (`AppShell` `p-6` + page `p-6`) and competing H1 systems (`page-title` vs `text-2xl font-semibold`).
8. Toast vs local toast state; `ConfirmDialog` vs `window.confirm`; reject-with-reason only sometimes.
9. Date/money formatters fragmented (`useFormatDate` underused; en-GB vs en-US hardcoding).
10. Three document panels + many bespoke upload UIs.
11. Navigation overcrowding (Travel, Assignments) and feature-only / jargon labels (`Phase 2-3 stubs`, `feature-only`).
12. Dark mode: tokenized `.card` vs raw `bg-white` / `var(--*)` pages and hardcoded SVG colors.
13. Mobile: wide tables without card fallback; dense `btn-sm`; inbox tab wrap.
14. Accessibility gaps: few `aria-label`s, weak table captions, no skip link, custom dialogs.
15. Print/export and queue-table patterns exist but are applied inconsistently across modules.

## Full findings

### UX-001 — ModulePageHeader adopted only on Leave/PIF

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `web/app/(app)/**`
- **What's wrong:** ModulePageHeader is imported only by leave/* and pif/* (~10 pages). ~400 other page.tsx files use ad-hoc <h1 className="page-title"> or text-2xl font-semibold.
- **Target pattern:** ModulePageHeader + PageBreadcrumbs on all module pages

### UX-002 — PageBreadcrumbs nearly unused outside Leave/PIF

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `web/app/(app)/**`
- **What's wrong:** PageBreadcrumbs only appears on leave and pif routes; travel/create and imprest/create use raw <a href> crumb rows instead.
- **Target pattern:** PageBreadcrumbs everywhere with consistent Home › Module › Page trail

### UX-003 — Double horizontal padding (AppShell p-6 + page p-6)

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `web/components/layout/AppShell.tsx + many pages`
- **What's wrong:** AppShell main already applies p-6; ~220 (app) pages also wrap content in p-6 / space-y-*p-6*, producing uneven outer gutters vs pages that rely on shell only.
- **Target pattern:** Pages should not re-apply outer p-6; shell owns page chrome padding

### UX-004 — Inconsistent content max-width

- **Severity:** P2
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `various`
- **What's wrong:** RegisterShell uses max-w-6xl; /approvals uses max-w-4xl; many hubs use unconstrained width; ModulePageHeader maxWidth prop rarely used.
- **Target pattern:** Standardize: registers max-w-6xl, forms max-w-3xl/4xl, dashboards full shell width

### UX-005 — Assets Pending intake uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/intake`
- **What's wrong:** /assets/intake wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-006 — Assets Maintenance uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/maintenance`
- **What's wrong:** /assets/maintenance wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-007 — Assets Revaluation uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/revaluation`
- **What's wrong:** /assets/revaluation wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-008 — Assets Disposal uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/disposal`
- **What's wrong:** /assets/disposal wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-009 — Assets Verification uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/verification`
- **What's wrong:** /assets/verification wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-010 — Assets Reports uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/reports`
- **What's wrong:** /assets/reports wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-011 — Assets Dashboard uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/dashboard`
- **What's wrong:** /assets/dashboard wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-012 — Assets Settings uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/settings`
- **What's wrong:** /assets/settings wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-013 — Assets Transfers uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/transfers`
- **What's wrong:** /assets/transfers wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-014 — Assets Insurance uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/insurance`
- **What's wrong:** /assets/insurance wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-015 — Assets My assets uses legacy page-container chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/mine`
- **What's wrong:** /assets/mine wraps with page-container / page-header / btn btn-* instead of ModulePageHeader or RegisterShell.
- **Target pattern:** Migrate to ModulePageHeader or RegisterShell + design-system Button

### UX-016 — Stock scan uses legacy page-container

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `stock`
- **Route / locus:** `/stock/scan`
- **What's wrong:** stock/scan/page.tsx uses page-container, alert alert-*, btn btn-* bridges.
- **Target pattern:** ModulePageHeader + Button + Toast/EmptyState

### UX-017 — Correspondence retention uses legacy page-container

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `correspondence`
- **Route / locus:** `/correspondence/retention`
- **What's wrong:** Uses page-container, alert alert-success/error, btn btn-*, table-wrap while master-register uses RegisterShell.
- **Target pattern:** Align with correspondence/master-register RegisterShell pattern

### UX-018 — My Work hub header not using page-title pattern

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `my-work`
- **Route / locus:** `/my-work`
- **What's wrong:** Uses text-2xl font-semibold and CSS var(--muted-foreground) instead of page-title / page-subtitle.
- **Target pattern:** ModulePageHeader with page-title tokens

### UX-019 — Approvals inbox title style diverges from Pending Approvals

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `approvals`
- **Route / locus:** `/approvals/inbox`
- **What's wrong:** /approvals uses page-title; /approvals/inbox uses text-2xl font-semibold tracking-tight and extra p-6.
- **Target pattern:** Same ModulePageHeader chrome for both approval surfaces

### UX-020 — People hub uses stub header typography

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `people`
- **Route / locus:** `/people`
- **What's wrong:** text-2xl font-semibold + plain border cards; no page-title, no ModulePageHeader, no card utility class.
- **Target pattern:** ModulePageHeader + card grid like /admin hub

### UX-021 — Audit dashboard header not on design-system title classes

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit`
- **What's wrong:** text-2xl font-semibold; view toggles use bg-neutral-900 not filter-tab / primary.
- **Target pattern:** ModulePageHeader + filter-tab or segmented control

### UX-022 — Access governance uses alternate token set

- **Severity:** P2
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `admin`
- **Route / locus:** `/admin/access`
- **What's wrong:** text-[var(--foreground)], border-[var(--border)], hover:bg-[var(--muted)] — parallel design language vs .card / .page-title.
- **Target pattern:** Map to brand tokens / page-title / card

### UX-023 — Duplicate Approvals entry points in sidebar

- **Severity:** P0
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `platform`
- **Route / locus:** `Sidebar NAV_ITEMS`
- **What's wrong:** Top-level Approvals (/approvals), My Approvals Inbox (/approvals/inbox), and My Work › Approvals Inbox all point at overlapping approval UX with different UIs.
- **Target pattern:** Single Approvals nav item with inbox as default; remove duplicates

### UX-024 — Two organisation-chart experiences

- **Severity:** P0
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `people`
- **Route / locus:** `/organogram vs /people/org-chart`
- **What's wrong:** /organogram is a rich interactive department canvas; /people/org-chart dumps JSON.stringify of API data with underline hub links.
- **Target pattern:** One org-chart product; retire or redirect the stub

### UX-025 — Leave appears under Leave nav and again under HR

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `leave`
- **Route / locus:** `/leave and /hr/leave`
- **What's wrong:** Sidebar Leave children include HR Leave Register (/hr/leave) while HR section also lists Leave — same job, two IA homes, different list UIs (RegisterShell vs custom).
- **Target pattern:** HR register as child of Leave only, or shared RegisterShell

### UX-026 — TOIL split across Travel and Leave with different UI maturity

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `leave`
- **Route / locus:** `/travel/toil vs /leave/toil`
- **What's wrong:** leave/toil uses ModulePageHeader + EmptyState; travel/toil is a bespoke table with window-style action messaging and no shared chrome.
- **Target pattern:** Unify TOIL under Leave with Travel deep-links; shared register pattern

### UX-027 — Two 'my profile' destinations

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `people`
- **Route / locus:** `/profile vs /people/my-profile`
- **What's wrong:** Polished /profile (DocumentsPanel, sections) vs /people/my-profile JSON stub linked from People nav.
- **Target pattern:** Redirect people/my-profile → /profile or embed profile chrome

### UX-028 — Signature management fragmented across three modules

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `saam`
- **Route / locus:** `/saam vs /people/signatures vs /profile/signature`
- **What's wrong:** SAAM page, people/my-signature + signatures stubs, and profile/signature — overlapping 'draw/sign' jobs with different UIs.
- **Target pattern:** Canonical signature home (SAAM or profile) with redirects

### UX-029 — Two role-administration UIs

- **Severity:** P0
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `admin`
- **Route / locus:** `/admin/roles vs /admin/access/roles`
- **What's wrong:** admin/roles is a rich color-coded permission matrix; admin/access/roles is a minimal draft/publish table with raw inputs — same domain, incompatible UX.
- **Target pattern:** Single roles surface; deprecate legacy or access stub clearly labeled

### UX-030 — Salary advances dual module surfaces

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `finance`
- **Route / locus:** `/finance/advances vs /salary-advances`
- **What's wrong:** Legacy finance/advances queue UI and newer salary-advances/* dashboards/queues coexist; status maps and CTAs differ.
- **Target pattern:** One advances IA; redirect finance/advances to salary-advances

### UX-031 — Legacy weekly digest still in primary nav

- **Severity:** P2
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `weekly-summaries`
- **Route / locus:** `Sidebar Weekly Summaries`
- **What's wrong:** Child 'Email Digest (legacy)' → /reports/weekly advertises legacy in production chrome.
- **Target pattern:** Hide behind admin or remove after cutover

### UX-032 — My Work hub is bare underlined link list

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `my-work`
- **Route / locus:** `/my-work`
- **What's wrong:** No cards, badges, counts, or EmptyState; plain <ul><Link className="underline"> — orphan aesthetic vs dashboard.
- **Target pattern:** Card/list pattern with counts matching Approvals hub density

### UX-033 — Feature-only orphan uses DIY breadcrumb and list

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `my-work`
- **Route / locus:** `/my-work/procurement-evaluations`
- **What's wrong:** Manual 'My Work / …' text crumbs, border rounded list items, CSS vars — not RegisterShell or EmptyState.
- **Target pattern:** RegisterShell + PageBreadcrumbs + EmptyState

### UX-034 — Travel nav overcrowded with parallel queues and dashboards

- **Severity:** P2
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `travel`
- **Route / locus:** `Sidebar Travel children`
- **What's wrong:** Admin Queue + Admin Dashboard; Finance Review Queue + Finance Dashboard; many view= query links — hard to scan vs Leave's tighter tree.
- **Target pattern:** Collapse queues under one Queues parent; dashboards under Analytics

### UX-035 — RegisterShell only on ~9 registers

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `platform`
- **Route / locus:** `web/components/registers/RegisterShell.tsx consumers`
- **What's wrong:** Used by leave, pif, travel/register, risk, correspondence/master-register, audit universe/plans, procurement register/tenders — vast majority of lists roll their own.
- **Target pattern:** Adopt RegisterShell for all primary registers

### UX-036 — Imprest list mirrors Leave but skips RegisterShell

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `imprest`
- **Route / locus:** `/imprest`
- **What's wrong:** Near-clone of leave list (filter tabs, bulk bar, ListPagination) without RegisterShell/density toggle.
- **Target pattern:** RegisterShell like /leave

### UX-037 — Stock items list custom chrome without RegisterShell

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `stock`
- **Route / locus:** `/stock`
- **What's wrong:** Custom header + filters; no density, no BulkSelectionBar, client filter only.
- **Target pattern:** RegisterShell + shared filter card

### UX-038 — Fixed assets register not on RegisterShell

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `assets`
- **Route / locus:** `/assets`
- **What's wrong:** Large bespoke page with capitalise modal; no shared density/pagination shell used by travel/leave registers.
- **Target pattern:** RegisterShell + Extract capitalise to drawer pattern

### UX-039 — Procurement requests list not RegisterShell despite /procurement/register using it

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `procurement`
- **Route / locus:** `/procurement`
- **What's wrong:** Dashboard-style request list vs Register at /procurement/register — two request lists, different shells.
- **Target pattern:** One request register via RegisterShell; dashboard widgets separate

### UX-040 — HR leave register uses ListPagination not RegisterShell

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `hr`
- **Route / locus:** `/hr/leave`
- **What's wrong:** Custom STATUS_BADGE and formatDate local helper; no density control; different empty/skeleton than /leave.
- **Target pattern:** RegisterShell shared with employee leave list patterns

### UX-041 — Two pagination components/patterns

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `platform`
- **Route / locus:** `ListPagination vs RegisterShell pagination`
- **What's wrong:** ListPagination used on ~18 pages; RegisterShell embeds its own Prev/Next — visual and API (page vs client slice) differ.
- **Target pattern:** Single ListPagination inside RegisterShell

### UX-042 — Bulk actions only on a handful of registers

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `platform`
- **Route / locus:** `BulkSelectionBar adoption`
- **What's wrong:** BulkSelectionBar on leave, imprest, travel/register, correspondence master, procurement register — most lists lack multi-select export/cancel.
- **Target pattern:** Offer bulk bar wherever export/cancel is meaningful

### UX-043 — Access roles table is unstyled raw HTML table

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `admin`
- **Route / locus:** `/admin/access/roles`
- **What's wrong:** w-full text-sm border-collapse without data-table / table-wrap / card.
- **Target pattern:** data-table inside card or RegisterShell

### UX-044 — Filter control styling inconsistent

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `platform`
- **Route / locus:** `filter-tab vs ad-hoc pill buttons`
- **What's wrong:** Some pages use .filter-tab; approvals/inbox uses rounded-md border pills; audit uses bg-neutral-900 active; people uses none.
- **Target pattern:** Standardize on filter-tab (or shared SegmentedControl)

### UX-045 — FormSection rarely used outside Leave/PIF/setup

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `FormSection / FormField usage`
- **What's wrong:** FormSection on leave create/settings, pif create, setup; travel/imprest create use local section patterns; most admin forms use bare labels.
- **Target pattern:** FormSection + FormField on all multi-section forms

### UX-046 — FormField only referenced from FormSection + pif/create

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `FormField adoption`
- **What's wrong:** Canonical labeled field wrapper effectively unused across HR settings, admin users create, assets forms.
- **Target pattern:** FormField for label/hint/error consistency

### UX-047 — Stepper used only on subset of wizards

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `Stepper adoption`
- **What's wrong:** Stepper on travel/create, imprest create/detail, assets/add, hr/incidents/new, pif edit, setup — leave create uses different step UI; many multi-step flows have none.
- **Target pattern:** Shared Stepper for all multi-step creates

### UX-048 — Access role create inputs lack form-input class

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `admin`
- **Route / locus:** `/admin/access/roles`
- **What's wrong:** block border rounded px-2 py-1 — not form-input; amber placeholder-shown highlight never applies.
- **Target pattern:** form-input + FormField

### UX-049 — Global amber 'unedited' input highlight surprises on some forms

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `globals.css form-input:placeholder-shown`
- **What's wrong:** Any placeholder-shown form-input gets amber border — inconsistent with design-system Input and confuses intentional empty optional fields.
- **Target pattern:** Opt-in class instead of global :placeholder-shown rule

### UX-050 — People hub quick-create uses unstyled border inputs

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `people`
- **Route / locus:** `/people`
- **What's wrong:** border rounded px-3 py-2 text-sm without form-input; sits on same page as institutional product.
- **Target pattern:** form-input + Button primary

### UX-051 — Travel create breadcrumbs use <a> not Link/PageBreadcrumbs

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `travel`
- **Route / locus:** `/travel/create`
- **What's wrong:** Full page reload crumbs vs client Link elsewhere.
- **Target pattern:** PageBreadcrumbs + next/link

### UX-052 — Imprest create breadcrumbs use <a href>

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `imprest`
- **Route / locus:** `/imprest/create`
- **What's wrong:** Same anti-pattern as travel/create.
- **Target pattern:** PageBreadcrumbs

### UX-053 — HR settings pages use <a href="/settings/hr"> crumbs

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `settings`
- **Route / locus:** `settings/hr/*`
- **What's wrong:** Multiple settings/hr pages hardcode <a> breadcrumbs instead of PageBreadcrumbs.
- **Target pattern:** PageBreadcrumbs component

### UX-054 — WorkflowStatusBanner only on leave/[id] and pif/[id]

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `platform`
- **Route / locus:** `WorkflowStatusBanner`
- **What's wrong:** Travel, imprest, procurement, advances detail pages use StatusTimeline / ApprovalTimeline / bespoke banners instead of WorkflowStatusBanner.
- **Target pattern:** WorkflowStatusBanner on all workflow-backed details

### UX-055 — Four parallel timeline/tracker components

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `platform`
- **Route / locus:** `Timeline component zoo`
- **What's wrong:** WorkflowTracker, ApprovalTimeline, StatusTimeline, AuditTimeline — travel detail stacks several; leave/pif use banner+timelines differently.
- **Target pattern:** Documented composition: Banner + ApprovalTimeline + AuditTimeline

### UX-056 — Travel detail lacks ModulePageHeader used by Leave detail

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `travel`
- **Route / locus:** `/travel/[id]`
- **What's wrong:** Leave/[id] polished with ModulePageHeader + WorkflowStatusBanner; travel/[id] is large bespoke layout without those primitives.
- **Target pattern:** Align travel detail to leave/[id] chrome

### UX-057 — Imprest detail workflow chrome differs from Leave/PIF

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `imprest`
- **Route / locus:** `/imprest/[id]`
- **What's wrong:** Uses Stepper + timelines without WorkflowStatusBanner/ModulePageHeader.
- **Target pattern:** Same detail shell as leave/[id]

### UX-058 — Procurement detail status presentation bespoke

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `procurement`
- **Route / locus:** `/procurement/[id]`
- **What's wrong:** Local status chips and DocumentsPanel; no WorkflowStatusBanner.
- **Target pattern:** Shared workflow detail shell

### UX-059 — Advance detail uses PrintButton but not ModulePageHeader

- **Severity:** P2
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `finance`
- **Route / locus:** `/finance/advances/[id]`
- **What's wrong:** Print affordance present; page chrome still ad-hoc vs leave certificate flow polish.
- **Target pattern:** ModulePageHeader + WorkflowStatusBanner

### UX-060 — Design-system Button component has zero page imports

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `@/components/ui/Button`
- **What's wrong:** Button.tsx exists with primary/secondary/ghost/danger but pages use .btn-primary / .btn.btn-primary / raw Tailwind buttons instead.
- **Target pattern:** Prefer Button component (or delete unused and document CSS-only)

### UX-061 — Legacy .btn.btn-primary and modern .btn-primary both exist

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `btn vs btn-primary dual CSS APIs`
- **What's wrong:** globals.css bridges Bootstrap-like .btn and institutional .btn-primary — assets/stock use .btn; leave uses .btn-primary / Button-less classes.
- **Target pattern:** Single button class API

### UX-062 — Native window.confirm on some destructive flows

- **Severity:** P0
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `window.confirm usage`
- **What's wrong:** assets/depreciation, hr/timesheets/templates, workplan use window.confirm while leave/travel/imprest use ConfirmDialog.
- **Target pattern:** useConfirm / ConfirmDialog everywhere

### UX-063 — Disposal workflow actions are unlabeled generic btn-sm

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `assets`
- **Route / locus:** `/assets/disposal`
- **What's wrong:** Recommend / finance-review / approve as dense btn-sm row without danger/primary hierarchy or ConfirmDialog.
- **Target pattern:** Button variants + ConfirmDialog for irreversible steps

### UX-064 — Inbox reject uses hardcoded reason string

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `approvals`
- **Route / locus:** `/approvals/inbox`
- **What's wrong:** decide() rejects with 'Rejected from inbox' without reason modal; /approvals has reject reason dialog.
- **Target pattern:** Shared reject modal requiring comment

### UX-065 — Primary CTA uses bg-[var(--primary)] not btn-primary

- **Severity:** P2
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `admin`
- **Route / locus:** `/admin/access/roles`
- **What's wrong:** Create draft button invents another primary style.
- **Target pattern:** btn-primary or Button

### UX-066 — Approvals: card list vs table/task list for same job

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `approvals`
- **Route / locus:** `/approvals vs /approvals/inbox`
- **What's wrong:** Pending Approvals uses rich module-colored cards; Inbox uses denser task rows/tabs — users bouncing between nav entries see different metaphors.
- **Target pattern:** Unify on one list metaphor with shared row component

### UX-067 — Evaluations as plain bordered <li> not table/register

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `my-work`
- **Route / locus:** `/my-work/procurement-evaluations`
- **What's wrong:** No columns for status/due; inconsistent with procurement evaluations elsewhere.
- **Target pattern:** RegisterShell table or card rows matching procurement

### UX-068 — People subpages render JSON in <pre> instead of tables/cards

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `people`
- **Route / locus:** `/people/* stubs`
- **What's wrong:** Majority of /people/* pages show JSON.stringify dumps — not operational UI.
- **Target pattern:** RegisterShell / detail layouts; hide stubs from nav until ready

### UX-069 — Audit submodules mix KPI cards and JSON/minimal lists

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `audit`
- **Route / locus:** `/audit/* stubs`
- **What's wrong:** Dashboard shows raw Object.entries keys; several children are thin stubs vs polished risk/procurement registers.
- **Target pattern:** RegisterShell + proper KPI widgets

### UX-070 — Legacy table-wrap still used beside data-table-in-card

- **Severity:** P2
- **Category:** Tables vs cards vs lists
- **Module:** `platform`
- **Route / locus:** `table-wrap vs overflow card`
- **What's wrong:** Assets legacy pages use table-wrap; newer pages wrap tables in card + overflow-x-auto.
- **Target pattern:** One table container pattern

### UX-071 — badge-info used but not defined in globals.css

- **Severity:** P0
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `badge-info class`
- **What's wrong:** assets, assets/depreciation, stock/movements, finance/budget reference badge-info; CSS defines badge-primary/success/warning/danger/muted only — badges render unstyled.
- **Target pattern:** Add .badge-info or map to badge-primary

### UX-072 — alert-info used on assets/reports without CSS definition

- **Severity:** P0
- **Category:** Status badges / colors / semantics
- **Module:** `assets`
- **Route / locus:** `alert-info class`
- **What's wrong:** globals defines alert-success/error/danger/warning only; alert-info messages lack intended styling.
- **Target pattern:** Add alert-info or use Toast

### UX-073 — React Badge component unused; CSS .badge-* used instead

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `@/components/ui/Badge`
- **What's wrong:** Badge.tsx variants (incl. info) never imported; pages use string class maps — drift between TS and CSS.
- **Target pattern:** Single badge API (component wrapping CSS)

### UX-074 — LIL labeling inconsistent between /leave and /hr/leave

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `leave`
- **Route / locus:** `Leave type label LIL vs Leave in Lieu`
- **What's wrong:** leave/page TYPE_LABELS lil→'Leave in Lieu'; hr/leave uses 'LIL'.
- **Target pattern:** Shared leaveLabels constant

### UX-075 — Per-page statusConfig dictionaries diverge

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `STATUS maps duplicated per module`
- **What's wrong:** Travel, leave, imprest, procurement, salary advances each define local status→badge maps with different labels for same states (e.g. submitted vs Pending Approval).
- **Target pattern:** Shared status dictionary per module type

### UX-076 — Purple Tailwind accents for procurement/admin/finance widgets

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `Purple used as module accent`
- **What's wrong:** Dashboard, approvals MODULE_CONFIG, Header notifications, admin hub, SAAM, risk — purple/violet as brand-adjacent accents conflicting with primary blue tokens.
- **Target pattern:** Module accent tokens from brand palette (no ad-hoc purple)

### UX-077 — Leave detail LIL blocks hardcode purple palette

- **Severity:** P2
- **Category:** Status badges / colors / semantics
- **Module:** `leave`
- **Route / locus:** `/leave/[id] LIL section`
- **What's wrong:** SectionIcon and progress bar use purple-500/600 outside Badge semantics.
- **Target pattern:** Use primary or dedicated LIL token

### UX-078 — CSS badge-success uses green-100/700; Badge.tsx uses emerald-100/800

- **Severity:** P2
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `Badge success green shade mismatch`
- **What's wrong:** If both ever mixed, success chips won't match.
- **Target pattern:** Align component variants to CSS tokens

### UX-079 — EmptyState used on ~6 pages only

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `EmptyState adoption`
- **What's wrong:** Most lists use inline 'No … found' text or empty <tbody>; EmptyState component underused.
- **Target pattern:** EmptyState for all register empty/error-empty

### UX-080 — Skeleton vs 'Loading…' text inconsistency

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `Loading patterns mixed`
- **What's wrong:** ~113 pages use animate-pulse skeletons; many others (people, audit, my-work) print Loading… text only.
- **Target pattern:** Shared SkeletonList / RegisterShell loading prop

### UX-081 — Errors via alert classes, red text, Toast, or silent catch

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `Error presentation mixed`
- **What's wrong:** Assets use alert-error; leave uses toast/actionError; correspondence master .catch(() => {}); people uses text-red-600.
- **Target pattern:** Toast for transient + inline Alert for page-level failures

### UX-082 — Unauthorized routes silently redirect to /dashboard

- **Severity:** P0
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `AppShell canAccessRoute`
- **What's wrong:** No 403 page — users lose context when lacking permission (unlike explicit Access denied copy elsewhere).
- **Target pattern:** Dedicated 403 view with reason + back link

### UX-083 — 404 page offers Home, Login, and Dashboard equally

- **Severity:** P2
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `web/app/not-found.tsx`
- **What's wrong:** Authenticated users still see Login CTA; styling uses ad-hoc buttons not btn-primary.
- **Target pattern:** Context-aware 404; design-system buttons

### UX-084 — Org chart error is bare 'Unable to load.'

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `people`
- **Route / locus:** `/people/org-chart`
- **What's wrong:** No retry, EmptyState, or alert pattern.
- **Target pattern:** EmptyState + retry action

### UX-085 — Two competing H1 systems

- **Severity:** P1
- **Category:** Spacing / typography / density
- **Module:** `platform`
- **Route / locus:** `page-title vs text-2xl font-semibold`
- **What's wrong:** Institutional .page-title (text-2xl font-bold) vs newer stubs using text-2xl font-semibold — weight/tracking differ.
- **Target pattern:** Always .page-title via ModulePageHeader

### UX-086 — Comfortable/compact density only where RegisterShell wired

- **Severity:** P2
- **Category:** Spacing / typography / density
- **Module:** `platform`
- **Route / locus:** `Register density toggle rare`
- **What's wrong:** Most lists fixed comfortable row padding (data-table py-4).
- **Target pattern:** Expose density on all RegisterShell migrations

### UX-087 — Vertical rhythm differs page to page

- **Severity:** P2
- **Category:** Spacing / typography / density
- **Module:** `platform`
- **Route / locus:** `space-y-5 vs space-y-6 vs space-y-4`
- **What's wrong:** RegisterShell space-y-5; many pages space-y-6; my-work space-y-4.
- **Target pattern:** Tokenized page stack spacing

### UX-088 — Audit KPIs show raw snake_case keys as labels

- **Severity:** P1
- **Category:** Spacing / typography / density
- **Module:** `audit`
- **Route / locus:** `/audit dashboard KPI cards`
- **What's wrong:** Object.entries key.replaceAll('_',' ') — not humanized titles; looks unfinished vs dashboard StatPills.
- **Target pattern:** Mapped label dictionary + shared StatCard

### UX-089 — Bootstrap-like legacy bridge layer still required

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `platform`
- **Route / locus:** `globals.css legacy bridges`
- **What's wrong:** page-container, btn, table-wrap, alert explicitly maintained for assets/stock/correspondence — permanent dual system.
- **Target pattern:** Migrate remaining consumers then remove bridges

### UX-090 — Access/admin/my-work use var(--foreground/muted/border)

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `admin`
- **Route / locus:** `CSS variable pages vs Tailwind token pages`
- **What's wrong:** Parallel token vocabulary not matching --primary / neutral Tailwind scale used by Leave/PIF.
- **Target pattern:** One token set

### UX-091 — Assets page-container pages lack dark: / [data-theme] awareness in JSX

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `assets`
- **Route / locus:** `Assets legacy pages dark mode`
- **What's wrong:** Rely on global bridges unevenly; purple/amber alerts may fail contrast in dark.
- **Target pattern:** Use components with dark tokens; verify alerts

### UX-092 — Shell uses Tailwind dark:neutral-900 while token system defines --dk-bg-app #0B1220

- **Severity:** P2
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `platform`
- **Route / locus:** `AppShell dark:bg-neutral-900 vs --dk-bg-app`
- **What's wrong:** Slight canvas mismatch between shell and tokenized surfaces.
- **Target pattern:** Shell uses var(--dk-bg-app) under dark

### UX-093 — Dark mode card:hover elevates non-interactive cards

- **Severity:** P2
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `platform`
- **Route / locus:** `[data-theme=dark] .card:hover elevates all cards`
- **What's wrong:** Every .card gets elevated hover — static summary cards feel clickable.
- **Target pattern:** Hover only on interactive cards

### UX-094 — Icon size classes vary widely

- **Severity:** P2
- **Category:** Icons / illustration inconsistency
- **Module:** `platform`
- **Route / locus:** `Material Symbols usage`
- **What's wrong:** text-[14px] crumbs, text-[16px], text-[18px], text-5xl EmptyState, default 24px — no size scale.
- **Target pattern:** Icon size tokens (sm/md/lg)

### UX-095 — Dashboard, Approvals, Header, SAAM each redefine module icon/colors

- **Severity:** P2
- **Category:** Icons / illustration inconsistency
- **Module:** `platform`
- **Route / locus:** `Module color+icon maps duplicated`
- **What's wrong:** Travel/Leave/Procurement accents diverge slightly across maps.
- **Target pattern:** Shared moduleMeta constant

### UX-096 — People hub tiles have no icons

- **Severity:** P1
- **Category:** Icons / illustration inconsistency
- **Module:** `people`
- **Route / locus:** `/people hub links`
- **What's wrong:** Admin hub cards use material icons + color; People hub is text-only borders.
- **Target pattern:** Match admin hub card pattern with icons

### UX-097 — Same inbox icon for unrelated empty states

- **Severity:** P2
- **Category:** Icons / illustration inconsistency
- **Module:** `platform`
- **Route / locus:** `EmptyState default inbox icon`
- **What's wrong:** When used, default icon=inbox even for calendars/TOIL.
- **Target pattern:** Pass contextual icons (already supported)

### UX-098 — Mixed modal systems: ConfirmDialog, ReturnModal, Stock*Modal, SigningModal, QuickEntrySlideOver, HR SlideOvers

- **Severity:** P1
- **Category:** Modals / drawers / dialogs
- **Module:** `platform`
- **Route / locus:** `Modal vs SlideOver zoo`
- **What's wrong:** No shared Dialog primitive; focus trap/ARIA inconsistent.
- **Target pattern:** Shared Dialog/Drawer primitives

### UX-099 — HR settings prefer SlideOver; stock prefers Modal

- **Severity:** P2
- **Category:** Modals / drawers / dialogs
- **Module:** `settings`
- **Route / locus:** `settings/hr SlideOvers`
- **What's wrong:** Same 'edit entity' job — different chrome.
- **Target pattern:** Pick drawer vs modal by complexity; document rule

### UX-100 — Capitalise flow embedded as page-local modal

- **Severity:** P1
- **Category:** Modals / drawers / dialogs
- **Module:** `assets`
- **Route / locus:** `/assets capitalise modal`
- **What's wrong:** Large inline modal in assets/page.tsx vs dedicated routes for other asset workflows.
- **Target pattern:** Shared drawer or /assets/[id]/capitalise route

### UX-101 — Multiple date formatters in play

- **Severity:** P1
- **Category:** Date/time/currency/number formatting
- **Module:** `platform`
- **Route / locus:** `formatDate helpers`
- **What's wrong:** formatDateShort (utils), useFormatDate hook, formatDate, local toLocaleDateString('en-GB'), ISO slice — inconsistent across modules.
- **Target pattern:** useFormatDate everywhere respecting user prefs

### UX-102 — HR leave defines local en-GB formatter

- **Severity:** P1
- **Category:** Date/time/currency/number formatting
- **Module:** `hr`
- **Route / locus:** `/hr/leave formatDate`
- **What's wrong:** Duplicates platform helpers; may ignore PrefsProvider.
- **Target pattern:** useFormatDate

### UX-103 — Currency display helpers diverge

- **Severity:** P1
- **Category:** Date/time/currency/number formatting
- **Module:** `finance`
- **Route / locus:** `Money formatting`
- **What's wrong:** travel formatMoney (code + toLocaleString), stock/assets fmtMoney en-US 2dp, formatSaCurrency for advances — locale and currency code placement differ.
- **Target pattern:** Shared formatMoney(amount, currency, locale)

### UX-104 — Hardcoded locales ignore tenant/user locale i18n

- **Severity:** P2
- **Category:** Date/time/currency/number formatting
- **Module:** `platform`
- **Route / locus:** `en-US vs en-GB locale hardcoding`
- **What's wrong:** Assets/stock force en-US; hr leave en-GB; app has LocaleProvider.
- **Target pattern:** Format via active locale

### UX-105 — In-page search inputs inconsistent

- **Severity:** P1
- **Category:** Search / filters UX
- **Module:** `platform`
- **Route / locus:** `GlobalSearch vs page search`
- **What's wrong:** Some registers use form-input search in filter card; others bare inputs; GlobalSearch has own styling.
- **Target pattern:** Shared SearchField in RegisterShell filters slot

### UX-106 — Search triggers full reload on every change without debounce UI

- **Severity:** P2
- **Category:** Search / filters UX
- **Module:** `correspondence`
- **Route / locus:** `/correspondence/master-register`
- **What's wrong:** useEffect([search]) immediate fetch — different from leave client-side filter.
- **Target pattern:** Debounced server search or client filter with clear affordance

### UX-107 — Ad-hoc user autocomplete only on HR leave

- **Severity:** P1
- **Category:** Search / filters UX
- **Module:** `hr`
- **Route / locus:** `/hr/leave UserAutocomplete`
- **What's wrong:** Custom dropdown; other modules lack equivalent or use different pickers.
- **Target pattern:** Shared UserPicker component

### UX-108 — Dashboard module grid incomplete vs sidebar modules

- **Severity:** P1
- **Category:** Dashboard widgets / badge counts
- **Module:** `dashboard`
- **Route / locus:** `/dashboard`
- **What's wrong:** Quick modules omit People, Audit, Risk, Stock, Assignments etc. present in sidebar.
- **Target pattern:** Generate module grid from nav config

### UX-109 — Open Requisitions KPI uses purple accent

- **Severity:** P2
- **Category:** Dashboard widgets / badge counts
- **Module:** `dashboard`
- **Route / locus:** `/dashboard purple KPI`
- **What's wrong:** Breaks primary brand blue system used elsewhere for CTAs.
- **Target pattern:** Primary or procurement token

### UX-110 — My Work has no badge counts

- **Severity:** P1
- **Category:** Dashboard widgets / badge counts
- **Module:** `my-work`
- **Route / locus:** `/my-work`
- **What's wrong:** Unlike approvals filter tabs with counts, My Work lists features without pending counts.
- **Target pattern:** Show counts per feature-only queue

### UX-111 — Module dashboards diverge in widget language

- **Severity:** P2
- **Category:** Dashboard widgets / badge counts
- **Module:** `stock`
- **Route / locus:** `/stock dashboard vs /assets/dashboard`
- **What's wrong:** Stock/assets/travel dashboards each invent KPI card layouts.
- **Target pattern:** Shared DashboardShell + StatCard

### UX-112 — Admin hub polished cards; Access sub-app looks like internal tooling

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin vs /admin/access`
- **What's wrong:** Visual cliff between /admin tile grid and /admin/access bare lists.
- **Target pattern:** Bring access UI onto admin card/table system

### UX-113 — Platform audit trail UI language differs from /admin/audit

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/audit-trail`
- **What's wrong:** Two audit concepts (platform trail vs legacy audit logs) with different chrome.
- **Target pattern:** Clarify naming + shared admin page header

### UX-114 — Document retention appears in admin and correspondence with different UI

- **Severity:** P2
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/documents vs /correspondence/retention`
- **What's wrong:** btn btn-primary text-sm admin pages vs correspondence page-container retention.
- **Target pattern:** One retention console

### UX-115 — Nav label 'Settings / Phase 2-3 stubs' leaks engineering jargon

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `people`
- **Route / locus:** `/people/settings label`
- **What's wrong:** Sidebar exposes stub status to end users.
- **Target pattern:** Hide unfinished routes or label Settings only

### UX-116 — Many registers lack mobile card alternative

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `Wide data tables`
- **What's wrong:** data-table with many columns relies on overflow-x-auto; leave/travel ok on desktop, poor on phone vs card lists on approvals.
- **Target pattern:** Responsive card rows below md breakpoint

### UX-117 — Sidebar closes on main click always

- **Severity:** P2
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `AppShell sidebar`
- **What's wrong:** main onClick={closeSidebar} — on desktop may close unexpectedly depending on state; mobile overlay OK.
- **Target pattern:** Close only when mobile overlay open

### UX-118 — Organogram canvas not mobile-optimized

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `organogram`
- **Route / locus:** `/organogram`
- **What's wrong:** Fixed NODE_W layout; pinch/pan UX unclear vs people stub.
- **Target pattern:** Touch pan/zoom + simplified mobile list

### UX-119 — Assets action btn-sm dense for touch

- **Severity:** P2
- **Category:** Mobile / responsive breakpoints
- **Module:** `assets`
- **Route / locus:** `Hit targets btn-sm`
- **What's wrong:** Disposal/revaluation action rows use btn-sm — below 44px guidance.
- **Target pattern:** min touch target on mobile

### UX-120 — Very few page.tsx files set aria-label

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `aria-label scarcity on pages`
- **What's wrong:** Icon-only buttons and filter tabs often lack accessible names; PageBreadcrumbs is a good exception.
- **Target pattern:** Audit icon buttons; add aria-labels

### UX-121 — Custom modals inconsistently expose dialog semantics

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Modals role=dialog`
- **What's wrong:** ConfirmDialog may be fine; many page-local fixed inset-0 overlays lack role/aria-modal/focus trap.
- **Target pattern:** Shared Dialog with a11y built-in

### UX-122 — People/audit stub nav links are underline-only

- **Severity:** P2
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `people`
- **Route / locus:** `Underline-only links on stubs`
- **What's wrong:** Low affordance vs buttons; possible contrast issues on neutral-500.
- **Target pattern:** btn-secondary or link-primary pattern

### UX-123 — Reject without prompting for reason hurts clarity

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `approvals`
- **Route / locus:** `/approvals/inbox reject`
- **What's wrong:** Also an a11y/UX issue: irreversible action without confirmation dialog.
- **Target pattern:** ConfirmDialog + required reason field

### UX-124 — globals force cursor:pointer on every label[for]

- **Severity:** P2
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Cursor pointer on all labels`
- **What's wrong:** May imply clickability on non-interactive labeled text groupings.
- **Target pattern:** Limit to interactive labels

### UX-125 — Different page titles for overlapping jobs

- **Severity:** P1
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `approvals`
- **Route / locus:** `Pending Approvals vs My Approvals`
- **What's wrong:** 'Pending Approvals' vs 'My Approvals' vs nav 'My Approvals Inbox'.
- **Target pattern:** One product name

### UX-126 — Error copy inconsistent

- **Severity:** P2
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `platform`
- **Route / locus:** `Failed to load… message variants`
- **What's wrong:** 'Failed to load X.', 'Unable to load.', 'Could not…', 'You do not have access' — tone varies.
- **Target pattern:** Microcopy guide + shared strings

### UX-127 — Engineering 'stubs' language in UI

- **Severity:** P1
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `people`
- **Route / locus:** `/people/settings nav`
- **What's wrong:** Visible to users in sidebar and hub link list.
- **Target pattern:** Remove jargon

### UX-128 — Ellipsis character inconsistent

- **Severity:** P2
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `platform`
- **Route / locus:** `Saving… vs Saving... ellipsis`
- **What's wrong:** Some UI uses … others ...
- **Target pattern:** Prefer … unicode consistently

### UX-129 — Short vs long returned labels

- **Severity:** P1
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `leave`
- **Route / locus:** `Leave status 'Returned' vs 'Returned for Correction'`
- **What's wrong:** List uses Returned; detail/travel uses Returned for Correction.
- **Target pattern:** Shared label

### UX-130 — Three document panels: DocumentsPanel, GenericDocumentsPanel, RiskDocumentsPanel

- **Severity:** P1
- **Category:** Attachment / document upload UX
- **Module:** `platform`
- **Route / locus:** `DocumentsPanel variants`
- **What's wrong:** Procurement/profile use DocumentsPanel; risk has specialized panel; upload UX not unified.
- **Target pattern:** One DocumentsPanel with module adapters

### UX-131 — PIF documents section separate from DocumentsPanel

- **Severity:** P2
- **Category:** Attachment / document upload UX
- **Module:** `pif`
- **Route / locus:** `/pif DocumentsSection`
- **What's wrong:** Edit flow uses custom DocumentsSection — another upload pattern.
- **Target pattern:** Reuse GenericDocumentsPanel

### UX-132 — Travel attachments UX embedded in detail page

- **Severity:** P1
- **Category:** Attachment / document upload UX
- **Module:** `travel`
- **Route / locus:** `Travel TRAVEL_DOCUMENT_TYPES inline`
- **What's wrong:** Not using shared DocumentsPanel used by procurement.
- **Target pattern:** DocumentsPanel with travel types

### UX-133 — Dual approval inboxes with different capabilities

- **Severity:** P0
- **Category:** Approval / inbox patterns
- **Module:** `approvals`
- **Route / locus:** `/approvals and /approvals/inbox`
- **What's wrong:** Card approve/reject+reason vs task tabs with silent reject; legacy pending fallback in inbox awaiting tab.
- **Target pattern:** Merge into one inbox; keep reason modal

### UX-134 — Per-module approval queues duplicate central Approvals

- **Severity:** P1
- **Category:** Approval / inbox patterns
- **Module:** `platform`
- **Route / locus:** `Module queue pages vs central inbox`
- **What's wrong:** travel/queues/*, leave certify, salary-advances queues, procurement intake — same 'act on item' job, different tables.
- **Target pattern:** Deep-link from central inbox; module queues as filtered views of same row UI

### UX-135 — Return for correction modal not universal

- **Severity:** P2
- **Category:** Approval / inbox patterns
- **Module:** `workflow`
- **Route / locus:** `ReturnModal only some modules`
- **What's wrong:** ReturnModal used on travel; leave has own flows — inconsistent return UX.
- **Target pattern:** Shared ReturnModal on all returnable workflows

### UX-136 — PrintButton only on certificate/detail subset

- **Severity:** P1
- **Category:** Print/export affordances
- **Module:** `platform`
- **Route / locus:** `PrintButton adoption`
- **What's wrong:** travel/leave/imprest/advances/procurement certificates — many printable registers lack print.
- **Target pattern:** PrintButton on registers that have PDF/certificate APIs

### UX-137 — exportToCsv helper vs ad-hoc Blob download

- **Severity:** P1
- **Category:** Print/export affordances
- **Module:** `platform`
- **Route / locus:** `CSV export patterns`
- **What's wrong:** Leave/imprest use exportToCsv; assets/reports builds CSV manually; inconsistent button labels (Export vs Download CSV).
- **Target pattern:** Shared ExportMenu (CSV/PDF)

### UX-138 — Dedicated print route separate from PrintButton pattern

- **Severity:** P2
- **Category:** Print/export affordances
- **Module:** `assets`
- **Route / locus:** `/assets/print`
- **What's wrong:** Another print entry style.
- **Target pattern:** Align with PrintButton

### UX-139 — Create flows: Stepper+FormSection (leave/pif) vs travel wizard vs bare forms

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Create request wizards`
- **What's wrong:** Leave/PIF are reference quality; travel/imprest partial; assets/disposal inline form; people create is stub.
- **Target pattern:** Wizard template: Stepper + FormSection + ModulePageHeader

### UX-140 — useToast vs local setToast state

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Toast systems`
- **What's wrong:** ~39 pages useToast; ~43 use local toast state/setTimeout — different positions/durations.
- **Target pattern:** Only useToast provider

### UX-141 — Design-system Input and Select have zero imports

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Input/Select components unused`
- **What's wrong:** Dead components while pages use form-input / raw <select>.
- **Target pattern:** Adopt or remove

### UX-142 — Fleet hub mixes tabs + inline create forms

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `fleet`
- **Route / locus:** `/fleet`
- **What's wrong:** Not RegisterShell; create driver/booking embedded — unlike travel missions polish.
- **Target pattern:** RegisterShell + create drawers

### UX-143 — SAAM home is a large custom dashboard

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `saam`
- **Route / locus:** `/saam`
- **What's wrong:** Parallel to profile/signature and people signatures with purple module chips.
- **Target pattern:** Align with ModulePageHeader + FormSection cards

### UX-144 — Letterhead settings heavy inline styles count

- **Severity:** P2
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `correspondence`
- **Route / locus:** `/correspondence/letterhead`
- **What's wrong:** Large bespoke preview/editor vs admin/settings forms.
- **Target pattern:** FormSection + shared settings layout

### UX-145 — Workplan uses unique color-coded event system + purple milestones

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `workplan`
- **Route / locus:** `/workplan`
- **What's wrong:** Visual language distinct from assignments calendar.
- **Target pattern:** Shared calendar/event chip system

### UX-146 — Many assignment queue routes with AssignmentFilteredList vs one-off pages

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `assignments`
- **Route / locus:** `Assignments lists`
- **What's wrong:** Some use shared filtered list; others bespoke — density varies.
- **Target pattern:** All queues via AssignmentFilteredList + RegisterShell

### UX-147 — People directory ships stub/JSON UI in production nav

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/directory`
- **What's wrong:** /people/directory is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-148 — People org-chart ships stub/JSON UI in production nav

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/org-chart`
- **What's wrong:** /people/org-chart is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-149 — People units ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/units`
- **What's wrong:** /people/units is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-150 — People positions ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/positions`
- **What's wrong:** /people/positions is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-151 — People assignments ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/assignments`
- **What's wrong:** /people/assignments is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-152 — People reporting ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/reporting`
- **What's wrong:** /people/reporting is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-153 — People job-descriptions ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/job-descriptions`
- **What's wrong:** /people/job-descriptions is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-154 — People authority ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/authority`
- **What's wrong:** /people/authority is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-155 — People acting ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/acting`
- **What's wrong:** /people/acting is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-156 — People delegations ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/delegations`
- **What's wrong:** /people/delegations is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-157 — People signatures ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/signatures`
- **What's wrong:** /people/signatures is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-158 — People onboarding ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/onboarding`
- **What's wrong:** /people/onboarding is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-159 — People offboarding ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/offboarding`
- **What's wrong:** /people/offboarding is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-160 — People access-reviews ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/access-reviews`
- **What's wrong:** /people/access-reviews is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-161 — People recertification ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/recertification`
- **What's wrong:** /people/recertification is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-162 — People sod ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/sod`
- **What's wrong:** /people/sod is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-163 — People scenarios ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/scenarios`
- **What's wrong:** /people/scenarios is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-164 — People m365 ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/m365`
- **What's wrong:** /people/m365 is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-165 — People esign ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/esign`
- **What's wrong:** /people/esign is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-166 — People succession ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/succession`
- **What's wrong:** /people/succession is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-167 — People skills ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/skills`
- **What's wrong:** /people/skills is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-168 — People privilege-alerts ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/privilege-alerts`
- **What's wrong:** /people/privilege-alerts is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-169 — People search ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/search`
- **What's wrong:** /people/search is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-170 — People ai ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/ai`
- **What's wrong:** /people/ai is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-171 — People reports ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/reports`
- **What's wrong:** /people/reports is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-172 — People my-profile ships stub/JSON UI in production nav

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/my-profile`
- **What's wrong:** /people/my-profile is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-173 — People my-delegations ships stub/JSON UI in production nav

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/my-delegations`
- **What's wrong:** /people/my-delegations is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-174 — People my-signature ships stub/JSON UI in production nav

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `people`
- **Route / locus:** `/people/my-signature`
- **What's wrong:** /people/my-signature is linked from Sidebar People & Authority but presents JSON.stringify or minimal stub chrome instead of operational register/detail UI (contrast /leave, /travel).
- **Target pattern:** Ship real UI or remove from nav until ready; use ModulePageHeader + RegisterShell

### UX-175 — Audit universe not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/universe`
- **What's wrong:** /audit/universe uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (RegisterShell partially adopted on universe/plans but still not full polish).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-176 — Audit plans not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/plans`
- **What's wrong:** /audit/plans uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (RegisterShell partially adopted on universe/plans but still not full polish).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-177 — Audit engagements not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/engagements`
- **What's wrong:** /audit/engagements uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-178 — Audit findings not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/findings`
- **What's wrong:** /audit/findings uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-179 — Audit corrective-actions not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/corrective-actions`
- **What's wrong:** /audit/corrective-actions uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-180 — Audit external not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/external`
- **What's wrong:** /audit/external uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-181 — Audit campaigns not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/campaigns`
- **What's wrong:** /audit/campaigns uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-182 — Audit appointments not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/appointments`
- **What's wrong:** /audit/appointments uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-183 — Audit resources not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/resources`
- **What's wrong:** /audit/resources uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-184 — Audit qa not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/qa`
- **What's wrong:** /audit/qa uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-185 — Audit templates not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/templates`
- **What's wrong:** /audit/templates uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-186 — Audit governance-packs not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/governance-packs`
- **What's wrong:** /audit/governance-packs uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-187 — Audit analytics not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/analytics`
- **What's wrong:** /audit/analytics uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-188 — Audit ai not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/ai`
- **What's wrong:** /audit/ai uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-189 — Audit settings not on Leave/PIF-level page chrome

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `audit`
- **Route / locus:** `/audit/settings`
- **What's wrong:** /audit/settings uses text-2xl / underline hub links / minimal tables rather than ModulePageHeader + RegisterShell (thin stub-level UI).
- **Target pattern:** ModulePageHeader + RegisterShell + EmptyState

### UX-190 — Access simulator uses tooling aesthetic (CSS vars, p-6)

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/access/simulator`
- **What's wrong:** /admin/access/simulator matches access home's parallel design tokens, not admin hub card system or ModulePageHeader.
- **Target pattern:** Admin ModulePageHeader + card/table patterns

### UX-191 — Access explorer uses tooling aesthetic (CSS vars, p-6)

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/access/explorer`
- **What's wrong:** /admin/access/explorer matches access home's parallel design tokens, not admin hub card system or ModulePageHeader.
- **Target pattern:** Admin ModulePageHeader + card/table patterns

### UX-192 — Access requests uses tooling aesthetic (CSS vars, p-6)

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/access/requests`
- **What's wrong:** /admin/access/requests matches access home's parallel design tokens, not admin hub card system or ModulePageHeader.
- **Target pattern:** Admin ModulePageHeader + card/table patterns

### UX-193 — Access reviews uses tooling aesthetic (CSS vars, p-6)

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/access/reviews`
- **What's wrong:** /admin/access/reviews matches access home's parallel design tokens, not admin hub card system or ModulePageHeader.
- **Target pattern:** Admin ModulePageHeader + card/table patterns

### UX-194 — Access governance uses tooling aesthetic (CSS vars, p-6)

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/access/governance`
- **What's wrong:** /admin/access/governance matches access home's parallel design tokens, not admin hub card system or ModulePageHeader.
- **Target pattern:** Admin ModulePageHeader + card/table patterns

### UX-195 — Depreciation page mixes table-wrap with complex custom UI

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `assets`
- **Route / locus:** `/assets/depreciation`
- **What's wrong:** Uses table-wrap and window.confirm; not ModulePageHeader.
- **Target pattern:** ModulePageHeader + ConfirmDialog + data-table card

### UX-196 — Transfers CTA uses raw <a href> full navigation

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `assets`
- **Route / locus:** `/assets/transfers`
- **What's wrong:** <a href="/assets/movement/new" className="btn btn-primary"> instead of next/link.
- **Target pattern:** Link + Button/btn-primary

### UX-197 — Compliance page uses legacy btn btn-secondary

- **Severity:** P2
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `weekly-summaries`
- **Route / locus:** `/weekly-summaries/compliance`
- **What's wrong:** Partial legacy button classes on otherwise newer module.
- **Target pattern:** btn-secondary

### UX-198 — Vendors page uses EmptyState but not RegisterShell

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `procurement`
- **Route / locus:** `/procurement/vendors`
- **What's wrong:** Partial adoption — empty good, shell missing.
- **Target pattern:** Full RegisterShell

### UX-199 — Leave and PIF details are gold standard but not templated for reuse

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `leave`
- **Route / locus:** `/leave/[id] vs /pif/[id]`
- **What's wrong:** Patterns exist only as copy-paste; no shared DetailShell extracting header/banner/tabs.
- **Target pattern:** Extract WorkflowDetailShell from leave/pif

### UX-200 — Only some nav labels have i18nKey

- **Severity:** P2
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `platform`
- **Route / locus:** `Sidebar i18nKey coverage`
- **What's wrong:** Critical shell labels translated; most module children English-only — FR/PT incomplete in sidebar.
- **Target pattern:** i18n keys for all nav labels

### UX-201 — Many lists fetch 100 then client-paginate

- **Severity:** P2
- **Category:** Search / filters UX
- **Module:** `platform`
- **Route / locus:** `Client per_page:100 then slice`
- **What's wrong:** Leave/imprest pattern — pagination UI implies server pages but is client slice.
- **Target pattern:** True server pagination via RegisterShell

### UX-202 — Errors swallowed with empty catch

- **Severity:** P2
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `correspondence`
- **Route / locus:** `/correspondence/master-register`
- **What's wrong:** .catch(() => {}) leaves user with empty list indistinguishable from no data.
- **Target pattern:** Surface error + EmptyState

### UX-203 — Disposal create is inline expandable form not FormSection

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `assets`
- **Route / locus:** `/assets/disposal create form`
- **What's wrong:** Mixed with table actions on same page — dense and easy to mis-click approve.
- **Target pattern:** FormSection drawer + ConfirmDialog

### UX-204 — Roles page invents 20+ color names (fuchsia, lime, stone…)

- **Severity:** P2
- **Category:** Status badges / colors / semantics
- **Module:** `admin`
- **Route / locus:** `admin/roles MODULE_GROUPS colors`
- **What's wrong:** Rainbow module headers not aligned with operational module accents.
- **Target pattern:** Reuse moduleMeta accents

### UX-205 — User admin uses DocumentsPanel; profile uses same — OK but password section mixed

- **Severity:** P2
- **Category:** Attachment / document upload UX
- **Module:** `admin`
- **Route / locus:** `/admin/users/[id]`
- **What's wrong:** Profile page mixes documents + password in section tabs; admin user page different IA.
- **Target pattern:** Shared profile sections component

### UX-206 — Reports hub export UX separate from module export buttons

- **Severity:** P2
- **Category:** Print/export affordances
- **Module:** `reports`
- **Route / locus:** `/reports`
- **What's wrong:** Users learn different export entry points per module.
- **Target pattern:** Consistent Export control placement (header actions)

### UX-207 — Approvals cards OK on mobile but inbox tabs wrap densely

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `approvals`
- **Route / locus:** `/approvals card layout`
- **What's wrong:** Six inbox tabs on small screens without scroll-snap or select fallback.
- **Target pattern:** Scrollable tab list or select on sm

### UX-208 — Stock page title 'Consumables / Stock' slash style unique

- **Severity:** P2
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `stock`
- **Route / locus:** `Consumables / Stock title`
- **What's wrong:** Other modules don't dual-name in H1.
- **Target pattern:** Single product name

### UX-209 — Finance domain split across three top-level experiences

- **Severity:** P1
- **Category:** Dashboard widgets / badge counts
- **Module:** `finance`
- **Route / locus:** `/finance vs /budget vs /salary-advances`
- **What's wrong:** Finance children include Budget; Salary Advances is separate sidebar root — cognitive split.
- **Target pattern:** Clear IA: Finance parent with Budget & Advances children only

### UX-210 — Timesheet entry: full pages + slide-over

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `hr`
- **Route / locus:** `/hr/timesheets vs QuickEntrySlideOver`
- **What's wrong:** Multiple timesheet routes and QuickEntrySlideOver — overlapping entry jobs.
- **Target pattern:** One entry pattern documented

### UX-211 — Sidebar scrollbar fully hidden

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Sidebar scrollbar hidden`
- **What's wrong:** scrollbar-width:none — keyboard users OK but mouse users lack visual scroll affordance on long Travel nav.
- **Target pattern:** Thin scrollbar on hover

### UX-212 — Login demo System Admin tile uses purple

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `auth`
- **Route / locus:** `login demo credentials purple`
- **What's wrong:** auth/login DEMO_CREDENTIALS color text-purple-600 — reinforces purple=admin motif.
- **Target pattern:** Primary/neutral accents

### UX-213 — Setup uses FormSection+Stepper but outside AppShell patterns

- **Severity:** P2
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `setup`
- **Route / locus:** `/setup`
- **What's wrong:** Acceptable for setup; still a second visual island.
- **Target pattern:** Document as intentional exception

### UX-214 — Risk register on RegisterShell but create/detail diverge

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `risk`
- **Route / locus:** `/risk`
- **What's wrong:** Good register; risk/create and risk/[id] still bespoke section icons with purple.
- **Target pattern:** FormSection + ModulePageHeader on create/detail

### UX-215 — Correspondence detail chrome vs leave detail

- **Severity:** P2
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `correspondence`
- **Route / locus:** `/correspondence/[id]`
- **What's wrong:** Does not use WorkflowStatusBanner/ModulePageHeader pattern.
- **Target pattern:** Shared detail shell where workflow applies

### UX-216 — Supplier portal mixed into staff AppShell nav

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `supplier`
- **Route / locus:** `Supplier Portal in main sidebar`
- **What's wrong:** External-party portal IA inside same shell as staff modules — visual/IA confusion.
- **Target pattern:** Separate supplier shell or clearer section divider

### UX-217 — Checkbox component exists; bulk selection uses custom RowCheckbox

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `@/components/ui/Checkbox`
- **What's wrong:** Parallel checkbox implementations.
- **Target pattern:** Unify on one Checkbox

### UX-218 — Travel detail status chips are custom bordered pills

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `travel`
- **Route / locus:** `Travel statusConfig uses bordered chips not .badge-*`
- **What's wrong:** Leave register uses badge-success etc.; travel detail uses text-*-700 bg-*-50 border-* — third badge style.
- **Target pattern:** Badge component / .badge-* classes

### UX-219 — Offline queue messaging via alert-success/error

- **Severity:** P2
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `stock`
- **Route / locus:** `/stock/scan offline queue`
- **What's wrong:** Unique offline UX not reused; alerts legacy.
- **Target pattern:** Toast + dedicated OfflineQueue panel

### UX-220 — Workflow designer/simulate/ai pages feel separate product

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/workflows/*`
- **What's wrong:** Different density and headers from admin hub tiles.
- **Target pattern:** ModulePageHeader under Admin › Workflows

### UX-221 — Employee identity surfaces: profile, people, hr/files

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `hr`
- **Route / locus:** `/profile vs /people/my-profile vs HR files`
- **What's wrong:** Three places for person-centric data with different UI maturity.
- **Target pattern:** Canonical employee 360 with tabs

### UX-222 — formatDateRelative used sparsely

- **Severity:** P2
- **Category:** Date/time/currency/number formatting
- **Module:** `platform`
- **Route / locus:** `Relative vs absolute dates`
- **What's wrong:** Travel detail mixes relative and absolute; lists usually absolute only.
- **Target pattern:** Rules: lists absolute; activity feeds relative

### UX-223 — Approvals filter tabs only render when requests.length > 0

- **Severity:** P1
- **Category:** Search / filters UX
- **Module:** `approvals`
- **Route / locus:** `Filter tabs hide when empty`
- **What's wrong:** Empty state can't switch filters; other modules always show tabs.
- **Target pattern:** Always show filters; empty inside

### UX-224 — Danger actions often styled as primary or plain btn-sm

- **Severity:** P2
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `Ghost/danger variants rarely used`
- **What's wrong:** Button.danger exists but unused; destructive not visually distinct.
- **Target pattern:** danger variant for destroy/reject

### UX-225 — Notifications page custom layout vs ModulePageHeader

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `notifications`
- **Route / locus:** `/notifications`
- **What's wrong:** Uses inline styles/patterns and workplan deep <a href>.
- **Target pattern:** ModulePageHeader + Link

### UX-226 — Global search desktop-oriented

- **Severity:** P2
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `Header GlobalSearch`
- **What's wrong:** Compact header search; mobile discovery of GlobalSearch may be weak vs page filters.
- **Target pattern:** Mobile search entry in header menu

### UX-227 — Feature-only explanation only on some pages

- **Severity:** P1
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `my-work`
- **Route / locus:** `Feature-only messaging`
- **What's wrong:** procurement-evaluations explains hidden siblings; other feature-only routes may not.
- **Target pattern:** Shared FeatureOnlyBanner

### UX-228 — Travel register vs filtered dashboard lists

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `travel`
- **Route / locus:** `/travel/register vs /travel?scope=mine`
- **What's wrong:** RegisterShell on /travel/register; dashboard views use different list UI for 'my requests'.
- **Target pattern:** One list component with query filters

### UX-229 — Certificate pages share PrintButton but layout still per-module

- **Severity:** P2
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Certificate pages`
- **What's wrong:** leave/travel/imprest/procurement certificates — good PrintButton, divergent chrome.
- **Target pattern:** Shared CertificateLayout

### UX-230 — btn-primary focus rings differ from Button component rings

- **Severity:** P2
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `focus:ring inconsistency`
- **What's wrong:** CSS btn-primary focus:ring-primary/50; Button focus:ring-2 ring-offset-1 — keyboard focus look differs.
- **Target pattern:** Unify focus styles

### UX-231 — Services category forced to purple palette

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `procurement`
- **Route / locus:** `Procurement category purple chips`
- **What's wrong:** categoryColors.services uses purple — module-level purple dependency.
- **Target pattern:** Brand-safe category tokens

### UX-232 — Admin notification templates vs user notifications

- **Severity:** P2
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/notifications vs /notifications`
- **What's wrong:** Similar naming; different UI generations (vars vs cards).
- **Target pattern:** Clear 'Templates' naming + admin chrome

### UX-233 — Advance create still on legacy finance path

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `finance`
- **Route / locus:** `/finance/advances/create`
- **What's wrong:** Parallel to salary-advances/create with different form polish.
- **Target pattern:** Redirect to salary-advances/create

### UX-234 — Assignment detail uses custom layout vs workflow modules

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `assignments`
- **Route / locus:** `/assignments/[id]`
- **What's wrong:** Inline styles/sections; not WorkflowStatusBanner pattern.
- **Target pattern:** Detail shell aligned with leave where status workflow exists

### UX-235 — Some API catches set generic errors; some empty

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `Silent permission failures`
- **What's wrong:** Users can't tell 403 vs 500 vs empty — especially people/audit stubs.
- **Target pattern:** Map HTTP status to specific empty/error states

### UX-236 — Nav label 'Alerts & Notifications' route /notifications

- **Severity:** P2
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `notifications`
- **Route / locus:** `Alerts & Notifications vs Notifications naming`
- **What's wrong:** Naming mismatch with page title possibilities.
- **Target pattern:** Align label and H1

### UX-237 — Filter cards tighter than content cards

- **Severity:** P2
- **Category:** Spacing / typography / density
- **Module:** `platform`
- **Route / locus:** `card padding p-3 filters vs p-5 sections`
- **What's wrong:** RegisterShell filter card p-3; FormSection p-5/p-6 — OK if intentional but many pages invent other paddings.
- **Target pattern:** Document density scale

### UX-238 — Resolutions page is a mega-custom surface

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `governance`
- **Route / locus:** `/governance/resolutions`
- **What's wrong:** Large bespoke UI with mixed <a> downloads — far from RegisterShell.
- **Target pattern:** Break into register + detail using shared primitives

### UX-239 — Material symbols default FILL 0 everywhere

- **Severity:** P2
- **Category:** Icons / illustration inconsistency
- **Module:** `platform`
- **Route / locus:** `FILL variation on icons`
- **What's wrong:** Active nav might benefit from FILL 1; currently uniform outlined.
- **Target pattern:** Filled icons for active nav states

### UX-240 — Export selected requires bulk bar; Export all sometimes separate

- **Severity:** P1
- **Category:** Print/export affordances
- **Module:** `platform`
- **Route / locus:** `Bulk export only when BulkSelectionBar present`
- **What's wrong:** Users don't get consistent export entry.
- **Target pattern:** Always expose Export in register actions

### UX-241 — HR personnel documents separate from profile DocumentsPanel

- **Severity:** P1
- **Category:** Attachment / document upload UX
- **Module:** `hr`
- **Route / locus:** `/hr/files/[id]/documents`
- **What's wrong:** Another upload/list pattern for documents.
- **Target pattern:** Shared documents UX

### UX-242 — Inbox sends idempotency_key; /approvals approve path may not

- **Severity:** P2
- **Category:** Approval / inbox patterns
- **Module:** `approvals`
- **Route / locus:** `Idempotency keys only in inbox decide path`
- **What's wrong:** Behavioral inconsistency under double-click.
- **Target pattern:** Idempotent approve/reject everywhere

### UX-243 — M&E module UI maturity uneven

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `mande`
- **Route / locus:** `/mande/*`
- **What's wrong:** Mix of custom dashboards and thinner pages; not on ModulePageHeader program.
- **Target pattern:** Apply Leave/PIF chrome baseline

### UX-244 — SRHR module visual language separate

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `srhr`
- **Route / locus:** `/srhr/*`
- **What's wrong:** Parliaments/deployments/reports use underline links and custom details.
- **Target pattern:** ModulePageHeader + RegisterShell baseline

### UX-245 — Admin hub is card grid gold-standard for hubs but unused elsewhere

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `admin`
- **Route / locus:** `/admin page hub`
- **What's wrong:** People/audit/my-work hubs do not reuse admin hub card component pattern.
- **Target pattern:** Extract HubCardGrid shared component

### UX-246 — Primary badge: CSS uses bg-primary/10; component uses bg-blue-100

- **Severity:** P2
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `badge-primary vs Badge primary`
- **What's wrong:** Primary blue token vs Tailwind blue-100 mismatch.
- **Target pattern:** Both use bg-primary/10 text-primary

### UX-247 — body bg-surface-muted and :root --surface both define canvas

- **Severity:** P2
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `platform`
- **Route / locus:** `surface-muted vs --surface`
- **What's wrong:** Possible token duplication/confusion.
- **Target pattern:** Single canvas token

### UX-248 — Leave settings uses FormSection (good) but most module settings don't

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `leave`
- **Route / locus:** `/leave/settings`
- **What's wrong:** travel/settings, procurement/settings, salary-advances/settings diverge.
- **Target pattern:** FormSection settings template

### UX-249 — Magic per_page 50 vs 100 across registers

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `platform`
- **Route / locus:** `per_page hardcoding`
- **What's wrong:** Inconsistent default page sizes.
- **Target pattern:** DEFAULT_PAGE_SIZE everywhere

### UX-250 — /dashboard lives under web/app/dashboard not (app)

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `dashboard`
- **Route / locus:** `Dashboard route outside (app) group`
- **What's wrong:** Works via shell but route group inconsistency with other modules.
- **Target pattern:** Move under (app) for consistency

### UX-251 — web/app/approval vs /approvals

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `approvals`
- **Route / locus:** `/approval legacy route`
- **What's wrong:** Legacy approval path may still exist alongside new approvals — dual entry.
- **Target pattern:** Redirect legacy → /approvals/inbox

### UX-252 — Some CTAs are <Link className="btn-secondary">; others <button>

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `Link styled as btn-secondary inconsistently`
- **What's wrong:** OK pattern but assets use btn btn-secondary differently.
- **Target pattern:** Document Link-as-button classes

### UX-253 — SectionIcon redefined inside leave and travel detail pages

- **Severity:** P2
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `platform`
- **Route / locus:** `SectionIcon local duplicates`
- **What's wrong:** Copy-pasted helper instead of shared component (FormSection already has icon slot).
- **Target pattern:** Shared SectionIcon or FormSection

### UX-254 — Most data tables lack <caption> or th scope

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Tables without caption/scope`
- **What's wrong:** Screen reader context weak on wide registers.
- **Target pattern:** caption + scope=col

### UX-255 — Bulk bar + filters may crowd mobile filter card

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `BulkSelectionBar on small screens`
- **What's wrong:** RegisterShell stacks but actions wrap tightly.
- **Target pattern:** Test and add sm-specific layout

### UX-256 — Queue naming style differs

- **Severity:** P2
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `leave`
- **Route / locus:** `Recommend Inbox vs Certification Queue naming`
- **What's wrong:** 'Inbox' vs 'Queue' vs 'Pending My Approval' across modules.
- **Target pattern:** Glossary: Queue for role inboxes

### UX-257 — Ledger surfaces in admin and analytics

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/ledger vs /analytics/ledger`
- **What's wrong:** Overlapping ledger UX in two places.
- **Target pattern:** Single ledger IA

### UX-258 — Multiple calendars: leave, travel, assignments, mande, admin

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Calendar pages`
- **What's wrong:** Each calendar UI invented separately.
- **Target pattern:** Shared CalendarShell

### UX-259 — Some lists sync filters to URL (finance advances); leave uses local state only

- **Severity:** P2
- **Category:** Search / filters UX
- **Module:** `platform`
- **Route / locus:** `URL query filters inconsistent`
- **What's wrong:** Shareable filtered views don't work on leave.
- **Target pattern:** nuqs/searchParams pattern for registers

### UX-260 — SA status map has 12+ states with badge-primary overloaded

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `finance`
- **Route / locus:** `Salary advance status explosion`
- **What's wrong:** finance_certified, paid, recovery_scheduled all badge-primary — weak discrimination.
- **Target pattern:** Distinct badge variants or icons per lifecycle phase

### UX-261 — Upload affordances differ by panel

- **Severity:** P2
- **Category:** Attachment / document upload UX
- **Module:** `platform`
- **Route / locus:** `Drag-drop vs file input`
- **What's wrong:** Some panels button-only; richer UIs elsewhere.
- **Target pattern:** Shared dropzone

### UX-262 — Utilisation report page export unclear

- **Severity:** P2
- **Category:** Print/export affordances
- **Module:** `fleet`
- **Route / locus:** `/fleet utilisation`
- **What's wrong:** Report-like page without standard Export control.
- **Target pattern:** Header Export action

### UX-263 — People pages use text-xs uppercase tracking-wide eyebrows

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `people`
- **Route / locus:** `Uppercase eyebrow labels on people stubs`
- **What's wrong:** Pattern not used on Leave/PIF (which use breadcrumbs) — third header style.
- **Target pattern:** Replace eyebrows with PageBreadcrumbs

### UX-264 — Asterisk / required marking inconsistent

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `Required field indicators`
- **What's wrong:** Some forms mark required; many don't.
- **Target pattern:** FormField required prop + *

### UX-265 — Some pages pass empty prop; others render empty inside children

- **Severity:** P2
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `RegisterShell empty vs children empty`
- **What's wrong:** Loading/empty exclusivity bugs possible.
- **Target pattern:** Always use RegisterShell empty prop

### UX-266 — Assignments children extremely long

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `assignments`
- **Route / locus:** `Assignments nav depth`
- **What's wrong:** 15+ children including Unassigned, Pending, Overdue, Blocked — vs Leave's 8.
- **Target pattern:** Group into Dashboard / Queues / Reports

### UX-267 — CSS variable pages may not map to dark tokens

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `admin`
- **Route / locus:** `Dark mode on var(--*) pages`
- **What's wrong:** var(--foreground) pages assume tokens ThemeProvider may not set the same as --dk-*.
- **Target pattern:** Verify ThemeProvider CSS vars for access pages

### UX-268 — Acknowledge uses btn-sm btn-primary without confirm

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `assets`
- **Route / locus:** `/assets/mine acknowledge`
- **What's wrong:** Custody acknowledge is significant yet one-click.
- **Target pattern:** ConfirmDialog

### UX-269 — Activity list custom vs notifications list

- **Severity:** P2
- **Category:** Tables vs cards vs lists
- **Module:** `dashboard`
- **Route / locus:** `Dashboard recent activity list`
- **What's wrong:** Two activity metaphors.
- **Target pattern:** Shared ActivityRow

### UX-270 — No shared Tabs component

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `platform`
- **Route / locus:** `Tabs implementation ad-hoc`
- **What's wrong:** Profile sections, fleet tabs, audit views, inbox tabs all custom.
- **Target pattern:** Shared Tabs primitive

### UX-271 — Budget control module vs finance budgets

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `budget`
- **Route / locus:** `/budget/* vs /finance/budget`
- **What's wrong:** Two budget UIs under Finance nav children.
- **Target pattern:** Consolidate naming and chrome

### UX-272 — Some statuses color-only without text/icon

- **Severity:** P2
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Color-only status in places`
- **What's wrong:** Badge text usually OK; KPI dots may be color-only.
- **Target pattern:** Always text + color

### UX-273 — Centered max width fine; horizontal padding double issue worse on mobile

- **Severity:** P2
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `max-w-6xl mx-auto on mobile`
- **What's wrong:** Double p-6 eats small screens.
- **Target pattern:** Fix double padding first

### UX-274 — Leave/PIF copy is institutional; access/people stubs are developer tone

- **Severity:** P1
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `platform`
- **Route / locus:** `Institutional vs tooling tone`
- **What's wrong:** 'backend is authoritative', 'Phase 2-3 stubs', 'UI draft'.
- **Target pattern:** User-facing prose only in UI

### UX-275 — Governance admin vs operational governance

- **Severity:** P2
- **Category:** Admin vs operational module visual split
- **Module:** `governance`
- **Route / locus:** `/admin/governance vs /governance`
- **What's wrong:** Similar names, different UI generations.
- **Target pattern:** Disambiguate labels (Platform governance vs Plenary)

### UX-276 — Stock submodules (issues, transfers, stocktakes…) inconsistent shells

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `stock`
- **Route / locus:** `/stock/* subregisters`
- **What's wrong:** Parent uses custom list; scan uses legacy; others vary.
- **Target pattern:** RegisterShell family for all stock registers

### UX-277 — Procurement create not on FormSection/Stepper baseline

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `procurement`
- **Route / locus:** `/procurement/create`
- **What's wrong:** Diverges from leave/pif create quality bar.
- **Target pattern:** FormSection + Stepper if multi-step

### UX-278 — Terminal states share muted badge

- **Severity:** P2
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `Withdrawn vs cancelled badge both muted`
- **What's wrong:** Hard to distinguish withdrawn/cancelled/draft at a glance on leave.
- **Target pattern:** Distinct muted variants or icons

### UX-279 — Loading dashboard… plain text

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `audit`
- **Route / locus:** `/audit dashboard loading`
- **What's wrong:** No skeleton matching dashboard KPI grid.
- **Target pattern:** KPI skeleton cards

### UX-280 — external-rfq outside (app) shell

- **Severity:** P2
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `procurement`
- **Route / locus:** `External RFQ route`
- **What's wrong:** Intentional for suppliers but another chrome island.
- **Target pattern:** Document as public shell exception

### UX-281 — Analytics export/print inconsistent with reports module

- **Severity:** P1
- **Category:** Print/export affordances
- **Module:** `analytics`
- **Route / locus:** `/analytics`
- **What's wrong:** Two analytics/reporting homes.
- **Target pattern:** Unify Reports & Analytics IA + export

### UX-282 — Balance register verify uses raw anchor for documents

- **Severity:** P1
- **Category:** Attachment / document upload UX
- **Module:** `finance`
- **Route / locus:** `Supporting document links as raw <a target=_blank>`
- **What's wrong:** No DocumentsPanel preview/metadata.
- **Target pattern:** DocumentsPanel or AttachmentLink component

### UX-283 — Approvals card config misses PIF, assignments, salary advances, risk

- **Severity:** P1
- **Category:** Approval / inbox patterns
- **Module:** `approvals`
- **Route / locus:** `MODULE_CONFIG missing modules`
- **What's wrong:** Falls back to generic Request styling.
- **Target pattern:** Complete module meta map

### UX-284 — Module settings under /travel/settings, /leave/settings, /settings/hr, /admin/settings, /people/settings

- **Severity:** P2
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `settings`
- **Route / locus:** `Settings scattered`
- **What's wrong:** No consistent settings IA or chrome.
- **Target pattern:** Settings template + IA map

### UX-285 — Module hubs rarely show where you are in IA

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `Hub pages without breadcrumbs`
- **What's wrong:** Except leave/pif children; hubs jump in cold.
- **Target pattern:** Breadcrumb Module on all hubs

### UX-286 — Create CTA sometimes left in subtitle row, sometimes right actions

- **Severity:** P2
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `Primary CTA placement`
- **What's wrong:** ModulePageHeader actions slot is the pattern; many pages put Link left.
- **Target pattern:** Primary create always in header actions

### UX-287 — User date prefs exist but most pages ignore useFormatDate

- **Severity:** P1
- **Category:** Date/time/currency/number formatting
- **Module:** `platform`
- **Route / locus:** `PrefsProvider date format underused`
- **What's wrong:** imprest uses hook; many peers don't.
- **Target pattern:** Lint rule / shared formatter mandate

### UX-288 — Many filter UIs lack Clear all

- **Severity:** P1
- **Category:** Search / filters UX
- **Module:** `platform`
- **Route / locus:** `Clear filters affordance missing`
- **What's wrong:** RegisterShell doesn't provide clear; pages forget it.
- **Target pattern:** Built-in clear in RegisterShell filters

### UX-289 — No skip-to-main-content link in AppShell

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Skip link absent`
- **What's wrong:** Keyboard users tab through entire sidebar.
- **Target pattern:** Skip link in shell

### UX-290 — Multi-step travel form dense on small screens

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `travel`
- **Route / locus:** `Travel create long wizard on mobile`
- **What's wrong:** Stepper helps but sections still heavy.
- **Target pattern:** One section per step on sm

### UX-291 — Cards use shadow-card; dark mode overrides to --dk-shadow-sm

- **Severity:** P2
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `platform`
- **Route / locus:** `shadow-card token`
- **What's wrong:** OK but legacy table-wrap also shadow-card — mixed elevation language.
- **Target pattern:** Elevation scale documentation

### UX-292 — Admin hub rich icons; People hub none; Audit hub none

- **Severity:** P1
- **Category:** Icons / illustration inconsistency
- **Module:** `admin`
- **Route / locus:** `Admin hub vs People hub iconography`
- **What's wrong:** Hub quality cliff.
- **Target pattern:** Shared HubCard with icon

### UX-293 — Audit dashboard not alone — other stubs dump keys

- **Severity:** P2
- **Category:** Tables vs cards vs lists
- **Module:** `audit`
- **Route / locus:** `KPI Object.entries anti-pattern`
- **What's wrong:** Signals unfinished UI shipped in nav.
- **Target pattern:** Block nav for unfinished or finish UI

### UX-294 — API errors: toast vs field-level vs alert

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `Validation error display`
- **What's wrong:** travel detail apiErrorMessage extracts field errors; many forms only toast.
- **Target pattern:** FormField error + toast summary

### UX-295 — Fixed min height may look sparse in compact density

- **Severity:** P2
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `platform`
- **Route / locus:** `EmptyState min-h-[200px]`
- **What's wrong:** Minor polish.
- **Target pattern:** Density-aware empty min-height

### UX-296 — Sidebar still largely static NAV_ITEMS while /access/navigation exists

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `platform`
- **Route / locus:** `Effective nav vs static NAV_ITEMS`
- **What's wrong:** My Work loads API nav; main sidebar duplicates/conflicts with feature-only model.
- **Target pattern:** Drive sidebar from access navigation API

### UX-297 — Uses btn btn-primary text-sm legacy

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/documents governance buttons`
- **What's wrong:** admin/documents/* mixed with newer access styling.
- **Target pattern:** btn-primary / Button

### UX-298 — TravelQueueTable vs AdvanceQueueTable vs ad-hoc tables

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Queue table components`
- **What's wrong:** Good extraction for some; leave certify invents own.
- **Target pattern:** Generic WorkflowQueueTable

### UX-299 — Filter tabs use filled primary; inbox tabs use same but different radius

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `filter-tab.active white on primary`
- **What's wrong:** filter-tab rounded-full vs inbox rounded-md.
- **Target pattern:** One tab component

### UX-300 — loadPdfLibs on assets page

- **Severity:** P2
- **Category:** Print/export affordances
- **Module:** `assets`
- **Route / locus:** `PDF libs loaded ad-hoc on assets`
- **What's wrong:** Print/PDF path unique to assets.
- **Target pattern:** Shared print/PDF helper with PrintButton

### UX-301 — travel/leave show AuditTimeline; others don't

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `platform`
- **Route / locus:** `AuditTimeline only on some details`
- **What's wrong:** Inconsistent transparency of history.
- **Target pattern:** AuditTimeline on all workflow details

### UX-302 — procurement/vendors/[id] large custom attachment section

- **Severity:** P2
- **Category:** Attachment / document upload UX
- **Module:** `procurement`
- **Route / locus:** `Vendor attachments custom UI`
- **What's wrong:** Alongside DocumentsPanel usage on same module.
- **Target pattern:** DocumentsPanel

### UX-303 — Toast titles vary (Approved, Decision recorded, Action Failed)

- **Severity:** P2
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `platform`
- **Route / locus:** `OK vs Okay vs success toasts`
- **What's wrong:** Casing and grammar inconsistent.
- **Target pattern:** Toast copy guide

### UX-304 — ModulePageHeader supports meta badges but few pages pass status there

- **Severity:** P2
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `meta slot on ModulePageHeader underused`
- **What's wrong:** Status often duplicated below title.
- **Target pattern:** Put status Badge in meta

### UX-305 — PIF register is high quality but isolated

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `pif`
- **Route / locus:** `/pif register as reference`
- **What's wrong:** Should be the template; other modules not migrated after Leave/PIF polish (e71cea6+).
- **Target pattern:** Roll out PIF/Leave register template module-by-module

### UX-306 — NotificationsPanel overlay desktop-first

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `Header notifications panel`
- **What's wrong:** Mobile sheet behavior may differ from approvals mobile.
- **Target pattern:** Full-screen sheet on sm

### UX-307 — badge-muted neutral-100/600 may fail on some surfaces

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Contrast on badge-muted`
- **What's wrong:** Especially dark mode overrides — verify WCAG.
- **Target pattern:** Contrast audit on badges

### UX-308 — Toggle.tsx exists; many settings use checkboxes

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `platform`
- **Route / locus:** `Toggle component usage`
- **What's wrong:** Inconsistent boolean UX.
- **Target pattern:** Toggle for settings booleans

### UX-309 — Recent fix avoided @apply card in table-wrap but consumers remain

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `assets`
- **Route / locus:** `e71cea6 table-wrap bridge still in use`
- **What's wrong:** Assets still depend on bridge — debt not paid.
- **Target pattern:** Migrate assets off table-wrap

### UX-310 — Product feels like two apps: polished Leave/PIF/Travel vs stub People/Audit/Access

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Gold path vs stub path`
- **What's wrong:** Strongest UX inconsistency — users hitting People after Leave experience quality cliff.
- **Target pattern:** Either finish People/Audit UI or hide from production nav

### UX-311 — Organogram is top-level nav item while People also has Organisation Chart

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `organogram`
- **Route / locus:** `Organogram top-level vs People child`
- **What's wrong:** IA duplication in sidebar.
- **Target pattern:** One entry under People

### UX-312 — Dashboard customization not mirrored elsewhere

- **Severity:** P2
- **Category:** Dashboard widgets / badge counts
- **Module:** `dashboard`
- **Route / locus:** `Widget prefs localStorage only`
- **What's wrong:** Unique personalization pattern.
- **Target pattern:** OK if documented; consider reuse on My Work

### UX-313 — GlobalSearch Admin group text-purple-600

- **Severity:** P2
- **Category:** Search / filters UX
- **Module:** `platform`
- **Route / locus:** `GlobalSearch module color purple for Admin`
- **What's wrong:** Reinforces purple=admin.
- **Target pattern:** Neutral/primary

### UX-314 — Approvals page requires reason; inbox doesn't; some queues optional

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `Reject flows require reason only sometimes`
- **What's wrong:** Policy UX inconsistency.
- **Target pattern:** Always require reason for reject/return

### UX-315 — Repeated across people pages

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `people`
- **Route / locus:** `People stub 'Unable to load.' too terse`
- **What's wrong:** No error code, retry, or support link.
- **Target pattern:** EmptyState with retry

### UX-316 — risk/analytics category color map includes pink/purple

- **Severity:** P2
- **Category:** Admin vs operational module visual split
- **Module:** `risk`
- **Route / locus:** `Risk analytics purple/pink category colors`
- **What's wrong:** Decorative category colors diverge from badge system.
- **Target pattern:** Semantic tokens only

### UX-317 — Access requests list minimal vs operational registers

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `admin`
- **Route / locus:** `/admin/access/requests`
- **What's wrong:** No RegisterShell, density, or EmptyState.
- **Target pattern:** RegisterShell

### UX-318 — PIF create uses FormSection; edit uses section components

- **Severity:** P2
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `pif`
- **Route / locus:** `PIF edit vs create chrome`
- **What's wrong:** Mostly good but two internal patterns.
- **Target pattern:** Same section primitives

### UX-319 — Users may not find certificate from register row actions

- **Severity:** P1
- **Category:** Print/export affordances
- **Module:** `platform`
- **Route / locus:** `Certificate vs Print register`
- **What's wrong:** Sometimes only on detail.
- **Target pattern:** Row action Print/Certificate where available

### UX-320 — Salary advance dashboard uses page-title (good) but not ModulePageHeader

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `finance`
- **Route / locus:** `/salary-advances dashboard`
- **What's wrong:** Close but missing breadcrumbs/actions slot standardization.
- **Target pattern:** ModulePageHeader

### UX-321 — Assets add uses Stepper but other asset flows don't

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `assets`
- **Route / locus:** `/assets/add Stepper`
- **What's wrong:** disposal/revaluation are single-page forms.
- **Target pattern:** Consistent multi-step only when needed; else FormSection

### UX-322 — saam/delegations vs people/delegations vs people/my-delegations

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `saam`
- **Route / locus:** `Delegation UIs`
- **What's wrong:** Three delegation surfaces.
- **Target pattern:** One delegations product

### UX-323 — SVG connectors may lack text alternatives

- **Severity:** P2
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `organogram`
- **Route / locus:** `Chart/canvas organogram`
- **What's wrong:** Structure not exposed to AT beyond visible nodes.
- **Target pattern:** Provide list alternative view

### UX-324 — Many filter-tab rows wrap to 2–3 lines on mobile

- **Severity:** P2
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `Filter tab wrap`
- **What's wrong:** Occupies huge first viewport.
- **Target pattern:** Horizontal scroll chips

### UX-325 — Inline SVG fill colors ignore theme

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `organogram`
- **Route / locus:** `Hardcoded #cbd5e1 in organogram`
- **What's wrong:** Dark mode connectors stay light-slate.
- **Target pattern:** CSS variables for connector colors

### UX-326 — Hardcoded hex purple in workplan page

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `workplan`
- **Route / locus:** `Workplan milestone purple bar #8b5cf6`
- **What's wrong:** Bypasses design tokens.
- **Target pattern:** Tokenized milestone color

### UX-327 — Good pattern not copied to HR/stock

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `assignments`
- **Route / locus:** `AssignmentFilteredList uses RegisterShell`
- **What's wrong:** Evidence that shared list wrappers work — under-adopted.
- **Target pattern:** Promote pattern in docs + migrations

### UX-328 — Certification queue linked from two sidebar sections

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `leave`
- **Route / locus:** `HR Leave Certify listed under HR and Leave`
- **What's wrong:** Duplicate discovery paths with same destination — OK for IA but increases perceived inconsistency with dual leave registers.
- **Target pattern:** Single parent for certify queue

### UX-329 — Local SkeletonCard vs RegisterShell pulse rows

- **Severity:** P2
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `travel`
- **Route / locus:** `SkeletonCard local in travel detail`
- **What's wrong:** Another skeleton variant.
- **Target pattern:** Shared skeletons package

### UX-330 — disabled:opacity-50 without explaining why

- **Severity:** P2
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `platform`
- **Route / locus:** `Disabled opacity only`
- **What's wrong:** Users don't know how to enable CTA.
- **Target pattern:** Inline hint when disabled

### UX-331 — User-facing 'feature-only' jargon

- **Severity:** P1
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `my-work`
- **Route / locus:** `My Work subtitle 'Feature-only tasks'`
- **What's wrong:** Permission-model language leaked.
- **Target pattern:** Plain language: 'Assigned to you'

### UX-332 — User create is elaborate multi-section; access role create is 2 fields

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `/admin/users create wizard`
- **What's wrong:** Extreme quality gap inside Admin.
- **Target pattern:** Raise access create to users-create quality

### UX-333 — Risk detail history section purple accent

- **Severity:** P1
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `risk`
- **Route / locus:** `/risk/[id] SectionIcon purple history`
- **What's wrong:** Inconsistent with status badge semantics.
- **Target pattern:** Neutral/primary section icons

### UX-334 — Employees may upload in profile and HR file separately

- **Severity:** P1
- **Category:** Attachment / document upload UX
- **Module:** `profile`
- **Route / locus:** `Profile documents vs HR file documents`
- **What's wrong:** Unclear source of truth UX.
- **Target pattern:** One documents vault UX

### UX-335 — Export CSV uses legacy btn classes

- **Severity:** P2
- **Category:** Print/export affordances
- **Module:** `weekly-summaries`
- **Route / locus:** `Weekly summaries compliance export`
- **What's wrong:** Matches earlier compliance finding; export affordance present but styled legacy.
- **Target pattern:** btn-secondary + exportToCsv

### UX-336 — Assets register filters bespoke vs RegisterShell filter card

- **Severity:** P1
- **Category:** Search / filters UX
- **Module:** `assets`
- **Route / locus:** `/assets page filters`
- **What's wrong:** Different filter layout language.
- **Target pattern:** RegisterShell filters slot

### UX-337 — Fleet tables plain; no data-table thead styling consistently

- **Severity:** P1
- **Category:** Tables vs cards vs lists
- **Module:** `fleet`
- **Route / locus:** `/fleet tab content tables`
- **What's wrong:** Misses institutional table chrome.
- **Target pattern:** data-table class

### UX-338 — Some polished pages still carry style={{}} for progress widths

- **Severity:** P2
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `leave`
- **Route / locus:** `Inline style usage on leave/pif remaining`
- **What's wrong:** Acceptable for dynamic width but mixed with token world.
- **Target pattern:** CSS variables for progress width

### UX-339 — Two notification UIs

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `notifications`
- **Route / locus:** `Notifications: Header panel vs /notifications page`
- **What's wrong:** Panel vs full page feature parity unclear.
- **Target pattern:** Panel as preview; page as full — shared row component

### UX-340 — Neither approvals page uses PageBreadcrumbs

- **Severity:** P1
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `approvals`
- **Route / locus:** `/approvals missing breadcrumbs`
- **What's wrong:** Despite being high-traffic.
- **Target pattern:** PageBreadcrumbs Home › Approvals

### UX-341 — When badge-info missing, authors may misuse badge-primary for informational

- **Severity:** P2
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `Info vs primary badge confusion`
- **What's wrong:** Seen in advances status map.
- **Target pattern:** Define info/neutral/progress variants

### UX-342 — Need verification that focus returns after confirm

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `ConfirmDialog and Toast focus management`
- **What's wrong:** Custom dialogs historically leak focus; ConfirmDialog should be audited.
- **Target pattern:** Focus restore tests

### UX-343 — --sidebar-width 260px with very deep trees

- **Severity:** P1
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `Sidebar 260px fixed`
- **What's wrong:** Labels truncate unevenly (Travel children).
- **Target pattern:** Collapsible sections + tooltips

### UX-344 — Demo credential tiles use *-50 backgrounds without dark variants

- **Severity:** P2
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `auth`
- **Route / locus:** `login page light-only demo tiles`
- **What's wrong:** If login ever dark-themed, broken.
- **Target pattern:** Theme-aware demo tiles

### UX-345 — Legacy /approval route group still in app tree

- **Severity:** P2
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `approvals`
- **Route / locus:** `approval/page.tsx legacy`
- **What's wrong:** Potential duplicate UX entry.
- **Target pattern:** Redirect + remove

### UX-346 — Near-clone of leave without density

- **Severity:** P1
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `imprest`
- **Route / locus:** `/imprest missing density toggle`
- **What's wrong:** Concrete incomplete migration.
- **Target pattern:** Add RegisterShell density

### UX-347 — Empty copy 'No assigned My Work features.' plain li

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `my-work`
- **Route / locus:** `/my-work empty`
- **What's wrong:** Not EmptyState.
- **Target pattern:** EmptyState

### UX-348 — /admin/access/governance tooling checklist UI

- **Severity:** P1
- **Category:** Admin vs operational module visual split
- **Module:** `admin`
- **Route / locus:** `Access governance checklist tone`
- **What's wrong:** Looks like README checklist not admin console.
- **Target pattern:** Admin settings FormSection pattern

### UX-349 — disabled={!name} only — no error text

- **Severity:** P1
- **Category:** Buttons / CTAs / destructive actions
- **Module:** `admin`
- **Route / locus:** `Create draft on access roles lacks validation feedback styling`
- **What's wrong:** Minimal form UX vs admin/users/create.
- **Target pattern:** FormField validation

### UX-350 — Possible redundant status storytelling

- **Severity:** P2
- **Category:** Detail pages / tabs / workflow banners
- **Module:** `travel`
- **Route / locus:** `StatusTimeline vs ApprovalTimeline both on travel`
- **What's wrong:** Users see multiple progress metaphors on one page.
- **Target pattern:** One primary progress + audit history

### UX-351 — Capitalise used in assets (British) while other UI Americanize

- **Severity:** P2
- **Category:** Copy/tone / microcopy inconsistency
- **Module:** `assets`
- **Route / locus:** `Capitalise British spelling`
- **What's wrong:** Spelling locale inconsistency.
- **Target pattern:** en-GB institutional spelling guide

### UX-352 — HR approval matrix separate from admin workflows designer

- **Severity:** P1
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `settings`
- **Route / locus:** `Settings HR approval matrix`
- **What's wrong:** Two places to configure approvals.
- **Target pattern:** Link clearly; shared mental model

### UX-353 — Bulk export exists on master-register — good — but retention page has none

- **Severity:** P1
- **Category:** Print/export affordances
- **Module:** `correspondence`
- **Route / locus:** `/correspondence master bulk export`
- **What's wrong:** Sibling pages inconsistent.
- **Target pattern:** Export on all correspondence registers

### UX-354 — Filters not in URL; refresh loses filters

- **Severity:** P2
- **Category:** Search / filters UX
- **Module:** `stock`
- **Route / locus:** `Stock category filter local state`
- **What's wrong:** Same class of issue as leave.
- **Target pattern:** URL-synced filters

### UX-355 — driverUserId typed as raw id string

- **Severity:** P1
- **Category:** Forms (labels, sections, validation presentation, steppers)
- **Module:** `fleet`
- **Route / locus:** `Fleet create driver User id raw number input`
- **What's wrong:** No UserPicker — poor UX vs hr leave autocomplete.
- **Target pattern:** Shared UserPicker

### UX-356 — Header.tsx procurement purple map

- **Severity:** P1
- **Category:** Status badges / colors / semantics
- **Module:** `platform`
- **Route / locus:** `Header notification module colors include purple procurement`
- **What's wrong:** Third copy of module color map.
- **Target pattern:** Shared moduleMeta

### UX-357 — API supports 3xl/4xl/6xl but callers use none

- **Severity:** P2
- **Category:** Layout chrome / page headers / breadcrumbs
- **Module:** `platform`
- **Route / locus:** `maxWidth prop on ModulePageHeader rarely passed`
- **What's wrong:** Forms may stretch too wide on ultrawide.
- **Target pattern:** Create forms maxWidth=3xl/4xl

### UX-358 — Header menu/notifications rely on icons

- **Severity:** P1
- **Category:** Accessibility (focus, labels, contrast, hit targets)
- **Module:** `platform`
- **Route / locus:** `Icon-only header buttons`
- **What's wrong:** Need verified aria-labels (partially present — audit remaining).
- **Target pattern:** Complete aria-label pass on Header

### UX-359 — Clicking controls in main closes mobile sidebar — OK; may cause focus quirks

- **Severity:** P2
- **Category:** Mobile / responsive breakpoints
- **Module:** `platform`
- **Route / locus:** `main onClick closes sidebar`
- **What's wrong:** Noted for a11y testing.
- **Target pattern:** Close via overlay only

### UX-360 — bg-white border tiles ignore dark surfaces

- **Severity:** P1
- **Category:** Color / legacy CSS bridges / dark-light issues
- **Module:** `people`
- **Route / locus:** `People hub white cards without dark:bg`
- **What's wrong:** Harsh in dark mode vs .card dark tokens.
- **Target pattern:** Use .card class

### UX-361 — Unable to load dashboard. without alert styling

- **Severity:** P1
- **Category:** Empty / loading / error / 403-404 states
- **Module:** `audit`
- **Route / locus:** `Audit isError plain text`
- **What's wrong:** Inconsistent with red alert boxes elsewhere.
- **Target pattern:** Alert / EmptyState error variant

### UX-362 — Good shell; category icon colors include purple compliance

- **Severity:** P2
- **Category:** Registers/lists (filters, density, pagination, bulk actions)
- **Module:** `risk`
- **Route / locus:** `Risk page RegisterShell + custom category icons`
- **What's wrong:** Partial token discipline.
- **Target pattern:** Semantic category colors

### UX-363 — Budget Control, Cycles, Changes… under Finance plus separate Budget mental model

- **Severity:** P1
- **Category:** Navigation / sidebar / My Work / feature-only orphans
- **Module:** `finance`
- **Route / locus:** `Finance nav mixes Budget module routes`
- **What's wrong:** Deep nesting without section separators in children.
- **Target pattern:** Visual section labels inside Finance children

### UX-364 — Canonical primitives exist but adoption <5% of pages

- **Severity:** P0
- **Category:** Cross-module “same job, different UI” duplicates
- **Module:** `platform`
- **Route / locus:** `Design system adoption gap is the root cause`
- **What's wrong:** ModulePageHeader ~10 pages, RegisterShell ~9, FormSection ~4, EmptyState ~6, WorkflowStatusBanner ~2, Button/Input/Select/Badge React components ~0 imports.
- **Target pattern:** Adoption program with lint/codemods; hide unfinished modules

## Notes

- Findings count the same anti-pattern on **different routes/modules** separately; exact duplicate issues on the **same file** were not padded.
- Leave/PIF (and parts of Travel register / Risk / Correspondence master / Procurement register) are the **reference** implementations — not listed as defects except where they still diverge from each other.
- Audit only; no product fixes shipped in this change set beyond this documentation.
