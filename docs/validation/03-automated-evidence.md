# Automated evidence index

Maps repository tests to production-readiness claims. Passing CI is **not** UAT sign-off, restore evidence, or a staging IDOR walkthrough.

| Claim | Evidence | Status in this closeout |
|-------|----------|-------------------------|
| Vendor directory paginates | `api/tests/Feature/Procurement/VendorPaginationTest.php` | Code shipped; run PHPUnit |
| Per-user idle timeout | `api/tests/Feature/Security/IdleTimeoutTest.php` | Code shipped; run PHPUnit |
| Privileged MFA gate | `api/tests/Feature/Security/PrivilegedMfaMiddlewareTest.php` | Production default on via `config/auth.php`; PHPUnit opt-in |
| BOLA / request IDOR | `api/tests/Feature/Security/RequestBolaAuthorizationTest.php` | Automated only |
| High findings F1–F3 | `api/tests/Feature/Security/HighFindingsF1F2F3Test.php` | Automated only |
| Observability no-ops without DSN | `api/tests/Unit/ObservabilityTest.php` | No Sentry DSN in repo |
| Web session timeout UI | `web/lib/ui-ux-remediation.test.mts` | Static |
| Mobile vendor load-more | `mobile/test/ui_ux_pass4_static_test.dart` | Static |

## Commands

```bash
cd api && php artisan test --filter="VendorPaginationTest|IdleTimeoutTest|PrivilegedMfaMiddlewareTest|ObservabilityTest|RequestBolaAuthorizationTest|HighFindingsF1F2F3Test"
cd web && node --experimental-strip-types --test lib/ui-ux-remediation.test.mts
cd mobile && flutter test test/ui_ux_pass4_static_test.dart
```

## Still operator-owned

See `02-conditions-and-exclusions.md`. Nothing in this file signs UAT, pilot, restore, or governance checklists.
