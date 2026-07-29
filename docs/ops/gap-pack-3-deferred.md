# Gap Pack 3 — deferred

- **Leave workflow variants (Finance-first / Director-principal):** not implemented — older leave plans do not specify selectable workflow modes like salary advance; leave remains recommend → HR certify → SG. Salary-advance Finance-first + Director principal already landed in prior packs.
- **Google Calendar two-way sync:** ICS import/export + webhook-ready `GOOGLE_CALENDAR_*` stubs only; full OAuth two-way deferred until credentials are provisioned (pattern already in `config/services.php`).
- **Store submission:** CI builds Android APK/AAB artifacts only; iOS job gated by `IOS_BUILD_ENABLED`; no Play/App Store submission.