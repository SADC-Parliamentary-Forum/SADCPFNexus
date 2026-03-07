plugins {
    id("com.android.application")
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

    // Production release: set SADC_KEYSTORE_PATH, SADC_KEYSTORE_PASSWORD, SADC_KEY_ALIAS, SADC_KEY_PASSWORD
    // (env or gradle.properties). If not set, release uses debug signing for local builds.
    signingConfigs {
        create("release") {
            val path = project.findProperty("SADC_KEYSTORE_PATH")?.toString() ?: System.getenv("SADC_KEYSTORE_PATH") ?: "../upload-keystore.jks"
            storeFile = file(path)
            storePassword = project.findProperty("SADC_KEYSTORE_PASSWORD")?.toString() ?: System.getenv("SADC_KEYSTORE_PASSWORD") ?: ""
            keyAlias = project.findProperty("SADC_KEY_ALIAS")?.toString() ?: System.getenv("SADC_KEY_ALIAS") ?: "upload"
            keyPassword = project.findProperty("SADC_KEY_PASSWORD")?.toString() ?: System.getenv("SADC_KEY_PASSWORD") ?: ""
        }
    }

    buildTypes {
        release {
            val releaseConfig = signingConfigs.getByName("release")
            signingConfig = if (releaseConfig.storeFile?.exists() == true) releaseConfig else signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
