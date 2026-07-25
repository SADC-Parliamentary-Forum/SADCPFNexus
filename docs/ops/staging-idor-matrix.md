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

## Sign-off

- Environment: __________________
- Git SHA: __________________
- Tester: __________________
- Date: __________________
- Verdict: PASS / FAIL
