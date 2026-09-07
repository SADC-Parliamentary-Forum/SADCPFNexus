# Fixed Assets — categories, label templates, print

**Date:** 2026-09-07  
**Branch:** `cursor/fixed-assets-labels-categories-9293`

## Problem

Operators cannot reliably classify or tag assets:

1. Category UI exists at `/assets/categories` but `GET/POST /asset-categories` requires `assets.admin|manage`, while add-asset allows `assets.create`. The dropdown stays empty and saves 403.
2. Label templates are seeded only on import commit. `/assets/labels` has an empty template select and print is a silent no-op.
3. Print uses `window.open` after an awaited POST (popup blockers) and treats JSON error blobs as PDFs.
4. There is no API or UI to edit Avery/thermal template geometry.

## Approach (extend existing)

Keep DomPDF + mm geometry. Do not invent a JSON layout DSL. Blade still renders QR + tag/name/serial; template rows store page/label sizes.

## Behaviour

### Categories
- **List:** `assets.view|create|edit|admin|manage|import`
- **Create/update/delete:** same as `canManageAssets` (`admin|manage|create|import` + System Admin)
- Optional `useful_life_years` (1–80). Add-asset prefills from the selected category when empty.
- Code editable when no assets use it; otherwise 422.

### Label templates
- `GET /assets/labels/templates` **ensures** the three defaults (Avery permanent, Avery custody, thermal 70×40) for the tenant.
- `POST/PUT/DELETE /assets/labels/templates/{id}` for `assets.print|admin|manage`.
- Delete deactivates (`is_active=false`) if batches exist; hard-delete only when unused.
- UI: `/assets/labels/templates` editor; Labels page links to it.

### Print
- Validate selection + template with visible errors.
- Open PDF via blob download + object URL (no post-await `window.open`).
- Parse JSON error bodies when `responseType: blob`.

## Out of scope

- Mobile label printing
- Changing the Blade field set (org name stays “SADC Parliamentary Forum”)
- Capitalisation policy / location CRUD (settings remain read-only except links)
