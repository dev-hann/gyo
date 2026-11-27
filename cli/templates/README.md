# Project Templates

Templates for `gyo create` project scaffolding. Native shells only — the web application in `lib/` is built by the user (any framework).

## Structure

```
templates/
├── android/        # Gradle-based Android WebView shell: the app module and the gyo-bridge module
├── ios/            # xtool-based iOS WebView shell
└── gyo.config.json # Configuration skeleton
```

## Template Variables

| Placeholder | Replaced with |
|-------------|---------------|
| `{{PROJECT_NAME}}` | Project name (e.g. "MyApp") |
| `{{PROJECT_NAME_LOWER}}` | Lowercase project name (e.g. "myapp") |
| `{{PACKAGE_NAME}}` | Package name (e.g. "com.example.myapp") |

## Platform Details

| Platform | Build System | Language | Details |
|----------|-------------|----------|---------|
| Android | Gradle | Kotlin | [android/README.md](./android/README.md) |
| iOS | xtool | Swift | [ios/README.md](./ios/README.md) |

## Security

The Android and iOS templates restrict the native bridge to the origin of `serverUrl`. On Android a WebView message listener does that per frame, so a third-party iframe never gets the bridge; an older WebView falls back to checking the main frame. Navigation to another origin is cancelled and opened outside the WebView. Changes to this behavior require updating `docs/BRIDGE_INTEGRATION.md`.
