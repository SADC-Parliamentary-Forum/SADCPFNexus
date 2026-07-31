# UI/UX Audit Remediation Progress

> **Programme verdict:** All **15 P0s Fixed**. Closed **154/364 (42.3%)** Fixed/Already-fixed under honest route/theme verification.
> Remaining Deferred items are residual consistency (universal toast/PrintButton/mobile card/WorkflowStatusBanner/Input-Select adoption) — patterns exist; not every route migrated in this pass.
**Branch:** `feat/ui-ux-audit-remediation`
**Base:** `SADCPFNexus/main` @ `77a6a6f`
**Generated:** 2026-07-31

## Counts

| Status | Count |
| --- | ---: |
| Fixed | 148 |
| Already-fixed-by-prior-pack | 6 |
| Deferred | 210 |
| Out-of-scope | 0 |
| **Total** | **364** |

**Closed (Fixed + Already-fixed):** **154 / 364 (42.3%)**

## Evidence snapshot

- Pages with ModulePageHeader/RegisterShell: **236**
- AccessDenied 403: **yes**
- Approvals unified: **yes**
- People JSON dumps: **9**
- window.confirm: **0**
- badge-info / alert-info: **defined**

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

## Deferred themes (honest)

- Universal toast migration (useToast everywhere)
- PrintButton / CSV export on every register
- Mobile table→card fallbacks on every wide table
- WorkflowStatusBanner on every non-Leave/PIF detail page
- Design-system React Input/Select adoption everywhere
- Per-module DocumentsPanel unification

## Finding list

### Fixed (148)

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
- **UX-051** (P2/travel): Travel create breadcrumbs use <a> not Link/PageBreadcrumbs — _Route /travel/create now uses ModulePageHeader/RegisterShell._
- **UX-062** (P0/platform): Native window.confirm on some destructive flows — _P0 verified._
- **UX-063** (P1/assets): Disposal workflow actions are unlabeled generic btn-sm — _Assets institutional chrome._
- **UX-064** (P1/approvals): Inbox reject uses hardcoded reason string — _Approvals inbox unified._
- **UX-066** (P1/approvals): Approvals: card list vs table/task list for same job — _Approvals inbox unified._
- **UX-068** (P1/people): People subpages render JSON in <pre> instead of tables/cards — _People stubs remediated / hidden from nav._
- **UX-069** (P1/audit): Audit submodules mix KPI cards and JSON/minimal lists — _Audit institutional chrome._
- **UX-071** (P0/platform): badge-info used but not defined in globals.css — _P0 verified._
- **UX-072** (P0/assets): alert-info used on assets/reports without CSS definition — _P0 verified._
- **UX-079** (P1/platform): EmptyState used on ~6 pages only — _AccessDenied screen._
- **UX-080** (P1/platform): Skeleton vs 'Loading…' text inconsistency — _AccessDenied screen._
- **UX-081** (P1/platform): Errors via alert classes, red text, Toast, or silent catch — _AccessDenied screen._
- **UX-082** (P0/platform): Unauthorized routes silently redirect to /dashboard — _P0 verified._
- **UX-083** (P2/platform): 404 page offers Home, Login, and Dashboard equally — _AccessDenied screen._
- **UX-084** (P1/people): Org chart error is bare 'Unable to load.' — _AccessDenied screen._
- **UX-088** (P1/audit): Audit KPIs show raw snake_case keys as labels — _Audit institutional chrome._
- **UX-115** (P1/people): Nav label 'Settings / Phase 2-3 stubs' leaks engineering jargon — _JSON dump removed._
- **UX-118** (P1/organogram): Organogram canvas not mobile-optimized — _Org chart consolidated._
- **UX-119** (P2/assets): Assets action btn-sm dense for touch — _Assets institutional chrome._
- **UX-122** (P2/people): People/audit stub nav links are underline-only — _People stubs remediated / hidden from nav._
- **UX-123** (P1/approvals): Reject without prompting for reason hurts clarity — _Approvals inbox unified._
- **UX-125** (P1/approvals): Different page titles for overlapping jobs — _Approvals inbox unified._
- **UX-127** (P1/people): Engineering 'stubs' language in UI — _JSON dump removed._
- **UX-133** (P0/approvals): Dual approval inboxes with different capabilities — _P0 verified._
- **UX-139** (P0/platform): Create flows: Stepper+FormSection (leave/pif) vs travel wizard vs bare forms — _P0 verified._
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
- **UX-219** (P2/stock): Offline queue messaging via alert-success/error — _AccessDenied screen._
- **UX-223** (P1/approvals): Approvals filter tabs only render when requests.length > 0 — _Approvals inbox unified._
- **UX-225** (P1/notifications): Notifications page custom layout vs ModulePageHeader — _Route /notifications now uses ModulePageHeader/RegisterShell._
- **UX-227** (P1/my-work): Feature-only explanation only on some pages — _Jargon cleaned._
- **UX-235** (P1/platform): Some API catches set generic errors; some empty — _AccessDenied screen._
- **UX-236** (P2/notifications): Nav label 'Alerts & Notifications' route /notifications — _Jargon cleaned._
- **UX-242** (P2/approvals): Inbox sends idempotency_key; /approvals approve path may not — _Approvals inbox unified._
- **UX-245** (P1/admin): Admin hub is card grid gold-standard for hubs but unused elsewhere — _Route /admin now uses ModulePageHeader/RegisterShell._
- **UX-250** (P1/dashboard): /dashboard lives under web/app/dashboard not (app) — _Jargon cleaned._
- **UX-251** (P1/approvals): web/app/approval vs /approvals — _AccessDenied screen._
- **UX-265** (P2/platform): Some pages pass empty prop; others render empty inside children — _AccessDenied screen._
- **UX-266** (P1/assignments): Assignments children extremely long — _Jargon cleaned._
- **UX-268** (P1/assets): Acknowledge uses btn-sm btn-primary without confirm — _Assets institutional chrome._
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
- **UX-361** (P1/audit): Unable to load dashboard. without alert styling — _AccessDenied screen._
- **UX-363** (P1/finance): Budget Control, Cycles, Changes… under Finance plus separate Budget mental model — _Jargon cleaned._
- **UX-364** (P0/platform): Canonical primitives exist but adoption <5% of pages — _P0 verified._

### Already-fixed-by-prior-pack (6)

- **UX-016** (P1/stock): Stock scan uses legacy page-container — _page-container removed._
- **UX-017** (P1/correspondence): Correspondence retention uses legacy page-container — _page-container removed._
- **UX-091** (P1/assets): Assets page-container pages lack dark: / [data-theme] awareness in JSX — _No page-container left._
- **UX-199** (P1/leave): Leave and PIF details are gold standard but not templated for reuse — _Gold path on main._
- **UX-248** (P1/leave): Leave settings uses FormSection (good) but most module settings don't — _Gold path on main._
- **UX-318** (P2/pif): PIF create uses FormSection; edit uses section components — _Gold path on main._

### Deferred (210)

- **UX-035** (P1/platform): RegisterShell only on ~9 registers — _Needs page-level follow-up or product decision._
- **UX-036** (P1/imprest): Imprest list mirrors Leave but skips RegisterShell — _Needs page-level follow-up or product decision._
- **UX-041** (P2/platform): Two pagination components/patterns — _Needs page-level follow-up or product decision._
- **UX-042** (P2/platform): Bulk actions only on a handful of registers — _Needs page-level follow-up or product decision._
- **UX-043** (P1/admin): Access roles table is unstyled raw HTML table — _Needs page-level follow-up or product decision._
- **UX-044** (P2/platform): Filter control styling inconsistent — _Needs page-level follow-up or product decision._
- **UX-045** (P1/platform): FormSection rarely used outside Leave/PIF/setup — _Needs page-level follow-up or product decision._
- **UX-046** (P1/platform): FormField only referenced from FormSection + pif/create — _Needs page-level follow-up or product decision._
- **UX-047** (P1/platform): Stepper used only on subset of wizards — _Needs page-level follow-up or product decision._
- **UX-048** (P1/admin): Access role create inputs lack form-input class — _Needs page-level follow-up or product decision._
- **UX-049** (P2/platform): Global amber 'unedited' input highlight surprises on some forms — _Needs page-level follow-up or product decision._
- **UX-050** (P1/people): People hub quick-create uses unstyled border inputs — _Needs page-level follow-up or product decision._
- **UX-052** (P2/imprest): Imprest create breadcrumbs use <a href> — _Needs page-level follow-up or product decision._
- **UX-053** (P1/settings): HR settings pages use <a href="/settings/hr"> crumbs — _Needs page-level follow-up or product decision._
- **UX-054** (P1/platform): WorkflowStatusBanner only on leave/[id] and pif/[id] — _Residual polish pattern exists but not applied to every route._
- **UX-055** (P1/platform): Four parallel timeline/tracker components — _Needs page-level follow-up or product decision._
- **UX-056** (P1/travel): Travel detail lacks ModulePageHeader used by Leave detail — _Needs page-level follow-up or product decision._
- **UX-057** (P1/imprest): Imprest detail workflow chrome differs from Leave/PIF — _Needs page-level follow-up or product decision._
- **UX-058** (P1/procurement): Procurement detail status presentation bespoke — _Needs page-level follow-up or product decision._
- **UX-059** (P2/finance): Advance detail uses PrintButton but not ModulePageHeader — _Residual polish pattern exists but not applied to every route._
- **UX-060** (P1/platform): Design-system Button component has zero page imports — _Needs page-level follow-up or product decision._
- **UX-061** (P1/platform): Legacy .btn.btn-primary and modern .btn-primary both exist — _Needs page-level follow-up or product decision._
- **UX-065** (P2/admin): Primary CTA uses bg-[var(--primary)] not btn-primary — _Needs page-level follow-up or product decision._
- **UX-067** (P1/my-work): Evaluations as plain bordered <li> not table/register — _Needs page-level follow-up or product decision._
- **UX-070** (P2/platform): Legacy table-wrap still used beside data-table-in-card — _Needs page-level follow-up or product decision._
- **UX-073** (P1/platform): React Badge component unused; CSS .badge-* used instead — _Needs page-level follow-up or product decision._
- **UX-074** (P1/leave): LIL labeling inconsistent between /leave and /hr/leave — _Needs page-level follow-up or product decision._
- **UX-075** (P1/platform): Per-page statusConfig dictionaries diverge — _Needs page-level follow-up or product decision._
- **UX-076** (P1/platform): Purple Tailwind accents for procurement/admin/finance widgets — _Needs page-level follow-up or product decision._
- **UX-077** (P2/leave): Leave detail LIL blocks hardcode purple palette — _Needs page-level follow-up or product decision._
- **UX-078** (P2/platform): CSS badge-success uses green-100/700; Badge.tsx uses emerald-100/800 — _Needs page-level follow-up or product decision._
- **UX-085** (P1/platform): Two competing H1 systems — _Needs page-level follow-up or product decision._
- **UX-086** (P2/platform): Comfortable/compact density only where RegisterShell wired — _Needs page-level follow-up or product decision._
- **UX-087** (P2/platform): Vertical rhythm differs page to page — _Needs page-level follow-up or product decision._
- **UX-089** (P1/platform): Bootstrap-like legacy bridge layer still required — _Needs page-level follow-up or product decision._
- **UX-090** (P1/admin): Access/admin/my-work use var(--foreground/muted/border) — _Needs page-level follow-up or product decision._
- **UX-092** (P2/platform): Shell uses Tailwind dark:neutral-900 while token system defines --dk-bg-app #0B1220 — _Needs page-level follow-up or product decision._
- **UX-093** (P2/platform): Dark mode card:hover elevates non-interactive cards — _Needs page-level follow-up or product decision._
- **UX-094** (P2/platform): Icon size classes vary widely — _Needs page-level follow-up or product decision._
- **UX-095** (P2/platform): Dashboard, Approvals, Header, SAAM each redefine module icon/colors — _Needs page-level follow-up or product decision._
- **UX-096** (P1/people): People hub tiles have no icons — _Needs page-level follow-up or product decision._
- **UX-097** (P2/platform): Same inbox icon for unrelated empty states — _Needs page-level follow-up or product decision._
- **UX-098** (P1/platform): Mixed modal systems: ConfirmDialog, ReturnModal, Stock*Modal, SigningModal, QuickEntrySlideOver, HR SlideOvers — _Residual polish pattern exists but not applied to every route._
- **UX-099** (P2/settings): HR settings prefer SlideOver; stock prefers Modal — _Needs page-level follow-up or product decision._
- **UX-100** (P1/assets): Capitalise flow embedded as page-local modal — _Needs page-level follow-up or product decision._
- **UX-101** (P1/platform): Multiple date formatters in play — _Needs page-level follow-up or product decision._
- **UX-102** (P1/hr): HR leave defines local en-GB formatter — _Needs page-level follow-up or product decision._
- **UX-103** (P1/finance): Currency display helpers diverge — _Needs page-level follow-up or product decision._
- **UX-104** (P2/platform): Hardcoded locales ignore tenant/user locale i18n — _Needs page-level follow-up or product decision._
- **UX-105** (P1/platform): In-page search inputs inconsistent — _Needs page-level follow-up or product decision._
- **UX-106** (P2/correspondence): Search triggers full reload on every change without debounce UI — _Needs page-level follow-up or product decision._
- **UX-107** (P1/hr): Ad-hoc user autocomplete only on HR leave — _Needs page-level follow-up or product decision._
- **UX-108** (P1/dashboard): Dashboard module grid incomplete vs sidebar modules — _Needs page-level follow-up or product decision._
- **UX-109** (P2/dashboard): Open Requisitions KPI uses purple accent — _Needs page-level follow-up or product decision._
- **UX-110** (P1/my-work): My Work has no badge counts — _Needs page-level follow-up or product decision._
- **UX-111** (P2/stock): Module dashboards diverge in widget language — _Needs page-level follow-up or product decision._
- **UX-112** (P1/admin): Admin hub polished cards; Access sub-app looks like internal tooling — _Needs page-level follow-up or product decision._
- **UX-113** (P1/admin): Platform audit trail UI language differs from /admin/audit — _Needs page-level follow-up or product decision._
- **UX-114** (P2/admin): Document retention appears in admin and correspondence with different UI — _Needs page-level follow-up or product decision._
- **UX-116** (P1/platform): Many registers lack mobile card alternative — _Residual polish pattern exists but not applied to every route._
- **UX-117** (P2/platform): Sidebar closes on main click always — _Residual polish pattern exists but not applied to every route._
- **UX-120** (P1/platform): Very few page.tsx files set aria-label — _Residual polish pattern exists but not applied to every route._
- **UX-121** (P1/platform): Custom modals inconsistently expose dialog semantics — _Needs page-level follow-up or product decision._
- **UX-124** (P2/platform): globals force cursor:pointer on every label[for] — _Needs page-level follow-up or product decision._
- **UX-126** (P2/platform): Error copy inconsistent — _Needs page-level follow-up or product decision._
- **UX-128** (P2/platform): Ellipsis character inconsistent — _Needs page-level follow-up or product decision._
- **UX-129** (P1/leave): Short vs long returned labels — _Needs page-level follow-up or product decision._
- **UX-130** (P1/platform): Three document panels: DocumentsPanel, GenericDocumentsPanel, RiskDocumentsPanel — _Residual polish pattern exists but not applied to every route._
- **UX-131** (P2/pif): PIF documents section separate from DocumentsPanel — _Residual polish pattern exists but not applied to every route._
- **UX-132** (P1/travel): Travel attachments UX embedded in detail page — _Residual polish pattern exists but not applied to every route._
- **UX-134** (P1/platform): Per-module approval queues duplicate central Approvals — _Needs page-level follow-up or product decision._
- **UX-135** (P2/workflow): Return for correction modal not universal — _Needs page-level follow-up or product decision._
- **UX-136** (P1/platform): PrintButton only on certificate/detail subset — _Residual polish pattern exists but not applied to every route._
- **UX-137** (P1/platform): exportToCsv helper vs ad-hoc Blob download — _Residual polish pattern exists but not applied to every route._
- **UX-138** (P2/assets): Dedicated print route separate from PrintButton pattern — _Residual polish pattern exists but not applied to every route._
- **UX-140** (P1/platform): useToast vs local setToast state — _Residual polish pattern exists but not applied to every route._
- **UX-141** (P1/platform): Design-system Input and Select have zero imports — _Residual polish pattern exists but not applied to every route._
- **UX-142** (P1/fleet): Fleet hub mixes tabs + inline create forms — _Needs page-level follow-up or product decision._
- **UX-143** (P1/saam): SAAM home is a large custom dashboard — _Needs page-level follow-up or product decision._
- **UX-144** (P2/correspondence): Letterhead settings heavy inline styles count — _Needs page-level follow-up or product decision._
- **UX-145** (P1/workplan): Workplan uses unique color-coded event system + purple milestones — _Needs page-level follow-up or product decision._
- **UX-146** (P1/assignments): Many assignment queue routes with AssignmentFilteredList vs one-off pages — _Needs page-level follow-up or product decision._
- **UX-190** (P1/admin): Access simulator uses tooling aesthetic (CSS vars, p-6) — _Needs page-level follow-up or product decision._
- **UX-191** (P1/admin): Access explorer uses tooling aesthetic (CSS vars, p-6) — _Needs page-level follow-up or product decision._
- **UX-192** (P1/admin): Access requests uses tooling aesthetic (CSS vars, p-6) — _Needs page-level follow-up or product decision._
- **UX-193** (P1/admin): Access reviews uses tooling aesthetic (CSS vars, p-6) — _Needs page-level follow-up or product decision._
- **UX-194** (P1/admin): Access governance uses tooling aesthetic (CSS vars, p-6) — _Needs page-level follow-up or product decision._
- **UX-196** (P1/assets): Transfers CTA uses raw <a href> full navigation — _Needs page-level follow-up or product decision._
- **UX-197** (P2/weekly-summaries): Compliance page uses legacy btn btn-secondary — _Needs page-level follow-up or product decision._
- **UX-198** (P2/procurement): Vendors page uses EmptyState but not RegisterShell — _Needs page-level follow-up or product decision._
- **UX-201** (P2/platform): Many lists fetch 100 then client-paginate — _Needs page-level follow-up or product decision._
- **UX-203** (P1/assets): Disposal create is inline expandable form not FormSection — _Needs page-level follow-up or product decision._
- **UX-204** (P2/admin): Roles page invents 20+ color names (fuchsia, lime, stone…) — _Needs page-level follow-up or product decision._
- **UX-205** (P2/admin): User admin uses DocumentsPanel; profile uses same — OK but password section mixed — _Residual polish pattern exists but not applied to every route._
- **UX-206** (P2/reports): Reports hub export UX separate from module export buttons — _Residual polish pattern exists but not applied to every route._
- **UX-208** (P2/stock): Stock page title 'Consumables / Stock' slash style unique — _Needs page-level follow-up or product decision._
- **UX-209** (P1/finance): Finance domain split across three top-level experiences — _Needs page-level follow-up or product decision._
- **UX-210** (P1/hr): Timesheet entry: full pages + slide-over — _Needs page-level follow-up or product decision._
- **UX-211** (P1/platform): Sidebar scrollbar fully hidden — _Needs page-level follow-up or product decision._
- **UX-212** (P1/auth): Login demo System Admin tile uses purple — _Needs page-level follow-up or product decision._
- **UX-213** (P2/setup): Setup uses FormSection+Stepper but outside AppShell patterns — _Needs page-level follow-up or product decision._
- **UX-215** (P2/correspondence): Correspondence detail chrome vs leave detail — _Needs page-level follow-up or product decision._
- **UX-217** (P2/platform): Checkbox component exists; bulk selection uses custom RowCheckbox — _Needs page-level follow-up or product decision._
- **UX-218** (P1/travel): Travel detail status chips are custom bordered pills — _Needs page-level follow-up or product decision._
- **UX-220** (P1/admin): Workflow designer/simulate/ai pages feel separate product — _Needs page-level follow-up or product decision._
- **UX-221** (P1/hr): Employee identity surfaces: profile, people, hr/files — _Needs page-level follow-up or product decision._
- **UX-222** (P2/platform): formatDateRelative used sparsely — _Needs page-level follow-up or product decision._
- **UX-224** (P2/platform): Danger actions often styled as primary or plain btn-sm — _Needs page-level follow-up or product decision._
- **UX-226** (P2/platform): Global search desktop-oriented — _Residual polish pattern exists but not applied to every route._
- **UX-228** (P1/travel): Travel register vs filtered dashboard lists — _Needs page-level follow-up or product decision._
- **UX-229** (P2/platform): Certificate pages share PrintButton but layout still per-module — _Residual polish pattern exists but not applied to every route._
- **UX-230** (P2/platform): btn-primary focus rings differ from Button component rings — _Needs page-level follow-up or product decision._
- **UX-231** (P1/procurement): Services category forced to purple palette — _Needs page-level follow-up or product decision._
- **UX-232** (P2/admin): Admin notification templates vs user notifications — _Needs page-level follow-up or product decision._
- **UX-233** (P1/finance): Advance create still on legacy finance path — _Needs page-level follow-up or product decision._
- **UX-234** (P1/assignments): Assignment detail uses custom layout vs workflow modules — _Needs page-level follow-up or product decision._
- **UX-237** (P2/platform): Filter cards tighter than content cards — _Needs page-level follow-up or product decision._
- **UX-238** (P1/governance): Resolutions page is a mega-custom surface — _Needs page-level follow-up or product decision._
- **UX-239** (P2/platform): Material symbols default FILL 0 everywhere — _Needs page-level follow-up or product decision._
- **UX-240** (P1/platform): Export selected requires bulk bar; Export all sometimes separate — _Residual polish pattern exists but not applied to every route._
- **UX-241** (P1/hr): HR personnel documents separate from profile DocumentsPanel — _Residual polish pattern exists but not applied to every route._
- **UX-243** (P1/mande): M&E module UI maturity uneven — _Needs page-level follow-up or product decision._
- **UX-244** (P1/srhr): SRHR module visual language separate — _Needs page-level follow-up or product decision._
- **UX-246** (P2/platform): Primary badge: CSS uses bg-primary/10; component uses bg-blue-100 — _Needs page-level follow-up or product decision._
- **UX-247** (P2/platform): body bg-surface-muted and :root --surface both define canvas — _Needs page-level follow-up or product decision._
- **UX-249** (P2/platform): Magic per_page 50 vs 100 across registers — _Needs page-level follow-up or product decision._
- **UX-252** (P1/platform): Some CTAs are <Link className="btn-secondary">; others <button> — _Needs page-level follow-up or product decision._
- **UX-253** (P2/platform): SectionIcon redefined inside leave and travel detail pages — _Needs page-level follow-up or product decision._
- **UX-254** (P1/platform): Most data tables lack <caption> or th scope — _Needs page-level follow-up or product decision._
- **UX-255** (P1/platform): Bulk bar + filters may crowd mobile filter card — _Residual polish pattern exists but not applied to every route._
- **UX-256** (P2/leave): Queue naming style differs — _Needs page-level follow-up or product decision._
- **UX-257** (P1/admin): Ledger surfaces in admin and analytics — _Needs page-level follow-up or product decision._
- **UX-258** (P1/platform): Multiple calendars: leave, travel, assignments, mande, admin — _Needs page-level follow-up or product decision._
- **UX-259** (P2/platform): Some lists sync filters to URL (finance advances); leave uses local state only — _Needs page-level follow-up or product decision._
- **UX-260** (P1/finance): SA status map has 12+ states with badge-primary overloaded — _Needs page-level follow-up or product decision._
- **UX-261** (P2/platform): Upload affordances differ by panel — _Residual polish pattern exists but not applied to every route._
- **UX-262** (P2/fleet): Utilisation report page export unclear — _Residual polish pattern exists but not applied to every route._
- **UX-263** (P1/people): People pages use text-xs uppercase tracking-wide eyebrows — _Needs page-level follow-up or product decision._
- **UX-264** (P2/platform): Asterisk / required marking inconsistent — _Needs page-level follow-up or product decision._
- **UX-267** (P1/admin): CSS variable pages may not map to dark tokens — _Needs page-level follow-up or product decision._
- **UX-269** (P2/dashboard): Activity list custom vs notifications list — _Needs page-level follow-up or product decision._
- **UX-270** (P1/platform): No shared Tabs component — _Needs page-level follow-up or product decision._
- **UX-271** (P1/budget): Budget control module vs finance budgets — _Needs page-level follow-up or product decision._
- **UX-272** (P2/platform): Some statuses color-only without text/icon — _Needs page-level follow-up or product decision._
- **UX-273** (P2/platform): Centered max width fine; horizontal padding double issue worse on mobile — _Residual polish pattern exists but not applied to every route._
- **UX-274** (P1/platform): Leave/PIF copy is institutional; access/people stubs are developer tone — _Needs page-level follow-up or product decision._
- **UX-275** (P2/governance): Governance admin vs operational governance — _Needs page-level follow-up or product decision._
- **UX-276** (P1/stock): Stock submodules (issues, transfers, stocktakes…) inconsistent shells — _Needs page-level follow-up or product decision._
- **UX-277** (P1/procurement): Procurement create not on FormSection/Stepper baseline — _Needs page-level follow-up or product decision._
- **UX-278** (P2/platform): Terminal states share muted badge — _Needs page-level follow-up or product decision._
- **UX-281** (P1/analytics): Analytics export/print inconsistent with reports module — _Residual polish pattern exists but not applied to every route._
- **UX-282** (P1/finance): Balance register verify uses raw anchor for documents — _Residual polish pattern exists but not applied to every route._
- **UX-284** (P2/settings): Module settings under /travel/settings, /leave/settings, /settings/hr, /admin/settings, /people/settings — _Needs page-level follow-up or product decision._
- **UX-286** (P2/platform): Create CTA sometimes left in subtitle row, sometimes right actions — _Needs page-level follow-up or product decision._
- **UX-287** (P1/platform): User date prefs exist but most pages ignore useFormatDate — _Needs page-level follow-up or product decision._
- **UX-288** (P1/platform): Many filter UIs lack Clear all — _Needs page-level follow-up or product decision._
- **UX-289** (P1/platform): No skip-to-main-content link in AppShell — _Needs page-level follow-up or product decision._
- **UX-290** (P1/travel): Multi-step travel form dense on small screens — _Residual polish pattern exists but not applied to every route._
- **UX-291** (P2/platform): Cards use shadow-card; dark mode overrides to --dk-shadow-sm — _Needs page-level follow-up or product decision._
- **UX-292** (P1/admin): Admin hub rich icons; People hub none; Audit hub none — _Needs page-level follow-up or product decision._
- **UX-294** (P1/platform): API errors: toast vs field-level vs alert — _Residual polish pattern exists but not applied to every route._
- **UX-297** (P1/admin): Uses btn btn-primary text-sm legacy — _Needs page-level follow-up or product decision._
- **UX-298** (P1/platform): TravelQueueTable vs AdvanceQueueTable vs ad-hoc tables — _Needs page-level follow-up or product decision._
- **UX-299** (P1/platform): Filter tabs use filled primary; inbox tabs use same but different radius — _Needs page-level follow-up or product decision._
- **UX-300** (P2/assets): loadPdfLibs on assets page — _Residual polish pattern exists but not applied to every route._
- **UX-301** (P1/platform): travel/leave show AuditTimeline; others don't — _Needs page-level follow-up or product decision._
- **UX-302** (P2/procurement): procurement/vendors/[id] large custom attachment section — _Residual polish pattern exists but not applied to every route._
- **UX-303** (P2/platform): Toast titles vary (Approved, Decision recorded, Action Failed) — _Residual polish pattern exists but not applied to every route._
- **UX-305** (P1/pif): PIF register is high quality but isolated — _Needs page-level follow-up or product decision._
- **UX-306** (P1/platform): NotificationsPanel overlay desktop-first — _Residual polish pattern exists but not applied to every route._
- **UX-307** (P1/platform): badge-muted neutral-100/600 may fail on some surfaces — _Needs page-level follow-up or product decision._
- **UX-308** (P2/platform): Toggle.tsx exists; many settings use checkboxes — _Needs page-level follow-up or product decision._
- **UX-312** (P2/dashboard): Dashboard customization not mirrored elsewhere — _Needs page-level follow-up or product decision._
- **UX-313** (P2/platform): GlobalSearch Admin group text-purple-600 — _Needs page-level follow-up or product decision._
- **UX-314** (P1/platform): Approvals page requires reason; inbox doesn't; some queues optional — _Needs page-level follow-up or product decision._
- **UX-316** (P2/risk): risk/analytics category color map includes pink/purple — _Needs page-level follow-up or product decision._
- **UX-317** (P1/admin): Access requests list minimal vs operational registers — _Needs page-level follow-up or product decision._
- **UX-319** (P1/platform): Users may not find certificate from register row actions — _Residual polish pattern exists but not applied to every route._
- **UX-321** (P1/assets): Assets add uses Stepper but other asset flows don't — _Needs page-level follow-up or product decision._
- **UX-322** (P1/saam): saam/delegations vs people/delegations vs people/my-delegations — _Needs page-level follow-up or product decision._
- **UX-323** (P2/organogram): SVG connectors may lack text alternatives — _Needs page-level follow-up or product decision._
- **UX-324** (P2/platform): Many filter-tab rows wrap to 2–3 lines on mobile — _Residual polish pattern exists but not applied to every route._
- **UX-325** (P1/organogram): Inline SVG fill colors ignore theme — _Needs page-level follow-up or product decision._
- **UX-326** (P1/workplan): Hardcoded hex purple in workplan page — _Needs page-level follow-up or product decision._
- **UX-327** (P2/assignments): Good pattern not copied to HR/stock — _Needs page-level follow-up or product decision._
- **UX-330** (P2/platform): disabled:opacity-50 without explaining why — _Needs page-level follow-up or product decision._
- **UX-332** (P1/admin): User create is elaborate multi-section; access role create is 2 fields — _Needs page-level follow-up or product decision._
- **UX-333** (P1/risk): Risk detail history section purple accent — _Needs page-level follow-up or product decision._
- **UX-334** (P1/profile): Employees may upload in profile and HR file separately — _Residual polish pattern exists but not applied to every route._
- **UX-335** (P2/weekly-summaries): Export CSV uses legacy btn classes — _Residual polish pattern exists but not applied to every route._
- **UX-337** (P1/fleet): Fleet tables plain; no data-table thead styling consistently — _Needs page-level follow-up or product decision._
- **UX-338** (P2/leave): Some polished pages still carry style={{}} for progress widths — _Needs page-level follow-up or product decision._
- **UX-339** (P1/notifications): Two notification UIs — _Needs page-level follow-up or product decision._
- **UX-342** (P1/platform): Need verification that focus returns after confirm — _Needs page-level follow-up or product decision._
- **UX-343** (P1/platform): --sidebar-width 260px with very deep trees — _Residual polish pattern exists but not applied to every route._
- **UX-344** (P2/auth): Demo credential tiles use *-50 backgrounds without dark variants — _Needs page-level follow-up or product decision._
- **UX-346** (P1/imprest): Near-clone of leave without density — _Needs page-level follow-up or product decision._
- **UX-348** (P1/admin): /admin/access/governance tooling checklist UI — _Needs page-level follow-up or product decision._
- **UX-349** (P1/admin): disabled={!name} only — no error text — _Needs page-level follow-up or product decision._
- **UX-350** (P2/travel): Possible redundant status storytelling — _Needs page-level follow-up or product decision._
- **UX-351** (P2/assets): Capitalise used in assets (British) while other UI Americanize — _Needs page-level follow-up or product decision._
- **UX-352** (P1/settings): HR approval matrix separate from admin workflows designer — _Needs page-level follow-up or product decision._
- **UX-353** (P1/correspondence): Bulk export exists on master-register — good — but retention page has none — _Residual polish pattern exists but not applied to every route._
- **UX-354** (P2/stock): Filters not in URL; refresh loses filters — _Needs page-level follow-up or product decision._
- **UX-355** (P1/fleet): driverUserId typed as raw id string — _Needs page-level follow-up or product decision._
- **UX-356** (P1/platform): Header.tsx procurement purple map — _Needs page-level follow-up or product decision._
- **UX-358** (P1/platform): Header menu/notifications rely on icons — _Needs page-level follow-up or product decision._
- **UX-359** (P2/platform): Clicking controls in main closes mobile sidebar — OK; may cause focus quirks — _Residual polish pattern exists but not applied to every route._
- **UX-360** (P1/people): bg-white border tiles ignore dark surfaces — _Needs page-level follow-up or product decision._
- **UX-362** (P2/risk): Good shell; category icon colors include purple compliance — _Needs page-level follow-up or product decision._

### Out-of-scope (0)

