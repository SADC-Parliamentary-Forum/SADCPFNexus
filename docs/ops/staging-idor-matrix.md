# Staging IDOR matrix — evidence pack

Manual negative-authorization checks for travel / leave / imprest / procurement / PIF / certificates.  
Automated coverage already includes `RequestBolaAuthorizationTest` and certificate IDOR in `HighFindingsF1F2F3Test`. This pack records **staging evidence** before release.

## How to run

1. Use two **same-tenant Staff** accounts (Owner / Peer) and one **cross-tenant** staff account.
2. Create one draft/submitted record as Owner for each resource type.
3. As Peer (and Cross-tenant), attempt show / update / delete / certificate / attachment download.
4. Expected: **403** (same tenant peer without policy) or **404** (cross-tenant / missing). Never **200** with foreign data.

Record results in the table (Date, Tester, Environment SHA, Pass/Fail + HTTP status).

| # | Resource | Action | Actor | Expected | Result | Notes |
|---|----------|--------|-------|----------|--------|-------|
| 1 | Travel request | GET show | Peer | 403 | | |
| 2 | Travel request | PUT update | Peer | 403 | | |
| 3 | Travel request | DELETE | Peer | 403 | | |
| 4 | Travel certificate | GET | Peer | 403 | | |
| 5 | Travel attachment download | GET | Peer | 403 | | |
| 6 | Leave request | GET show | Peer | 403 | | |
| 7 | Leave certificate | GET | Peer | 403 | | |
| 8 | Imprest request | GET show | Peer | 403 | | |
| 9 | Imprest certificate | GET | Peer | 403 | | |
| 10 | Procurement request | GET show | Peer | 403 | | |
| 11 | Procurement certificate | GET | Peer | 403 | | |
| 12 | Salary advance | GET show | Peer | 403 | | |
| 13 | Salary advance certificate | GET | Peer | 403 | | |
| 14 | PIF / programme | GET show | Peer (no programme role) | 403/404 | | |
| 15 | Any of above | GET show | Cross-tenant | 404 | | |

## Automated re-check (CI / local)

```bash
cd api
php artisan test --filter=RequestBolaAuthorizationTest
php artisan test --filter=HighFindingsF1F2F3Test
php artisan test --filter=UploadContentSniffingTest
```

Automated PHPUnit coverage is **not** staging evidence. Leave the result columns above blank until a human runs the matrix on staging.

## Automated mapping (CI / local PHPUnit)

These tests cover the same classes of check. Record the SHA and date when they last passed; do **not** copy Pass into the staging table above.

| Matrix # | Automated test | File |
|----------|----------------|------|
| 1–3, 15 | `test_peer_cannot_view_another_users_travel_request` / `test_guest_cannot_view_travel_request` | `RequestBolaAuthorizationTest` |
| 6 | `test_peer_cannot_view_another_users_leave_request` | `RequestBolaAuthorizationTest` |
| 8 | `test_peer_cannot_view_another_users_imprest_request` | `RequestBolaAuthorizationTest` |
| 10 | `test_peer_cannot_view_another_users_procurement_request` | `RequestBolaAuthorizationTest` |
| 4, 7, 9, 11, 13 | `test_peer_cannot_read_another_users_leave_certificate` / `test_peer_cannot_read_salary_advance_travel_imprest_procurement_certificates` | `HighFindingsF1F2F3Test` |

Last automated run (optional): Date ______ SHA ______ Result ______

## Sign-off

- Environment: __________________
- Git SHA: __________________
- Tester: __________________
- Date: __________________
- Verdict: PASS / FAIL
