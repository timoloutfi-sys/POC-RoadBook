plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.mirasmile.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.mirasmile.app"
        minSdk = 30
        targetSdk = 35
        versionCode = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()
        versionName = "1.0." + (System.getenv("GITHUB_RUN_NUMBER") ?: "0")
    }

    // Clé de l'appli (installation directe, hors Play Store) : fixe pour que
    // chaque nouvelle version s'installe par-dessus la précédente.
    signingConfigs {
        create("mirasmile") {
            storeFile = file("mirasmile.keystore")
            storePassword = "mirasmile"
            keyAlias = "mirasmile"
            keyPassword = "mirasmile"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("mirasmile")
        }
        debug {
            signingConfig = signingConfigs.getByName("mirasmile")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = true
    }
}

dependencies {
    val camerax = "1.4.1"
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.activity:activity-ktx:1.9.3")
    implementation("androidx.camera:camera-core:$camerax")
    implementation("androidx.camera:camera-camera2:$camerax")
    implementation("androidx.camera:camera-lifecycle:$camerax")
    implementation("androidx.camera:camera-view:$camerax")
    // Détection du visage et du sourire, modèle embarqué (marche hors ligne).
    implementation("com.google.mlkit:face-detection:16.1.7")

    testImplementation("junit:junit:4.13.2")
}
