# SADC PF Nexus — What’s Left to Do

Summary of remaining work for **Web** (Next.js) and **Mobile** (Flutter) as of review. The **API** (Laravel) already exposes auth, admin, travel, leave, imprest, and procurement; gaps are mainly wiring the UIs to the API and adding missing backend modules.

---

## 1. Web (Next.js)

### 1.1 API integration (high priority)

The app has a full API client in `web/lib/api.ts` (auth, admin, travel, leave, imprest) but **only the login page** uses it. All other pages use hardcoded mock data.

| Area | Current state | To do |
|------|----------------|--------|
| **Dashboard** | Static stats and “Recent Activity” | Fetch real counts/activity from API or new aggregate endpoints. |
| **Admin – Users** | `MOCK_USERS` in `admin/users/page.tsx` | Use `adminApi.listUsers`, `getUser`, `createUser`, `updateUser`, `deactivateUser`, etc. |
| **Admin – Departments** | Likely mock | Use `adminApi.listDepartments`, `createDepartment`, `updateDepartment`. |
| **Admin – Roles** | Likely mock | Use `adminApi.listRoles`, `createRole`, `syncRolePermissions`. |
| **Travel – List** | Mock array in `travel/page.tsx` | Use `travelApi.list()` and wire filters to params. |
| **Travel – Detail** | Mock object in `travel/[id]/page.tsx` | Use `travelApi.get(id)`, wire Approve/Reject to `travelApi.approve` / `reject`. |
| **Travel – Create** | `setTimeout` then `router.push` (no API) | Use `travelApi.create()` (and optionally `travelApi.update` for draft). |
| **Leave – List / Detail / Create** | Mock data | Use `leaveApi.list`, `get`, `create`, `update`, `submit`, `approve`, `reject`. |
| **Imprest – List / Detail / Create / Liquidate** | Likely mock | Use `imprestApi.*` for all CRUD and workflow actions. |
| **Procurement – List / Detail / Create** | Likely mock | Add `procurementApi` (and vendor helpers) in `lib/api.ts` if not present; wire all pages. |

### 1.2 Finance & HR (backend + frontend)

- **Finance**  
  - **API:** No finance routes in `api/routes/api.php` (no salary advances, no payslips).  
  - **Web:** Finance page and “Request Advance” form use mock data and `setTimeout`; “View all” links to `/finance/payslips` but **no payslips page exists** (404).  
  - **To do:** Add Laravel endpoints for advances (and optionally payslips), then add `financeApi` in `web/lib/api.ts` and wire Finance page + `/finance/advances/create` and add `/finance/payslips` page (or remove the link).

- **HR / Timesheets**  
  - **API:** No HR or timesheet routes in `api/routes/api.php`.  
  - **Web:** HR page and timesheet list use mock data; “View all” links to `/hr/timesheets`.  
  - **To do:** Add Laravel endpoints for timesheets (and any HR self-service), then add `hrApi` (or similar) and wire HR and timesheet pages.

### 1.3 Auth and layout

- **Route protection:** There is **no middleware** in `web/`. Authenticated routes under `(app)/` are not protected; users can open `/dashboard`, `/admin/users`, etc. without logging in.  
  - **To do:** Add Next.js middleware (or equivalent) to redirect unauthenticated users to `/login` and optionally redirect authenticated users away from `/login`.

- **Token refresh / 401:** `lib/api.ts` already clears token and redirects to `/login` on 401. Optional: add refresh flow if the API supports refresh tokens.

### 1.4 Missing or placeholder behaviour

- **Travel create:** Submit (and draft) currently use a placeholder `setTimeout`; replace with real API calls.
- **Finance – advances create:** Same placeholder; replace with real API once finance endpoints exist.
- **Finance – payslips:** Either add `/finance/payslips` page and API or remove the “View all” link from the finance page.
- **Forgot password:** Login page has a “Forgot your password?” link pointing to `#`; implement flow or remove.

---

## 2. Mobile (Flutter)

### 2.1 Auth

- **Login:** `_handleLogin()` uses `Future.delayed(1 second)` then `context.go('/dashboard')`. No API call, no token storage.  
  - **To do:** Call Laravel `/api/v1/auth/login`, store token (e.g. `flutter_secure_storage` or `shared_preferences`), then navigate; handle errors and loading.

- **Biometric:** Button `onPressed: () {}` is a no-op.  
  - **To do:** Implement biometric auth (e.g. `local_auth`) and optionally “remember me” / token refresh.

- **Logout / session:** No logout or token invalidation in app; no global API client that sends `Authorization: Bearer <token>` or redirects on 401.  
  - **To do:** Add a small API/service layer that uses the stored token and handles 401 (e.g. clear storage and go to login).

### 2.2 Placeholder screens

These routes are defined but show only a generic `PlaceholderScreen` (title in app bar + centered text):

| Route | To do |
|-------|--------|
| `/requests` | Implement “My Requests” (travel, leave, imprest, etc.) – list and possibly detail. |
| `/approvals` | Implement “Pending my approval” (travel, leave, imprest, etc.). |
| `/reports` | Implement reports (e.g. travel, leave, DSA) or a reports hub. |
| `/profile` | Implement profile (user info, change password, logout, maybe MFA). |

Either reuse the same Laravel API (with token from login) or define a small mobile-specific API layer and wire these screens.

### 2.3 Dashboard

- **Current:** Static overview (e.g. stat cards, quick actions, recent activity).  
- **Optional:** Replace with API-driven counts and activity once backend supports it (same as web dashboard).

### 2.4 Tests

- **`mobile/test/widget_test.dart`** still references `MyApp` and a counter; the app uses `SADCPFNexusApp` and has no counter.  
  - **To do:** Update test to use `SADCPFNexusApp` (and `ProviderScope` if needed) and assert on real UI (e.g. login or dashboard), or remove/replace with a minimal smoke test.

### 2.5 Android

- **`mobile/android/app/build.gradle.kts`:** Template TODOs for “Specify your own unique Application ID” and “Add your own signing config for the release build.” Application ID is already set; add release signing when publishing.

---

## 3. API (Laravel) – optional additions

- **Finance:** Salary advances (create, list, approve, reject); optionally payslips (list, download).
- **HR / Timesheets:** Timesheet CRUD, submit, approve; optionally leave balance or other HR read endpoints.
- **Module routes:** Comment in `api/routes/api.php` (“Module routes will be added here per module”) is already followed by travel, leave, imprest, procurement; no action needed unless you add more modules.

---

## 4. Suggested order of work

1. **Web:** Add auth middleware so only logged-in users can access `(app)/*`.  
2. **Web:** Wire Travel list/detail/create to `travelApi` (removes mock + placeholder).  
3. **Web:** Wire Leave and Imprest the same way.  
4. **Web:** Wire Admin (users, departments, roles) to `adminApi`.  
5. **Mobile:** Implement real login (API + token storage + 401 handling), then profile (logout).  
6. **Mobile:** Replace placeholders for Requests, Approvals, Reports, Profile (and optionally dashboard) with real API-backed screens.  
7. **API + Web + Mobile:** Add Finance (and optionally HR) backend and wire web/mobile UIs.  
8. **Web:** Add `/finance/payslips` or remove the link; implement or remove “Forgot password.”  
9. **Mobile:** Fix or replace `widget_test.dart`; add release signing for Android when releasing.

---

## 5. Files to touch (reference)

| Area | Files |
|------|--------|
| Web API usage | `web/app/(app)/dashboard/page.tsx`, `travel/page.tsx`, `travel/[id]/page.tsx`, `travel/create/page.tsx`, `leave/*`, `imprest/*`, `procurement/*`, `admin/users/page.tsx`, `admin/departments/page.tsx`, `admin/roles/page.tsx`, `finance/page.tsx`, `finance/advances/create/page.tsx`, `hr/page.tsx`, `hr/timesheets/page.tsx` |
| Web auth | New `web/middleware.ts` (or equivalent) for route protection |
| Web API client | `web/lib/api.ts` (add `financeApi`, `hrApi`, `procurementApi` if missing) |
| Mobile auth | `mobile/lib/features/auth/` (login screen, auth service, token storage) |
| Mobile placeholders | `mobile/lib/core/router/app_router.dart` (replace `PlaceholderScreen` with real screens) |
| Mobile test | `mobile/test/widget_test.dart` |
| API routes | `api/routes/api.php` (finance, HR/timesheets) |
| API controllers | New `api/app/Http/Controllers/Api/V1/Finance/*`, `HR/*` (or similar) |
