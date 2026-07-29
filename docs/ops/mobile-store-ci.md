# Mobile store CI

## What CI builds by default
- **Android:** debug APK and debug AAB on `main` / PRs when `mobile/**` changes (`.github/workflows/mobile.yml`).
- Artifacts are uploaded for download; **PR builds do not submit** to Google Play or the App Store.

## Optional store submission (gated)
Submission jobs run only when **repository variables** and **secrets** are present:

| Gate | Purpose |
|------|---------|
| `vars.PLAY_SUBMIT_ENABLED=true` | Allow Android Play upload job |
| `vars.APPSTORE_SUBMIT_ENABLED=true` | Allow iOS TestFlight upload job |
| `vars.IOS_BUILD_ENABLED=true` | Enable macOS iOS build job |
| `workflow_dispatch` inputs | Manual submit without waiting for a mobile path push |

### Android / Play secrets (never commit)
- `PLAY_STORE_JSON` — Google Play service-account JSON
- `PLAY_PACKAGE_NAME` — application package name
- `ANDROID_KEYSTORE_BASE64` — base64-encoded upload keystore
- `SADC_KEYSTORE_PASSWORD`, `SADC_KEY_ALIAS`, `SADC_KEY_PASSWORD`

When secrets are missing, the `submit-play` job is skipped (conditional `if`).

### iOS / App Store Connect secrets
- `APP_STORE_CONNECT_API_KEY_ID`
- `APP_STORE_CONNECT_API_ISSUER_ID`
- `APP_STORE_CONNECT_API_KEY_P8` — contents of the `.p8` key
- `IOS_BUNDLE_ID`

If IPA/signing is incomplete, the upload step **conditionally skips** (exit 0) rather than inventing credentials.

## Operator notes
- Release/signing keys and store credentials must be provisioned in GitHub Secrets only.
- Prefer internal QA distribution of CI APK/AAB until gated submit vars are enabled.
- See also `mobile/RELEASE.md` for local signing env var names.
