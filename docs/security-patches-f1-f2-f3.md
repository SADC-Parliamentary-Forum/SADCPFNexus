# Security patches F1–F3 (2026-07-24)

Patches for the three **High** findings from the full-repo security scan.

| ID | Finding | Fix |
|----|---------|-----|
| **F1** | Privilege escalation: any user could `PUT /admin/users/{self}` and set role/classification | `UserPolicy::update` is System Admin only; controller requires `assignRole` for role/classification; `UserService` strips privileged fields for non-admins |
| **F2** | Certificate IDOR: any user could read any approved leave/travel/imprest/procurement/salary-advance certificate by ID | Shared `AuthorizesCertificates` trait — owner, System Admin, module privileged roles, or prior approval-history actor only |
| **F3** | Salary-advance approval bypass: no `salary_advance` workflow; legacy path allowed any non-staff role | Seeded `salary_advance` workflow; legacy approve/reject requires `finance.approve` / Finance Controller / SG; deploy reseeds `WorkflowSeeder` |

## Tests

`api/tests/Feature/Security/HighFindingsF1F2F3Test.php`

## Deploy note

After pull, run (or use updated `scripts/deploy.sh`):

```bash
php artisan db:seed --class="Database\\Seeders\\WorkflowSeeder" --force
```

VPS deploy may still need `sudo chown -R sadcpf-nexus:sadcpf-nexus api/storage api/bootstrap/cache` if ownership drift blocks `git pull`.
