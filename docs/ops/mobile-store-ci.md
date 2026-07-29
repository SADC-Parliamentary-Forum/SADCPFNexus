# Mobile store CI

## What CI builds
- **Android:** debug APK and debug AAB on `main` / PRs when `mobile/**` changes (`.github/workflows/mobile.yml`).
- Artifacts are uploaded for download; **CI does not submit to Google Play or the App Store**.

## iOS
- The `build-ios` job is **off by default**.
- Enable only when a macOS runner is available by setting repository variable `IOS_BUILD_ENABLED=true`.
- Builds use `--no-codesign` (unsigned). Signing and store submission remain a manual release process.

## Operator notes
- Release/signing keys and store credentials must be provisioned outside this workflow.
- Prefer internal distribution of CI APK/AAB for QA until a signed release pipeline is approved.
