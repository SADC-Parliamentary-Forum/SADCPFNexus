# Plan: Travel Auto-TOIL approval

> **For agentic workers:** Prefer `TravelAutoToilApprovalTest` + existing Phase 1 TOIL tests.

## Tasks

1. [x] Audit Phase 1–finish TOIL models/services/jobs/UI
2. [x] Status machine: `pending_supervisor` → `pending_hr` → `credited|rejected|expired|extended`
3. [x] Notify supervisor + HR on generate; HR again on confirm-duty
4. [x] Leave credit only in `hrValidateAndCredit` (`OvertimeAccrual`)
5. [x] SG extend requires reason; expiry = accrual_date + 30d
6. [x] Config: `auto_generate_candidates=true`, `auto_create_leave_from_travel=false`
7. [x] Web `/travel/toil` + mobile queue alignment
8. [x] Nightly generate + expire command
9. [x] Docs under `docs/superpowers/`
10. [x] Commit / push / merge main / deploy `sadcpf-nexus-prod` / verify `/up`

## Tests

- `tests/Feature/Travel/TravelAutoToilApprovalTest.php`
- Existing: `TravelPhase1CoreTest`, `TravelPhase1PolicyTest`, `TravelPhase2Test` reject path
