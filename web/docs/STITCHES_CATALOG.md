# List of Stitches — Design System Catalog

Catalog of design tokens and UI components (Stitches-style) for SADC PF Nexus. Use as a reference for the design system; current styling is implemented with Tailwind in `tailwind.config.ts` and component classes in `app/globals.css`.

---

## 1. Design tokens (theme / CSS variables)

### Colors

| Category   | Token keys                         | Tailwind class examples        |
|-----------|-------------------------------------|--------------------------------|
| Primary   | `primary`, `primary50`–`primary950`| `bg-primary`, `text-primary`, `border-primary`, `primary-500`, `primary/10` |
| Background| `backgroundLight`, `backgroundDark`| `bg-background-light`, `bg-background-dark` |
| Surface   | `surface`, `surfaceMuted`, `surfaceDark` | `bg-surface`, `bg-surface-muted`, `bg-white` |
| Sidebar   | `sidebar`, `sidebarForeground`, `sidebarBorder`, `sidebarAccent` | `bg-sidebar`, `text-sidebar-foreground`, `border-sidebar-border` |
| Neutral   | `neutral50`–`neutral900`           | `text-neutral-900`, `bg-neutral-50`, `border-neutral-200` |
| Semantic  | `success`, `warning`, `danger`, `info` | `bg-green-100 text-green-700`, `bg-amber-100 text-amber-700`, `bg-red-100 text-red-700` |

### Typography

| Token       | Tailwind usage                    |
|------------|------------------------------------|
| `fontSans` | `font-sans` (Public Sans via `theme.extend.fontFamily`); body uses `font-sans antialiased` |
| Sizes      | `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`, `text-2xl` |
| Weights    | `font-medium`, `font-semibold`, `font-bold` |

### Space

| Token   | Tailwind examples                |
|--------|-----------------------------------|
| Padding/margins | `p-3`, `px-5`, `py-2.5`, `gap-2`, `gap-3`, `mt-0.5` |

### Radii

| Token       | Tailwind      |
|-------------|---------------|
| `radiusSm`  | `rounded-sm`  |
| `radiusMd`  | `rounded`, `rounded-lg` |
| `radiusLg`  | `rounded-lg`, `rounded-xl` |
| `radiusFull`| `rounded-full` |

### Shadows

| Token           | Tailwind / config   |
|-----------------|---------------------|
| `shadowCard`   | `shadow-card` (in theme) |
| `shadowElevated` | `shadow-elevated`   |
| `shadowSidebar` | `shadow-sidebar`    |

---

## 2. Component stitches (UI components / variants)

Each component lists the **Tailwind-based class names** used in this project (from `app/globals.css` or inline). Use these as the reference implementation for the catalog.

### 1. Button

- **Variants:** primary, secondary; sizes: default (sm/md via padding).
- **Tailwind classes:**
  - Primary: `btn-primary` → `inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-colors disabled:opacity-50`
  - Secondary: `btn-secondary` → `inline-flex items-center gap-2 rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors`

### 2. Input

- **Variants:** default; focus ring, optional error state.
- **Tailwind classes:** `form-input` → `w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder-neutral-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition`

### 3. Card

- **Variants:** default (elevated with border).
- **Tailwind classes:**
  - Container: `card` → `rounded-xl bg-white border border-neutral-200 shadow-card`
  - Header: `card-header` → `flex items-center justify-between px-5 py-4 border-b border-neutral-100`

### 4. Badge

- **Variants:** primary, success, warning, danger, muted.
- **Tailwind classes:**
  - Base: `badge` → `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`
  - `badge-primary`, `badge-success`, `badge-warning`, `badge-danger`, `badge-muted` (semantic bg/text pairs)

### 5. Sidebar

- **Parts:** nav container, nav item, active state, section label, divider.
- **Tailwind classes:**
  - Nav item: `nav-item` → `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 transition-colors`
  - Active: `nav-item active` → `bg-primary text-white shadow-sm`
  - Scrollable nav: `sidebar-nav` (scrollbar hidden via globals.css)

### 6. Header

- **Parts:** app bar, search bar, actions, user menu. Implemented in `components/layout/Header.tsx` with Tailwind (e.g. search container, icon buttons, avatar).

### 7. Table

- **Variants:** default (with header and row hover).
- **Tailwind classes:** `data-table` → table with `thead` (border-b, bg-neutral-50), `th` (px-5 py-3, text-xs font-semibold uppercase), `tbody` (divide-y), `td` (px-5 py-4), row hover `hover:bg-neutral-50/50`

### 8. Modal / Dialog

- Overlay and panel; implement with fixed positioning and Tailwind (e.g. `fixed inset-0`, `bg-black/50`, `rounded-xl` panel).

### 9. Dropdown / Menu

- Trigger, list, item, separator; implement with Tailwind and state (e.g. `relative`, `absolute right-0 mt-1`, list with borders and hover).

### 10. Form field

- **Parts:** label, hint, error, wrapper. Use `form-input` for the input; add `text-sm font-medium text-neutral-700` for label, `text-xs text-neutral-500` for hint, `text-red-600` for error.

### 11. Avatar

- Circle or rounded; use `rounded-full` with fixed size (e.g. `w-10 h-10`) and `object-cover` for images or centre initials with `text-*` and `font-semibold`.

### 12. Icon

- **Implementation:** Material Symbols Outlined via `.material-symbols-outlined` in globals.css (font-family, font-variation-settings). Use `material-symbols-outlined` class with `text-[20px]` or `text-[24px]` for size and `text-primary` / `text-neutral-500` for color.

### Page and filter helpers

- **Page title:** `page-title` → `text-2xl font-bold text-neutral-900`
- **Page subtitle:** `page-subtitle` → `text-sm text-neutral-500 mt-0.5`
- **Filter tab:** `filter-tab` → `rounded-full px-4 py-1.5 text-xs font-semibold border transition-colors bg-white text-neutral-600 border-neutral-200 hover:border-primary hover:text-primary`
- **Filter tab active:** `filter-tab active` → `bg-primary text-white border-primary`

---

## 3. Mapping to current stack

- **Tokens:** Defined in `tailwind.config.ts` (colors, fontFamily, borderRadius, boxShadow). CSS variables in `app/globals.css` (`:root`: `--primary`, `--surface`, `--sidebar-width`).
- **Components:** Implemented via Tailwind utility classes and component classes in `app/globals.css` (`@layer components`). Ensure new components align with this catalog.
- **Stitches adoption (optional):** If you add `@stitches/react`, define the tokens above as theme and implement these components as `styled()` with variants.
