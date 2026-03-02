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

    // For production release, add a signing config and use it in buildTypes.release:
    // signingConfigs {
    //     create("release") {
    //         storeFile = file(project.findProperty("SADC_KEYSTORE_PATH") ?: System.getenv("SADC_KEYSTORE_PATH") ?: "../upload-keystore.jks")
    //         storePassword = project.findProperty("SADC_KEYSTORE_PASSWORD") ?: System.getenv("SADC_KEYSTORE_PASSWORD") ?: ""
    //         keyAlias = project.findProperty("SADC_KEY_ALIAS") ?: System.getenv("SADC_KEY_ALIAS") ?: "upload"
    //         keyPassword = project.findProperty("SADC_KEY_PASSWORD") ?: System.getenv("SADC_KEY_PASSWORD") ?: ""
    //     }
    // }
    // buildTypes { release { signingConfig = signingConfigs.getByName("release") } }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("debug")
        }
    }
}

flutter {
    source = "../.."
}
