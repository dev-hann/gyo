# Hot Reload

개발 중 파일 변경 시 앱 자동 새로고침.

## 아키텍처

```
File Change          WebSocket           Native App
    │                    │                    │
    ▼                    ▼                    ▼
┌─────────┐         ┌─────────┐         ┌─────────┐
│Chokidar │────────▶│ :3001   │────────▶│ WebView │
│ Watcher │  "reload"│ Server  │  reload │         │
└─────────┘         └─────────┘         └─────────┘
```

## 포트

- Vite 개발 서버: 3000
- Hot Reload WebSocket: 3001

## 감시 대상

- `lib/src/**` (기본)
- 무시: `node_modules/`, `.git/`, 빌드 산출물

## 구현

### CLI (hot-reload-server.ts)

```typescript
import chokidar from 'chokidar'
import WebSocket from 'ws'

const wss = new WebSocket.Server({ port: 3001 })
const watcher = chokidar.watch('lib/src', { ignoreInitial: true })

watcher.on('change', () => {
  wss.clients.forEach(client => client.send('reload'))
})
```

### Android (MainActivity.kt)

```kotlin
private fun connectHotReload(serverUrl: String) {
    val wsUrl = "ws://${URI(serverUrl).host}:3001"
    val request = Request.Builder().url(wsUrl).build()
    
    okHttpClient.newWebSocket(request, object : WebSocketListener() {
        override fun onMessage(webSocket: WebSocket, text: String) {
            if (text == "reload") runOnUiThread { webView.reload() }
        }
    })
}
```

### iOS (WebViewContainer.swift)

```swift
private func connectHotReload(serverUrl: String) {
    guard let host = URL(string: serverUrl)?.host else { return }
    let wsURL = URL(string: "ws://\(host):3001")!
    
    hotReloadWebSocket = URLSession.shared.webSocketTask(with: wsURL)
    hotReloadWebSocket?.resume()
    receiveMessage()
}

private func receiveMessage() {
    hotReloadWebSocket?.receive { [weak self] result in
        if case .success(.string("reload")) = result {
            DispatchQueue.main.async { self?.webView.reload() }
        }
        self?.receiveMessage()
    }
}
```

## 의존성

- **CLI**: chokidar, ws
- **Android**: OkHttp 4.12.0
- **iOS**: URLSession (내장)

## 프로덕션

WebSocket 연결 실패 시 조용히 무시. 앱 정상 동작.
