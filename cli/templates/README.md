# Gyo Project Templates

This directory contains templates for creating new Gyo projects with `gyo create` command.

## Template Structure

```
templates/
├── android/        # Android native project
├── ios/            # iOS native project (xtool)
├── lib/            # Web application (React)
└── gyo.config.json # Gyo configuration template
```

## Platforms

### Android
- Gradle-based build system
- WebView with JavaScript bridge
- Kotlin source code

### iOS
- xtool-based (works on Linux, macOS, Windows)
- SwiftUI + WKWebView
- Swift Package Manager

### Web (lib)
- React + Vite
- TypeScript
- Hot reload support

## Template Variables

Templates use placeholders that are replaced during `gyo create`:

| Placeholder | Replaced with |
|-------------|---------------|
| `{{PROJECT_NAME}}` | Project name (e.g., "MyApp") |
| `{{PROJECT_NAME_LOWER}}` | Lowercase project name (e.g., "myapp") |
| `{{PACKAGE_NAME}}` | Android/iOS package name (e.g., "com.example.myapp") |

## Files

- `android/` - Android Studio project structure
- `ios/` - xtool project structure
- `lib/` - React web application
- `gyo.config.json` - Configuration template

## Future Enhancements

- [ ] Multiple state management templates (Redux, Zustand)
- [ ] Custom template support (`gyo create --template <path>`)
- [ ] Desktop platform templates (Electron, Tauri)
