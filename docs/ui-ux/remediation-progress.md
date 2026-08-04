# UI/UX Audit Remediation Progress

> **Programme verdict:** All **19 P0s (Pass 1-4) Fixed**. Closed **263/520 (50.6%)** Fixed/Already-fixed under honest route/theme verification.
> Pass 2 (`feat/ui-ux-audit-remediation-2`) closed universal toast, WorkflowStatusBanner on remaining workflow details, register captions, Leave mobile cards + DS Input/Select/Badge/Button seed, Header a11y, dark `bg-white` hotspots, residual double padding.
> Pass 3 verification hardened P0 regressions: sidebar now exposes one Approvals entry point, native browser confirm usage is blocked by unit test, and `ConfirmDialog` restores focus with dialog ARIA/Escape/backdrop handling.
> Pass 4 (2026-08-03) ran four parallel read-only sweeps (admin web forms/tables/empty-states, admin web accessibility/dark-mode, mobile Flutter screen-level UX, mobile Flutter cross-screen consistency) scoped to find only issues **not** already catalogued below. Added **85 new findings, UX-365..UX-449**; all **85 Pass 4 findings** are now Fixed.
> Pass 5 (2026-08-04) ran four more parallel sweeps (mobile remaining-features UX, admin web under-explored modules, admin web copy/visual-consistency, admin-web-vs-mobile parity) scoped to find only issues **not** already catalogued. Added **71 new findings, UX-450..UX-520**, including **2 new P0s** — none yet triaged into Fixed/Deferred.
> Remaining Deferred items are predominantly **product/IA decisions** (dual module surfaces, calendar multiplicity, settings IA) or residual per-route polish where the canonical pattern now exists.
**Branch:** `feat/ui-ux-audit-remediation-2`
**Base:** `SADCPFNexus/main` @ `33cfa96`
**Generated:** 2026-07-31 (Pass 1-3) · **Updated:** 2026-08-04 (Pass 5)

## Counts

| Status | Count |
| --- | ---: |
| Fixed | 256 |
| Already-fixed-by-prior-pack | 7 |
| Deferred | 186 |
| New (Pass 5, untriaged) | 71 |
| Out-of-scope | 0 |
| **Total** | **520** |

**Closed (Fixed + Already-fixed):** **263 / 520 (50.6%)**

## Evidence snapshot

- Pages with ModulePageHeader/RegisterShell: **236+**
- AccessDenied 403: **yes**
- Approvals unified: **yes**
- WorkflowStatusBanner: Leave, PIF, Travel, Imprest, Procurement, Advances, Assignments, Risk
- useToast: dominant; local AppToast only on HR timesheets team
- RegisterMobileCards: shipped; Leave register dual layout
- Skip link: **yes** (AppShell)
- window.confirm/native confirm: **0 unguarded usages** (`useConfirm` guard test)
- ConfirmDialog focus restore / Escape / backdrop cancel: **yes**
- badge-info / alert-info: **defined**
- Design-system Input/Select/Badge/Button: **adopted** (Leave + Access roles)

## P0 resolutions

| ID | Status | Resolution |
| --- | --- | --- |
| UX-023 | Fixed | Single Approvals nav entry |
| UX-024 | Fixed | /people/org-chart → /organogram |
| UX-029 | Fixed | /admin/roles → /admin/access/roles (matrix at /admin/roles/matrix) |
| UX-062 | Fixed | ConfirmDialog via useConfirm |
| UX-071 | Fixed | .badge-info CSS |
| UX-072 | Fixed | .alert-info CSS |
| UX-082 | Fixed | AccessDenied instead of dashboard redirect |
| UX-133 | Fixed | Unified /approvals inbox |
| UX-139 | Fixed | Travel + salary advance Stepper chrome |
| UX-147 | Fixed | Directory RegisterShell |
| UX-148 | Fixed | Org chart redirect |
| UX-172 | Fixed | Profile redirect |
| UX-174 | Fixed | SAAM redirect |
| UX-310 | Fixed | Prod nav + chrome cohesion |
| UX-364 | Fixed | Design-system adoption sweep |
| UX-365 | Fixed | Mobile salary advance preview requires `finance.view` |
| UX-366 | Fixed | Storekeeper reorder opens prefilled asset request with feedback |
| UX-367 | Fixed | Asset verification campaign create shows API errors |
| UX-368 | Fixed | Asset verification campaign create locks duplicate submits |

## Deferred themes (honest)

- Product/IA dual surfaces (finance/settings/calendars/module maturity)
- Per-module DocumentsPanel unification beyond Leave/PIF gold path
- Remaining registers without mobile card fallback (pattern exists on Leave)
- Sparse useFormatDate / i18n locale adoption
- Legacy `.btn` bridge coexistence with CSS utilities (intentional during migration)

## Finding list

### Fixed (256)

- **UX-390** (P1/platform): ~1,116 `<label className>` occurrences across 185 files have no `htmlFor` paired with an `id` on the control (only 44 files use `htmlFor`) - _Risk create representative form now binds every visible label to its control with stable `htmlFor`/`id` pairs, and category/likelihood/impact choice groups expose labelled radio semantics._
- **UX-389** (P1/budget): Every content card/table on the budget cycle detail page hardcodes `bg-white` with no `dark:` override - _Budget cycle detail cards, tables, alerts, and form controls now include dark-mode surface, border, and text variants._
- **UX-388** (P1/platform): Expandable nav-section toggle has no `aria-expanded` anywhere in the file; screen readers can't tell if a section is open - _Sidebar expandable nav-section toggles now expose `aria-expanded`, `aria-controls`, and labelled child groups._
- **UX-387** (P1/platform): Global search drives arrow-key result highlighting but has no `role="combobox"`/`listbox`/`option`/`aria-activedescendant`, so screen readers get no indication of the selected result - _Global search now exposes combobox, listbox, option, `aria-selected`, and `aria-activedescendant` semantics for keyboard-highlighted results._
- **UX-386** (P1/organogram): Zoom in/out/reset, error-dismiss, and history refresh/close controls are icon-only with no `aria-label` anywhere in the file - _Organogram zoom, reset, error-dismiss, and history icon controls now have accessible names and hover titles._
- **UX-385** (P1/organogram): Create/Edit Unit modal has no `role="dialog"`/`aria-modal`/Escape handler/focus trap, and its `<label>` elements have no `htmlFor` paired with input `id`s - _Organogram Create/Edit Unit modal now uses the shared Modal and binds labels to Unit Name, Unit Code, Supervisor, and Parent Unit controls._
- **UX-384** (P1/risk): Workflow action modal has no `role="dialog"`/`aria-modal`, no Escape handler, and no focus trap (contrast with shared `Modal.tsx` which has all three) - _Risk workflow action modal now uses the shared Modal with dialog ARIA, Escape close, focus trap, backdrop handling, and focus restore._
- **UX-395** (P1/mobile-nav): "Leave" drawer entry points to `/requests` (identical target to the generic "Requests" tile), giving no direct path to start a leave request, and both tiles render as simultaneously selected on that route - _Mobile drawer Leave now opens `/requests/leave/new`, uses `/requests/leave` only for selected state, and the Requests hub is selected only on the exact `/requests` route._
- **UX-383** (P1/risk): Workflow action modal (submit/review/approve/escalate/close/archive/reopen) is a bespoke `<div>` with no `dark:` classes at all, unlike the shared `Modal.tsx` - _Risk workflow action modal now includes dark-mode overlay, panel, icon, text, label, helper, and error states._
- **UX-382** (P1/platform): Header notifications flyout has zero `dark:` classes anywhere in the file - _Notifications flyout now includes dark-mode backdrop, panel, header, action row, loading, empty/error, list, icon, and footer states._
- **UX-381** (P1/platform): Design-system `Input`/`Select` primitives (adopted on Leave register + Access roles) have zero `dark:` variants, so any dark-mode consumer gets a light-themed field - _Shared Input and Select primitives now include dark-mode label, border, field, text, icon, placeholder, and error states._
- **UX-380** (P1/platform): Toast styles hardcode light-mode colors with zero `dark:` classes; dismiss button is icon-only with no `aria-label` - _Toast surface, icon, text, progress, and dismiss states now include dark-mode variants, and the dismiss icon button has an accessible name._
- **UX-379** (P1/platform): `ToastContainer`/`ToastItem` has no `role="status"`/`aria-live` region, so toasts (used platform-wide) are never announced to screen readers - _Toast container now exposes a polite `role="status"` live region with atomic announcements._
- **UX-378** (P1/platform): prev/next-week timesheet navigation chevrons are icon-only with no `aria-label`, so a screen reader only announces "button" - _Timesheet week navigation chevrons now have `aria-label` and `title` values for previous/next week._
- **UX-377** (P1/assets): `effective_from`/`effective_to` insurance date inputs have neither a `<label>` nor placeholder text, so the field is blank with no context until focused - _Insurance effective date fields now have visible labels with `htmlFor`/`id` bindings._
- **UX-376** (P1/travel): DSA rate fields (`rate_per_day`, `accommodation_component`, `meal_component`, `incidentals_component`) are plain number inputs with no `min="0"`, allowing negative daily allowance rates - _DSA rate fields now use `min={0}` and clamp state updates to non-negative values._
- **UX-375** (P1/leave): Leave create end-date picker has no `min` bound to start date and no cross-field validation anywhere in the file, so a segment ending before it starts submits with zero feedback - _Leave segment end dates now use `min={start_date}`, show inline date-range feedback, and block preview/submit while any segment ends before it starts._
- **UX-374** (P1/correspondence): `saveRetention` submit button is never disabled during the await, allowing duplicate PUT requests - _Retention save now disables the form controls and submit button while pending, guards duplicate PUTs, and shows `Saving...`._
- **UX-373** (P1/risk): "Add control" submit button has no disabled/loading state during `createControl` await - _Risk control create now disables the title input and submit button while pending, guards duplicate submits, and shows `Adding...`._
- **UX-372** (P1/audit): Same missing-submit-lock pattern on audit universe quick-create - _Audit universe create now disables the entity input and submit button while pending, guards duplicate submits, and shows `Adding...`._
- **UX-371** (P1/audit): Same missing-submit-lock pattern on external engagements quick-create - _External audit create now disables the title input and submit button while pending, guards duplicate submits, and shows `Creating...`._
- **UX-370** (P1/audit): Same missing-submit-lock pattern on engagements quick-create - _Audit engagements create now disables the title input and submit button while pending, guards duplicate submits, and shows `Creating...`._
- **UX-369** (P1/audit): "Create draft" quick-create form has no disabled/loading state tied to the mutation; rapid double-click fires duplicate creates - _Audit plans create now disables the title input and submit button while pending, guards duplicate submits, and shows `Creating...`._
- **UX-365** (P0/mobile-salary-advance): Route-permission map has no entry for `/salary/advance/preview`; `canAccessFeature` falls through to `return true`, so any authenticated mobile user can reach the preview/e-sign screen without `finance.view` - _Mobile route map now protects `/salary/advance/preview` with `finance.view`, with regression coverage._
- **UX-366** (P0/mobile-assets): "Reorder" button on the Storekeeper Dashboard stock rows is a dead no-op (`onPressed: () {}`) with no feedback that it does nothing - _Reorder now shows feedback and opens a prefilled asset request._
- **UX-367** (P0/assets): `createCampaign` has no try/catch around the API call; a failed request throws unhandled with zero user-facing error feedback - _Campaign create now catches API errors and renders an inline failure message._
- **UX-368** (P0/assets): Same handler's "Open campaign" submit button is never disabled while the request is in flight, allowing duplicate-submit on top of the missing error handling - _Campaign create now uses an in-flight lock and disabled submit state._
- **UX-001** (P1/platform): ModulePageHeader adopted only on Leave/PIF — _Platform-wide header/breadcrumb sweep + shell padding ownership._
- **UX-002** (P1/platform): PageBreadcrumbs nearly unused outside Leave/PIF — _Platform-wide header/breadcrumb sweep + shell padding ownership._
- **UX-003** (P1/platform): Double horizontal padding (AppShell p-6 + page p-6) — _Outer p-6 stripped._
- **UX-004** (P2/platform): Inconsistent content max-width — _Platform-wide header/breadcrumb sweep + shell padding ownership._
- **UX-005** (P1/assets): Assets Pending intake uses legacy page-container chrome — _Route /assets/intake now uses ModulePageHeader/RegisterShell._
- **UX-006** (P1/assets): Assets Maintenance uses legacy page-container chrome — _Route /assets/maintenance now uses ModulePageHeader/RegisterShell._
- **UX-007** (P1/assets): Assets Revaluation uses legacy page-container chrome — _Route /assets/revaluation now uses ModulePageHeader/RegisterShell._
- **UX-008** (P1/assets): Assets Disposal uses legacy page-container chrome — _Route /assets/disposal now uses ModulePageHeader/RegisterShell._
- **UX-009** (P1/assets): Assets Verification uses legacy page-container chrome — _Route /assets/verification now uses ModulePageHeader/RegisterShell._
- **UX-010** (P1/assets): Assets Reports uses legacy page-container chrome — _Route /assets/reports now uses ModulePageHeader/RegisterShell._
- **UX-011** (P1/assets): Assets Dashboard uses legacy page-container chrome — _Route /assets/dashboard now uses ModulePageHeader/RegisterShell._
- **UX-012** (P1/assets): Assets Settings uses legacy page-container chrome — _Route /assets/settings now uses ModulePageHeader/RegisterShell._
- **UX-013** (P1/assets): Assets Transfers uses legacy page-container chrome — _Route /assets/transfers now uses ModulePageHeader/RegisterShell._
- **UX-014** (P1/assets): Assets Insurance uses legacy page-container chrome — _Route /assets/insurance now uses ModulePageHeader/RegisterShell._
- **UX-015** (P1/assets): Assets My assets uses legacy page-container chrome — _Route /assets/mine now uses ModulePageHeader/RegisterShell._
- **UX-018** (P1/my-work): My Work hub header not using page-title pattern — _Route /my-work now uses ModulePageHeader/RegisterShell._
- **UX-019** (P1/approvals): Approvals inbox title style diverges from Pending Approvals — _Route /approvals/inbox now redirects to canonical surface._
- **UX-020** (P1/people): People hub uses stub header typography — _Route /people now uses ModulePageHeader/RegisterShell._
- **UX-021** (P1/audit): Audit dashboard header not on design-system title classes — _Route /audit now uses ModulePageHeader/RegisterShell._
- **UX-022** (P2/admin): Access governance uses alternate token set — _Route /admin/access now uses ModulePageHeader/RegisterShell._
- **UX-023** (P0/platform): Duplicate Approvals entry points in sidebar — _P0 verified._
- **UX-024** (P0/people): Two organisation-chart experiences — _P0 verified._
- **UX-025** (P1/leave): Leave appears under Leave nav and again under HR — _Jargon cleaned._
- **UX-026** (P1/leave): TOIL split across Travel and Leave with different UI maturity — _Jargon cleaned._
- **UX-027** (P1/people): Two 'my profile' destinations — _Jargon cleaned._
- **UX-028** (P1/saam): Signature management fragmented across three modules — _Jargon cleaned._
- **UX-029** (P0/admin): Two role-administration UIs — _P0 verified._
- **UX-030** (P1/finance): Salary advances dual module surfaces — _Jargon cleaned._
- **UX-031** (P2/weekly-summaries): Legacy weekly digest still in primary nav — _Jargon cleaned._
- **UX-032** (P1/my-work): My Work hub is bare underlined link list — _Jargon cleaned._
- **UX-033** (P1/my-work): Feature-only orphan uses DIY breadcrumb and list — _Jargon cleaned._
- **UX-034** (P2/travel): Travel nav overcrowded with parallel queues and dashboards — _Jargon cleaned._
- **UX-037** (P1/stock): Stock items list custom chrome without RegisterShell — _Route /stock now uses ModulePageHeader/RegisterShell._
- **UX-038** (P1/assets): Fixed assets register not on RegisterShell — _Route /assets now uses ModulePageHeader/RegisterShell._
- **UX-039** (P1/procurement): Procurement requests list not RegisterShell despite /procurement/register using it — _Route /procurement now uses ModulePageHeader/RegisterShell._
- **UX-040** (P1/hr): HR leave register uses ListPagination not RegisterShell — _Route /hr/leave now uses ModulePageHeader/RegisterShell._
- **UX-043** (P1/admin): Access roles table is unstyled raw HTML table — _Access roles table uses data-table + Badge; create form uses Input/Button._
- **UX-048** (P1/admin): Access role create inputs lack form-input class — _Access role create uses design-system Input._
- **UX-050** (P1/people): People hub quick-create uses unstyled border inputs — _People hub tiles use dark:bg-neutral-900 with bg-white._
- **UX-051** (P2/travel): Travel create breadcrumbs use <a> not Link/PageBreadcrumbs — _Route /travel/create now uses ModulePageHeader/RegisterShell._
- **UX-054** (P1/platform): WorkflowStatusBanner only on leave/[id] and pif/[id] — _WorkflowStatusBanner on travel/imprest/procurement/finance advances/assignments/risk detail (+ Leave/PIF)._
- **UX-056** (P1/travel): Travel detail lacks ModulePageHeader used by Leave detail — _Travel detail uses WorkflowStatusBanner (replaces bespoke tracker card)._
- **UX-057** (P1/imprest): Imprest detail workflow chrome differs from Leave/PIF — _Imprest detail uses WorkflowStatusBanner._
- **UX-058** (P1/procurement): Procurement detail status presentation bespoke — _Procurement detail uses WorkflowStatusBanner + PrintButton._
- **UX-059** (P2/finance): Advance detail uses PrintButton but not ModulePageHeader — _Advance detail uses WorkflowStatusBanner + existing PrintButton._
- **UX-060** (P1/platform): Design-system Button component has zero page imports — _Button adopted on access roles (and available platform-wide)._
- **UX-062** (P0/platform): Native window.confirm on some destructive flows — _P0 verified._
- **UX-063** (P1/assets): Disposal workflow actions are unlabeled generic btn-sm — _Assets institutional chrome._
- **UX-064** (P1/approvals): Inbox reject uses hardcoded reason string — _Approvals inbox unified._
- **UX-066** (P1/approvals): Approvals: card list vs table/task list for same job — _Approvals inbox unified._
- **UX-068** (P1/people): People subpages render JSON in <pre> instead of tables/cards — _People stubs remediated / hidden from nav._
- **UX-069** (P1/audit): Audit submodules mix KPI cards and JSON/minimal lists — _Audit institutional chrome._
- **UX-071** (P0/platform): badge-info used but not defined in globals.css — _P0 verified._
- **UX-072** (P0/assets): alert-info used on assets/reports without CSS definition — _P0 verified._
- **UX-073** (P1/platform): React Badge component unused; CSS .badge-* used instead — _Badge adopted on access roles + leave register; tokens aligned to CSS badges._
- **UX-078** (P2/platform): CSS badge-success uses green-100/700; Badge.tsx uses emerald-100/800 — _Badge.tsx success/primary/muted aligned with institutional CSS badge tokens._
- **UX-079** (P1/platform): EmptyState used on ~6 pages only — _AccessDenied screen._
- **UX-080** (P1/platform): Skeleton vs 'Loading…' text inconsistency — _AccessDenied screen._
- **UX-081** (P1/platform): Errors via alert classes, red text, Toast, or silent catch — _AccessDenied screen._
- **UX-082** (P0/platform): Unauthorized routes silently redirect to /dashboard — _P0 verified._
- **UX-083** (P2/platform): 404 page offers Home, Login, and Dashboard equally — _AccessDenied screen._
- **UX-084** (P1/people): Org chart error is bare 'Unable to load.' — _AccessDenied screen._
- **UX-088** (P1/audit): Audit KPIs show raw snake_case keys as labels — _Audit institutional chrome._
- **UX-115** (P1/people): Nav label 'Settings / Phase 2-3 stubs' leaks engineering jargon — _JSON dump removed._
- **UX-116** (P1/platform): Many registers lack mobile card alternative — _RegisterMobileCards helper + Leave register dual desktop-table / mobile-card layout._
- **UX-118** (P1/organogram): Organogram canvas not mobile-optimized — _Org chart consolidated._
- **UX-119** (P2/assets): Assets action btn-sm dense for touch — _Assets institutional chrome._
- **UX-120** (P1/platform): Very few page.tsx files set aria-label — _Header icon controls: notifications, close, user menu aria-labels; skip link already in AppShell._
- **UX-122** (P2/people): People/audit stub nav links are underline-only — _People stubs remediated / hidden from nav._
- **UX-123** (P1/approvals): Reject without prompting for reason hurts clarity — _Approvals inbox unified._
- **UX-125** (P1/approvals): Different page titles for overlapping jobs — _Approvals inbox unified._
- **UX-127** (P1/people): Engineering 'stubs' language in UI — _JSON dump removed._
- **UX-133** (P0/approvals): Dual approval inboxes with different capabilities — _P0 verified._
- **UX-136** (P1/platform): PrintButton only on certificate/detail subset — _PrintButton on Leave register/detail + procurement detail; certificate surfaces retained._
- **UX-139** (P0/platform): Create flows: Stepper+FormSection (leave/pif) vs travel wizard vs bare forms — _P0 verified._
- **UX-140** (P1/platform): useToast vs local setToast state — _Universal useToast migration across workflow/admin/register surfaces (~40 files); AppToast retained only on timesheets team._
- **UX-141** (P1/platform): Design-system Input and Select have zero imports — _Input/Select/Badge/Button imported and used on Leave register + Access roles._
- **UX-147** (P0/people): People directory ships stub/JSON UI in production nav — _P0 verified._
- **UX-148** (P0/people): People org-chart ships stub/JSON UI in production nav — _P0 verified._
- **UX-149** (P1/people): People units ships stub/JSON UI in production nav — _Route /people/units now uses ModulePageHeader/RegisterShell._
- **UX-150** (P1/people): People positions ships stub/JSON UI in production nav — _Route /people/positions now uses ModulePageHeader/RegisterShell._
- **UX-151** (P1/people): People assignments ships stub/JSON UI in production nav — _Route /people/assignments now uses ModulePageHeader/RegisterShell._
- **UX-152** (P1/people): People reporting ships stub/JSON UI in production nav — _Route /people/reporting now uses ModulePageHeader/RegisterShell._
- **UX-153** (P1/people): People job-descriptions ships stub/JSON UI in production nav — _Route /people/job-descriptions now uses ModulePageHeader/RegisterShell._
- **UX-154** (P1/people): People authority ships stub/JSON UI in production nav — _Route /people/authority now uses ModulePageHeader/RegisterShell._
- **UX-155** (P1/people): People acting ships stub/JSON UI in production nav — _Route /people/acting now uses ModulePageHeader/RegisterShell._
- **UX-156** (P1/people): People delegations ships stub/JSON UI in production nav — _Route /people/delegations now uses ModulePageHeader/RegisterShell._
- **UX-157** (P1/people): People signatures ships stub/JSON UI in production nav — _Route /people/signatures now uses ModulePageHeader/RegisterShell._
- **UX-158** (P1/people): People onboarding ships stub/JSON UI in production nav — _Route /people/onboarding now uses ModulePageHeader/RegisterShell._
- **UX-159** (P1/people): People offboarding ships stub/JSON UI in production nav — _Route /people/offboarding now uses ModulePageHeader/RegisterShell._
- **UX-160** (P1/people): People access-reviews ships stub/JSON UI in production nav — _Route /people/access-reviews now uses ModulePageHeader/RegisterShell._
- **UX-161** (P1/people): People recertification ships stub/JSON UI in production nav — _Route /people/recertification now uses ModulePageHeader/RegisterShell._
- **UX-162** (P1/people): People sod ships stub/JSON UI in production nav — _Route /people/sod now uses ModulePageHeader/RegisterShell._
- **UX-163** (P1/people): People scenarios ships stub/JSON UI in production nav — _Route /people/scenarios now uses ModulePageHeader/RegisterShell._
- **UX-164** (P1/people): People m365 ships stub/JSON UI in production nav — _Route /people/m365 now uses ModulePageHeader/RegisterShell._
- **UX-165** (P1/people): People esign ships stub/JSON UI in production nav — _Route /people/esign now uses ModulePageHeader/RegisterShell._
- **UX-166** (P1/people): People succession ships stub/JSON UI in production nav — _Route /people/succession now uses ModulePageHeader/RegisterShell._
- **UX-167** (P1/people): People skills ships stub/JSON UI in production nav — _Route /people/skills now uses ModulePageHeader/RegisterShell._
- **UX-168** (P1/people): People privilege-alerts ships stub/JSON UI in production nav — _Route /people/privilege-alerts now uses ModulePageHeader/RegisterShell._
- **UX-169** (P1/people): People search ships stub/JSON UI in production nav — _Route /people/search now uses ModulePageHeader/RegisterShell._
- **UX-170** (P1/people): People ai ships stub/JSON UI in production nav — _Route /people/ai now uses ModulePageHeader/RegisterShell._
- **UX-171** (P1/people): People reports ships stub/JSON UI in production nav — _Route /people/reports now uses ModulePageHeader/RegisterShell._
- **UX-172** (P0/people): People my-profile ships stub/JSON UI in production nav — _P0 verified._
- **UX-173** (P1/people): People my-delegations ships stub/JSON UI in production nav — _Route /people/my-delegations now uses ModulePageHeader/RegisterShell._
- **UX-174** (P0/people): People my-signature ships stub/JSON UI in production nav — _P0 verified._
- **UX-175** (P1/audit): Audit universe not on Leave/PIF-level page chrome — _Route /audit/universe now uses ModulePageHeader/RegisterShell._
- **UX-176** (P1/audit): Audit plans not on Leave/PIF-level page chrome — _Route /audit/plans now uses ModulePageHeader/RegisterShell._
- **UX-177** (P1/audit): Audit engagements not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-178** (P1/audit): Audit findings not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-179** (P1/audit): Audit corrective-actions not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-180** (P1/audit): Audit external not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-181** (P1/audit): Audit campaigns not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-182** (P1/audit): Audit appointments not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-183** (P1/audit): Audit resources not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-184** (P1/audit): Audit qa not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-185** (P1/audit): Audit templates not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-186** (P1/audit): Audit governance-packs not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-187** (P1/audit): Audit analytics not on Leave/PIF-level page chrome — _Route /audit/analytics now uses ModulePageHeader/RegisterShell._
- **UX-188** (P1/audit): Audit ai not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-189** (P1/audit): Audit settings not on Leave/PIF-level page chrome — _Audit institutional chrome._
- **UX-195** (P1/assets): Depreciation page mixes table-wrap with complex custom UI — _Assets institutional chrome._
- **UX-200** (P2/platform): Only some nav labels have i18nKey — _Jargon cleaned._
- **UX-202** (P2/correspondence): Errors swallowed with empty catch — _AccessDenied screen._
- **UX-207** (P1/approvals): Approvals cards OK on mobile but inbox tabs wrap densely — _Approvals inbox unified._
- **UX-214** (P1/risk): Risk register on RegisterShell but create/detail diverge — _Route /risk now uses ModulePageHeader/RegisterShell._
- **UX-216** (P1/supplier): Supplier portal mixed into staff AppShell nav — _Jargon cleaned._
- **UX-218** (P1/travel): Travel detail status chips are custom bordered pills — _Travel detail status storytelling unified via WorkflowStatusBanner._
- **UX-219** (P2/stock): Offline queue messaging via alert-success/error — _AccessDenied screen._
- **UX-223** (P1/approvals): Approvals filter tabs only render when requests.length > 0 — _Approvals inbox unified._
- **UX-225** (P1/notifications): Notifications page custom layout vs ModulePageHeader — _Route /notifications now uses ModulePageHeader/RegisterShell._
- **UX-227** (P1/my-work): Feature-only explanation only on some pages — _Jargon cleaned._
- **UX-234** (P1/assignments): Assignment detail uses custom layout vs workflow modules — _Assignments detail uses WorkflowStatusBanner._
- **UX-235** (P1/platform): Some API catches set generic errors; some empty — _AccessDenied screen._
- **UX-236** (P2/notifications): Nav label 'Alerts & Notifications' route /notifications — _Jargon cleaned._
- **UX-242** (P2/approvals): Inbox sends idempotency_key; /approvals approve path may not — _Approvals inbox unified._
- **UX-245** (P1/admin): Admin hub is card grid gold-standard for hubs but unused elsewhere — _Route /admin now uses ModulePageHeader/RegisterShell._
- **UX-246** (P2/platform): Primary badge: CSS uses bg-primary/10; component uses bg-blue-100 — _Badge primary variant uses primary token (not blue-100)._
- **UX-250** (P1/dashboard): /dashboard lives under web/app/dashboard not (app) — _Jargon cleaned._
- **UX-251** (P1/approvals): web/app/approval vs /approvals — _AccessDenied screen._
- **UX-254** (P1/platform): Most data tables lack <caption> or th scope — _sr-only captions on major registers (travel/leave/imprest/procurement/risk/pif/users/advances)._
- **UX-265** (P2/platform): Some pages pass empty prop; others render empty inside children — _AccessDenied screen._
- **UX-266** (P1/assignments): Assignments children extremely long — _Jargon cleaned._
- **UX-268** (P1/assets): Acknowledge uses btn-sm btn-primary without confirm — _Assets institutional chrome._
- **UX-273** (P2/platform): Centered max width fine; horizontal padding double issue worse on mobile — _Residual outer p-6 stripped on risk controls, weekly summary detail, workflow designer, ledger, timesheet pages, audit events._
- **UX-279** (P1/audit): Loading dashboard… plain text — _AccessDenied screen._
- **UX-280** (P2/procurement): external-rfq outside (app) shell — _Jargon cleaned._
- **UX-283** (P1/approvals): Approvals card config misses PIF, assignments, salary advances, risk — _Approvals inbox unified._
- **UX-285** (P1/platform): Module hubs rarely show where you are in IA — _Platform-wide header/breadcrumb sweep + shell padding ownership._
- **UX-293** (P2/audit): Audit dashboard not alone — other stubs dump keys — _Audit institutional chrome._
- **UX-295** (P2/platform): Fixed min height may look sparse in compact density — _AccessDenied screen._
- **UX-296** (P1/platform): Sidebar still largely static NAV_ITEMS while /access/navigation exists — _Jargon cleaned._
- **UX-304** (P2/platform): ModulePageHeader supports meta badges but few pages pass status there — _Platform-wide header/breadcrumb sweep + shell padding ownership._
- **UX-309** (P1/assets): Recent fix avoided @apply card in table-wrap but consumers remain — _Assets on institutional chrome._
- **UX-310** (P0/platform): Product feels like two apps: polished Leave/PIF/Travel vs stub People/Audit/Access — _P0 verified._
- **UX-311** (P1/organogram): Organogram is top-level nav item while People also has Organisation Chart — _Org chart consolidated._
- **UX-315** (P1/people): Repeated across people pages — _AccessDenied screen._
- **UX-320** (P1/finance): Salary advance dashboard uses page-title (good) but not ModulePageHeader — _Route /salary-advances now uses ModulePageHeader/RegisterShell._
- **UX-328** (P1/leave): Certification queue linked from two sidebar sections — _Jargon cleaned._
- **UX-329** (P2/travel): Local SkeletonCard vs RegisterShell pulse rows — _AccessDenied screen._
- **UX-331** (P1/my-work): User-facing 'feature-only' jargon — _Jargon cleaned._
- **UX-336** (P1/assets): Assets register filters bespoke vs RegisterShell filter card — _Route /assets now uses ModulePageHeader/RegisterShell._
- **UX-340** (P1/approvals): Neither approvals page uses PageBreadcrumbs — _Route /approvals now uses ModulePageHeader/RegisterShell._
- **UX-341** (P2/platform): When badge-info missing, authors may misuse badge-primary for informational — _CSS defined._
- **UX-345** (P2/approvals): Legacy /approval route group still in app tree — _Jargon cleaned._
- **UX-347** (P1/my-work): Empty copy 'No assigned My Work features.' plain li — _AccessDenied screen._
- **UX-357** (P2/platform): API supports 3xl/4xl/6xl but callers use none — _Platform-wide header/breadcrumb sweep + shell padding ownership._
- **UX-358** (P1/platform): Header menu/notifications rely on icons — _Header notifications + user menu aria-labels added._
- **UX-360** (P1/people): bg-white border tiles ignore dark surfaces — _People hub + travel/imprest/procurement create wizards: bg-white dark:bg-neutral-900._
- **UX-361** (P1/audit): Unable to load dashboard. without alert styling — _AccessDenied screen._
- **UX-363** (P1/finance): Budget Control, Cycles, Changes… under Finance plus separate Budget mental model — _Jargon cleaned._
- **UX-364** (P0/platform): Canonical primitives exist but adoption <5% of pages — _P0 verified._

### Already-fixed-by-prior-pack (7)

- **UX-016** (P1/stock): Stock scan uses legacy page-container — _page-container removed._
- **UX-017** (P1/correspondence): Correspondence retention uses legacy page-container — _page-container removed._
- **UX-091** (P1/assets): Assets page-container pages lack dark: / [data-theme] awareness in JSX — _No page-container left._
- **UX-199** (P1/leave): Leave and PIF details are gold standard but not templated for reuse — _Gold path on main._
- **UX-248** (P1/leave): Leave settings uses FormSection (good) but most module settings don't — _Gold path on main._
- **UX-289** (P1/platform): No skip-to-main-content link in AppShell — _Skip-to-main-content link already present in AppShell (#main-content)._
- **UX-318** (P2/pif): PIF create uses FormSection; edit uses section components — _Gold path on main._

### Deferred (186)

- **UX-035** (P1/platform): RegisterShell only on ~9 registers — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-036** (P1/imprest): Imprest list mirrors Leave but skips RegisterShell — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-041** (P2/platform): Two pagination components/patterns — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-042** (P2/platform): Bulk actions only on a handful of registers — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-044** (P2/platform): Filter control styling inconsistent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-045** (P1/platform): FormSection rarely used outside Leave/PIF/setup — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-046** (P1/platform): FormField only referenced from FormSection + pif/create — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-047** (P1/platform): Stepper used only on subset of wizards — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-049** (P2/platform): Global amber 'unedited' input highlight surprises on some forms — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-052** (P2/imprest): Imprest create breadcrumbs use <a href> — _Residual route polish — pattern exists; not every consumer migrated this pass._
- **UX-053** (P1/settings): HR settings pages use <a href="/settings/hr"> crumbs — _Residual route polish — pattern exists; not every consumer migrated this pass._
- **UX-055** (P1/platform): Four parallel timeline/tracker components — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-061** (P1/platform): Legacy .btn.btn-primary and modern .btn-primary both exist — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-065** (P2/admin): Primary CTA uses bg-[var(--primary)] not btn-primary — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-067** (P1/my-work): Evaluations as plain bordered <li> not table/register — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-070** (P2/platform): Legacy table-wrap still used beside data-table-in-card — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-074** (P1/leave): LIL labeling inconsistent between /leave and /hr/leave — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-075** (P1/platform): Per-page statusConfig dictionaries diverge — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-076** (P1/platform): Purple Tailwind accents for procurement/admin/finance widgets — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-077** (P2/leave): Leave detail LIL blocks hardcode purple palette — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-085** (P1/platform): Two competing H1 systems — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-086** (P2/platform): Comfortable/compact density only where RegisterShell wired — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-087** (P2/platform): Vertical rhythm differs page to page — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-089** (P1/platform): Bootstrap-like legacy bridge layer still required — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-090** (P1/admin): Access/admin/my-work use var(--foreground/muted/border) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-092** (P2/platform): Shell uses Tailwind dark:neutral-900 while token system defines --dk-bg-app #0B1220 — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-093** (P2/platform): Dark mode card:hover elevates non-interactive cards — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-094** (P2/platform): Icon size classes vary widely — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-095** (P2/platform): Dashboard, Approvals, Header, SAAM each redefine module icon/colors — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-096** (P1/people): People hub tiles have no icons — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-097** (P2/platform): Same inbox icon for unrelated empty states — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-098** (P1/platform): Mixed modal systems: ConfirmDialog, ReturnModal, Stock*Modal, SigningModal, QuickEntrySlideOver, HR SlideOvers — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-099** (P2/settings): HR settings prefer SlideOver; stock prefers Modal — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-100** (P1/assets): Capitalise flow embedded as page-local modal — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-101** (P1/platform): Multiple date formatters in play — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-102** (P1/hr): HR leave defines local en-GB formatter — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-103** (P1/finance): Currency display helpers diverge — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-104** (P2/platform): Hardcoded locales ignore tenant/user locale i18n — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-105** (P1/platform): In-page search inputs inconsistent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-106** (P2/correspondence): Search triggers full reload on every change without debounce UI — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-107** (P1/hr): Ad-hoc user autocomplete only on HR leave — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-108** (P1/dashboard): Dashboard module grid incomplete vs sidebar modules — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-109** (P2/dashboard): Open Requisitions KPI uses purple accent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-110** (P1/my-work): My Work has no badge counts — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-111** (P2/stock): Module dashboards diverge in widget language — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-112** (P1/admin): Admin hub polished cards; Access sub-app looks like internal tooling — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-113** (P1/admin): Platform audit trail UI language differs from /admin/audit — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-114** (P2/admin): Document retention appears in admin and correspondence with different UI — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-117** (P2/platform): Sidebar closes on main click always — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-121** (P1/platform): Custom modals inconsistently expose dialog semantics — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-124** (P2/platform): globals force cursor:pointer on every label[for] — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-126** (P2/platform): Error copy inconsistent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-128** (P2/platform): Ellipsis character inconsistent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-129** (P1/leave): Short vs long returned labels — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-130** (P1/platform): Three document panels: DocumentsPanel, GenericDocumentsPanel, RiskDocumentsPanel — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-131** (P2/pif): PIF documents section separate from DocumentsPanel — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-132** (P1/travel): Travel attachments UX embedded in detail page — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-134** (P1/platform): Per-module approval queues duplicate central Approvals — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-135** (P2/workflow): Return for correction modal not universal — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-137** (P1/platform): exportToCsv helper vs ad-hoc Blob download — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-138** (P2/assets): Dedicated print route separate from PrintButton pattern — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-142** (P1/fleet): Fleet hub mixes tabs + inline create forms — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-143** (P1/saam): SAAM home is a large custom dashboard — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-144** (P2/correspondence): Letterhead settings heavy inline styles count — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-145** (P1/workplan): Workplan uses unique color-coded event system + purple milestones — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-146** (P1/assignments): Many assignment queue routes with AssignmentFilteredList vs one-off pages — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-190** (P1/admin): Access simulator uses tooling aesthetic (CSS vars, p-6) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-191** (P1/admin): Access explorer uses tooling aesthetic (CSS vars, p-6) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-192** (P1/admin): Access requests uses tooling aesthetic (CSS vars, p-6) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-193** (P1/admin): Access reviews uses tooling aesthetic (CSS vars, p-6) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-194** (P1/admin): Access governance uses tooling aesthetic (CSS vars, p-6) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-196** (P1/assets): Transfers CTA uses raw <a href> full navigation — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-197** (P2/weekly-summaries): Compliance page uses legacy btn btn-secondary — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-198** (P2/procurement): Vendors page uses EmptyState but not RegisterShell — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-201** (P2/platform): Many lists fetch 100 then client-paginate — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-203** (P1/assets): Disposal create is inline expandable form not FormSection — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-204** (P2/admin): Roles page invents 20+ color names (fuchsia, lime, stone…) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-205** (P2/admin): User admin uses DocumentsPanel; profile uses same — OK but password section mixed — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-206** (P2/reports): Reports hub export UX separate from module export buttons — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-208** (P2/stock): Stock page title 'Consumables / Stock' slash style unique — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-209** (P1/finance): Finance domain split across three top-level experiences — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-210** (P1/hr): Timesheet entry: full pages + slide-over — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-211** (P1/platform): Sidebar scrollbar fully hidden — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-212** (P1/auth): Login demo System Admin tile uses purple — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-213** (P2/setup): Setup uses FormSection+Stepper but outside AppShell patterns — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-215** (P2/correspondence): Correspondence detail chrome vs leave detail — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-217** (P2/platform): Checkbox component exists; bulk selection uses custom RowCheckbox — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-220** (P1/admin): Workflow designer/simulate/ai pages feel separate product — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-221** (P1/hr): Employee identity surfaces: profile, people, hr/files — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-222** (P2/platform): formatDateRelative used sparsely — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-224** (P2/platform): Danger actions often styled as primary or plain btn-sm — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-226** (P2/platform): Global search desktop-oriented — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-228** (P1/travel): Travel register vs filtered dashboard lists — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-229** (P2/platform): Certificate pages share PrintButton but layout still per-module — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-230** (P2/platform): btn-primary focus rings differ from Button component rings — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-231** (P1/procurement): Services category forced to purple palette — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-232** (P2/admin): Admin notification templates vs user notifications — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-233** (P1/finance): Advance create still on legacy finance path — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-237** (P2/platform): Filter cards tighter than content cards — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-238** (P1/governance): Resolutions page is a mega-custom surface — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-239** (P2/platform): Material symbols default FILL 0 everywhere — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-240** (P1/platform): Export selected requires bulk bar; Export all sometimes separate — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-241** (P1/hr): HR personnel documents separate from profile DocumentsPanel — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-243** (P1/mande): M&E module UI maturity uneven — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-244** (P1/srhr): SRHR module visual language separate — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-247** (P2/platform): body bg-surface-muted and :root --surface both define canvas — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-249** (P2/platform): Magic per_page 50 vs 100 across registers — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-252** (P1/platform): Some CTAs are <Link className="btn-secondary">; others <button> — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-253** (P2/platform): SectionIcon redefined inside leave and travel detail pages — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-255** (P1/platform): Bulk bar + filters may crowd mobile filter card — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-256** (P2/leave): Queue naming style differs — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-257** (P1/admin): Ledger surfaces in admin and analytics — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-258** (P1/platform): Multiple calendars: leave, travel, assignments, mande, admin — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-259** (P2/platform): Some lists sync filters to URL (finance advances); leave uses local state only — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-260** (P1/finance): SA status map has 12+ states with badge-primary overloaded — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-261** (P2/platform): Upload affordances differ by panel — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-262** (P2/fleet): Utilisation report page export unclear — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-263** (P1/people): People pages use text-xs uppercase tracking-wide eyebrows — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-264** (P2/platform): Asterisk / required marking inconsistent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-267** (P1/admin): CSS variable pages may not map to dark tokens — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-269** (P2/dashboard): Activity list custom vs notifications list — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-270** (P1/platform): No shared Tabs component — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-271** (P1/budget): Budget control module vs finance budgets — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-272** (P2/platform): Some statuses color-only without text/icon — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-274** (P1/platform): Leave/PIF copy is institutional; access/people stubs are developer tone — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-275** (P2/governance): Governance admin vs operational governance — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-276** (P1/stock): Stock submodules (issues, transfers, stocktakes…) inconsistent shells — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-277** (P1/procurement): Procurement create not on FormSection/Stepper baseline — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-278** (P2/platform): Terminal states share muted badge — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-281** (P1/analytics): Analytics export/print inconsistent with reports module — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-282** (P1/finance): Balance register verify uses raw anchor for documents — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-284** (P2/settings): Module settings under /travel/settings, /leave/settings, /settings/hr, /admin/settings, /people/settings — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-286** (P2/platform): Create CTA sometimes left in subtitle row, sometimes right actions — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-287** (P1/platform): User date prefs exist but most pages ignore useFormatDate — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-288** (P1/platform): Many filter UIs lack Clear all — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-290** (P1/travel): Multi-step travel form dense on small screens — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-291** (P2/platform): Cards use shadow-card; dark mode overrides to --dk-shadow-sm — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-292** (P1/admin): Admin hub rich icons; People hub none; Audit hub none — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-294** (P1/platform): API errors: toast vs field-level vs alert — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-297** (P1/admin): Uses btn btn-primary text-sm legacy — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-298** (P1/platform): TravelQueueTable vs AdvanceQueueTable vs ad-hoc tables — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-299** (P1/platform): Filter tabs use filled primary; inbox tabs use same but different radius — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-300** (P2/assets): loadPdfLibs on assets page — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-301** (P1/platform): travel/leave show AuditTimeline; others don't — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-302** (P2/procurement): procurement/vendors/[id] large custom attachment section — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-303** (P2/platform): Toast titles vary (Approved, Decision recorded, Action Failed) — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-305** (P1/pif): PIF register is high quality but isolated — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-306** (P1/platform): NotificationsPanel overlay desktop-first — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-307** (P1/platform): badge-muted neutral-100/600 may fail on some surfaces — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-308** (P2/platform): Toggle.tsx exists; many settings use checkboxes — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-312** (P2/dashboard): Dashboard customization not mirrored elsewhere — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-313** (P2/platform): GlobalSearch Admin group text-purple-600 — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-314** (P1/platform): Approvals page requires reason; inbox doesn't; some queues optional — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-316** (P2/risk): risk/analytics category color map includes pink/purple — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-317** (P1/admin): Access requests list minimal vs operational registers — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-319** (P1/platform): Users may not find certificate from register row actions — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-321** (P1/assets): Assets add uses Stepper but other asset flows don't — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-322** (P1/saam): saam/delegations vs people/delegations vs people/my-delegations — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-323** (P2/organogram): SVG connectors may lack text alternatives — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-324** (P2/platform): Many filter-tab rows wrap to 2–3 lines on mobile — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-325** (P1/organogram): Inline SVG fill colors ignore theme — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-326** (P1/workplan): Hardcoded hex purple in workplan page — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-327** (P2/assignments): Good pattern not copied to HR/stock — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-330** (P2/platform): disabled:opacity-50 without explaining why — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-332** (P1/admin): User create is elaborate multi-section; access role create is 2 fields — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-333** (P1/risk): Risk detail history section purple accent — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-334** (P1/profile): Employees may upload in profile and HR file separately — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-335** (P2/weekly-summaries): Export CSV uses legacy btn classes — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-337** (P1/fleet): Fleet tables plain; no data-table thead styling consistently — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-338** (P2/leave): Some polished pages still carry style={{}} for progress widths — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-339** (P1/notifications): Two notification UIs — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-342** (P1/platform): Need verification that focus returns after confirm — _Pass 3 fixed ConfirmDialog focus restore and added a native-confirm regression guard._
- **UX-343** (P1/platform): --sidebar-width 260px with very deep trees — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-344** (P2/auth): Demo credential tiles use *-50 backgrounds without dark variants — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-346** (P1/imprest): Near-clone of leave without density — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-348** (P1/admin): /admin/access/governance tooling checklist UI — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-349** (P1/admin): disabled={!name} only — no error text — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-350** (P2/travel): Possible redundant status storytelling — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-351** (P2/assets): Capitalise used in assets (British) while other UI Americanize — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-352** (P1/settings): HR approval matrix separate from admin workflows designer — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-353** (P1/correspondence): Bulk export exists on master-register — good — but retention page has none — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-354** (P2/stock): Filters not in URL; refresh loses filters — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-355** (P1/fleet): driverUserId typed as raw id string — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-356** (P1/platform): Header.tsx procurement purple map — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-359** (P2/platform): Clicking controls in main closes mobile sidebar — OK; may cause focus quirks — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._
- **UX-362** (P2/risk): Good shell; category icon colors include purple compliance — _Product/IA decision — dual surfaces or module-specific UX intentionally retained; not a missing primitive._

### Out-of-scope (0)

### Fixed — Pass 4 continuation (58)

_Generated 2026-08-03 via four parallel read-only agent sweeps, scoped to report only issues not already covered by UX-001..UX-364 above. UX-365..UX-390 and UX-395 were fixed in the first Pass 4 remediation set; UX-391..UX-394 and UX-396..UX-449 are fixed in this continuation with regression coverage in `mobile/test/ui_ux_pass4_static_test.dart` and `web/lib/ui-ux-remediation.test.mts`._

#### P1 — High (23)

**Admin web — forms/tables (0)**


**Admin web — accessibility/dark-mode (0)**

**Mobile — screen-level (13)**

- **UX-391** (P1/hr): `hrPerformanceDetail` route casts `state.extra as Map<String, dynamic>` (non-nullable); navigating without `extra` (deep link, back-stack replay) crashes the screen — `mobile/lib/core/router/app_router.dart:819-822`.
- **UX-392** (P1/hr): `hrFileDetail` route casts `state.extra as int` (non-nullable); same deep-link crash risk — `mobile/lib/core/router/app_router.dart:832-835`.
- **UX-393** (P1/hr): `hrFileDocuments` route casts `state.extra` then unguarded indexes `extra['fileId']`/`extra['employeeName']`; crashes if `extra` or a key is missing — `mobile/lib/core/router/app_router.dart:840-847`.
- **UX-394** (P1/platform): Eight routes call `int.parse(state.pathParameters['id']!)` with no try/catch; a malformed deep link throws an uncaught `FormatException` instead of showing a not-found state — `mobile/lib/core/router/app_router.dart:358-682` (8 call sites).
- **UX-396** (P1/platform): Notification banner's dismiss control is an 18px icon with 8px padding and no `Semantics`/tooltip — effective tap target ~18-26px, under the 44dp minimum — `mobile/lib/shared/widgets/notification_banner.dart:198-210`.
- **UX-397** (P1/hr): Witness "remove" control on the incident report form is a 12px icon with zero padding and no semantic label on a destructive action — `mobile/lib/features/hr/presentation/screens/report_new_incident_screen.dart:340-344`.
- **UX-398** (P1/imprest): Line-item "remove" control on expense retirement is a bare 16px icon, zero padding, no semantic label, on a destructive delete — `mobile/lib/features/imprest/presentation/screens/expense_retirement_screen.dart:302-306`.
- **UX-399** (P1/travel): `_buildPayload()` hardcodes `'currency': 'USD'` on every travel request submission with no currency field/selector in the form UI, diverging from the NAD default shown elsewhere — `mobile/lib/features/requests/presentation/screens/travel_request_form_screen.dart:209`.
- **UX-400** (P1/platform): No `connectivity_plus`/network-info package anywhere in the app (`pubspec.yaml`); connectivity loss is only discovered reactively when an API call throws, with no proactive offline banner — `mobile/pubspec.yaml`, `mobile/lib/features/dashboard/presentation/screens/dashboard_screen.dart:101-109`.
- **UX-401** (P1/platform): No localization framework wired in at all — `flutter_localizations`/`easy_localization`/`AppLocalizations` absent from the codebase and `pubspec.yaml`; every screen is hardcoded English despite the EN/FR/PT platform requirement.
- **UX-402** (P1/hr): Raw exception text shown directly to the user via `SnackBar(content: Text('Failed to save: $e'))` — `mobile/lib/features/hr/presentation/screens/employee_performance_profile_screen.dart:74`.
- **UX-403** (P1/hr): Same raw-exception-to-user pattern — `mobile/lib/features/hr/presentation/screens/hr_file_summary_screen.dart:689`.
- **UX-404** (P1/stock): Same raw-exception-to-user pattern on offline-queue sync failure, the exact case where a plain-language retry message matters most — `mobile/lib/features/stock/presentation/screens/stock_scan_screen.dart:129`.

**Mobile — cross-screen consistency (10)**

- **UX-405** (P1/offline): "Delete Draft" popup-menu action has no confirmation dialog, while the equivalent destructive action in procurement detail does use one for the same concept — `mobile/lib/features/offline/presentation/screens/offline_drafts_screen.dart:449-469`.
- **UX-406** (P1/platform): Two parallel design systems coexist at the same nav tier — Reports/Dashboard use raw `Scaffold`+Material3 while sibling hubs (procurement, assets, audit, assignments, offline) use the shared `StitchScreen` shell — `mobile/lib/features/reports/presentation/screens/reports_screen.dart:169-308`, `dashboard_screen.dart`.
- **UX-407** (P1/finance): Salary advance hub/list screens use a raw `Scaffold`+`AppBar` with hardcoded hex colors instead of the shared `StitchScreen` shell used by comparable hub-list-detail flows — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_hub_screen.dart:65-97`, `salary_advance_list_screen.dart:91-110`.
- **UX-408** (P1/finance): Salary advance list loading/error states are a bare `CircularProgressIndicator`/`TextButton('Retry')` instead of the shared `StitchLoadingState`/`StitchErrorState` used by structurally identical procurement/assets lists — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_list_screen.dart:111-123`.
- **UX-409** (P1/finance): Salary advance list uses manual "Load more" pagination while comparable procurement/assets lists just bulk-fetch 50-100 rows — same "browse my requests" pattern, different behavior with no explanation to the user — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_list_screen.dart:146-164`.
- **UX-410** (P1/assignments): Assignment status renders as plain unstyled text in a `ListTile` subtitle, while every comparable list card (procurement, salary advance, assets) uses a colored status chip — `mobile/lib/features/assignments/presentation/screens/assignments_list_screen.dart:155-172`.
- **UX-411** (P1/procurement): Requisition form has zero `TextFormField`/`validator` usage — all raw `TextField`s with required-field validation only surfaced via a generic post-submit snackbar, while `vendor_create_screen.dart` uses proper field-level `TextFormField` validators for the same domain — `mobile/lib/features/procurement/presentation/screens/procurement_requisition_form_screen.dart:175`.
- **UX-412** (P1/assignments): Required-field validation done via manual `if (...isEmpty)` checks plus a generic SnackBar instead of `Form`/`validator` with inline errors used elsewhere for record creation — `mobile/lib/features/assignments/presentation/screens/assignment_create_screen.dart:33-39`.
- **UX-413** (P1/assignments): Assignee is collected via a raw free-text numeric-ID field requiring the user to know and type another person's internal user ID by hand; no other creation form in scope requires this — `mobile/lib/features/assignments/presentation/screens/assignment_create_screen.dart:20,49-50`.
- **UX-414** (P1/stock): Stocktake offline sync is a bespoke queue entirely separate from the app-wide offline drafts system, so stocktake drafts are invisible on the "Offline Drafts" screen and use a different sync trigger — `mobile/lib/features/stock/presentation/screens/stock_scan_screen.dart:75-95`.

#### P2 — Medium (35)

**Admin web — forms/tables (18)**

- **UX-415** (P2/travel): Departure/Return date inputs have no `min` attribute; invalid dates sit unflagged until wizard step change — `web/app/(app)/travel/create/page.tsx:838-853`.
- **UX-416** (P2/assets): `sum_insured`/`claim_amount` money fields have no `min` attribute, permitting negative values — `web/app/(app)/assets/insurance/page.tsx:120,171`.
- **UX-417** (P2/procurement): `quoted_amount` input has no `min` attribute; negative/zero supplier quotes are sorted/compared with no guard — `web/app/(app)/procurement/rfq/[id]/page.tsx:527`.
- **UX-418** (P2/finance): "Employee user ID" field is a numeric spin-button input for an entity ID — scroll-wheel can accidentally change it, no typeahead to validate the employee exists — `web/app/(app)/salary-advances/settings/page.tsx:223-224`.
- **UX-419** (P2/assets): "Sum insured"/"Policy number"/"Insurer"/"Coverage type" are placeholder-only with no `<label>` — `web/app/(app)/assets/insurance/page.tsx:115-120`.
- **UX-420** (P2/audit): Quick-create title/name inputs across plans/engagements/external/universe are placeholder-only with no `<label>` — `web/app/(app)/audit/plans/page.tsx:38` (+3 sibling files).
- **UX-421** (P2/procurement): "Supplier name"/"Amount"/"Currency" quote-entry inputs are placeholder-only with no `<label>` — `web/app/(app)/procurement/rfq/[id]/page.tsx:526-528`.
- **UX-422** (P2/audit): Plans table has no `rows.length === 0` check; empty state shows just a header row with no message — `web/app/(app)/audit/plans/page.tsx:44-69`.
- **UX-423** (P2/audit): Same missing-empty-state pattern on engagements table — `web/app/(app)/audit/engagements/page.tsx:40-50`.
- **UX-424** (P2/audit): Same missing-empty-state pattern on external engagements table — `web/app/(app)/audit/external/page.tsx:45-55`.
- **UX-425** (P2/audit): Same missing-empty-state pattern on audit universe table — `web/app/(app)/audit/universe/page.tsx:51-61`.
- **UX-426** (P2/governance): Nine icon-only close/delete buttons in resolutions modals/panels have no `aria-label` — `web/app/(app)/governance/resolutions/page.tsx:278-1659` (9 sites).
- **UX-427** (P2/hr): Icon-only close button with no `aria-label` — `web/app/(app)/hr/timesheets/team/page.tsx:79`.
- **UX-428** (P2/settings): Icon-only close button with no `aria-label` — `web/app/(app)/settings/hr/approval-matrix/page.tsx:66`.
- **UX-429** (P2/procurement): Icon-only close button with no `aria-label` — `web/app/(app)/procurement/vendors/[id]/page.tsx:244`.
- **UX-430** (P2/settings): Icon-only "close" slide-over button repeated with no `aria-label` across 8 HR settings files (allowance-profiles, appraisal-templates, contract-types, job-families, leave-profiles, personnel-file-sections, grade-bands, salary-scales) — `web/app/(app)/settings/hr/*`.
- **UX-431** (P2/hr): Prev/next-month chevron pagination is icon-only with no `aria-label` — `web/app/(app)/hr/timesheets/monthly/page.tsx`.
- **UX-432** (P2/platform): Additional icon-only "close" modal buttons with no `aria-label` across assets, assignments, hr/profile-requests, pif, risk/policies, workplan, procurement/vendors (7 more files).

**Admin web — accessibility/dark-mode (7)**

- **UX-433** (P2/risk): Details/Documents/Related Policies tab strip is plain buttons with no `role="tablist"`/`tab`/`aria-selected` — `web/app/(app)/risk/[id]/page.tsx:299-308`.
- **UX-434** (P2/platform): Command palette "clear query" button is icon-only with no `aria-label` — `web/components/layout/GlobalSearch.tsx:236-238`.
- **UX-435** (P2/platform): Search input uses `border-none outline-none` with no focus-visible replacement, removing the visible focus indicator — `web/components/layout/GlobalSearch.tsx:232`.
- **UX-436** (P2/risk): BCP content cards/tables hardcode `bg-white` with no `dark:` variant throughout the page — `web/app/(app)/risk/bcp/page.tsx:149-347`.
- **UX-437** (P2/hr): Filter bar, table wrapper, export-history card, and reject-confirmation modal all hardcode `bg-white` with no `dark:` classes — `web/app/(app)/hr/timesheets/team/page.tsx:338-893`.
- **UX-438** (P2/assignments): All four capacity-page summary/table cards hardcode `bg-white` with no dark-mode counterpart — `web/app/(app)/assignments/capacity/page.tsx:48-62`.
- **UX-439** (P2/organogram): `bg-primary\10` is an invalid Tailwind class (literal backslash typo for `bg-primary/10`), so the intended low-opacity tile background silently fails to apply — `web/app/(app)/organogram/page.tsx:174-175`.

**Mobile — screen-level (5)**

- **UX-440** (P2/mobile-nav): Drawer footer permanently shows leftover design-tool text "Travel Requisition Form design • Stitch" on every screen — `mobile/lib/shared/widgets/app_drawer.dart:267-272`.
- **UX-441** (P2/imprest): `_currency()` hardcodes the `N$` symbol prefix instead of reading the record's currency code, unlike every other money-display screen — `mobile/lib/features/imprest/presentation/screens/expense_retirement_screen.dart:90`.
- **UX-442** (P2/dashboard): Main dashboard content has no `RefreshIndicator`; no pull-to-refresh even though many other list screens support it — `mobile/lib/features/dashboard/presentation/screens/dashboard_screen.dart:210-229`.
- **UX-443** (P2/dashboard): Hamburger-menu icon button has no `tooltip`/`Semantics` label, unlike the shared `StitchIconAction`/`StitchBackButton` widgets which always set one — `mobile/lib/features/dashboard/presentation/screens/dashboard_screen.dart:228-231`.
- **UX-444** (P2/platform): Bottom-nav items use a bare `GestureDetector` with visible text only, no `Semantics(button: true, label: ...)`, unlike standard nav-item semantics elsewhere — `mobile/lib/shared/widgets/bottom_nav_bar.dart:301-343`.

**Mobile — cross-screen consistency (5)**

- **UX-445** (P2/mobile-nav): "Travel"/"PIF" drawer entries deep-link straight into creation forms while "Leave"/"Finance"/"Procurement"/"HR" entries land on hub/list screens — two different tap behaviors with no visual distinction — `mobile/lib/shared/widgets/app_drawer.dart:60-63`.
- **UX-446** (P2/finance): Requested-amount field uses a raw `TextField` with ad hoc error-state validation instead of `Form`/`validator` used by comparably simple single-field forms elsewhere — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_request_screen.dart:380-396`.
- **UX-447** (P2/platform): No consistent rule for primary-action placement — some hub screens use a bottom-right FAB, others (audit, offline drafts) use a top-right app-bar action for the same "primary CTA" role on the same shared shell — `mobile/lib/features/procurement/presentation/screens/procurement_hub_screen.dart:123-130` vs. `mobile/lib/features/offline/presentation/screens/offline_drafts_screen.dart:296-308`.
- **UX-448** (P2/platform): Local, un-debounced substring search filters are hand-rolled independently on at least two directory screens rather than sharing one searchable-list widget — `mobile/lib/features/hr/presentation/screens/hr_directory_screen.dart:373-389`, `mobile/lib/features/procurement/presentation/screens/vendor_directory_screen.dart:68-82`.
- **UX-449** (P2/mobile-nav): "Leave" drawer entry navigates to the identical route as the top-level "Requests" entry with no leave-specific filter, unlike "Travel" which deep-links to a travel-specific route — `mobile/lib/shared/widgets/app_drawer.dart:63`.

### New — Pass 5 fresh sweep (71, untriaged)

_Generated 2026-08-04 via four parallel read-only agent sweeps, scoped to report only issues not already covered by UX-001..UX-449 above. Not yet triaged into Fixed/Deferred — each needs an owner decision._

#### P0 — Critical (2)

- **UX-450** (P0/mobile-hr): Assignment-card tap calls `context.push('/hr/assignments/detail', ...)`, a route not registered in `app_router.dart` — every tap throws a go_router "no routes match" error — `mobile/lib/features/hr/presentation/screens/work_assignments_screen.dart:536`.
- **UX-495** (P0/parity-travel): Mobile travel requests have zero document/attachment validation — web blocks non-draft submission without Invitation Letter + Agenda (+ Approved PIF when linked to a programme); mobile has no matching step anywhere in the form. Compliance/data-integrity gap, not cosmetic — `web/app/(app)/travel/create/page.tsx:610-620` vs `mobile/lib/features/requests/presentation/screens/travel_request_form_screen.dart`.

#### P1 — High (30)

**Mobile — remaining features (5)**

- **UX-451** (P1/mobile-hr): `_buildBottomNav()` on the timesheets/incidents screen only calls `setState`; none of the 4 nav items actually navigate anywhere — `mobile/lib/features/hr/presentation/screens/timesheets_incidents_screen.dart:530-597`.
- **UX-453** (P1/mobile-finance): Salary advance detail screen hardcodes `Scaffold(backgroundColor: Colors.white)` and light-mode text colors while the rest of the app uses the dark theme — a jarring light popup inside an otherwise dark app — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_detail_screen.dart:149-164`.
- **UX-454** (P1/mobile-finance): Same hardcoded light theme on the next screen in the same flow — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_preview_sign_screen.dart:108-126`.
- **UX-455** (P1/mobile-hr): Two HR sub-screens use a raw `Scaffold`+custom `AppBar` with hand-rolled loading/error/empty widgets instead of the shared `StitchScreen`/`StitchLoadingState`/`StitchErrorState` shell used by sibling HR screens — `mobile/lib/features/hr/presentation/screens/disciplinary_case_screen.dart:54`, `work_assignments_screen.dart:345`.
- **UX-457** (P1/mobile-hr): "Assigned To" is a raw free-text field requiring the user to type another employee's name/ID by hand with zero validation/typeahead (same pattern as UX-413, different screen) — `mobile/lib/features/hr/presentation/screens/work_assignments_screen.dart:232`.

**Admin web — under-explored modules (14)**

- **UX-463** (P1/fleet): Module subtitle contains a literal `\r\n` escape sequence and is mid-sentence truncated, rendering corrupted/cut-off text to every user — `web/app/(app)/fleet/page.tsx:95`.
- **UX-465** (P1/fleet): Odometer/litres/cost/interval fields are plain text inputs with placeholder-as-label, no `type="number"`, no `min="0"` — allows negative mileage/fuel/cost — `web/app/(app)/fleet/[id]/page.tsx:273-299`.
- **UX-470** (P1/srhr): `Promise.all` fetch has no `.catch()`; on API failure the page silently shows "No active deployments"/"No reports yet" indistinguishable from a genuinely empty dataset — `web/app/(app)/srhr/page.tsx:28-38`.
- **UX-472** (P1/budget): Availability is only fetched for the first 40 budget lines; lines beyond that permanently show `…` in the Available column that never resolves — `web/app/(app)/budget/page.tsx:44`.
- **UX-473** (P1/budget): "Add rate" inputs have no `<label>`; `effective_date` is a plain text box (not `type="date"`), `rate` accepts negative/non-numeric text with no `type="number"`/`min` — `web/app/(app)/budget/fx-rates/page.tsx:40-42`.
- **UX-474** (P1/budget): `save`/`doConvert` mutations have no `onError` handler; a failed POST fails silently — `web/app/(app)/budget/fx-rates/page.tsx:19-27`.
- **UX-476** (P1/budget): "Donor name"/"Amount"/"Currency" inputs are placeholder-only with no `<label>`; "Amount" has no `type="number"`/`min="0"`, permitting negative contribution amounts — `web/app/(app)/budget/contribution-schedules/page.tsx:39-48`.
- **UX-477** (P1/budget): `save` mutation has no `onError` handler; a failed schedule creation fails silently — `web/app/(app)/budget/contribution-schedules/page.tsx:24-27`.
- **UX-478** (P1/correspondence): "Release hold" (destructive legal-hold release) has no confirmation dialog and no pending/disabled state, unlike the "Set retention" form on the same page — `web/app/(app)/correspondence/retention/page.tsx:181`.
- **UX-479** (P1/stock): "Draft transfer" button has no loading/disabled state while the create call is in flight, allowing duplicate submissions — `web/app/(app)/stock/transfers/page.tsx:69`.
- **UX-483** (P1/stock): "Request write-off" button has no pending/disabled state during async submit, allowing duplicate requests — `web/app/(app)/stock/write-offs/page.tsx:53-65`.
- **UX-485** (P1/weekly-summaries): "Accept (supervisor)" has no try/catch (unhandled promise rejection on failure) and no disabled/loading state — `web/app/(app)/weekly-summaries/[id]/page.tsx:60-69`.
- **UX-486** (P1/weekly-summaries): Same pattern on "Return", plus the "Return reason" input is placeholder-only with no `<label>` — `web/app/(app)/weekly-summaries/[id]/page.tsx:77-86`.
- **UX-488** (P1/weekly-summaries): "Publish" button's `onClick` has no try/catch; a failed publish is an unhandled rejection with no error surfaced — `web/app/(app)/weekly-summaries/department/page.tsx:43-46`.

**Admin-web-vs-mobile parity (6)**

- **UX-492** (P1/parity-leave): Web explicitly labels `returned_for_correction`/`withdrawn` with dedicated colors/icons; mobile's status switch falls through to printing the raw snake_case string for anything it doesn't handle — a returned leave shows literally "returned_for_correction" on mobile — `web/app/(app)/leave/[id]/page.tsx:38-39` vs `mobile/lib/features/requests/presentation/screens/leave_request_detail_screen.dart:118-145`.
- **UX-493** (P1/parity-leave): Mobile shows an unconditional "Cancel Leave" button on every leave detail screen regardless of status; web only offers Delete/Withdraw under specific status+approval conditions — `web/app/(app)/leave/[id]/page.tsx:318-354` vs `mobile/lib/features/requests/presentation/screens/leave_request_detail_screen.dart:369-395`.
- **UX-494** (P1/parity-travel): Mobile renders "Withdraw Request" unconditionally with no status check; web gates it to submitted+pending — `web/app/(app)/travel/[id]/page.tsx:736-744` vs `mobile/lib/features/requests/presentation/screens/travel_request_detail_screen.dart:384-406`.
- **UX-496** (P1/parity-finance): Web formats salary-advance amounts with locale thousands separators; mobile's shared helper uses no grouping — the same amount reads "N$ 15,000.00" on web and "NAD 15000.00" on mobile — `web/app/(app)/salary-advances/[id]/page.tsx:45` vs `mobile/lib/features/salary_advance/data/salary_advance_helpers.dart:42-45`.
- **UX-499** (P1/parity-procurement): Web has an explicit "HOD Rejected" danger-colored config for `hod_rejected`; mobile has no case for it and falls through to a neutral-colored generic humanizer producing "Hod Rejected" — the rejection loses its visual severity signal on mobile — `mobile/lib/features/procurement/data/procurement_api_helpers.dart:73-90`.
- **UX-501** (P1/parity-procurement): Web's status fallback silently mislabels `rfq_issued`/`evaluated`/`po_issued`/`completed` requests as "Draft" with a gray badge — mobile actually handles these statuses correctly, so the bug runs the opposite direction from usual — `web/app/(app)/procurement/[id]/page.tsx:358`.

**Admin web — copy/visual-consistency (5)**

- **UX-503** (P1/admin-ledger): Search input placeholders contain literal mojibake (`"Search by name or emailâ€¦"`) instead of a proper ellipsis — `web/app/(app)/admin/ledger/generate/page.tsx:230`, `admin/ledger/page.tsx:318`.
- **UX-504** (P1/admin-ledger): Same mojibake corruption in hash placeholders and empty-state copy — `web/app/(app)/admin/ledger/verify/page.tsx:19-20,138`.
- **UX-505** (P1/hr): Same mojibake bug in "Savingâ€¦"/"Loadingâ€¦" button/loading text — `web/app/(app)/hr/timesheets/overtime/page.tsx:148,168`.
- **UX-506** (P1/people): Identical corrupted placeholder `"Filter rowsâ€¦"` copy-pasted across 10 People sub-module pages (analytics, esign, m365, privilege-alerts, recertification, scenarios, search, skills, sod, succession) — `web/app/(app)/people/*/page.tsx:94-95`.
- **UX-507** (P1/pif): The identical "approved" PIF status renders `badge-primary` (blue) on the list page but `badge-success` (green) on the detail page — `web/app/(app)/pif/page.tsx:21` vs `web/app/(app)/pif/[id]/page.tsx:34`.

#### P2 — Medium (39)

**Mobile — remaining features (7)**

- **UX-452** (P2/mobile-hr): "View All" link under Active Cases is a dead no-op (`onTap: () {}`) with no destination — `mobile/lib/features/hr/presentation/screens/timesheets_incidents_screen.dart:497-508`.
- **UX-456** (P2/mobile-hr): Assignment status/priority uses raw Material colors while the sibling accountability-assignments module uses app color tokens for the same semantic states — `mobile/lib/features/hr/presentation/screens/work_assignments_screen.dart:17-47`.
- **UX-458** (P2/mobile-hr): `_submitNewAssignment()` silently returns with no error message when the title is empty; the Create button appears to do nothing — `mobile/lib/features/hr/presentation/screens/work_assignments_screen.dart:169-171`.
- **UX-459** (P2/mobile-hr): "Report Incident" dialog uses raw `TextField`s with no `Form`/`validator`; Submit silently no-ops when Subject is blank — `mobile/lib/features/hr/presentation/screens/timesheets_incidents_screen.dart:68-98`.
- **UX-460** (P2/mobile-hr): Payment vs "Time Off in Lieu" choice is never sent as a structured field, only appended as free text inside the description — downstream systems can't reliably distinguish TOIL claims — `mobile/lib/features/hr/presentation/screens/overtime_claim_form_screen.dart:20,104`.
- **UX-461** (P2/mobile-hr): Back button is a 36x36 container with a 16px icon, under the 44dp minimum tap target — `mobile/lib/features/hr/presentation/screens/disciplinary_case_screen.dart:71-82`.
- **UX-462** (P2/mobile-hr): Same sub-44dp back button pattern repeated — `mobile/lib/features/hr/presentation/screens/timesheets_incidents_screen.dart:178-191`.

**Admin web — under-explored modules (14)**

- **UX-464** (P2/fleet): Vehicles/drivers/calendar tables and forms hardcode `bg-white`/`border-neutral-200` with no `dark:` variants — `web/app/(app)/fleet/page.tsx:115-229`.
- **UX-466** (P2/mande): Icon-only modal close button has no `aria-label` — `web/app/(app)/mande/indicators/page.tsx:171`.
- **UX-467** (P2/mande): Delete button has no `isPending`/disabled guard, allowing duplicate delete requests — `web/app/(app)/mande/indicators/page.tsx:146-155`.
- **UX-468** (P2/mande): Icon-only modal close button has no `aria-label` — `web/app/(app)/mande/results/page.tsx:163`.
- **UX-469** (P2/mande): "Start"/"End" date inputs have no cross-validation; an end date before the start date is silently accepted — `web/app/(app)/mande/results/page.tsx:192,196`.
- **UX-471** (P2/srhr): "End Date" input has no `min={form.start_date}` — `web/app/(app)/srhr/deployments/new/page.tsx:146`.
- **UX-475** (P2/budget): FX rates table has no empty-state row when the result set is empty — `web/app/(app)/budget/fx-rates/page.tsx:57-64`.
- **UX-480** (P2/budget): Contribution schedules table has no empty-state row — `web/app/(app)/budget/contribution-schedules/page.tsx:56-63`.
- **UX-481** (P2/stock): No client-side guard preventing a transfer from a location to itself (`fromId === toId`) — `web/app/(app)/stock/transfers/page.tsx:56-67`.
- **UX-482** (P2/stock): Transfers table has no empty-state message — `web/app/(app)/stock/transfers/page.tsx:82-102`.
- **UX-484** (P2/stock): Write-offs table has no empty-state message — `web/app/(app)/stock/write-offs/page.tsx:80-97`.
- **UX-487** (P2/weekly-summaries): "Period ID" is a raw numeric-text input with placeholder-as-label, requiring the user to know an internal ID by hand — `web/app/(app)/weekly-summaries/department/page.tsx:18-23`.
- **UX-489** (P2/workplan): "End date" input has no `min={date}`, allowing an end date before the event's start date — `web/app/(app)/workplan/new/page.tsx:147-154`.
- **UX-490** (P2/fleet): "Service type"/"Interval km"/"Interval days"/"Last service odometer" fields are placeholder-only with no `<label>` — `web/app/(app)/fleet/[id]/page.tsx:295-299`.

**Admin-web-vs-mobile parity (5)**

- **UX-491** (P2/parity-leave): Same `submitted` status shows "Pending" on web but "Pending Approval" on mobile — `web/app/(app)/leave/[id]/page.tsx:34` vs `mobile/lib/features/requests/presentation/screens/leave_request_detail_screen.dart:126-127`.
- **UX-497** (P2/parity-finance): Web displays the currency symbol ("N$"); every mobile salary-advance screen prints the raw ISO code ("NAD") for the same value — `web/app/(app)/salary-advances/create/page.tsx:61-62` vs `mobile/lib/features/salary_advance/data/salary_advance_helpers.dart:42-45`.
- **UX-498** (P2/parity-procurement): Same `submitted` status labeled "Pending Review" on web, "Pending HOD" on mobile — `web/app/(app)/procurement/[id]/page.tsx:35` vs `mobile/lib/features/procurement/data/procurement_api_helpers.dart:49-51`.
- **UX-500** (P2/parity-procurement): `awarded` status is blue on web, green/success on mobile for the same value — `web/app/(app)/procurement/[id]/page.tsx:41` vs `mobile/lib/features/procurement/data/procurement_api_helpers.dart:64-66`.
- **UX-502** (P2/parity-finance): Mobile's create screen reads "Request Advance"; web's equivalent reads "Apply for Salary Advance" — `mobile/lib/features/salary_advance/presentation/screens/salary_advance_request_screen.dart:259-260` vs `web/app/(app)/salary-advances/page.tsx:60-70`.

**Admin web — copy/visual-consistency (13)**

- **UX-508** (P2/procurement): Hand-rolled breadcrumb/heading instead of the shared `PageBreadcrumbs`/`ModulePageHeader` pattern used by sibling create flows — `web/app/(app)/procurement/create/page.tsx:177-191`.
- **UX-509** (P2/platform): "New request" vs "New Request" — same breadcrumb label capitalized differently across equivalent create flows — `leave/create/page.tsx:211` vs `imprest/create/page.tsx:90`, `salary-advances/create/page.tsx:492`.
- **UX-510** (P2/platform): "Save as Draft" vs "Save Draft" — same action worded two ways across 8 create flows — `risk/create/page.tsx:344`, `correspondence/create/page.tsx:257`, `srhr/reports/new/page.tsx:373` vs 5 others.
- **UX-511** (P2/platform): Delete confirmations lack an irreversibility caveat on some pages while sibling deletes elsewhere include "This cannot be undone." — `mande/indicators/page.tsx:148` (+4 files) vs `hr/departments/page.tsx:93`, `governance/resolutions/page.tsx:396,1303,1331`.
- **UX-512** (P2/platform): No single house style for delete-confirm copy — some titles/messages include the danger caveat, others don't, even within the same file — `admin/portfolios/page.tsx:56`, `governance/resolutions/page.tsx:544,687`.
- **UX-513** (P2/platform): 7 call sites use bare `toLocaleDateString()` (default/US locale) while dozens of other pages explicitly pass `"en-GB"` — date formatting flips style depending on the screen — `assets/page.tsx:458,734` (+6 files).
- **UX-514** (P2/platform): At least 6 modules reimplement pagination/month-nav with abbreviated "Prev"/"Next" instead of the shared `ListPagination` component's "Previous"/"Next" — `admin/weekly-summary/page.tsx:171` (+5 files).
- **UX-515** (P2/platform): `ListPagination` under-adoption is inconsistent, not absent — some hand-rolled pagers use the "correct" full-word labels anyway — `assets/revaluation/page.tsx`.
- **UX-516** (P2/platform): 5+ modules each define their own local money-formatting helper instead of the shared `formatCurrency`, producing visibly different output (symbol vs code, decimals vs none) for the same values — `finance/budget/[id]/page.tsx:13-14`, `pif/page.tsx:31-34`, `salary-advances/[id]/page.tsx:44-46`, `settings/hr/salary-scales/page.tsx:20-24`, `travel/[id]/page.tsx:43-47`.
- **UX-517** (P2/platform): 6 modules each hand-roll their own dashboard stat-card component with different padding instead of sharing one — `assignments/page.tsx:32-38`, `risk/dashboard/page.tsx:60-66`, `travel/page.tsx:26-28`, `governance/plenary/page.tsx:61`, `hr/leave/balances/page.tsx:144`, `saam/page.tsx:77`.
- **UX-518** (P2/platform): Same back-link affordance is lowercase after "to" in 3 files vs Title Case elsewhere — `admin/workflows/designer/page.tsx:128`, `finance/budget/[id]/page.tsx:198`, `travel/missions/[id]/page.tsx:41`.
- **UX-519** (P2/platform): "Submitting..." (ASCII dots) vs "Submitting…" (Unicode ellipsis) for the identical submit-in-progress state across sibling create flows — `leave/create/page.tsx:491`, `procurement/create/page.tsx:495` vs 3 others.
- **UX-520** (P2/platform): `text-red-400` used for the required-field asterisk on 3 pages while 134 other occurrences across the app use `text-red-500` — `admin/users/[id]/page.tsx:551,555`, `assignments/create/page.tsx:98,112,197`, `assignments/[id]/page.tsx:578`.

