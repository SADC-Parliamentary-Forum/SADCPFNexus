# Access Control — Pilot Sign-off Pack (Phase 7)

**Status:** Ready for operator pilot evidence  
**Automated suite:** `php artisan test --testsuite=Feature --filter=AccessControl`  
**Persona seeder:** `php artisan db:seed --class=AccessControlPersonaSeeder`

## Persona fixtures

Seeded deterministic accounts (`@sadcpf.local`). Default password is documented in the seeder constant only for local/pilot — rotate before any shared environment.

| Persona key | Email | Spatie / template role |
|---|---|---|
| Employee | persona.employee@sadcpf.local | staff |
| Supervisor | persona.supervisor@sadcpf.local | HOD |
| HR | persona.hr@sadcpf.local | HR Manager |
| Finance | persona.finance@sadcpf.local | Finance Controller |
| Programme | persona.programme@sadcpf.local | Programme Officer |
| Procurement feature-only | persona.proc-eval@sadcpf.local | Procurement Evaluation Committee Member |
| SG Office | persona.sg-office@sadcpf.local | Administration Officer |
| ICT Admin | persona.ict@sadcpf.local | ICT Platform Administrator |
| Access Admin | persona.access-admin@sadcpf.local | Security and Access Administrator |
| Internal Auditor | persona.auditor@sadcpf.local | Internal Auditor |

## Sign-off checklist (operator)

1. Run persona matrix Feature tests green (see Test plan below).
2. Log in as each persona (or use Access Simulator — no live impersonation).
3. Confirm navigation: feature-only evaluator sees **My Work**, not Procurement admin.
4. Confirm ICT cannot export salary advances; Access Admin cannot authorise leave.
5. Confirm Employee leave/travel lists are self-scoped; unrelated leave detail returns **404**.
6. Confirm Travel list does not return other staff requests for plain Employee.
7. Capture screenshots / notes under change-control; attach to release evidence.
8. Governance topics on `/admin/access/governance` remain **Pending** until institutional decisions (do not invent MFA/retention/pen-test outcomes).

## Test plan (automated)

```bash
cd api
php artisan test tests/Feature/AccessControl tests/Unit/AccessControl
```

Expected coverage areas:

- Persona effective permissions + navigation (`AccessControlPersonaSmokeTest`)
- Negative access / SoD / feature-only / Travel scoping / Leave safe-404 (`AccessControlNegativeAccessTest`)
- PDP / denial / grant / scope unit tests (`PolicyDecisionPointTest`)

## Related artefacts

- Cutover helper API: `GET /api/v1/admin/access/cutover`
- Cutover dry-run revoke: `POST /api/v1/admin/access/cutover/revoke-obsolete`
- Checklist doc: `docs/access-control/cutover-checklist.md`
- Residuals: `docs/access-control/residuals-and-governance.md`
