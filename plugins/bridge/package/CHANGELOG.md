# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.2] - 2025-01-10

### Added
- Initial release of @gyo/bridge
- Core Bridge class for web-native communication
- Android BridgeInterface and BridgeRegistry implementation
- iOS IOSBridgeInterface and BridgeRegistry implementation
- TypeScript type definitions
- Platform-specific native code included in npm package

### Features
- Bridge system with `invoke()` method for native method calls
- Event listening with `listen()` method
- Automatic timeout handling (30 seconds)
- Multi-bridge support
- Android WebView integration
- iOS WKWebView integration
- Promise-based API

### Documentation
- Comprehensive README with usage examples
- API reference documentation
- Platform-specific integration guides

## [0.1.1] - Unreleased

### Changed
- Package optimization for npm distribution
- Improved build configuration
- Enhanced .npmignore for smaller package size

[0.1.2]: https://github.com/gyo-framework/gyo/releases/tag/v0.1.2
