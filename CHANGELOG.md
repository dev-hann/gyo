# Changelog

## [Unreleased] - v0.2.0

### Added

#### 📷 Camera Plugin (`gyo-camera`) (✅ COMPLETED)
- Take photos using device camera
- Pick images from gallery
- Base64-encoded image output with data URI format
- Quality control (0.0 - 1.0)
- Image dimensions (width/height) in response
- Cross-platform (Android & iOS)
- **Android**: Intent-based camera/gallery access
- **iOS**: UIImagePickerController integration

#### 📍 Geolocation Plugin (`gyo-geolocation`) (✅ COMPLETED)
- Get current device position (one-time)
- Watch position for real-time tracking
- High-accuracy location data
- Cross-platform (Android & iOS)
- **Android**: Google Play Services Fused Location Provider
- **iOS**: CoreLocation framework
- Auto-permission handling
- Position includes: lat, lon, accuracy, altitude, speed, heading
- Error handling with PositionErrorCode enum

#### 🛠️ New CLI Commands
- `gyo upgrade` - Upgrade Gyo CLI to latest version
  - `--check` flag to check for updates
  - `--version` to upgrade to specific version
- `gyo debug <platform>` - Launch debugger
  - Opens Chrome DevTools for Android
  - Shows Safari Web Inspector instructions for iOS

### Improved

#### 🔌 Plugin System
- **Unified plugin naming**: `gyo-` prefix now supported (recommended)
- Legacy support for `@gyo/` and `@gyo-community/` scopes
- Better plugin detection and validation

#### 🌉 Bridge System
- **Configurable timeout** for bridge method calls
  - Constructor option: `new Bridge('name', { timeout: 5000 })`
  - Default: 30000ms (30 seconds)
- **BridgeRegistry** for Android and iOS
  - Centralized bridge management
  - Runtime bridge registration
  - Better error handling

### Infrastructure
- Type definitions updated for better IDE support
- Build system optimized
- Plugin directory structure standardized

### Implementation Status

| Feature | Status | Progress |
|---------|--------|----------|
| Camera Plugin | ✅ Complete | 100% |
| Geolocation Plugin | ✅ Complete | 100% |
| BridgeRegistry | ✅ Complete | 100% |
| gyo upgrade | ✅ Complete | 100% |
| gyo debug | ✅ Complete | 100% |
| Template Integration | ✅ Complete | 100% |

### ✅ Phase 2 Complete

All core features have been implemented:
- **Android Template**: Camera & Geolocation bridges registered
- **iOS Template**: Camera & Geolocation bridges registered

### ✅ Phase 3 Complete

All documentation and testing tasks completed:
- **Documentation**: Geolocation, Creating Plugins guides
- **Unit Tests**: Camera and Geolocation plugins (Jest)
- **Example Projects**: basic, camera-demo, location-tracker
- **Docs Index**: Comprehensive README with quick links

### Next Steps (Optional Future Work)

- [ ] Integration testing on real devices/emulators
- [ ] Performance testing and optimization
- [ ] Additional native plugins (File System, Notifications)
- [ ] npm package publishing

## Upcoming Features

### High Priority
- 🔄 Additional native plugins (File System, Notifications, etc.)
- 📊 Performance monitoring and analytics
- 🎨 UI components library

### Medium Priority
- 🧪 Testing framework for plugins
- 📱 OTA (Over-The-Air) updates
- 🔐 Secure storage plugin

### Low Priority
- 🖥️ Desktop platform support (Electron/Tauri)
- 🌐 Web deployment tools
- 📚 Plugin marketplace

---

For detailed documentation, see:
- [Camera Plugin](docs/CAMERA_PLUGIN.md)
- [Geolocation Plugin](docs/GEOLOCATION_PLUGIN.md)
- [Plugin System](docs/PLUGIN_SYSTEM_README.md)
