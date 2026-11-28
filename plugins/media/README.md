# @gyo-community/media

Saves images and videos to the device, and shares media and text with other apps.

A page in the gyo WebView can do neither by itself: it cannot read the bytes of the image it shows, the Web
Share API does not exist in a WebView, and the shell's download handling only takes what the WebView cannot
show. The plugin downloads the file natively and stores it where the system keeps pictures, videos and
downloads, or hands it to the system chooser. A failure comes back as a value that names its kind.

> See [PLUGINS.md](../../docs/PLUGINS.md#gyo-communitymedia) for the API contract.

## Install

```bash
npm install @gyo-community/media
```

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Android only; the module brings its own OkHttp and `androidx.core`.

## Android 9 and earlier

Saving takes `WRITE_EXTERNAL_STORAGE` there; from Android 10 on no permission is needed. The app declares the permission for those versions alone. Add to `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission
    android:name="android.permission.WRITE_EXTERNAL_STORAGE"
    android:maxSdkVersion="28" />
```

`gyo install` points the permission out while the line is missing, whatever the Android version a device runs. On Android 9 and earlier, `saveToGallery()` answers the kind `permission` until the page has asked the user for it with `requestPermissions()` of `@gyo-framework/bridge`.

## Sharing and the cache

A download is written to the app's cache before it is stored or shared, so a save needs room there for the size of the file while it lasts.

The module's manifest declares a `FileProvider` under the authority `<applicationId>.gyo.media`, which grants read access to `cache/share` and nothing else. A share keeps its file there for the app the user picks; files older than a day are deleted at the next call.
