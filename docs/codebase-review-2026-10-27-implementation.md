# Codebase review 2026-10-27 — implementation log

Branch: `chore/codebase-review-2026-10-27` (from `fix/web-csp-nonce` @ `0f983b6c`).
Source review: [codebase-review-2026-10-27.md](codebase-review-2026-10-27.md) (copied from the
`C:\DEV\SADCPFNexus` checkout, which is an older `main` at `2ad1f4c` with its own uncommitted
work and was left untouched; all changes below are against this current checkout).

## Progress checklist

- [x] Stage 1 — baseline and verification of findings
- [x] Stage 2 — reliability and isolation
- [x] Stage 3 — authorization and document handling
- [x] Stage 4 — incremental consolidation (partial by design; see remaining work)
- [x] Stage 5 — product improvements (first increments)

## Stage 1 — Baseline

### Environment

| Tool | Version / state |
|---|---|
| PHP | 8.4.4 (Windows) |
| PostgreSQL | 14.5 (Laragon, started locally for this work; production uses 16) |
| Node | 24.13.0 |
| Flutter | 3.29.3 |
| Docker | Compose v5.6.0 available; daemon not running (`docker compose config` still validates) |

### Baseline results (before changes unless noted)

| Check | Result |
|---|---|
| `web`: `npx tsc --noEmit` | pass |
| `web`: `npm run test:unit` | 12 failures, **all pre-existing** (identical on a clean `HEAD` worktree): UI-convention static checks (`native window.alert…`, `operational … gold chrome`, `EmptyState chrome`, sidebar child count for Procurement, etc.) |
| `mobile`: `flutter analyze` | 35 issues, all `info` (no warnings/errors) |
| `mobile`: `flutter test` | 68/68 pass — the AGENTS.md "known failure" (`formatSaCurrency` NAD) no longer fails on this branch |
| `api`: `php artisan test` | ~2,047 tests; long run in progress (see final report). Note: it runs against the working tree, so failures are re-checked against a clean `HEAD` worktree before being classified |

Local-environment notes (not code defects):

- `RefreshDatabase` re-runs `migrate:fresh`, whose single `DROP TABLE` over ~600 tables exceeds this
  local PostgreSQL's default `max_locks_per_transaction` once a test DB is populated. Targeted runs
  used freshly created empty test databases (`sadcpfnexus_test_s2*`) instead.
- The local dev DB `sadcpfnexus` is 105 migrations behind; it was not migrated (operational data
  left untouched).

### Finding verification

| # | Finding | Status in current code | Correction |
|---|---|---|---|
| 1 | Startup seeds and hides migration failures | **Valid** | — |
| 2 | Dev settings / ports survive prod overlay | **Valid, worse than stated** | Queue worker also inherited `APP_ENV=local` (no `APP_DEBUG` override); web bound `0.0.0.0:3000` in production, bypassing CloudPanel |
| 3 | Offline drafts not account-scoped | **Valid** | — |
| 4 | Approval transitions lack concurrency protection | **Partly valid** | `WorkflowOrchestrator::decide()` already locks the row and rechecks status. Real gaps: `reject()` finalised outside the lock; authority not rechecked under lock for reject; `returnForCorrection`/`withdraw`/`resubmit`/`delegate`/`recuse` took no lock; an idempotent replay of a final approval re-ran `finalizeApprovable` (financial effects) |
| 5 | RLS cleanup not exception-safe | **Valid** | — |
| 6 | Web admin roles differ from API; route shadowing; unlisted routes allowed | **Mostly invalid** | `User::isSystemAdmin` and web `ADMIN_ROLES` are identical; no rule is currently shadowed (165 rules checked); unknown routes already deny by default. Only first-match fragility remained |
| 7 | Query cache not isolated by identity | **Valid** | — |
| 8 | Offline retries recreate records | **Valid, worse than stated** | Salary-advance and PIF offline submit always failed (server requires explicit consent fields the app never sent), so *every* sync retry created another record |
| 9 | Travel attachments reuse view auth for mutations | **Invalid for Travel** | `TravelAttachmentController` already uses `ensureCanManage` for store/destroy. Cross-module consistency still to review in Stage 3 |
| 10 | No scheduler runner | **Valid** | Nothing in the repo runs `schedule:run`/`schedule:work` |
| 11 | MFA secret plaintext; disable = password only; no recovery codes | **Valid** | — |
| — | Busi / Loc8Mobile / OfflineVault | Not present in this checkout (only in `C:\DEV\SADCPFNexus`) | Out of scope here |
| — | `run-tests.sh` not tracked | **Invalid here** | Tracked in this checkout |

## Stage 2 — Reliability and isolation

### Changes

1. **Production startup** — `docker/php/entrypoint.sh`
   - Roles: `app` (php-fpm), `worker`, `scheduler`, `migrate` (one-shot job).
   - `AUTO_MIGRATE`/`AUTO_SEED` default `true` outside production, `false` in production;
     `AUTO_SEED=true` with `APP_ENV=production` aborts startup.
   - Migration errors are no longer suppressed (`2>/dev/null || true` removed); a failure stops the
     container. Every role runs `php artisan schema:check` and refuses to start against pending
     migrations. Dev demo-seed failures are reported loudly but do not block the dev stack.
   - New command `api/app/Console/Commands/SchemaCheck.php` (`schema:check {--wait=}`; exit 0 current,
     1 pending/missing, 2 unreachable; read-only).
   - `scripts/deploy.sh` runs `schema:check` after `migrate --force` (aborts deploy on failure).
2. **Production configuration** — `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`
   - `BCRYPT_ROUNDS=4` moved from the base file to the dev overlay; production uses cost 12.
   - Queue (and new scheduler/migrate) get `APP_ENV=production`, `APP_DEBUG=false` in the prod overlay.
   - Web port bound to `${WEB_BIND:-127.0.0.1}`; merged production config now publishes only loopback ports.
   - New `scheduler` service (`schedule:work`); in production behind the `scheduler` profile (see decisions).
   - New `migrate` one-shot service (`deploy` profile).
   - Verified with `docker compose … config` (merged prod: php/queue/scheduler/migrate `APP_ENV=production`,
     `APP_DEBUG=false`, no `BCRYPT_ROUNDS`, all ports `127.0.0.1`; dev: `BCRYPT_ROUNDS=4` on php/queue).
3. **RLS cleanup** — `api/app/Http/Middleware/SetRlsContext.php`
   - `try/finally`: rolls back only transactions the request left open (aborted Postgres transactions
     reject further statements), then `RESET ROLE` and `RESET app.*`. If cleanup itself fails the
     connection is purged so it is never reused.
4. **Atomic approval transitions** — `api/app/Services/WorkflowService.php`
   - `approve`/`reject`/`returnForCorrection`/`withdraw`/`resubmit`/`delegate`/`recuse` now lock the
     `approval_requests` row, reload, and revalidate status, the stage the actor was looking at, and the
     actor — all inside one transaction with the decision and the approvable's finalisation.
   - A replayed idempotency key returns the stored decision without re-running `finalizeApprovable`.
   - `recuse` read-modify-write of `condition_context` moved under the lock (lost-update fix).
   - HR completion notifications dispatched `afterCommit`.
5. **Offline draft ownership** — `mobile/lib/core/offline/`
   - Drift schema v2 adds `owner_key` (`tenantId:userId`), `operation_id`, `server_id`, `sync_state`,
     `last_error`, `attempts`. Existing rows keep `owner_key = NULL` and are **quarantined**: never listed
     or synced for any account; the drafts screen shows only a count with a "Discard" action.
   - `DraftStore` (`draft_provider.dart`) scopes every read/delete to the signed-in owner; all 17 form
     insert sites and 5 form delete sites now go through it. No account → nothing saved.
6. **Resumable offline sync** — `mobile/lib/core/offline/draft_sync_engine.dart` + server middleware
   - Create → persist server id → submit → delete local draft; each step sends
     `Idempotency-Key: <operationId>:create|submit`. Per-draft actionable errors are stored and shown.
   - Salary advance and PIF drafts are **created but not auto-submitted**: their submit endpoints require
     the requester's explicit consent (`deduction_authority_confirmed` / `declaration_confirmed`), which
     the app must not give on their behalf.
   - Server: `EnforceIdempotencyKey` middleware (authenticated group, after `SetRlsContext`) + table
     `idempotency_records` (granted to `app_user`; pruned daily after 48 h). Same key + same request →
     stored response replayed (`Idempotent-Replayed: true`); same key + different request → 422;
     in-flight → 409; failed requests release the key. Opt-in: requests without the header are untouched.
7. **Web cache isolation** — `web/components/providers/QueryProvider.tsx`, `web/lib/queryIdentity.ts`
   - The React Query cache is cancelled and cleared when the identity (`tenant:user:roles`) ends or
     changes. Chosen over threading user ids through every query key: it covers all present and future keys.
8. (Stage 3.2 done early) **Route matching** — `web/lib/authAccess.ts` `findRouteAccessRule`: longest prefix wins.

### Verification

| Test | Result |
|---|---|
| `api` `RlsContextCleanupTest` (real PostgreSQL, runs the middleware with `SET ROLE app_user`) | 4/4 pass; **4/4 fail against the original middleware** |
| `api` `WorkflowTransitionAtomicityTest` | 6/6 pass; **4/6 fail against the original service** (the 2 others were already covered by the engine lock for *sequential* replays) |
| `api` existing `WorkflowEnginePhase1Test`, `WorkflowEnginePhase2Phase3Test` | all pass |
| `api` `IdempotencyKeyTest` (real create/submit endpoints) | 6/6 pass |
| `api` `AppUserGrantsTest` | pass (new table granted) |
| `mobile` `draft_sync_engine_test.dart` (network failure between create and submit, lost response, consent-gated types, ownership keys) | pass; full suite 78/78 |
| `mobile` `flutter analyze` | 35 info (baseline), 0 warnings/errors |
| `web` `queryIdentity.test.mts`, route-precedence test | pass; `tsc --noEmit` pass; no new unit-test failures |
| Merged production Compose config | validated as above |

### Not validated / residual risk

- **True parallel concurrency** (two DB connections racing) was not exercised: PHPUnit runs in one
  wrapped transaction. Tests simulate the race with stale models; serialisation relies on PostgreSQL
  `SELECT … FOR UPDATE` semantics.
- Drift migration v1→v2 was not executed in a test (Drift cannot load in this Flutter test
  environment — pre-existing limitation noted in `offline_drafts_sync_failure_test.dart`). Verify on a
  device with pre-existing drafts.
- The entrypoint was syntax-checked (`sh -n`) and its command (`schema:check`) tested, but containers
  were not started (Docker daemon unavailable).
- Mobile PIF *online* submit (`pif_form_screen.dart`) does not send `declaration_confirmed`, so it
  likely fails server validation. Pre-existing; not changed.

### Decisions needed

1. **Enable the production scheduler**: confirm no host crontab runs `schedule:run`, accept the first
   run's reminder backlog, then set `COMPOSE_PROFILES=scheduler` on the server.
2. **Quarantined drafts**: currently count-and-discard only. If staff must recover pre-upgrade drafts,
   a "claim" flow would need a policy for proving authorship.

## Stage 3 — Authorization and document handling

### Verification of the attachment finding against the real enforcement path

The review (and a first static inventory) concluded most attachment mutations were "tenant-only".
That is wrong for most routes: `EnforceRegisteredEndpointAccess` (appended to every API request,
mode `mapped`) resolves permissions per endpoint from the registry, route middleware or prefix
fallback rules. The effective permissions were dumped from the live route table; deletes mostly
require `*.admin`. Real gaps found:

- **`/api/v1/contracts/{contract}/attachments` POST/DELETE were unmapped** (a second path to
  `ContractAttachmentController`, whose only check was tenant) → any authenticated tenant user could
  upload or delete contract documents. The whole `/api/v1/contracts` prefix (64 routes) is unmapped in
  the endpoint PEP; the other contract controllers enforce `contract.*` permissions internally.
- `ProgrammeDocumentController` had no tenant check and did not verify the document belonged to the
  programme in the URL.
- No module applied lifecycle rules to attachment deletion.
- Ten controllers stored file then row with no compensation, and deleted file before row.

### Changes

1. **Admin identifiers** — mobile had four divergent copies (missing `admin`/`Admin`); now one
   `kSystemAdminRoles`/`hasSystemAdminRole` in `mobile/lib/core/auth/feature_access.dart`, identical to
   API `User::isSystemAdmin` and web `ADMIN_ROLES`.
2. **Route precedence** — `findRouteAccessRule` (longest prefix wins), with test.
3. **Contract attachments** — explicit upload/delete checks in the controller (mirrors
   `ContractController`), and removal from a signature-locked contract (`Contract::isSignatureLocked`)
   limited to System Admin / `procurement.admin`, audited (`contract.attachment_removed_after_signature`).
4. **Programme documents** — tenant + parent-ownership checks (404 otherwise).
5. **Risk evidence** — deletion locked once `Risk::isEditable()` is false, except `risk.admin`
   (audited, `risk.attachment_removed_after_submission`); uploading new evidence stays allowed.
6. **Shared storage primitive** — `api/app/Support/AttachmentFiles.php`: `store` (file removed if the
   row insert fails), `delete` (row first in a transaction, file after commit; failed file removal is
   logged as `attachment.orphan_file`, never a dangling row), `download`. Adopted by Appraisal, Invoice,
   PurchaseOrder, Quote, Vendor, ProfileDocument (self + admin), Policy, Risk, ResearcherReport,
   Workplan, Contract (download). Authorization stays per module.
7. **Document Service bridge** — `ModuleDocumentBridge::storeAttachment` now commits managed document,
   attachment row and link in one transaction; on failure the stored blob is removed only if no committed
   row still references it (content de-duplication reuses files). Legacy unlink uses the row-first delete.
8. **MFA** — `mfa_secret` encrypted at rest (`encrypted` cast) with an idempotent, reversible migration
   that widens the column and encrypts existing plaintext secrets; one-time recovery codes (8, shown
   once, stored as sha256 hashes in an encrypted column); login accepts a recovery code; **disabling
   requires password + a current TOTP or recovery code**; `POST /profile/2fa/recovery-codes` regenerates
   (password + TOTP); audited (`auth.mfa.recovery_code_used`, `auth.mfa_recovery_codes_regenerated`);
   admin MFA reset clears recovery codes. Web: sign-in accepts recovery codes; security page shows codes
   once, asks for a code to disable, offers regeneration (EN/FR/PT hint updated).

Not changed (already consistent): navigation and route guards both use `canAccessRoute`; action buttons
use the `can*` helpers in `web/lib/authAccess.ts`. Backend enforcement is unchanged and remains the
security boundary.

### Verification

| Test | Result |
|---|---|
| `AttachmentAuthorizationTest` (5) | pass |
| `MfaLifecycleTest` (5) + `AuthTest`, `AuthLifecycleTest`, `CaptchaAndPortalLoginTest`, `PrivilegedMfaMiddlewareTest`, `ExternalWorkplanAuthTest` | 54/54 pass |
| `QuoteAttachmentTest`, `VendorAttachmentAuthorizationTest`, `SupplierRegistrationTest`, `ProgrammeDocumentsTest`, Travel/Leave attachment suites | pass |
| `web` `tsc --noEmit`, `secondFactorInput.test.mts` | pass |
| `mobile` `flutter analyze` | 35 info (baseline) |

Notes: `VendorAttachmentAuthorizationTest::test_supplier_downloads_own_attachments…` failed once in a
large combined run and passed alone and in two other combinations — order-dependent, re-checked in the
final run. A comparison run of the new attachment tests against the original controllers could not be
completed (the reused test DB hit the local `max_locks_per_transaction` limit), so for these tests
"fails before the fix" is shown by reasoning, not by a recorded run. Six of the refactored controllers
(Appraisal, Invoice, PurchaseOrder, ProfileDocument, Policy, ResearcherReport, Workplan) have no
endpoint tests; their refactor is verified by `php -l` and review only.

### Decisions needed

3. **Contract upload rights**: `procurement.create` (held by the staff role) still allows uploading to
   contracts, matching the existing `/procurement/contracts` rule. Should it?
4. **Signed-contract documents**: `procurement.admin` (held by Procurement Officers) may still remove
   them, audited. Should removal be System Admin only, or never?
5. **Lifecycle locks for other modules** (Travel, Leave, Procurement requests, Programmes, POs): models
   expose `isDraft()`/`isSubmitted()`, but "returned for correction" flows may legitimately remove files.
   Locks were applied only where the code defines an explicit editability rule (Contract, Risk).
6. **Endpoint registry for `/api/v1/contracts`**: map the 64 routes in the access-control registry so
   the PEP enforces them too (defence in depth; controllers already check internally).
7. **MFA key management**: secrets are now tied to `APP_KEY`; rotate with `APP_PREVIOUS_KEYS`.

## Stage 4 — Incremental consolidation

### Changes

1. **API route registration split** — 15 domain groups (documents, travel, leave, procurement, budget,
   finance, contracts, programmes, mande, fleet, assignments, correspondence, risk, audit-management,
   people-authority) moved from `api/routes/api.php` (2,598 → 1,363 lines) to `api/routes/api/<domain>.php`,
   each `require`d at its original position **inside** the authenticated group. Verified: the full route
   table (2,063 routes: method, URI, name, action and the ordered middleware chain) is identical before and
   after; `route:cache` works.
2. **Web API client** — shared transport moved to `web/lib/api/client.ts` (axios instance, CSRF, locale,
   multipart, 401/MFA/5xx handling) and routing cookies to `web/lib/api/cookies.ts`; `web/lib/api.ts`
   re-exports both, so no import site changed. Static tests now read all API sources through
   `web/lib/apiSourceForTests.mts`, and the Docker build guard (`scripts/verify-build-context.js`) checks
   the cookie helpers where they now live. Domain clients (143) remain in `api.ts`; the pattern for moving
   them is: create `lib/api/<domain>.ts` importing `api` from `./client` and types with `import type`,
   then `export * from "@/lib/api/<domain>"` in `api.ts`.
3. **PIF detail page** — presentation constants and the dialog wrapper extracted to
   `pifDetailShared.tsx`; dead local `Toast` removed; duplicated error parsing replaced by the shared
   `apiErrorMessage` (1,706 → 1,593 lines).
4. **Query keys** — not mass-migrated. Cache isolation is handled by identity-scoped clearing (Stage 2);
   convention for new code: `[domain, resource, ...params]`, invalidate by the `[domain, resource]` prefix.
5. **Notifications** — the existing outbox/delivery stack already provides after-commit dispatch,
   idempotency keys, delivery attempts, dead letters, coalescing and preferences. Changes:
   - inline outbox processing during web requests now runs after the response is sent
     (`app()->terminating`), so push/email provider calls no longer add latency to or fail user
     requests; a crash leaves the row pending for `notifications:process-outbox`;
   - **latent bug**: the Docker worker ran `queue:work` without `--queue`, i.e. only `default`, while
     `OutboxService` targets `notifications*` queues. The worker now drains
     `notifications-critical,notifications,default,notifications-digest` (override with `QUEUE_NAMES`).
6. **Scheduler** — explicit `scheduler` service (Stage 2), plus a one-minute heartbeat and
   `php artisan ops:health` (exit 0/1/2) for monitoring.
7. **CI** — `.github/actions/setup-api` composite action replaces three copies of PHP + Composer setup in
   `api.yml`; each job keeps its own test/lint/audit step.
8. **Docs** — `AGENTS.md` corrected (former "known failures" now pass; Flutter CI version) and extended with
   current known issues and operations notes; `DOCKER.md` updated (Stage 2).
9. **Repository boundaries** — `Busi`, `Loc8Mobile` and `OfflineVault` exist only in the older
   `C:\DEV\SADCPFNexus` checkout, untracked. Recommendation: confirm ownership, then move each to its own
   repository (or a declared workspace package) before any cleanup; never delete them as part of Nexus work.
   Generated test reports and auth state should stay git-ignored.

### Verification

| Check | Result |
|---|---|
| Route table before/after (2,063 routes incl. middleware order) | identical |
| `php artisan route:cache` | ok |
| Notification suites (`NotificationTest`, Phase1/2-3, producer migration, live channel drivers, governance checklist) | 53 passed, 1 skipped |
| `web` `tsc --noEmit`, `npm run test:unit` | pass / 12 pre-existing failures only |
| `web` `next build` | compiles and generates all 431 pages, then exits with Next.js `SecurityFatalError`: **installed Next.js 16.4.0 has a published security advisory**. Not caused by this work; blocks production web builds until Next.js is upgraded |
| `ops:health` against the local stack | probes report live values; heartbeat recorded by the scheduler |
| `.github` YAML | parses |

### Disclosure

While exercising the heartbeat, one local `php artisan schedule:run` executed the tasks due that minute
(`notifications:process-outbox`, `notifications:process-deliveries …`, `documents:process-ocr-jobs`,
`reports:dispatch-scheduled`) against the **local development** database (105 migrations behind). No
production or shared system was involved.

### Decisions needed

8. **Upgrade Next.js** (security advisory on 16.4.0) — dependency change left to the team.

## Stage 5 — Product improvements

All five additions reuse existing module services and access rules. None can surface a record the
viewer could not open in its own module: each source is the module's own user-scoped query, and
records outside it are omitted (not counted).

1. **"Needs my action" queue** — `GET /api/v1/me/action-queue` (`ActionQueueService`) aggregates
   engine approval tasks assigned to the caller (`WorkflowOrchestrator::inbox`), the caller's own
   requests returned for correction (with the return reason as blocker), open assignments assigned to
   them, lifecycle tasks (`LifecycleCaseService::myTasks`, RBAC-filtered) and correspondence they own
   (`accessibleQuery`). Overdue first; per-source status reported so a failing module never hides the
   rest. Web: `/my-actions` (sidebar "Needs my action", EN/FR/PT label) and a panel on `/my-work`; the
   module→record link map was extracted from the approvals page into `web/lib/recordLinks.ts` and is
   shared by both.
2. **Programme timeline** — `GET /api/v1/programmes/{id}/timeline` (`ProgrammeTimelineService`):
   programme lifecycle + approval history, and linked procurement requests, purchase orders, contracts,
   travel and M&E reports, each filtered through `AccessScopeResolver::constrainQuery` for its module.
   Money is reported **per currency and per definition** (procurement estimates vs PO commitments vs
   contract values) and never summed across currencies; the response states these are not a
   budget-versus-actual statement. Web: "Timeline" tab on the PIF detail page.
3. **Autosave and resumable submission (web)** — `web/lib/formDraft.ts` + `useFormDraft`: owner-scoped
   (tenant + user) local drafts with restore/discard, cleared on success and on logout. Applied to the
   two longest request forms — travel (1,538 lines) and leave (EN/FR/PT banner). Both forms now (a) sends an `Idempotency-Key` on
   create, (b) remembers the created id so a retry after an upload/submit failure updates the same
   request instead of **creating a duplicate** (previous behaviour), and (c) explains a lost-response
   conflict instead of showing a raw error. Mobile resumable sync is covered by Stage 2.
4. **Record search** — `GET /api/v1/search/records?q=` (`RecordSearchService`): travel, leave and
   procurement requests by reference/title, programmes, suppliers (only with vendor-register access) and
   correspondence (`accessibleQuery`), each through its module scope; LIKE wildcards escaped.
   `GlobalSearch` shows these as a "Records" group. **Meilisearch evaluation:** the container is
   provisioned but unused (no Scout package, no indexes, no config); adopting it would require
   re-implementing every module's deny-by-default rules as index filters, so database search was chosen.
   Revisit when record volume makes `ILIKE` too slow, indexing tenant + owner/scope attributes.
5. **Operational dashboard** — the existing restricted admin operations console (`admin-console.view-health`)
   previously hard-coded Web/API/Auth/Database as "operational". It now includes live probes from
   `OperationalHealthService`: scheduler heartbeat, database round-trip, failed jobs (24 h) and queue
   backlog, stale notification outbox / dead letters / failed deliveries, storage writability and free
   space. Same data via `php artisan ops:health` (exit 0/1/2) for external monitoring.

### Verification

| Test | Result |
|---|---|
| `ActionQueueTest` (approver-only, requester-only corrections, own assignments overdue-first, cross-tenant) | 4/4 |
| `ProgrammeTimelineTest` (colleague's linked record hidden, per-currency totals, denial) | 3/3 |
| `RecordSearchTest` (own vs colleague, cross-tenant, supplier gating, wildcard escaping, min length) | 5/5 |
| `OperationalHealthTest` + existing `AdminConsolePhase1Test` | 14/14 |
| `web` `recordLinks.test.mts`, `formDraft.test.mts` | pass |
| `web` `tsc`, unit tests, build guards | pass / 12 pre-existing failures only |

### Not done / next increments

- Autosave applied to travel, leave and (follow-up increment) salary advance
  (`web/app/(app)/salary-advances/create/page.tsx`, `financeApi.createAdvance(…, idempotencyKey)`): a retry after
  create-succeeded/submit-failed now updates and submits the same advance instead of creating a second one; the
  deduction consent is deliberately never autosaved or restored. Verified with `tsc` and web unit tests (534 pass,
  same 12 pre-existing failures); not exercised in a browser.
- Procurement requisition create (`web/app/(app)/procurement/create/page.tsx`, `procurementApi.create(…, idempotencyKey)`):
  same treatment; a retry also skips documents that already uploaded. Staged files are not autosaved (the restore
  banner says so). `procurement_method` cannot change on the retry path (the API's update does not accept it).
  `tsc` clean, web unit tests 534 pass / 12 pre-existing failures; not exercised in a browser.
- Risk create (`web/app/(app)/risk/create/page.tsx`, `riskApi.create(…, idempotencyKey)`, EN/FR/PT keys
  `risk.create.draftFound|draftRestore|draftDiscard`): autosave plus retry-safe create; a retry updates and submits
  the same risk and does not apply the mitigation a second time. The mitigation file is not autosaved.
- Contracts create (`web/app/(app)/contracts/create/page.tsx`, `contractsApi.create(…, idempotencyKey)`): one
  idempotency key per form session, so a create retried after a lost response returns the first contract. There is
  no separate submit step, so no update-on-retry path was needed. **Autosave was not added** to this 25-field wizard.
- Verified for all three: `tsc` clean; web unit tests 534 pass / 12 pre-existing failures; `route:list` confirms
  `EnforceIdempotencyKey` on `POST` `finance/advances`, `procurement/requests`, `risk/risks` and `contracts`.
  None of these forms was exercised in a browser. Resumable **uploads** (chunked) were not built.
- `web/lib/api.ts` line endings restored to CRLF (as at `HEAD`) so its diff shows only the real changes.
- Action queue: no team/delegated view, no SLA escalation; ownership is always "you" by construction.
- Timeline: M&E reports appear only for their submitter/creator (the M&E module has no elevated list
  scope in `AccessScopeResolver`); imprest/expenditure actuals are not included — there is no single
  agreed "actual expenditure" source per programme yet (decision needed).
- Search: no ranking/full-text; five results per module.
- Lifecycle reminders and policy explainability (review items 6–7) were not started.

### Decisions needed

9. **Programme actuals**: which records count as actual expenditure (imprest retirements, paid invoices,
   ledger postings?) and in which currency/exchange basis, before a budget-versus-actual view is built.
10. **M&E visibility in timelines**: should M&E reviewers get an elevated list scope (add `mande` to
    `AccessScopeResolver`)?

## Independent security review of these changes

A read-only security review of the full diff found no critical or high issues. Medium findings, all fixed:

| # | Finding | Fix |
|---|---|---|
| M1 | Workflow decision replay checked before actor authorization and keyed by tenant only: another user could get a stored decision snapshot (HTTP 200), and a key reused on a different request silently skipped that decision | Replay accepted only when the stored decision has the same request **and** actor; otherwise 422 `idempotency_key`. Tests: `test_another_users_idempotency_key_is_refused_not_replayed`, `test_reusing_a_key_on_a_different_request_is_refused` |
| M2 | Idempotency middleware stored response bodies in plaintext, including any credential/MFA responses sent with the header | Auth, 2FA, password and token endpoints excluded; stored bodies encrypted with `APP_KEY`. Tests added |
| M3 | Recovery-code consumption was a non-atomic read-modify-write (double use / lost removal under concurrency) | Consumed under a `lockForUpdate` transaction |
| M4 | Fingerprint ignored query string and multipart files; stale-reservation takeover after 300 s could re-run slow requests | Fingerprint = method + full URI + body, plus form fields and file name/size/sha256 for uploads; stale window 30 min |

Low findings addressed: `SET` statements moved inside the RLS `try`; `throttle:5,1,mfa-sensitive` (own bucket) on
2FA disable/regenerate/verify; drafts also cleared on 401 session expiry. Low findings accepted and documented:
idempotent replay of a user's own earlier response after a permission revocation (≤ 48 h); 40-bit recovery codes
(password + per-account login throttle precede them); module "elevated" scopes are tenant-wide in search/timeline,
matching existing list behaviour; base `docker-compose.yml` defaults `APP_ENV=local` if run without the prod
overlay (the documented deploy always uses the overlay).

## Full-suite status (honest summary)

- Baseline run (before most changes were loaded): 1,309 passed, 0 failed, then exhausted PHP's 512 MB memory limit in dompdf; the remaining ~740 tests did not run.
- Post-change full run (`php -d memory_limit=2G artisan test`, fresh DB): 393 passed, 0 failed, then **stopped by the host because the machine ran low on memory**. It was not restarted. The remaining ~1,650 tests have **not** been run against the final code.
- Every suite touching changed code was run separately on fresh databases and passes (listed per stage above).
- **Before merging, run the full API suite in CI or on a machine with more memory** (`php -d memory_limit=2G artisan test`).
