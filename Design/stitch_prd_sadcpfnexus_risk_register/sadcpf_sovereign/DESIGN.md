# Design System Specification: Institutional Integrity & Data-Dense Clarity

## 1. Overview & Creative North Star: "The Sovereign Ledger"
The Creative North Star for this design system is **"The Sovereign Ledger."** 

Unlike standard SaaS platforms that feel airy and ephemeral, this system is built to feel heavy, permanent, and authoritative—much like a digital version of an institutional archive or a parliamentary record. We achieve this by rejecting the "floating card" aesthetic of the 2010s in favor of **Tonal Layering** and **Architectural Asymmetry**. 

The goal is to present complex governance data not as a series of disconnected widgets, but as a singular, cohesive environment. We break the "template" look by using exaggerated typographic scales for key metrics and utilizing the "No-Line" rule to create a seamless, high-end editorial feel.

## 2. Color & Surface Architecture
The palette is dominated by `primary` (#001e40) and `surface` (#f7f9fb), creating a high-contrast environment that screams security and stability.

### The "No-Line" Rule
To achieve a premium, institutional feel, **designers are prohibited from using 1px solid borders** to section off content. Physical boundaries must be defined solely through background shifts:
*   Use `surface_container_low` for secondary sidebar regions.
*   Use `surface_container_highest` for active content regions.
*   The transition between these tones creates a "seam" rather than a "fence," making the UI feel like a singular, engineered object.

### Surface Hierarchy & Nesting
Treat the interface as a series of physical layers. 
*   **Base:** `surface` (#f7f9fb)
*   **Sectioning:** `surface_container_low` (#f2f4f6)
*   **Interactive Cards:** `surface_container_lowest` (#ffffff)
*   **Overlays:** Semi-transparent `surface_variant` with a 20px backdrop-blur.

### The "Glass & Gradient" Rule
For high-level KPI cards and Hero sections, use a subtle linear gradient from `primary` (#001e40) to `primary_container` (#003366) at a 135-degree angle. This provides a "visual soul" that flat colors lack, suggesting depth and institutional prestige.

## 3. Typography: The Editorial Scale
We use a dual-font strategy to balance institutional authority with data readability.
*   **Display & Headlines:** *Manrope*. Use this for high-level summaries and section headers. Its geometric structure feels modern yet established.
*   **Data & Body:** *Inter*. This is our workhorse for tables, risk logs, and labels. It is selected for its high x-height and readability in dense environments.

### Typographic Hierarchy
*   **Display-LG (3.5rem):** For primary risk scores or aggregate financial totals.
*   **Headline-SM (1.5rem):** For section titles (e.g., "Regional Governance Audit").
*   **Label-MD (0.75rem):** For metadata and table headers, always in `on_surface_variant` (#43474f).

## 4. Elevation, Depth & The Ghost Border
In a "Sovereign Ledger," shadows are not used for decoration; they are used for functional emphasis.

### Layering Principle
Depth is achieved by stacking. A `surface_container_lowest` (White) card placed on a `surface_container_low` background creates a natural lift without a single shadow.

### Ambient Shadows
For floating elements (modals, dropdowns), use "Ambient Shadows":
*   **Blur:** 24px - 40px
*   **Opacity:** 4% - 6%
*   **Color:** `on_surface` (#191c1e)
*   *Note:* The shadow should feel like a soft glow of darkness, not a hard drop shadow.

### The "Ghost Border" Fallback
If accessibility requires a container edge, use a **Ghost Border**: `outline_variant` (#c3c6d1) at **15% opacity**. This provides a hint of a boundary without cluttering the data-dense environment.

## 5. Components & Primitive Styling

### Buttons: Institutional Weights
*   **Primary:** Solid `primary` (#001e40) with `on_primary` (#ffffff) text. Use `md` (0.375rem) roundedness.
*   **Secondary:** `surface_container_high` background with `on_surface` text. No border.
*   **Tertiary:** Transparent background, `primary` text, underlined only on hover.

### Cards & Lists: The Separation Rule
**Forbid the use of divider lines.** 
*   To separate list items, use a vertical spacing of `spacing.4` (0.9rem) and subtle alternating background shifts (`surface_container_low` vs `surface_container_lowest`).
*   In data tables, use a `1px` shift in background color for the header row to ground the data.

### Input Fields: The "Quiet" State
Inputs should not compete with the data they contain.
*   **Default State:** `surface_container_highest` background, no border, `sm` roundedness.
*   **Focus State:** A Ghost Border (2px) using `primary` at 40% opacity.

### Risk Indicators (Semantic System)
Risk levels are conveyed through "Status Pills" using `tertiary` (Red), `on_tertiary_container` (Orange), and `secondary` (Slate) palettes.
*   **Critical:** `tertiary_container` background with `on_tertiary_fixed` text.
*   **High:** Orange-tinted `surface_variant` with `on_tertiary_container` text.

### Custom Component: The "Audit Trail"
A vertical timeline component using `outline_variant` vertical "threads" (2px) and `primary` nodes. The nodes should use Glassmorphism (blur) to show the content behind them, signifying transparency in the governance process.

## 6. Do’s and Don’ts

### Do:
*   **Do** use asymmetrical layouts (e.g., a wide 8-column data table next to a 4-column summary sidebar) to break the "web template" feel.
*   **Do** use `spacing.16` (3.5rem) or higher for top-level section margins to provide "institutional breathing room."
*   **Do** use the `surface_container` tiers to create a logical "nesting" of information.

### Don’t:
*   **Don’t** use pure black (#000000) for text. Use `on_surface` (#191c1e) to maintain a sophisticated slate-navy tone.
*   **Don’t** use 100% opaque borders. They create "visual noise" that hinders the readability of dense governance data.
*   **Don’t** use rounded corners larger than `lg` (0.5rem). The system must feel "sharp" and disciplined, not "bubbly" or consumer-grade.