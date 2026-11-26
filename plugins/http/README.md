# @gyo-framework/http

GET requests from the web layer that run outside the WebView, with the headers the caller chooses.

The WebView cannot fetch other sites itself: cross-origin responses are hidden by CORS, and many
servers answer a WebView's own user agent or a foreign `Referer` with a redirect or a 403. This
plugin performs the request natively and hands back the status, the headers and the raw body.
Decoding is left to the caller, who knows the charset.

> See [PLUGINS.md](../../docs/PLUGINS.md#gyo-frameworkhttp) for the API contract.

## Install

```bash
npm install @gyo-framework/http
gyo build android   # once, to copy the Kotlin handler and register the bridge
```

Android only. The app needs OkHttp; the gyo Android template already includes it.
