# Nexus Admin + Mobile UI/UX Inconsistency Hunt

Static review of admin web routes and Flutter mobile screens. Source pass: 2026-07-31. Scope is deliberately limited to `web/app/(app)/admin`, shared web UI components touched by admin flows, and `mobile/lib`.

## Scoreboard

826 evidence-backed issue instances found.

Severity split:

| Severity | Count | Meaning |
| --- | ---: | --- |
| P0 critical | 16 | Broken navigation, route crashes, unsafe production tooling, silent access failure, or production debug exposure. |
| P1 inconsistency | 476 | Pattern drift that creates uneven admin/mobile workflows, weak feedback, hard-to-use mobile screens, or missing canonical primitives. |
| P2 polish | 334 | Visual polish, density, formatting, copy, and dark-mode/semantic detail gaps. |

Surface split:

| Surface | Evidence base | Issue instances |
| --- | ---: | ---: |
| Admin web | 53 TSX files, 52 `page.tsx` routes | 186 |
| Mobile Flutter | 97 screen files plus shell/router widgets | 640 |

Counting rule: repeated defects count once per affected route/screen per UX pattern. For example, 89 mobile screens with no semantic affordances count as 89 issue instances because each screen needs work. Structural defects count once.

## P0 Critical List

| ID | Surface | Summary | Evidence |
| --- | --- | --- | --- |
| AM-001 | Admin | Admin hub links to a missing Correspondence Settings route. | `web/app/(app)/admin/page.tsx` uses `/admin/correspondence`; no `web/app/(app)/admin/correspondence/page.tsx` exists. |
| AM-002 | Mobile | Assignments create route is malformed and nests the calendar route inside the wrong `GoRoute` block. | `mobile/lib/core/router/app_router.dart:601` to `:610`. |
| AM-003 | Mobile | Vendor directory pushes `/procurement/vendors/new`, which matches `/procurement/vendors/:id` and then `int.parse('new')` can crash. | `mobile/lib/features/procurement/presentation/screens/vendor_directory_screen.dart:119`; router only has `/procurement/vendors/:id`. |
| AM-004 | Mobile | Unauthorized routes silently redirect to `/dashboard`, hiding the access-denied reason. | `mobile/lib/core/router/app_router.dart:173` to `:174`. |
| AM-005 | Mobile | `debugLogDiagnostics: true` is enabled in the production router. | `mobile/lib/core/router/app_router.dart:146`. |
| AM-006 | Admin | Role administration is still split between `/admin/access/roles` and legacy `/admin/roles/*` surfaces. | `/admin/roles` redirects, but `/admin/roles/create`, `/admin/roles/matrix`, and `/admin/roles/[id]/edit` still exist. |
| AM-007 | Admin | Audit is split between legacy `/admin/audit` and canonical `/admin/audit-trail` families. | Both route families exist and render different audit experiences. |
| AM-008 | Admin | Access explorer renders raw JSON into a production admin page. | `web/app/(app)/admin/access/explorer/page.tsx` uses `<pre>{JSON.stringify(...)}</pre>`. |
| AM-009 | Admin | Access simulator renders raw JSON into a production admin page. | `web/app/(app)/admin/access/simulator/page.tsx` uses `<pre>{JSON.stringify(...)}</pre>`. |
| AM-010 | Admin | Workflow simulation renders raw JSON instead of a reviewed result UI. | `web/app/(app)/admin/workflows/simulate/page.tsx`. |
| AM-011 | Admin | Workflow analytics renders raw JSON instead of dashboard primitives. | `web/app/(app)/admin/workflows/analytics/page.tsx`. |
| AM-012 | Admin | Workflow AI page renders guard/suggestion JSON directly. | `web/app/(app)/admin/workflows/ai/page.tsx`. |
| AM-013 | Admin | Notifications analytics renders multiple raw JSON panels. | `web/app/(app)/admin/notifications/page.tsx`. |
| AM-014 | Admin | Audit ingestion exposes migrate/replay operational controls as ordinary admin UI. | `web/app/(app)/admin/audit-trail/ingestion/page.tsx`. |
| AM-015 | Web shared | Document download failures still use native `alert()`, affecting admin document workflows. | `web/components/ui/DocumentsPanel.tsx:68`, `web/components/ui/GenericDocumentsPanel.tsx:84`. |
| AM-016 | Mobile | Drawer/dashboard/route IA disagree on assignments and HR assignments entry points. | Drawer uses `/assignments`; dashboard uses `/hr/assignments`; router defines both. |

## Admin Static Buckets

The admin subtotal is 170 pattern instances plus 16 structural/P0 items that overlap or sit outside the pattern buckets.

| Bucket | Count | What needs fixing |
| --- | ---: | --- |
| Missing canonical admin header | 16 | Adopt `ModulePageHeader` and consistent breadcrumbs/actions. |
| Legacy `page-title` header chrome | 5 | Replace raw H1 systems with canonical header primitive. |
| Raw color utilities/tokens | 43 | Move route-specific status colors into `Badge`, `Button`, or tokenized variants. |
| Wide `data-table` surfaces | 19 | Add captions, scopes, mobile card fallback, responsive density, and consistent pagination. |
| Raw JSON/tool output | 7 | Replace `<pre>`/`JSON.stringify` with reviewed admin result panels. |
| Custom fixed modals | 5 | Standardize modal focus, escape, overlay, title, destructive variants, and mobile layout. |
| Bespoke empty/loading states | 30 | Use shared `EmptyState` and consistent skeleton/loading treatment. |
| Dense text actions | 44 | Replace tiny inline text actions with accessible buttons/icons and predictable hit targets. |
| Legacy `input-field` bridge | 1 | Migrate workflow editor to `Input`, `Select`, `FormField`, and `FormSection`. |

Admin routes missing `ModulePageHeader`:

- `web/app/(app)/admin/calendar/page.tsx`
- `web/app/(app)/admin/data-scope/page.tsx`
- `web/app/(app)/admin/departments/page.tsx`
- `web/app/(app)/admin/governance/page.tsx`
- `web/app/(app)/admin/ledger/[id]/page.tsx`
- `web/app/(app)/admin/positions/create/page.tsx`
- `web/app/(app)/admin/positions/page.tsx`
- `web/app/(app)/admin/positions/[id]/edit/page.tsx`
- `web/app/(app)/admin/roles/create/page.tsx`
- `web/app/(app)/admin/roles/page.tsx`
- `web/app/(app)/admin/roles/[id]/edit/page.tsx`
- `web/app/(app)/admin/workflows/ai/page.tsx`
- `web/app/(app)/admin/workflows/analytics/page.tsx`
- `web/app/(app)/admin/workflows/designer/page.tsx`
- `web/app/(app)/admin/workflows/page.tsx`
- `web/app/(app)/admin/workflows/simulate/page.tsx`

Admin routes with raw JSON/tooling UI:

- `web/app/(app)/admin/access/explorer/page.tsx`
- `web/app/(app)/admin/access/simulator/page.tsx`
- `web/app/(app)/admin/audit-trail/ingestion/page.tsx`
- `web/app/(app)/admin/notifications/page.tsx`
- `web/app/(app)/admin/workflows/ai/page.tsx`
- `web/app/(app)/admin/workflows/analytics/page.tsx`
- `web/app/(app)/admin/workflows/simulate/page.tsx`

Admin routes with wide table risk:

- `web/app/(app)/admin/access/requests/page.tsx`
- `web/app/(app)/admin/access/roles/page.tsx`
- `web/app/(app)/admin/audit/page.tsx`
- `web/app/(app)/admin/audit-trail/page.tsx`
- `web/app/(app)/admin/calendar/page.tsx`
- `web/app/(app)/admin/data-scope/page.tsx`
- `web/app/(app)/admin/governance/page.tsx`
- `web/app/(app)/admin/ledger/generate/page.tsx`
- `web/app/(app)/admin/ledger/page.tsx`
- `web/app/(app)/admin/ledger/verify/page.tsx`
- `web/app/(app)/admin/ledger/[id]/page.tsx`
- `web/app/(app)/admin/payslip-config/[userId]/page.tsx`
- `web/app/(app)/admin/payslips/page.tsx`
- `web/app/(app)/admin/portfolios/page.tsx`
- `web/app/(app)/admin/roles/matrix/page.tsx`
- `web/app/(app)/admin/salary-assignments/page.tsx`
- `web/app/(app)/admin/timesheet-projects/page.tsx`
- `web/app/(app)/admin/users/page.tsx`
- `web/app/(app)/admin/weekly-summary/page.tsx`

Admin custom modal routes:

- `web/app/(app)/admin/calendar/page.tsx`
- `web/app/(app)/admin/payslip-config/[userId]/page.tsx`
- `web/app/(app)/admin/payslips/page.tsx`
- `web/app/(app)/admin/salary-assignments/page.tsx`
- `web/app/(app)/admin/timesheet-projects/page.tsx`

## Mobile Static Buckets

Mobile has the highest score because there are many screens and most do not share a canonical screen scaffold yet.

| Bucket | Count | What needs fixing |
| --- | ---: | --- |
| Missing shared Stitch widgets | 94 | Adopt shared cards/buttons/chips/shell primitives outside the travel gold path. |
| Raw colors or `Colors.*` literals | 95 | Route status, surfaces, warnings, and dark-mode variants through theme tokens. |
| Bespoke `AppBar` per screen | 87 | Standardize mobile screen header, back behavior, refresh actions, and shell drawer affordance. |
| Local `SnackBar` feedback | 40 | Standardize toast/banner severity, placement, retry, and blocking vs non-blocking feedback. |
| Raw `AlertDialog`/`showDialog` | 14 | Use a shared confirm/action sheet pattern for destructive and approval flows. |
| Raw bottom sheets | 6 | Normalize sheet sizing, drag/keyboard behavior, validation, and action layout. |
| Spinner-only loading | 85 | Replace full-screen spinners with skeletons or retained cached content where possible. |
| Bespoke form fields | 34 | Align validation, required labels, helper text, keyboard types, and draft/offline affordances. |
| `SingleChildScrollView` dense forms | 12 | Improve keyboard behavior, focus traversal, and overflow handling. |
| Missing semantic affordances | 89 | Add `Semantics`, labels, hints, or tooltips for icon-only and gesture-only controls. |
| Raw `Navigator.pop(context)` back behavior | 22 | Use safe back helpers and consistent fallback routes. |
| Fragmented date/money formatting | 62 | Consolidate `DateTime.parse`, `toStringAsFixed`, currency, and relative time formats. |

Representative mobile hotspots:

- `mobile/lib/core/router/app_router.dart`
- `mobile/lib/shared/widgets/app_drawer.dart`
- `mobile/lib/shared/widgets/bottom_nav_bar.dart`
- `mobile/lib/features/dashboard/presentation/screens/dashboard_screen.dart`
- `mobile/lib/features/approvals/presentation/screens/approvals_screen.dart`
- `mobile/lib/features/procurement/presentation/screens/procurement_hub_screen.dart`
- `mobile/lib/features/procurement/presentation/screens/vendor_directory_screen.dart`
- `mobile/lib/features/hr/presentation/screens/hr_directory_screen.dart`
- `mobile/lib/features/assets/presentation/screens/asset_inventory_screen.dart`
- `mobile/lib/features/audit/presentation/screens/audit_management_screen.dart`
- `mobile/lib/features/offline/presentation/screens/offline_drafts_screen.dart`
- `mobile/lib/features/stock/presentation/screens/stock_scan_screen.dart`
- `mobile/lib/features/salary_advance/presentation/screens/salary_advance_preview_sign_screen.dart`

## Highest-Value Themes

1. Fix broken routes first: `/admin/correspondence`, mobile assignments calendar/create block, and `/procurement/vendors/new`.
2. Replace silent access redirects with a clear access-denied screen on web and mobile.
3. Collapse dual admin surfaces: roles, audit/audit-trail, assignments/HR assignments, and workflow tooling.
4. Make one mobile screen scaffold: app bar, drawer/menu, back fallback, loading/error/empty state, and bottom nav spacing.
5. Migrate mobile screens to shared Stitch primitives instead of per-screen `Container`, `ElevatedButton`, `TextButton`, and hand-coded badges.
6. Replace admin raw JSON pages with result cards, tables, timelines, and copy written for administrators.
7. Standardize destructive and privileged controls: confirm copy, focus management, result toast, disabled reasons, and audit notes.
8. Add mobile semantic labels/hints to icon-only buttons, gesture cards, nav pills, scan controls, and dashboard tiles.
9. Create one date/money/status formatting layer shared by admin web and mobile where platform-appropriate.
10. Add responsive admin table fallbacks before widening the admin surface further.

## Reproduction Scans

Admin pattern count:

```powershell
node -e "const fs=require('fs'),path=require('path'); function walk(d,a=[]){if(!fs.existsSync(d))return a; for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p,a); else a.push(p)} return a} const admin=walk('web/app/(app)/admin').filter(f=>f.endsWith('.tsx')); const pages=admin.filter(f=>path.basename(f)==='page.tsx'); const count=(files,re)=>files.filter(f=>re.test(fs.readFileSync(f,'utf8'))).length; const adminCats={missing_header:pages.filter(f=>!/ModulePageHeader/.test(fs.readFileSync(f,'utf8'))).length,legacy_page_title:count(pages,/page-title/),raw_color:count(admin,/bg-white|text-neutral|border-neutral|bg-green|text-green|bg-red|text-red|bg-purple|text-purple|bg-blue|text-blue/),data_table:count(admin,/data-table/),raw_json:count(admin,/<pre|JSON\.stringify/),custom_modal:count(admin,/fixed inset/),bespoke_empty:admin.filter(f=>!/EmptyState/.test(fs.readFileSync(f,'utf8'))&&/(length === 0|\.length === 0|No .*|No entries|No .* yet)/.test(fs.readFileSync(f,'utf8'))).length,dense_text_actions:count(admin,/text-xs/),input_field:count(admin,/input-field/)}; console.log(adminCats)"
```

Mobile pattern count:

```powershell
node -e "const fs=require('fs'),path=require('path'); function walk(d,a=[]){if(!fs.existsSync(d))return a; for(const e of fs.readdirSync(d,{withFileTypes:true})){const p=path.join(d,e.name); if(e.isDirectory()) walk(p,a); else a.push(p)} return a} const mobile=walk('mobile/lib/features').filter(f=>f.endsWith('.dart')&&/presentation[\\/]screens/.test(f)); const count=(files,re)=>files.filter(f=>re.test(fs.readFileSync(f,'utf8'))).length; const mobileCats={missing_stitch:mobile.filter(f=>!/Stitch[A-Z]/.test(fs.readFileSync(f,'utf8'))).length,raw_colors:count(mobile,/Colors\.|Color\(0x/),bespoke_appbar:count(mobile,/\bAppBar\(/),snackbar:count(mobile,/ScaffoldMessenger|SnackBar/),dialog:count(mobile,/showDialog|AlertDialog/),bottom_sheet:count(mobile,/showModalBottomSheet/),spinner:count(mobile,/CircularProgressIndicator/),forms:count(mobile,/TextField|TextFormField/),single_scroll:count(mobile,/SingleChildScrollView/),no_semantics:mobile.filter(f=>!/Semantics\(|semanticLabel|tooltip:/.test(fs.readFileSync(f,'utf8'))).length,raw_back:count(mobile,/Navigator\.pop\(context\)/),format_fragment:count(mobile,/toStringAsFixed|DateTime\.parse|DateFormat/)}; console.log(mobileCats)"
```

Route integrity spot checks:

```powershell
rg --files 'web/app/(app)/admin/correspondence'
rg "debugLogDiagnostics|return '/dashboard'|/assignments/create|/assignments/calendar" mobile/lib/core/router/app_router.dart -n
rg "/procurement/vendors/new|/admin/correspondence|alert\(" web mobile -n
```
