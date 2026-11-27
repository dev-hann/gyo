// An Android library module. gyo run, gyo build and gyo install include it in
// the app's Gradle build from wherever node_modules keeps this package.
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "gyo.plugins.app_launcher"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    sourceSets {
        getByName("main") {
            java.srcDirs("src/main/kotlin")
        }
    }
}

dependencies {
    // The app brings the bridge module; this one only needs BridgeHandler to compile.
    compileOnly(project(":gyo-bridge"))
}
