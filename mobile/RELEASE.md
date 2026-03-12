# Android release build and signing

Release signing is configured in [android/app/build.gradle.kts](android/app/build.gradle.kts). The release build uses a keystore when the following are set; otherwise it falls back to the debug keystore (for local builds only).

## 1. Create a keystore (one-time)

From a terminal (e.g. in `mobile/` or project root):

```bash
keytool -genkey -v -keystore upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload
```

- Store the keystore file somewhere safe (e.g. `mobile/android/app/upload-keystore.jks` or a secure path **outside** the repo).
- Remember the passwords and alias; you will need them for CI and local release builds.

**Do not commit the keystore or passwords to version control.**

## 2. Configure the build

Set these via environment variables or in `android/gradle.properties` (and add `gradle.properties` to `.gitignore` if it contains secrets):

| Variable / property       | Description                          |
|---------------------------|--------------------------------------|
| `SADC_KEYSTORE_PATH`      | Path to the `.jks` file              |
| `SADC_KEYSTORE_PASSWORD`  | Keystore password                    |
| `SADC_KEY_ALIAS`           | Key alias (e.g. `upload`)            |
| `SADC_KEY_PASSWORD`       | Key password                         |

**Example (env):**

```bash
export SADC_KEYSTORE_PATH=/path/to/upload-keystore.jks
export SADC_KEYSTORE_PASSWORD=your_keystore_password
export SADC_KEY_ALIAS=upload
export SADC_KEY_PASSWORD=your_key_password
```

**Example (gradle.properties):** in `android/gradle.properties`:

```properties
SADC_KEYSTORE_PATH=../upload-keystore.jks
SADC_KEYSTORE_PASSWORD=your_keystore_password
SADC_KEY_ALIAS=upload
SADC_KEY_PASSWORD=your_key_password
```

The build script reads `project.findProperty("...")` first, then `System.getenv("...")`, so either method works.

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

If the keystore is missing or env vars are not set, the release build uses the **debug** signing config so you can still produce a release build locally; do **not** use that for production distribution.
