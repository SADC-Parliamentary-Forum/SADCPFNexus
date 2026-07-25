# Android release build and signing

Release signing is configured in [android/app/build.gradle.kts](android/app/build.gradle.kts).

## Operator-provided keystore (required for store builds)

**Production signing material is operator-owned.** This repository does **not** contain:

- upload/release keystores (`.jks` / `.keystore`)
- keystore passwords, key aliases, or key passwords
- Play App Signing or App Store certificates
- sample or placeholder secrets meant to look like real credentials

Operators generate and store the keystore in their own secret store (CI secrets, vault, HSM, etc.) and inject values at build time. Do not commit keystores, `gradle.properties` with passwords, or any fake “example” secret values that could be mistaken for production credentials.

## 1. Create a keystore (operator, one-time)

Run locally on a secure machine (not committed):

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

Store the `.jks` **outside** the repo and record passwords/alias only in the operator secret store.

## 2. Configure the build (inject at build time)

Set via environment variables or a **local-only** `android/gradle.properties` that is gitignored:

| Variable / property       | Description                          |
|---------------------------|--------------------------------------|
| `SADC_KEYSTORE_PATH`      | Path to the operator `.jks` file     |
| `SADC_KEYSTORE_PASSWORD`  | Keystore password (from secrets)     |
| `SADC_KEY_ALIAS`           | Key alias (e.g. `upload`)            |
| `SADC_KEY_PASSWORD`       | Key password (from secrets)          |

**Example (env — replace with values from your secret store):**

```bash
export SADC_KEYSTORE_PATH=/secure/path/upload-keystore.jks
export SADC_KEYSTORE_PASSWORD= # from operator secret store
export SADC_KEY_ALIAS=upload
export SADC_KEY_PASSWORD= # from operator secret store
```

The build script reads `project.findProperty("...")` first, then `System.getenv("...")`.

## 3. Build release artifacts

From the `mobile/` directory:

```bash
# AAB (recommended for Play Store)
flutter build appbundle

# APK (for direct distribution or testing)
flutter build apk
```

Outputs:

- AAB: `build/app/outputs/bundle/release/app-release.aab`
- APK: `build/app/outputs/flutter-apk/app-release.apk`

If the keystore env vars are **not** set, the release build falls back to the **debug** signing config so local/CI smoke builds still work. **Do not** ship debug-signed binaries to Play Store or production users.

## Store release

Play Store / App Store signing remains operator-owned. CI may produce unsigned or debug-signed artifacts until operators inject `SADC_KEYSTORE_*` (and iOS signing equivalents) via a secure secret store.
