# {{PROJECT_NAME}}

A cross-platform application built with [gyo](https://github.com/dev-hann/gyo): a web application in `lib/`, served over HTTP and wrapped in native WebView shells for Android and iOS.

## Prerequisites

- Node.js 24 or later
- Android: Android Studio, which brings the Android SDK; JDK 17
- iOS: [xtool](https://xtool.sh) (`curl -fsSL https://xtool.sh | sh`), and on Linux `libimobiledevice-utils`

## 1. Add your web application

Put any web application (React, Next.js, Vue, Svelte, plain HTML...) in `lib/`:

```bash
cd lib
npm create vite@latest .        # or any framework of your choice
npm install
```

## 2. Configure the dev server

Edit `gyo.config.json`:

- `script.start` — the command that starts your dev server
- `profiles.development.serverUrl` — the URL your dev server serves on

The device reaches the dev server over your network, so the server must listen on `0.0.0.0`, not only on localhost. With Vite:

```bash
npm run dev -- --host 0.0.0.0
```

Set `script.start` to that command, host flag included.

## 3. Run

```bash
gyo run
```

## Build

```bash
gyo build android      # asks for the deploy URL the first time
gyo build ios
```

Deploy the web application to a server first, then build with the profile that points at it:

```bash
gyo build android -p production
```

## Plugins

A Gyo plugin is an npm package that gives the web layer a native ability. Install it in `lib/`; the next `gyo run`, `gyo build` or `gyo install` adds its Android code to the app:

```bash
cd lib && npm install @gyo-framework/http
```

Permissions the system has to ask the user for, such as contacts or SMS, go in `android/app/src/main/AndroidManifest.xml`. `gyo install` lists the ones an installed plugin needs.

## Project Structure

```
{{PROJECT_NAME}}/
├── lib/                # Your web application (any framework)
│   └── package.json
├── android/            # Android native shell
├── ios/                # iOS native shell
├── gyo.config.json     # Server URLs, start script, app identity
└── README.md
```
