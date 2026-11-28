# Changelog

## [0.2.0] - 2026-11-28

### Added

- `Downloader.download({ url, headers, fileName }, { onProgress })`: a file written to `downloads/<fileName>` in the
  cache of the app, streamed so that nothing is held in memory. Returns a `DownloadTask`: `result` resolves once the
  file is whole, `cancel()` ends it, and a `DownloadCancelledError` is why a cancelled one rejected
- The progress reaches the page as an event the handler publishes, the first use of a handler's events on the bridge:
  `{ type: 'progress', downloadId, bytesWritten, totalBytes }`, at most every 250 ms and always first and last
- Native methods `download` and `cancel_download` of `HttpBridge`; the download logic is in `Downloads.kt` of the module
- The call is given ten minutes before it is cut off; a file has no size limit

## [0.1.0] - 2026-11-27

### Added

- Published under `@gyo-community`, where every add-on feature lives; `@gyo-framework` is the core
- `Http.request({ url, headers, jar })`: native GET that follows redirects and returns the status,
  the final url, the response headers and the raw body as base64
- Cookies per `jar` name, kept across app restarts
- `decodeText`, `base64ToBytes` helpers
- Android handler `HttpBridge`, in an `android/` Gradle library module that declares its own OkHttp dependency
