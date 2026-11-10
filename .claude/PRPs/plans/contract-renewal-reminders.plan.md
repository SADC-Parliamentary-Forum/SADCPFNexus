# Plan: Contract Renewal Reminders Before Expiry

## Summary
Extend the existing daily contract reminder engine (`ContractReminderService`, run by `contracts:send-reminders` at 08:35) so it understands renewals. The changes:

- Add a new **renewal-decision reminder**, keyed on the renewal decision date. That is `renewal_decision_date`, or else `end_date − notice_period_days`. Both fields are captured today but never used for reminders.
- Tailor the expiry-reminder wording to the contract's `renewal_type` and `auto_renew`.
- Suppress reminders while a renewal or extension is already pending.
- Fix a latent bug where reminders are silently swallowed after a contract is renewed. This happens because idempotency keys don't include the term.

## User Story
As a contract owner or procurement officer, I want timely reminders before a contract's renewal decision date that tell me what kind of decision is needed, so that auto-renewals and renewal rights are never missed or acted on by default.

## Problem → Solution
**Today:**
- Expiry reminders fire at 120/90/60/30/14/7 days before `end_date`, all with the same "renew, extend or close out" text. This is the same for non-renewable contracts.
- The renewal decision / notice deadline (`renewal_decision_date`, `notice_period_days`) only feeds a risk score and an exception that is raised when someone views the contract. Nothing pushes a reminder.
- Reminders keep firing while a renewal or extension is already pending.
- After a renewal is approved, the new term reuses the same idempotency keys (`contract.expiry_reminder:{id}:{days}`), so the second term gets **no** expiry reminders.

**After:**
- A `contract.renewal_decision_reminder` fires at 60/30/14/7/1/0 days before the decision date.
- A one-shot escalation fires if the decision date passes with no renewal action.
- Expiry text is renewal-type aware.
- Both reminder kinds are suppressed while a renewal or extension is pending.
- Keys are scoped to the current term, so renewed contracts get a fresh reminder cycle.

## Metadata
- **Complexity**: Medium
- **Source PRD**: N/A (PRD §64–§66 reminders, §72–§74 renewals, referenced in code comments)
- **PRD Phase**: N/A
- **Estimated Files**: 4 (3 updated + 1 test file extended)

---

## UX Design

### Before
```
Inbox / email (owner + procurement officer)
  "Contract expiring soon — CTR-2026-014"
  "...due to end on 2026-12-31 — in 60 day(s).
   Please review whether it should be renewed, extended or closed out."
  (same text for non-renewable / auto-renew; nothing about the notice deadline,
   which may have been 90 days before end and is already past)
```

### After
```
"Renewal decision due — CTR-2026-014"
  "...the renewal decision / notice deadline is 2026-10-02 — in 14 day(s).
   This contract renews automatically unless non-renewal notice is served
   by the deadline."

"Contract expiring soon — CTR-2026-014"
  "...due to end on 2026-12-31 — in 60 day(s).
   This contract is non-renewable — plan close-out or a new procurement."

(no reminders while a renewal/extension is pending; fresh cycle after renewal)
```

### Interaction Changes
| Touchpoint | Before | After | Notes |
|---|---|---|---|
| In-app bell / email | Expiry reminders only | + renewal-decision reminders + a one-shot "decision deadline passed" escalation | Same recipients: owner + procurement officer |
| Expiry reminder body | Fixed advice line | `{{advice}}` varies by renewal_type / auto_renew / renewal right exhausted | Default template text only. DB-customised templates are unaffected. |
| Pending renewal/extension | Reminders keep firing | Renewal-decision and expiry reminders suppressed | Overdue-expiry escalation (days < 0) is **not** suppressed |
| Renewed contract | Second term silent at windows the first term already hit | Full reminder cycle per term | Bug fix |

No web or mobile changes. The notification links to the existing `/contracts/{id}`.

---

## Mandatory Reading

| Priority | File | Lines | Why |
|---|---|---|---|
| P0 | `api/app/Modules/Contracts/Services/ContractReminderService.php` | 1-184 | The file being changed. Windows, `dispatchAll`, idempotency-key format. |
| P0 | `api/app/Services/NotificationService.php` | 678-697 | Default templates for `contract.*` triggers. The new template goes here. |
| P0 | `api/tests/Feature/Contracts/ContractReminderTest.php` | 1-91 | Test harness to extend (`contract()` factory helper, `outboxCount`) |
| P1 | `api/app/Modules/Contracts/Services/ContractExceptionService.php` | 69-97 | `detectAutoRenewalDeadline`: the **90-day default** notice window to mirror |
| P1 | `api/app/Modules/Contracts/Services/ContractRenewalService.php` | 55-100 | renewal_type rules (`non_renewable`, `renewable_once` + `renewals_count`). Approval updates `end_date`. |
| P1 | `api/app/Models/Contract.php` | 22-75, 251-259, 314-317 | Fillable/casts (`renewal_decision_date` date, `notice_period_days` int, `auto_renew` bool), `extensions()` / `renewals()` relations, `lifecycle()` |
| P2 | `api/database/migrations/2026_09_18_110000_create_contract_extension_renewal_tables.php` | 17-61 | Status values: `pending\|approved\|rejected` on both tables |
| P2 | `api/app/Modules/Notifications/Services/NotificationDispatchService.php` | 36-80 | Outbox dedupes on `idempotency_key` per tenant, permanently. This is why keys must include the term. |
| P2 | `api/app/Http/Controllers/Api/V1/Contracts/ContractController.php` | 329-332 | Valid `renewal_type` values: `non_renewable, renewable_once, renewable_multiple, automatic, subject_to_approval` |

## External Documentation
No external research needed. The feature uses established internal patterns (the Notifications outbox, the Carbon date maths already in the service).

---

## Patterns to Mirror

### NAMING_CONVENTION (window constants, trigger keys, idempotency keys)
```php
// SOURCE: api/app/Modules/Contracts/Services/ContractReminderService.php:21-32
/** Days before end date at which to remind (PRD §65). */
private const EXPIRY_WINDOWS = [120, 90, 60, 30, 14, 7];
/** Days before the signature deadline. */
private const SIGNATURE_WINDOWS = [5, 2, 1, 0];
private const LIVE_STATUSES = ['ACTIVE', 'FULLY_EXECUTED'];
```
Trigger keys are `contract.<snake_case>`. Idempotency keys are `"{trigger}:{id}:{discriminator}"`, and `dispatchAll` appends `:user:{id}`.

### SERVICE_PATTERN (per-kind private scanner summed in run())
```php
// SOURCE: ContractReminderService.php:37-44, 51-77
public function run(?int $tenantId = null, ?Carbon $asOf = null): int
{
    $asOf = ($asOf ?? now())->copy()->startOfDay();
    return $this->expiryReminders($tenantId, $asOf)
        + $this->deliverableReminders($tenantId, $asOf)
        + $this->signatureReminders($tenantId, $asOf);
}

private function expiryReminders(?int $tenantId, Carbon $asOf): int
{
    $sent = 0;
    $contracts = $this->baseQuery($tenantId)
        ->whereIn('contract_status', self::LIVE_STATUSES)
        ->whereNotNull('end_date')
        ->get();
    foreach ($contracts as $c) {
        $days = (int) $asOf->diffInDays($c->end_date->copy()->startOfDay(), false);
        $recipients = $this->contractRecipients($c);
        if (in_array($days, self::EXPIRY_WINDOWS, true)) {
            $sent += $this->dispatchAll($recipients, 'contract.expiry_reminder', [...], $c, "contract.expiry_reminder:{$c->id}:{$days}");
        } elseif ($days < 0) {
            $sent += $this->dispatchAll($recipients, 'contract.escalation', [...], $c, "contract.escalation:expiry:{$c->id}:{$asOf->toDateString()}");
        }
    }
    return $sent;
}
```

### DEFAULT_NOTICE_WINDOW (mirror for the auto-renew fallback)
```php
// SOURCE: api/app/Modules/Contracts/Services/ContractExceptionService.php:82-84
// Notice window: the configured notice period, or 90 days by default.
$window = (int) ($contract->notice_period_days ?: 90);
$deadline = $contract->end_date->copy()->subDays($window);
```

### NOTIFICATION_TEMPLATE
```php
// SOURCE: api/app/Services/NotificationService.php:679-697
// Contract Management reminders & escalation (PRD §64-66)
'contract.expiry_reminder' => [
    'subject' => 'Contract expiring soon — {{reference}}',
    'body' => "Dear {{name}},\n\nContract {{reference}} ({{title}}) is due to end on {{end_date}} — in {{days}} day(s).\n\nPlease review whether it should be renewed, extended or closed out.\n\nRegards,\nSADC-PF Nexus",
],
```

### ERROR_HANDLING / LOGGING
This is a scheduled scanner, so there's no user-facing errors and no logging. Bad rows are skipped with `continue` (`ContractReminderService.php:91-93`). The command prints `"Dispatched {$sent} contract reminder(s)."`. Mirror this: no new logging, and no exceptions thrown out of the scanner.

### TEST_STRUCTURE
```php
// SOURCE: api/tests/Feature/Contracts/ContractReminderTest.php:25-58
private function contract(array $overrides = []): Contract { /* ACTIVE, end_date +30d, owner + PO */ }
private function outboxCount(string $event): int
{
    return NotificationOutbox::where('tenant_id', $this->tenant->id)->where('event_type', $event)->count();
}
public function test_expiry_window_notifies_owner_and_procurement_once(): void
{
    $this->contract(['end_date' => now()->addDays(30)->toDateString()]);
    $svc = app(ContractReminderService::class);
    $sent = $svc->run($this->tenant->id);
    $this->assertSame(2, $sent); // owner + procurement officer
    $this->assertSame(2, $this->outboxCount('contract.expiry_reminder'));
    $svc->run($this->tenant->id);
    $this->assertSame(2, $this->outboxCount('contract.expiry_reminder'));
}
```
Pending-renewal fixtures follow `ContractRenewalTest.php`: `\App\Models\ContractRenewal::create([... 'status' => 'pending'])`. The required columns are `tenant_id, contract_id, new_start_date, new_end_date`. For `ContractExtension` they are `tenant_id, contract_id, proposed_end_date, reason, status`.

`NotificationOutbox::$casts` has `'payload' => 'array'` (`api/app/Models/Notifications/NotificationOutbox.php:30-31`), so `$row->payload['vars']['advice']` works directly.

---

## Files to Change

| File | Action | Justification |
|---|---|---|
| `api/app/Modules/Contracts/Services/ContractReminderService.php` | UPDATE | New `renewalDecisionReminders()`, pending suppression, renewal-aware advice, term-scoped idempotency keys |
| `api/app/Services/NotificationService.php` | UPDATE | Add a `contract.renewal_decision_reminder` default template. Expiry body uses `{{advice}}`. |
| `api/app/Console/Commands/ContractsSendReminders.php` | UPDATE | `$description` mentions renewal-decision reminders |
| `api/tests/Feature/Contracts/ContractReminderTest.php` | UPDATE | New cases (see Testing Strategy) |

## NOT Building
- Configurable or per-contract-type reminder windows (they stay `const`)
- A web or mobile "Renewals due" panel or new API endpoints
- New migrations or columns. `renewal_decision_date`, `notice_period_days`, `auto_renew` and `renewal_type` already exist.
- Changing the daily overdue-expiry escalation (days < 0). It stays daily and is not suppressed.
- Auto-creating renewals or serving notice. Reminders only.
- Changes to `ContractExceptionService` / `ContractRiskService`. They stay as they are.
- Seeding DB `NotificationTemplate` rows. Defaults live in code.

---

## Step-by-Step Tasks

### Task 1: Term-scoped idempotency keys (bug fix)
- **ACTION**: In `expiryReminders()`, change the key to `"contract.expiry_reminder:{$c->id}:{$c->end_date->toDateString()}:{$days}"`.
- **IMPLEMENT**: A one-line change. Apply the same `end_date` scoping to the new renewal-decision keys in Task 3.
- **MIRROR**: The existing key format, with the term (end date) as an added discriminator.
- **GOTCHA**: Outbox dedupe is permanent per tenant (`NotificationDispatchService.php:79`). Without the term, an approved renewal's new `end_date` re-enters the same `{days}` windows, and every reminder is silently swallowed. Changing the key format means a contract that is *exactly* on a window on deploy day could get one duplicate if the 08:35 run already fired. This is acceptable; see Risks.
- **VALIDATE**: The new test `test_renewed_contract_gets_fresh_expiry_cycle` passes.

### Task 2: Pending renewal/extension suppression
- **ACTION**: Eager-count pending renewals and extensions on the live-contract query, and skip reminders when either exists.
- **IMPLEMENT**:
  ```php
  private function liveContracts(?int $tenantId)
  {
      return $this->baseQuery($tenantId)
          ->whereIn('contract_status', self::LIVE_STATUSES)
          ->whereNotNull('end_date')
          ->withCount([
              'renewals as pending_renewals_count' => fn ($q) => $q->where('status', 'pending'),
              'extensions as pending_extensions_count' => fn ($q) => $q->where('status', 'pending'),
          ]);
  }

  private function hasPendingRenewalAction(Contract $c): bool
  {
      return (int) $c->pending_renewals_count > 0 || (int) $c->pending_extensions_count > 0;
  }
  ```
  In `expiryReminders()`, use `$this->liveContracts($tenantId)->get()`. In the window branch only, add `&& ! $this->hasPendingRenewalAction($c)`. Leave the `$days < 0` escalation branch untouched.
- **MIRROR**: The `baseQuery` / `when` style at `ContractReminderService.php:46-49`.
- **GOTCHA**: `renewals()` / `extensions()` define `orderByDesc('id')`. That's harmless inside `withCount`, but don't call `->get()` on the relations per contract, because that causes N+1 queries. `withCount` aliases need the `'relation as alias'` string form.
- **VALIDATE**: `test_pending_renewal_suppresses_expiry_and_decision_reminders` passes.

### Task 3: Renewal-decision reminders
- **ACTION**: Add the `RENEWAL_DECISION_WINDOWS` const, `renewalDecisionDate()`, and `renewalDecisionReminders()`, and add them to `run()`.
- **IMPLEMENT**:
  ```php
  /** Days before the renewal decision / non-renewal notice deadline (PRD §74). */
  private const RENEWAL_DECISION_WINDOWS = [60, 30, 14, 7, 1, 0];

  /** Default notice window for auto-renewing contracts with no notice period (mirrors ContractExceptionService). */
  private const DEFAULT_AUTO_RENEW_NOTICE_DAYS = 90;

  private function renewalDecisionDate(Contract $c): ?Carbon
  {
      if ($c->renewal_decision_date !== null) {
          return $c->renewal_decision_date->copy()->startOfDay();
      }
      $notice = (int) $c->notice_period_days;
      if ($notice <= 0 && $c->auto_renew) {
          $notice = self::DEFAULT_AUTO_RENEW_NOTICE_DAYS;
      }

      return $notice > 0 ? $c->end_date->copy()->startOfDay()->subDays($notice) : null;
  }

  private function renewalDecisionReminders(?int $tenantId, Carbon $asOf): int
  {
      $sent = 0;
      foreach ($this->liveContracts($tenantId)->get() as $c) {
          if ($c->renewal_type === 'non_renewable' || $this->hasPendingRenewalAction($c)) {
              continue;
          }
          $decision = $this->renewalDecisionDate($c);
          if ($decision === null || $decision->gte($c->end_date->copy()->startOfDay())) {
              continue;
          }
          $days = (int) $asOf->diffInDays($decision, false);
          $term = $c->end_date->toDateString();
          $recipients = $this->contractRecipients($c);

          if (in_array($days, self::RENEWAL_DECISION_WINDOWS, true)) {
              $sent += $this->dispatchAll($recipients, 'contract.renewal_decision_reminder', [
                  'reference' => $c->reference_number, 'title' => $c->title,
                  'decision_date' => $decision->toDateString(), 'end_date' => $term,
                  'days' => $days, 'advice' => $this->renewalAdvice($c),
              ], $c, "contract.renewal_decision_reminder:{$c->id}:{$term}:{$days}");
          } elseif ($days < 0 && $asOf->lt($c->end_date->copy()->startOfDay())) {
              $sent += $this->dispatchAll($recipients, 'contract.escalation', [
                  'reference' => $c->reference_number, 'title' => $c->title,
                  'issue' => "The renewal decision / notice deadline ({$decision->toDateString()}) has passed with no renewal or extension recorded.",
              ], $c, "contract.escalation:renewal_decision:{$c->id}:{$term}");
          }
      }

      return $sent;
  }
  ```
  `run()` becomes `expiry + renewalDecision + deliverable + signature`.
- **MIRROR**: The `expiryReminders` structure exactly (window branch / `elseif` overdue branch).
- **GOTCHA**:
  - The overdue escalation key has **no date**, so it fires once per term, not daily. That's deliberate: past the decision date, daily nagging adds nothing, and the expiry reminders keep going.
  - Contracts with neither `renewal_decision_date` nor `notice_period_days` and `auto_renew=false` get **no** decision reminder. They still get expiry reminders.
  - Skip when the decision date is ≥ `end_date` (bad data).
  - `renewal_type` may be `null`. Treat it as `subject_to_approval`, matching `ContractRenewalService.php:57`.
- **VALIDATE**: The decision-window, notice-period-fallback, auto-renew-default, non-renewable and once-per-term escalation tests pass.

### Task 4: Renewal-aware advice text
- **ACTION**: Add `renewalAdvice(Contract $c): string`. Pass it as `advice` to both the expiry and renewal-decision vars.
- **IMPLEMENT**:
  ```php
  private function renewalAdvice(Contract $c): string
  {
      $type = $c->renewal_type ?? 'subject_to_approval';

      return match (true) {
          $type === 'non_renewable' => 'This contract is non-renewable — plan close-out or a new procurement.',
          $type === 'renewable_once' && (int) $c->renewals_count >= 1 => 'The single renewal right has been used — plan close-out or a new procurement.',
          $c->auto_renew || $type === 'automatic' => 'This contract renews automatically unless non-renewal notice is served by the deadline.',
          default => 'Please decide whether to renew, extend or close out, allowing time for procurement validation and budget confirmation.',
      };
  }
  ```
  Add `'advice' => $this->renewalAdvice($c)` to the expiry-reminder vars array.
- **MIRROR**: The vars-array style at `ContractReminderService.php:64-67`.
- **GOTCHA**: Order matters. Non-renewable and exhausted checks come before auto-renew, so an `auto_renew` flag on a non-renewable contract (contradictory data) still says "non-renewable". The `renewable_once` exhausted rule mirrors `ContractRenewalService.php:61`.
- **VALIDATE**: `test_expiry_advice_reflects_renewal_type` asserts on the outbox payload `vars.advice`.

### Task 5: Templates
- **ACTION**: In `NotificationService.php`, inside the "Contract Management reminders & escalation" block:
  - Change the `contract.expiry_reminder` body line `Please review whether it should be renewed, extended or closed out.` → `{{advice}}`.
  - Add, right after `contract.expiry_reminder`:
  ```php
  'contract.renewal_decision_reminder' => [
      'subject' => 'Renewal decision due — {{reference}}',
      'body' => "Dear {{name}},\n\nContract {{reference}} ({{title}}) ends on {{end_date}}. The renewal decision / notice deadline is {{decision_date}} — in {{days}} day(s).\n\n{{advice}}\n\nRegards,\nSADC-PF Nexus",
  ],
  ```
- **MIRROR**: The adjacent `contract.*` entries.
- **GOTCHA**: Only the in-code default changes. A tenant that has customised `contract.expiry_reminder` in the DB keeps its text, and the unused `advice` var is harmless.
- **VALIDATE**: `php -l app/Services/NotificationService.php`.

### Task 6: Command description
- **ACTION**: In `ContractsSendReminders.php`, set `$description` to `'Send contract signature, expiry, renewal-decision and deliverable reminders and escalate overdue items (PRD §64-66, §74)'`. Also update the class docblock in `ContractReminderService` to mention renewal-decision reminders.
- **VALIDATE**: `php artisan list contracts` shows the new description.

### Task 7: Tests
- **ACTION**: Extend `ContractReminderTest.php` with the cases below. Use the existing `contract()` helper with overrides, and `outboxCount()`.
- **IMPORTS**: `App\Models\ContractRenewal`, `App\Models\ContractExtension`.
- **GOTCHA**:
  - **Count reminders by trigger.** The default fixture has `end_date` +30 days, which also hits an expiry window. Assert on the specific trigger's `outboxCount`, not on the `run()` return.
  - **Avoid accidental decision-window hits.** For decision-only assertions, set `end_date` to a non-window offset (e.g. +100 days) and set `renewal_decision_date` explicitly.
  - **Payload assertions.** Read `NotificationOutbox::where(... 'event_type', ...)->latest('id')->first()->payload['vars']['advice']`. `payload` is cast to an array.
- **VALIDATE**: `php artisan test --filter=ContractReminderTest`.

---

## Testing Strategy

### Feature Tests (`ContractReminderTest`)

| Test | Input | Expected Output | Edge Case? |
|---|---|---|---|
| `test_renewal_decision_window_notifies_once` | end +100d, `renewal_decision_date` +30d | 2 `contract.renewal_decision_reminder`. Re-run still 2. | |
| `test_notice_period_derives_decision_date` | end +44d, `notice_period_days` 30 (decision +14d) | 2 decision reminders | |
| `test_auto_renew_defaults_to_90_day_notice` | end +97d, `auto_renew` true, no notice/date (decision +7d) | 2 decision reminders | ✓ |
| `test_no_decision_reminder_without_decision_inputs` | end +100d, nothing set, auto_renew false | 0 decision reminders | ✓ |
| `test_non_renewable_gets_no_decision_reminder` | `renewal_type` non_renewable, decision +30d | 0 decision reminders | ✓ |
| `test_pending_renewal_suppresses_expiry_and_decision_reminders` | end +30d, decision +14d, pending `ContractRenewal` | 0 expiry, 0 decision reminders | ✓ |
| `test_pending_extension_suppresses_reminders` | end +30d, pending `ContractExtension` | 0 expiry | ✓ |
| `test_passed_decision_escalates_once_per_term` | end +100d, decision −5d | 2 `contract.escalation`. Run again with `asOf` = tomorrow → still 2. | ✓ |
| `test_renewed_contract_gets_fresh_expiry_cycle` | Run with `asOf = now()`, end +30d → update `end_date` to `now()->addDays(60)` → run with `asOf = now()->addDays(30)` | 4 `contract.expiry_reminder` total | ✓ bug fix |
| `test_expiry_advice_reflects_renewal_type` | non_renewable, end +30d | the payload `advice` contains "non-renewable" | |
| existing 4 tests | unchanged | still pass | regression |

### Edge Cases Checklist
- [x] Null `renewal_type` → treated as subject_to_approval
- [x] Decision date ≥ end date → skipped
- [x] Contract already past end → no decision escalation (`asOf < end` guard). The existing expiry escalation covers it.
- [x] Recipients missing (owner/PO null) → `contractRecipients` returns empty, so 0 sent
- [x] Re-runs the same day → idempotent
- [ ] Concurrent runs → covered by outbox idempotency; no new handling

---

## Validation Commands

### Static Analysis / Lint
```bash
cd api
php -l app/Modules/Contracts/Services/ContractReminderService.php
./vendor/bin/pint --test app/Modules/Contracts/Services/ContractReminderService.php app/Services/NotificationService.php app/Console/Commands/ContractsSendReminders.php tests/Feature/Contracts/ContractReminderTest.php
```
EXPECT: No syntax errors. Pint is clean on the changed files (CI enforces Pint on changed files only).

### Targeted Tests
```bash
cd api
php artisan test --filter=ContractReminderTest
php artisan test --filter=ContractRenewalTest
```
EXPECT: All pass.

### Contracts Suite
```bash
cd api
php artisan test tests/Feature/Contracts
```
EXPECT: No regressions.

### Full Suite
```bash
cd api
php artisan test
```
EXPECT: Only the known pre-existing failure (`ExternalWorkplanAuthTest::test_workplan_view_alone_cannot_access_external_workplan`).

### Manual Validation
- [ ] `php artisan contracts:send-reminders --tenant=<id>` on the dev DB prints a count with no errors.
- [ ] On a seeded contract, set `renewal_decision_date = today + 7`, run the command, and check the bell notification text and link to `/contracts/{id}`.
- [ ] Optional: on prod, verify with a `DB::transaction` + rollback via tinker, per the team's prod smoke-test practice. No staging environment exists.

---

## Acceptance Criteria
- [ ] Renewal-decision reminders fire at 60/30/14/7/1/0 days before the decision date, to owner + procurement officer, once each.
- [ ] Decision date resolves as: `renewal_decision_date`, else `end_date − notice_period_days`, else (auto_renew only) `end_date − 90`.
- [ ] Non-renewable contracts never get decision reminders. Their expiry text says non-renewable.
- [ ] A pending renewal or extension suppresses expiry and decision reminders (but not the overdue-expiry escalation).
- [ ] A passed decision date escalates once per term.
- [ ] Renewed contracts receive a full new reminder cycle.
- [ ] All validation commands pass. Pint is clean on the changed files.

## Completion Checklist
- [ ] Code follows the existing scanner structure in `ContractReminderService`
- [ ] No new logging or exceptions (matches the scanner style)
- [ ] Tests follow `ContractReminderTest` helpers
- [ ] Window values are `const` with PRD docblocks, not magic numbers
- [ ] No migrations, routes or UI added
- [ ] Self-contained: no questions needed during implementation

## Risks
| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Changed expiry key format re-fires a reminder on deploy day for contracts exactly on a window | Low | Low (one duplicate email) | Deploy before 08:35, or accept |
| Many seeded or legacy contracts with `auto_renew=true` and no notice data suddenly get 90-day-derived reminders | Medium | Low–Med (notification burst) | Matches existing exception-service semantics. Check the dev-DB count with a dry run before deploy. |
| DB-customised `contract.expiry_reminder` template doesn't show advice | Low | Low | Documented. Admins can add `{{advice}}`. |
| `withCount` alias collides with an existing attribute | Very low | Low | Aliases are prefixed `pending_` and unused elsewhere |

## Notes
- **Scope:** the user chose "renewal-aware reminders" only. Configurable windows and a "Renewals due" UI were explicitly deferred.
- **Overlap:** `ContractExceptionService::detectAutoRenewalDeadline` (raised on view) and `ContractRiskService` (+20 risk at ≤30 days) overlap conceptually but are untouched. This feature is the push channel.
- **Possible follow-up (not in scope):** `contract.escalation:expiry` still fires daily for live contracts past their end date.
