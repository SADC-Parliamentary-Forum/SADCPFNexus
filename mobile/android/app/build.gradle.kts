import java.util.Properties

plugins {
    id("com.android.application")
    // START: FlutterFire Configuration
    id("com.google.gms.google-services")
    // END: FlutterFire Configuration
    id("kotlin-android")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

android {
    namespace = "org.sadcpf.sadcpf_nexus"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }

    kotlinOptions {
        jvmTarget = JavaVersion.VERSION_11.toString()
    }

    defaultConfig {
        applicationId = "org.sadcpf.sadcpf_nexus"
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    // Production release signing. Values are read, in order of precedence, from gradle properties,
    // environment variables (SADC_KEYSTORE_PATH, SADC_KEYSTORE_PASSWORD, SADC_KEY_ALIAS, SADC_KEY_PASSWORD),
    // then android/key.properties (storeFile, storePassword, keyAlias, keyPassword — written by CI).
    // A release build fails if no keystore is found, so a debug-signed artifact can never ship.
    // For a local test-only release build, pass -PSADC_ALLOW_DEBUG_SIGNED_RELEASE=true.
    val keyProperties = Properties().apply {
        val f = rootProject.file("key.properties")
        if (f.exists()) f.inputStream().use { load(it) }
    }
    fun signingValue(name: String, keyPropName: String): String? =
        project.findProperty(name)?.toString() ?: System.getenv(name) ?: keyProperties.getProperty(keyPropName)

    signingConfigs {
        create("release") {
            storeFile = file(signingValue("SADC_KEYSTORE_PATH", "storeFile") ?: "../upload-keystore.jks")
            storePassword = signingValue("SADC_KEYSTORE_PASSWORD", "storePassword") ?: ""
            keyAlias = signingValue("SADC_KEY_ALIAS", "keyAlias") ?: "upload"
            keyPassword = signingValue("SADC_KEY_PASSWORD", "keyPassword") ?: ""
        }
    }

    buildTypes {
        release {
            val releaseConfig = signingConfigs.getByName("release")
            val hasKeystore = releaseConfig.storeFile?.exists() == true
            val allowDebugSigned = (project.findProperty("SADC_ALLOW_DEBUG_SIGNED_RELEASE")?.toString()
                ?: System.getenv("SADC_ALLOW_DEBUG_SIGNED_RELEASE")) == "true"
            val buildingRelease = gradle.startParameter.taskNames.any { it.contains("Release") }

            if (!hasKeystore && buildingRelease && !allowDebugSigned) {
                throw GradleException(
                    "Release keystore not found at ${releaseConfig.storeFile}. Set SADC_KEYSTORE_PATH " +
                        "(or android/key.properties), or pass -PSADC_ALLOW_DEBUG_SIGNED_RELEASE=true for a local test build."
                )
            }
            signingConfig = if (hasKeystore) releaseConfig else signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
