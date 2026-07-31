# Access Control — Cutover Checklist (Phase 7–8)

Operator-facing checklist. **No automatic revoke of production System Admin.** Obsolete broad roles are dry-run by default.

## Dual-run steps

1. **Freeze legacy role edits** while published `access_role_versions` are authoritative.
2. **Migrate users** onto published versions (`POST /api/v1/admin/access/users/{id}/role-versions/{version}`).
3. **Validate assignments** via `GET /api/v1/admin/access/cutover` (`validated_assignments`, `users_without_versioned_assignment`).
4. **Session refresh:** role revoke / review-revoke / grant-deny invalidates Sanctum tokens + `user_sessions` via `AccessCacheInvalidator`.
5. **Retire obsolete broad roles** only after dual-run period:
   - Inspect `obsolete_broad_role_holders` from cutover status.
   - Dry-run: `POST /api/v1/admin/access/cutover/revoke-obsolete` with `{ "user_ids": [...], "execute": false }`.
   - Execute only with change-control approval: `"execute": true`.
6. **Pilot personas:** seed + sign off using `docs/access-control/pilot-signoff-pack.md`.
7. **Governance:** leave Pending topics Pending until real institutional decisions (`/admin/access/governance`).

## Safe revoke rules

- Never invent a Super-Admin bypass.
- Never auto-revoke `System Admin`.
- Prefer dry-run first; capture audit evidence.
- After revoke, confirm target must re-authenticate.

## Seeder note

`RolesAndPermissionsSeeder` re-merges published role template permissions after legacy `syncPermissions` so curated catalogue merges are not clobbered on re-seed.
