# {{PROJECT_NAME}} - Android

Android project for {{PROJECT_NAME}} gyo app.

## Requirements

- Android SDK with the platform named by `compileSdk` in `app/build.gradle`
- JDK 17+
- Gradle (wrapper included)

## Project Structure

| Module | Content |
|--------|---------|
| `app/` | The app: `MainActivity.kt`, the manifest, the resources |
| `gyo-bridge/` | The native half of the bridge; plugins compile against it |

## Development

```bash
# Using gyo CLI (recommended)
gyo run

# Or use Gradle directly, once gyo has written app/src/main/assets/gyo-config.json
./gradlew assembleDebug
adb install app/build/outputs/apk/debug/app-debug.apk
adb shell am start -n <package>/.MainActivity
```

## URL Configuration

The app loads content from the URL specified in `app/src/main/assets/gyo-config.json`:

```json
{
  "serverUrl": "http://192.168.0.7:3000"
}
```

This file is written by `gyo run` and `gyo build android`. It is ignored by git; without it the app does not start.

## Plugins

Every Gyo plugin installed in `lib/` is a Gradle library module. `gyo run`, `gyo build` and `gyo install` include it and register its handler; nothing is edited by hand.

| File | Written by gyo before every build |
|------|-----------------------------------|
| `gyo.settings.gradle` | Includes each plugin module |
| `app/gyo.build.gradle` | Makes the app depend on each one |
| `app/src/main/java/gyo/plugins/bridge/PluginRegistry.kt` | Registers each handler |

Run-time permissions are not written by gyo. Declare them in `app/src/main/AndroidManifest.xml`; `gyo install` lists the ones an installed plugin needs. Ask the user for them from the web layer with `requestPermissions` from `@gyo-framework/bridge`.

## Version, Name and Icon

`gyo build` and `gyo run` keep the Android project in sync with `gyo.config.json`:

| gyo.config.json | Android |
|-----------------|---------|
| `version` | `versionName` in `app/build.gradle` |
| `platforms.android.versionCode` | `versionCode` in `app/build.gradle` |
| `displayName` | `app_name` in `res/values/strings.xml` |
| `platforms.android.icon` | `res/mipmap-xxxhdpi/ic_launcher.png` and `android:icon` |

## Release Signing

Release builds sign the APK when `keystore.properties` exists next to this README.

| Property | Value |
|----------|-------|
| `storeFile` | Keystore path, relative to `app/` |
| `storePassword` | Keystore password |
| `keyAlias` | Key alias |
| `keyPassword` | Key password |

`gyo build android --release` writes the file from environment variables:

| Variable | Property |
|----------|----------|
| `GYO_ANDROID_KEYSTORE_PATH` | `storeFile` |
| `GYO_ANDROID_KEYSTORE_PASSWORD` | `storePassword` |
| `GYO_ANDROID_KEY_ALIAS` | `keyAlias` |
| `GYO_ANDROID_KEY_PASSWORD` | `keyPassword` |

`keystore.properties`, `*.jks` and `*.keystore` are ignored by git.
