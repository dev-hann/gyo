# {{PROJECT_NAME}} - iOS

iOS project for {{PROJECT_NAME}} gyo app.

## Requirements

- [xtool](https://xtool.sh): `curl -fsSL https://xtool.sh | sh`
- iOS 13.0+

## Project Structure

A Swift package that xtool builds and installs on a connected device.

## Development

```bash
# Using gyo CLI (recommended)
gyo run

# Or use xtool directly, once gyo has written Sources/Resources/gyo-config.json
xtool dev
```

## URL Configuration

The app loads content from the URL specified in `Sources/Resources/gyo-config.json`:

```json
{
  "serverUrl": "http://192.168.0.7:3000"
}
```

This file is written by `gyo run` and `gyo build ios`. It is ignored by git; without it the app does not start.

## Files

| File | Purpose |
|------|---------|
| `Package.swift` | Swift package manifest |
| `xtool.yml` | xtool configuration: the bundle ID |
| `Sources/AppDelegate.swift` | App entry point |
| `Sources/WebViewContainer.swift` | WebView with the gyo runtime; the origin-restricted entry of the bridge |
| `Sources/Config.swift` | Configuration loader |
| `Sources/GyoBridge/` | The native half of the bridge |
| `Sources/Resources/` | `gyo-config.json`, the launch screen |
