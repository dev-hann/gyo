# Plugins

## Packages

| Package | Version | Description |
|---------|---------|-------------|
| [@gyo-framework/bridge](./bridge/README.md) | 0.2.0 | Web-native communication core (built-in) |
| [@gyo-framework/test-utils](./test-utils/README.md) | 0.2.0 | A stand-in for the native side of the bridge, for the tests of an app (devDependency) |
| [@gyo-framework/app-launcher](./app-launcher/README.md) | 0.1.2 | App launching and URL opening via PackageManager |
| [@gyo-framework/device-info](./device-info/README.md) | 0.1.2 | Device metadata (Android) |
| [@gyo-framework/contact-search](./contact-search/README.md) | 0.1.2 | Contacts search (Android) |
| [@gyo-framework/notification-reader](./notification-reader/README.md) | 0.1.4 | Notification reading (Android) |
| [@gyo-framework/sms-sender](./sms-sender/README.md) | 0.1.3 | SMS send and read (Android) |
| [@gyo-framework/phone-caller](./phone-caller/README.md) | 0.1.3 | Calls and call log (Android) |
| [@gyo-framework/screen-reader](./screen-reader/README.md) | 0.1.5 | Screen UI tree reading (Android) |
| [@gyo-framework/screen-action](./screen-action/README.md) | 0.1.5 | UI automation: tap/type/swipe (Android) |
| [@gyo-framework/screen-find](./screen-find/README.md) | 0.1.5 | Screen element location (Android) |
| [@gyo-framework/accessibility](./accessibility/README.md) | 0.1.3 | The accessibility service the screen plugins read and act through (Android) |
| [@gyo-framework/notification-listener](./notification-listener/README.md) | 0.1.3 | The notification listener service, and the active notifications (Android) |
| [@gyo-framework/http](./http/README.md) | 0.1.0 | GET requests that run outside the WebView (Android) |
| [@gyo-framework/http](./http/README.md) | 0.1.0 | HTTP requests outside the WebView, with the caller's headers (Android) |

## Naming Convention

| Scope | Usage |
|-------|-------|
| `@gyo-framework/` | Official plugins |
| `@gyo-community/` | Community plugins |

## Plugin API Specs

> See [docs/PLUGINS.md](../docs/PLUGINS.md) for type signatures, permissions, and plugin development conventions.
