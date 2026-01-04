# Gyo Plugins - iOS

iOS bridge library for Gyo framework.

## 🎯 Overview

This library provides a bridge between WKWebView and native iOS code, enabling seamless communication between your web application and native iOS features.

## 📦 Installation

### Swift Package Manager

Add to your `Package.swift`:

```swift
dependencies: [
    .package(url: "https://github.com/<your-org>/gyo-plugins-ios.git", from: "0.1.0")
]
```

Or in Xcode:
1. File > Add Package Dependencies
2. Enter the repository URL
3. Select version 0.1.0 or later

## 🚀 Usage

### Basic Setup

```swift
import UIKit
import WebKit
import GyoBridge

class ViewController: UIViewController {
    var webView: WKWebView!
    var bridgeInterface: IOSBridgeInterface!
    
    override func viewDidLoad() {
        super.viewDidLoad()
        
        // Configure WKWebView
        let config = WKWebViewConfiguration()
        
        // Setup WebView
        webView = WKWebView(frame: view.bounds, configuration: config)
        view.addSubview(webView)
        
        // Setup bridge interface
        bridgeInterface = IOSBridgeInterface(webView: webView)
        config.userContentController.add(bridgeInterface, name: "gyoBridge")
        
        // Load your web app
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.loadFileURL(url, allowingReadAccessTo: url.deletingLastPathComponent())
        }
    }
}
```

### Creating Custom Bridges

```swift
import GyoBridge

final class MyCustomBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "getData":
            // Handle getData method
            return [
                "success": true,
                "message": "Hello from iOS!"
            ]
            
        case "doSomething":
            let param = data["param"] as? String ?? "default"
            // Do something with param
            return ["result": "processed: \(param)"]
            
        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}

// Register the bridge
Task { @MainActor in
    await BridgeRegistry.shared.register("myBridge", handler: MyCustomBridgeHandler())
}
```

### Publishing Events to Web

```swift
// Publish an event to web listeners
await bridgeInterface.publishEvent(
    bridgeName: "myBridge",
    data: [
        "eventType": "update",
        "data": "Something happened!"
    ]
)
```

## 📚 API Reference

### BridgeHandler

Protocol for creating custom bridge handlers.

```swift
public protocol BridgeHandler: Sendable {
    func handle(method: String, data: [String: Any]) throws -> Any?
}
```

### BridgeRegistry

Singleton for managing bridge handlers.

```swift
@MainActor
public class BridgeRegistry {
    public static let shared: BridgeRegistry
    
    public func register(_ bridgeName: String, handler: BridgeHandler)
    public func unregister(_ bridgeName: String)
    public func get(_ bridgeName: String) -> BridgeHandler?
    public func initialize()
}
```

### IOSBridgeInterface

Main bridge interface for WKWebView communication.

```swift
@MainActor
public class IOSBridgeInterface: NSObject, WKScriptMessageHandler {
    public init(webView: WKWebView)
    
    public func handleMessage(_ body: Any)
    public func publishEvent(bridgeName: String, data: Any?)
}
```

### BridgeError

Error types for bridge operations.

```swift
public enum BridgeError: Error {
    case unknownMethod(String)
    case unknownBridge(String)
}
```

## 🔗 Related Packages

- **Web**: `gyo-plugins` (NPM)
- **Android**: `gyo.plugins:android` (JitPack)

## 📄 License

MIT
