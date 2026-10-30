# SADC PF Nexus codebase review — 27 October 2026

## Scope and limits

Repository-wide inventory and targeted static review of the Laravel API, Next.js web app, Flutter staff app, Docker deployment, CI, and supporting documentation. This is an architectural review with concrete code findings, not an assertion that every line has been audited. No application code was changed and no tests were executed. Existing modified and untracked work was included as local evidence; it may differ from deployed code.

The inventory found 432 files under api/app, 228 under web/app, 105 under mobile/lib, 115 under api/tests, 16 under web/tests, and two under mobile/test. These are file counts, not counts of test cases or coverage measurements. Busi, Loc8Mobile, and OfflineVault identify themselves as separate products; they were inventoried, not audited as Nexus features.

## Overall assessment

Nexus already has substantial business functionality: travel, leave, imprest, procurement, supplier access, salary advances, HR, programmes, M&E, stock, governance, correspondence, risk, approvals, notifications, and reporting. Its next phase should emphasize reliable transitions, consistent permissions, shared document handling, and operational visibility. Preserve the modular monolith; the evidence does not justify introducing microservices.

## Prioritized findings

### 1. Production startup performs data setup and can hide failures — high

Evidence: docker/php/entrypoint.sh runs migrations at startup, then `php artisan db:seed --force`, suppressing seed errors. If every migration attempt fails, startup still continues. api/database/seeders/DatabaseSeeder.php includes user, workflow, demo, and comprehensive business-data seeders. docker-compose.prod.yml uses the same PHP image and entrypoint.

Impact: a restart can invoke data-writing setup in production; schema failures can be obscured behind an apparently running service. Actual data changes depend on each seeder's guards.

Recommendation: make migrations a single deployment job that fails the deployment on error. Run ProductionSeeder explicitly when bootstrapping production, after reviewing its idempotence. Keep demo seeding opt-in. Start the application only against the expected schema.

### 2. Development settings and port bindings survive production overlays — high

Evidence: docker-compose.yml sets BCRYPT_ROUNDS=4 for PHP and queue workers. The production overlay does not replace that value. The base web port is `${WEB_PORT:-3000}:3000`; the production overlay adds a loopback port but does not explicitly remove the base binding, despite its comment that all base ports use loopback. Only PHP receives an explicit production APP_ENV override in that overlay.

Recommendation: render and review the merged production configuration. Set password hashing cost through production configuration, align worker environment with PHP, and explicitly replace or constrain published ports. Confirm effective runtime values before deployment. External reachability still depends on host firewall and networking.

### 3. Offline drafts are not scoped to an account — high

Evidence: mobile/lib/core/offline/draft_database.dart defines a shared `drafts` database with no tenant_id or user_id columns. OfflineDraftsScreen loads all unsynced entries and submits them through the currently authenticated API client.

Impact: switching accounts on the same installation can expose another user's drafts and submit them under the new account.

Recommendation: partition drafts by tenant and user, enforce ownership when reading and syncing, and define a safe migration for existing ownerless entries. Test account switching and logout explicitly.

### 4. Approval transitions need concurrency protection — high

Evidence: WorkflowService::approve and reject verify the actor and read the current step before entering DB::transaction. The approval transaction does not acquire a row lock or revalidate a freshly loaded workflow state. ApprovalController delegates to this service without a visible row lock.

Impact: concurrent approve/reject requests can validate the same old state and write incompatible histories or outcomes. A transaction alone does not serialize the initial check.

Recommendation: lock and reload the approval inside the transaction; validate pending status, current step, and actor there. Add concurrent approval/rejection and replay tests. Protect final financial effects with database constraints or idempotency records.

### 5. Database session cleanup is not exception-safe — high

Evidence: SetRlsContext sets session variables and SET ROLE app_user, calls the next middleware, and resets the role only after a successful return. It does not use finally or clear the context variables.

Impact: an exception skips cleanup. Reused connections are especially sensitive to retained role or tenant context; this is a lifecycle defect, not proof of a demonstrated cross-tenant exploit.

Recommendation: guarantee cleanup in finally, including context variables. Evaluate transaction-local settings against the actual connection lifecycle. Test sequential requests across tenants after exceptions and failed transactions.

### 6. Web permissions diverge from backend permissions — medium

Evidence: web/lib/auth.ts recognizes admin and Admin as system administrators; User::isSystemAdmin does not. ROUTE_ACCESS uses the first prefix match, so `/hr` precedes and shadows `/hr/payslips`. Unlisted routes default to allowed.

Impact: navigation and route guards can show the wrong capabilities or block valid users. Backend checks remain the security boundary.

Recommendation: standardize role identifiers; prefer backend-supplied capabilities. Use explicit or longest-prefix route matching and test the permission matrix. Derive sidebar visibility and action buttons from the same capability model.

### 7. Query caches are not explicitly isolated by identity — medium

Evidence: QueryProvider creates a root QueryClient; AuthProvider login/logout updates user storage and state without clearing that client. TravelPage uses a query key containing module and filter but no user or tenant identity.

Impact: an account change without a full page reload can reuse previous account data. A hard reload may currently mask this path.

Recommendation: clear cached queries on identity changes and scope private query keys by tenant/user. Test a same-tab account switch and role changes.

### 8. Offline retries can recreate records — medium

Evidence: OfflineDraftsScreen creates a record, optionally submits PIF or salary advance in a second request, then deletes the local draft. It does not persist the created server ID between those operations.

Impact: if creation succeeds but submission or the response fails, retrying can create another record.

Recommendation: persist an operation UUID and server record ID; implement server idempotency keys and a resumable sync state machine. Preserve per-draft validation errors for correction.

### 9. Document mutations reuse view authorization — medium

Evidence: TravelAttachmentController calls ensureCanView for index, download, store, and destroy. That helper permits travel approvers broadly. QuoteAttachmentController uses separate mutation role checks, showing inconsistent policies across modules.

Recommendation: define explicit view/upload/delete permissions and state rules, particularly after signing or approval. Confirm the intended business policy before restricting existing access. Separate a shared attachment storage service from module-specific authorization. Handle failed storage/database operations with compensation and orphan cleanup.

### 10. Operational execution is only partly described — medium

Evidence: api/routes/console.php defines reminder, budget, TOIL, and summary schedules. The reviewed Compose services provide a queue worker but no scheduler service; no scheduler launch was found in docker scripts. A host cron may exist outside the repository.

Recommendation: document or supply the scheduler runner and monitor its heartbeat. Add queue backlog, failed-job, delivery-failure, and backup-restore visibility. Avoid overlapping scheduled runs where duplicate reminders or financial updates would matter.

### 11. MFA lifecycle can be strengthened — medium

Evidence: TwoFactorController stores mfa_secret through User::update; User casts do not encrypt that field. Disabling MFA verifies a password only. No recovery-code lifecycle is visible in that controller.

Recommendation: encrypt secrets at rest with a migration for existing values, require an appropriate second-factor or recovery challenge for sensitive changes, provide recovery codes, and audit enrollment/removal. Never expose secrets in logs.

## Consolidation plan

| Area | Evidence | Consolidation |
|---|---|---|
| API client and types | web/lib/api.ts has 5,198 lines | Split by business domain; keep one configured transport and shared pagination/error types. Introduce a versioned API schema and generated types incrementally. |
| Route registration | api/routes/api.php has 1,135 lines | Split route files by domain while retaining a single visible authentication/RLS boundary. |
| Large pages | PIF detail page has 1,302 lines | Extract section components and domain hooks; keep orchestration in the page. |
| Documents | Multiple attachment controllers and DocumentsPanel, GenericDocumentsPanel, RiskDocumentsPanel | Share transfer/storage/preview primitives; keep document types, access policies, and lifecycle rules specific to each module. |
| Approvals | Shared WorkflowService plus module-specific transitions | Establish one transition contract, audit history format, notification event, and delegation interface; preserve different business approval steps. |
| Notifications | Central NotificationService already exists; email queued, push called inline | Extend the existing service with queued push, after-commit events/outbox, delivery tracking, deduplication, and preferences. |
| UI state | React Query and shared UI components already exist | Standardize query keys, invalidation, tables, pagination, error/retry states, status badges, and accessible dialogs. Reuse the existing foundations. |
| Repository boundaries | Untracked Busi, Loc8Mobile, OfflineVault describe separate products | Decide ownership, then move to dedicated repositories or explicitly managed workspace packages. Do not delete them as cleanup. Exclude generated test reports and auth state from commits. |
| CI setup | API/web/readiness jobs duplicate service setup | Share setup steps and environment definitions while preserving separate test jobs and failure visibility. |

Do not combine financial ledgers, procurement lifecycle states, and HR balances into a generic request table merely because they share approvals. Share workflow infrastructure, not unrelated accounting rules.

## Useful additions, in order

1. **A unified work queue:** extend existing approvals, alerts, and assignments into one view of what needs my action, who owns the next step, due dates, and blockers. Deep-link to the original record and preserve permissions.
2. **An end-to-end programme record:** surface existing PIF, procurement, travel, expenditure, and M&E links as one timeline with budget-versus-actual and missing-document checks. Validate financial definitions before combining totals.
3. **Resilient drafts:** add autosave, resumable uploads, and visible sync failures across long forms. Start with correcting mobile ownership and retry behavior.
4. **Record search:** extend the existing navigation-oriented GlobalSearch with permission-filtered search for request references, suppliers, programmes, and correspondence. Evaluate the already provisioned Meilisearch before adding another service.
5. **Operational administration:** scheduler health, failed jobs, notification delivery, integration failures, document storage health, and restore-test results in one restricted screen.
6. **Lifecycle reminders:** consolidate existing reminder commands into configurable due-date and escalation policies; expose existing reminders before creating parallel notification logic.
7. **Policy explainability:** show the policy version, threshold, balance, and approval route behind a decision, building on existing policy/version models. Include a safe preview for administrators.

## Quality and documentation

The backend already has substantial feature tests and CI includes Pint, Composer/npm audits, TypeScript build checks, Playwright, and Flutter analysis/tests. Build on that investment. The mobile test inventory is particularly small relative to its source surface.

Highest-value additional tests: cross-tenant access after exceptions; account-switch cache/draft isolation; concurrent approvals; network interruption during offline creation/submission; attachment mutation rules; and production configuration assertions. Use real PostgreSQL for RLS and locking tests.

The README says tests require PostgreSQL, while REMAINING_WORK still mentions SQLite and labels much work optional or complete despite newer lifecycle additions. run-tests.sh is referenced by CI but was not tracked in the reviewed checkout; publish the intended script before depending on it in fresh checkouts. Update module ownership, deployment, scheduler, and production seeding documentation.

## Suggested delivery sequence

- **First:** establish a reproducible baseline from a fresh checkout; fix production startup/settings, draft ownership, RLS cleanup, and approval locking. Run targeted regression tests.
- **Next:** align permissions, isolate caches, make sync resumable, and normalize attachment policies. Validate full staff/approver/finance/supplier journeys.
- **Then:** split large files and consolidate shared primitives incrementally, with no bulk rewrite.
- **Afterward:** deliver the unified work queue, programme timeline, record search, and operational dashboard using existing modules.

Effort estimates should follow a baseline test run and agreement on attachment permissions, deployment ownership, and intended offline behavior. This review does not certify production readiness or dependency vulnerability status.

---

## Implementation status (2026-10-27)

Implemented on branch `chore/codebase-review-2026-10-27` against the current checkout (`D:\dev\SADCPFNexus`,
which is ahead of the `C:\DEV\SADCPFNexus` copy this review was written from). Full detail, test evidence
and open decisions: [codebase-review-2026-10-27-implementation.md](codebase-review-2026-10-27-implementation.md).

| # | Finding | Status |
|---|---|---|
| 1 | Production startup seeds / hides migration failures | **Fixed** — no seeding or migrating in production containers; failures fatal; `schema:check` gate; `migrate` deploy job; `deploy.sh` verifies schema |
| 2 | Dev settings / ports in production | **Fixed** — `BCRYPT_ROUNDS=4` dev-only; queue/scheduler/migrate run `APP_ENV=production`; all published ports loopback (validated with `docker compose config`) |
| 3 | Offline drafts not account-scoped | **Fixed** — drafts owned by `tenant:user`; pre-upgrade drafts quarantined (count + discard only) |
| 4 | Approval concurrency | **Fixed (narrower than stated)** — engine already locked `decide()`; all transitions now lock + revalidate status, stage and actor in one transaction; replays never re-run finalisation |
| 5 | RLS cleanup not exception-safe | **Fixed** — `finally` cleanup incl. aborted transactions and context variables; connection purged if cleanup fails |
| 6 | Web/API permission divergence | **Mostly not reproduced** — admin roles already matched; no shadowed rules; unknown routes already denied. Route matching made longest-prefix; mobile admin roles aligned |
| 7 | Query cache not identity-scoped | **Fixed** — cache cleared on logout / account / role change |
| 8 | Offline retries recreate records | **Fixed** — operation UUIDs, persisted server ids, server `Idempotency-Key` middleware; consent-gated submits no longer auto-sent |
| 9 | Attachment mutations reuse view auth | **Partly not reproduced** (global endpoint PEP gates most); **real hole fixed** on `/api/v1/contracts/*/attachments`; programme-document scoping; lifecycle locks where defined (Contract, Risk); shared `AttachmentFiles` storage primitive; bridge transactional |
| 10 | Scheduler not described | **Fixed** — `scheduler` service (opt-in profile in production), heartbeat, `ops:health`; worker now drains notification queues (latent bug) |
| 11 | MFA lifecycle | **Fixed** — secrets encrypted at rest (migration), recovery codes, second factor required to disable/regenerate, audited |

Consolidation: route registration split into `routes/api/*` (route table verified identical), web API
transport extracted (`lib/api/client.ts`, `lib/api/cookies.ts`), PIF page constants extracted, CI PHP setup
shared, notifications deliver after the response is sent. Product additions: "Needs my action" queue,
programme timeline, travel-form autosave with duplicate-safe submission, permission-filtered record search,
live operational probes. Remaining work and decisions are listed in the implementation log.
