// An Android library module. gyo run, gyo build and gyo install include it in
// the app's Gradle build from wherever node_modules keeps this package.
plugins {
    id("com.android.library")
}

android {
    namespace = "gyo.plugins.screen_action"
    compileSdk = 36

    defaultConfig {
        minSdk = 24
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    sourceSets {
        getByName("main") {
            java.directories.add("src/main/kotlin")
        }
    }
}

dependencies {
    // The app brings the bridge module; this one only needs BridgeHandler to compile.
    compileOnly(project(":gyo-bridge"))
    implementation(project(":gyo-plugin-accessibility"))
}
