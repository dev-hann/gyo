# Changelog

## [0.1.0] - 2026-11-27

### Added

- Published under `@gyo-community`, where every add-on feature lives; `@gyo-framework` is the core
- `Http.request({ url, headers, jar })`: native GET that follows redirects and returns the status,
  the final url, the response headers and the raw body as base64
- Cookies per `jar` name, kept across app restarts
- `decodeText`, `base64ToBytes` helpers
- Android handler `HttpBridge`, in an `android/` Gradle library module that declares its own OkHttp dependency
