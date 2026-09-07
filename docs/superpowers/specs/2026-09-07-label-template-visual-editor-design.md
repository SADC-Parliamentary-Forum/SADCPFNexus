# Label template visual editor

**Date:** 2026-09-07  
**Branch:** `cursor/label-template-visual-editor-9293`  
**Route:** `/assets/labels/templates`

## Problem

Template editing is a numeric form with no preview. Operators cannot see how many labels fit on a sheet, nor place QR / tag / name fields.

## Approach

Keep existing page geometry (`page_*`, `label_*`, `rows`, `columns`, gaps, margins) for **N labels per page**. Add a stored `layout` JSON of field positions **inside one label** (mm from the label’s top-left). The print Blade absolutely positions those fields. Empty/null layout falls back to a default that matches the previous stacked layout (org + notice, text left, QR right).

## Layout item

```
{ id, x_mm, y_mm, w_mm, h_mm?, visible? }
```

Allowed `id` values: `org`, `notice`, `tag`, `name`, `model`, `serial`, `location`, `custodian`, `qr`. Unknown keys and ids are dropped. Coordinates are clamped to the label rectangle.

## UI

- Live **page preview** (scaled sheet) showing `rows × columns` cells as size/gaps/margins change.
- Live **label canvas**: drag fields, resize QR, show/hide items, numeric nudge.
- Size presets (Avery 18-up, 8-up, 2-up, thermal) so more than one label per page is obvious.
- Save via existing POST/PUT; `layout` is included.

## Out of scope

- Arbitrary extra user-defined fields
- Changing printed org copy (“SADC Parliamentary Forum” / “Property of SADC PF”)
- A seventh Fixed Assets sidebar item
