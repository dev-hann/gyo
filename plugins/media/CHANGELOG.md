# Changelog

## [0.1.0] - 2026-11-28

### Added

- `Media.saveToGallery({ url, mimeType, filename, userAgent, folder })`: downloads the file natively and stores it through `MediaStore`, one save at a time, without a permission from Android 10 on; before that in the public folder of the gallery, behind `WRITE_EXTERNAL_STORAGE`
- `Media.share({ url, ... })` and `Media.share({ text })`: offers a downloaded file or a text through the system chooser; a file goes through the module's own `FileProvider`, which grants `cache/share` and nothing else
- A download is written to the cache before it is stored or shared
- A failure resolves as a value: `{ status: 'failed', error: { kind, message } }`, with the kind `network`, `unsupported`, `permission` or `storage`
- Android handler `MediaBridge`, in an `android/` Gradle library module that declares its own OkHttp and `androidx.core` dependencies and the share provider
