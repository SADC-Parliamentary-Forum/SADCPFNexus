---
name: sadcpf-accessibility-i18n-review
description: Review SADC PF web, admin, and mobile UI for accessibility, multilingual EN/FR/PT support, no hardcoded strings, language switching, readable content, keyboard navigation, screen reader support, contrast, and low cognitive load.
allowed-tools: Read Grep Glob Bash(rg *) Bash(npm run lint) Bash(npm run typecheck) Bash(npm test *) Bash(flutter analyze) Bash(flutter test *)
---

# SADC PF Accessibility and i18n Review

Use this for all UI, content, form, workflow, notification, and document-facing changes.

## Accessibility principle

The platform must be usable by Members of Parliament, Secretariat staff, Parliament staff, and stakeholders with different levels of technical skill, language preference, accessibility needs, devices, and network conditions.

## Mandatory accessibility checks

### General UI
Check:
- Clear labels.
- Low cognitive load.
- Consistent placement.
- No hidden essential actions.
- Important meeting-day actions are prominent.
- Destructive actions require confirmation.
- Errors are human-readable.
- Loading, empty, offline, and failed states exist.
- Font scaling does not break layout.
- Touch targets are large enough on mobile.

### Screen reader
Check:
- Buttons have accessible names.
- Icons have labels or are marked decorative.
- Form fields have labels.
- Errors are announced.
- Dynamic updates are announced where required.
- Speaker queue and voting state changes are accessible.

### Keyboard navigation for web/admin
Check:
- All controls reachable by keyboard.
- Focus order is logical.
- Focus indicator visible.
- Modals trap and restore focus.
- Dropdowns and menus are keyboard-operable.
- No keyboard traps.

### Contrast and readability
Check:
- Text contrast is acceptable.
- Status colors are not the only signal.
- Documents and cards remain readable in low light and older devices.
- Tables are responsive and readable.

## Mandatory i18n checks

The app must support English, French, and Portuguese.

Check:
- No user-facing hardcoded strings.
- All labels, errors, buttons, empty states, notifications, and statuses use translation keys.
- Language switch works without logout.
- Date, time, number, and country formats are localized where required.
- Long French/Portuguese text does not break layout.
- Fallback language is explicit.
- Missing translations fail visibly in development/test.
- Search handles multilingual titles and metadata.
- Notification templates are language-aware.
- Meeting packs and documents can carry language metadata.

## Hardcoded string search guidance

Search for suspicious UI strings in:
- React/Next components.
- Flutter widgets.
- Admin forms.
- Validation messages.
- Toasts/alerts.
- Email/WhatsApp/push templates.
- API error responses.
- Test snapshots.

Prefer project-specific i18n tooling if available.

## Output format

### Accessibility and i18n Verdict
PASS, PASS WITH CONDITIONS, or BLOCKED.

### Critical User Experience Risks

### Accessibility Defects

### i18n Defects

### Hardcoded String Risks

### Missing States
List missing loading, empty, error, offline, unauthorized, stale, and success states.

### Tests to Add
Include accessibility tests, language-switch tests, snapshot/text-key tests, and mobile font-scale tests.

### Uncomfortable Truth
State where the app will confuse or exclude users most.
