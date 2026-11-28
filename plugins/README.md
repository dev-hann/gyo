# Plugins

The community plugins of Gyo: every add-on feature, published under `@gyo-community`.

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@gyo-community/accessibility](./accessibility/README.md) | 0.2.0 | The accessibility service, and reading, finding and acting on the screen (Android) |
| [@gyo-community/app-launcher](./app-launcher/README.md) | 0.1.2 | App launching and URL opening via PackageManager (Android) |
| [@gyo-community/communication](./communication/README.md) | 0.2.0 | Contacts search, SMS send and read, calls and call log (Android) |
| [@gyo-community/device-info](./device-info/README.md) | 0.1.2 | Device metadata (Android) |
| [@gyo-community/http](./http/README.md) | 0.1.0 | GET requests that run outside the WebView, with the caller's headers (Android) |
| [@gyo-community/media](./media/README.md) | 0.1.0 | Saving images and videos to the device, and sharing media and text with other apps (Android) |
| [@gyo-community/notifications](./notifications/README.md) | 0.2.0 | The notification listener service, and the active notifications (Android) |

## Naming Convention

| Scope | Usage |
|-------|-------|
| `@gyo-framework/` | The core, what the shell cannot run without: `cli`, `bridge` |
| `@gyo-community/` | Community plugins: every add-on feature |

## Plugin API Specs

> See [docs/PLUGINS.md](../docs/PLUGINS.md) for exports, native handlers, permissions and plugin development conventions.
