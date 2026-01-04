// Top-level build file for gyo-plugins-android
plugins {
    id("com.android.library") version "8.3.2" apply false
    id("org.jetbrains.kotlin.android") version "1.9.22" apply false
}

allprojects {
    group = "gyo.plugins"
    version = "0.1.0"
}

tasks.register("clean", Delete::class) {
    delete(rootProject.layout.buildDirectory)
}
