# @gyo-community/http

GET requests from the web layer that run outside the WebView, with the headers the caller chooses.

The WebView cannot fetch other sites itself: cross-origin responses are hidden by CORS, and many
servers answer a WebView's own user agent or a foreign `Referer` with a redirect or a 403. This
plugin performs the request natively and hands back the status, the headers and the raw body.
Decoding is left to the caller, who knows the charset.

> See [PLUGINS.md](../../docs/PLUGINS.md#gyo-communityhttp) for the API contract.

## Install

```bash
npm install @gyo-community/http
```

`gyo run`, `gyo build android` and `gyo install` include the plugin's Android module in the app and register the handler. Android only; the module brings its own OkHttp.

## Download

`Downloader` writes a file into the cache of the app, a private place that needs no permission, and tells the page how far it is. It is how an app outside a store gets the APK of its next version, which `ApkInstaller` of `@gyo-community/app-launcher` then installs.

```typescript
import { DownloadCancelledError, Downloader } from '@gyo-community/http';

const downloader = new Downloader();
const task = downloader.download(
  { url: 'https://example.com/app-1.2.0.apk', fileName: 'app.apk' },
  { onProgress: ({ bytesWritten, totalBytes }) => console.log(bytesWritten, totalBytes) }
);
task.cancel();
try {
  const file = await task.result;
} catch (error) {
  if (error instanceof DownloadCancelledError) return;
  throw error;
}
```

| Member | Role |
|--------|------|
| `download(request, options?)` | Starts the download and returns a `DownloadTask` |
| `DownloadTask.result` | The file once it is whole (`path`, `bytesWritten`, `status`, `url`, `headers`). Rejects when the server answers anything but 2xx, when no response arrived, when the file could not be written, and with a `DownloadCancelledError` when the task was cancelled |
| `DownloadTask.cancel()` | Ends a download that runs; a file that did not arrive whole is deleted |
| `onProgress` | Called with `{ bytesWritten, totalBytes }` for this download only; `totalBytes` is -1 when the server did not say |

The progress reaches the page as an event the native handler publishes: the first says 0 bytes, the last how many there are, and at most one every 250 ms in between.

Left out, `fileName` is the last part of the address the server answered from, once redirects were followed. GitHub sends a release asset to an address that ends in an id, so pass `fileName` when the file is to keep the name it was asked under.
