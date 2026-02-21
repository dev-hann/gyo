# iOS Integration Guide

This guide explains how to integrate the `@gyo-framework/bridge` iOS native code into your iOS project.

## Prerequisites

- Xcode 15.0 or later
- iOS 13.0 or later
- Swift 5.9 or later
- Swift Package Manager or CocoaPods

## Method 1: Copy Source Files

### Step 1: Locate the Bridge Code

After installing `@gyo-framework/bridge`, find the native code at:

```
node_modules/@gyo-framework/bridge/ios/Sources/GyoBridge/
```

### Step 2: Copy to Your Project

Copy the following files to your iOS project:

```
YourProject/
└── GyoBridge/
    ├── IOSBridgeInterface.swift
    ├── BridgeHandler.swift
    └── BridgeRegistry.swift
```

**Important**: When adding to Xcode, make sure to select "Copy items if needed" and verify the files are added to your app target.

### Step 3: Configure WKWebView in Your ViewController

```swift
import UIKit
import WebKit

class WebViewController: UIViewController {
    private var webView: WKWebView!
    private var bridgeInterface: IOSBridgeInterface!

    override func viewDidLoad() {
        super.viewDidLoad()

        setupWebView()
        registerBridges()
        loadWebContent()
    }

    private func setupWebView() {
        let webConfiguration = WKWebViewConfiguration()
        webConfiguration.preferences.javaScriptEnabled = true

        // Setup content controller for bridge messages
        let userContentController = WKUserContentController()
        bridgeInterface = IOSBridgeInterface(webView: nil)
        userContentController.add(bridgeInterface, name: "gyoBridge")
        webConfiguration.userContentController = userContentController

        webView = WKWebView(frame: .zero, configuration: webConfiguration)
        webView.navigationDelegate = self
        view = webView

        // Set the webView reference after initialization
        bridgeInterface = IOSBridgeInterface(webView: webView)
    }

    private func registerBridges() {
        // Register your custom bridges
        BridgeRegistry.shared.register("myBridge", handler: MyCustomBridgeHandler())
    }

    private func loadWebContent() {
        if let url = Bundle.main.url(forResource: "index", withExtension: "html") {
            webView.load(URLRequest(url: url))
        }
    }
}

// MARK: - WKNavigationDelegate
extension WebViewController: WKNavigationDelegate {
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        print("WebView loaded successfully")
    }
}
```

### Step 4: Create a Custom Bridge Handler

```swift
import Foundation

class MyCustomBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        switch method {
        case "getData":
            guard let userId = data["userId"] as? Int else {
                throw BridgeError.invalidArgument("userId is required")
            }
            return [
                "name": "John Doe",
                "email": "john@example.com",
                "userId": userId
            ]

        case "saveData":
            guard let name = data["name"] as? String,
                  let email = data["email"] as? String else {
                throw BridgeError.invalidArgument("name and email are required")
            }
            // Save to UserDefaults or Core Data
            return [
                "success": true,
                "saved": [
                    "name": name,
                    "email": email
                ]
            ]

        default:
            throw BridgeError.unknownMethod(method)
        }
    }
}
```

### Step 5: Define BridgeError

```swift
enum BridgeError: Error {
    case unknownMethod(String)
    case invalidArgument(String)
    case internalError(String)

    var localizedDescription: String {
        switch self {
        case .unknownMethod(let method):
            return "Unknown method: \(method)"
        case .invalidArgument(let message):
            return "Invalid argument: \(message)"
        case .internalError(let message):
            return "Internal error: \(message)"
        }
    }
}
```

### Step 6: Send Events to Web

```swift
// Get reference to bridgeInterface (from setupWebView)
func sendEventToWeb() {
    bridgeInterface.publishEvent(bridgeName: "myBridge", data: [
        "event": "userLoggedIn",
        "timestamp": Date().timeIntervalSince1970,
        "userData": [
            "id": 123,
            "name": "John Doe"
        ]
    ])
}
```

## Method 2: Swift Package Manager (Recommended)

### Step 1: Create a Local Swift Package

1. Create a new directory named `GyoBridge`
2. Create the following structure:

```
GyoBridge/
├── Package.swift
└── Sources/
    └── GyoBridge/
        ├── IOSBridgeInterface.swift
        ├── BridgeHandler.swift
        └── BridgeRegistry.swift
```

### Step 2: Create Package.swift

```swift
// swift-tools-version: 5.9

import PackageDescription

let package = Package(
    name: "GyoBridge",
    platforms: [
        .iOS(.v13)
    ],
    products: [
        .library(
            name: "GyoBridge",
            targets: ["GyoBridge"]
        )
    ],
    targets: [
        .target(
            name: "GyoBridge",
            path: "Sources/GyoBridge"
        )
    ]
)
```

### Step 3: Add Package to Your Project

In Xcode:
1. Select your project in the navigator
2. Go to "Package Dependencies"
3. Click "+" button
4. Select "Add Local Package..."
5. Choose the `GyoBridge` folder
6. Add "GyoBridge" to your app target

### Step 4: Import in Your Code

```swift
import GyoBridge
```

## Method 3: CocoaPods

### Step 1: Create a Podspec

Create `GyoBridge.podspec`:

```ruby
Pod::Spec.new do |spec|
  spec.name             = 'GyoBridge'
  spec.version          = '0.1.2'
  spec.license          = { :type => 'MIT', :file => 'LICENSE' }
  spec.homepage         = 'https://github.com/gyo-framework/gyo'
  spec.authors          = { 'Gyo Framework' => 'gyo@example.com' }
  spec.summary          = 'Core bridge library for Gyo framework'
  spec.source           = { :git => 'https://github.com/gyo-framework/gyo.git', :tag => "v#{spec.version}" }
  spec.swift_version    = '5.9'

  spec.ios.deployment_target = '13.0'

  spec.source_files = 'Sources/GyoBridge/**/*.swift'
  spec.frameworks = 'WebKit'
end
```

### Step 2: Add to Your Podfile

```ruby
platform :ios, '13.0'

target 'YourApp' do
  use_frameworks!
  pod 'GyoBridge', :path => 'path/to/GyoBridge'
end
```

### Step 3: Install

```bash
pod install
```

## Testing Your Integration

### Web Side Test

```javascript
import { Bridge } from '@gyo-framework/bridge';

const bridge = new Bridge('myBridge');

async function test() {
    try {
        const result = await bridge.invoke('getData', { userId: 123 });
        console.log('Native response:', result);
    } catch (error) {
        console.error('Bridge error:', error);
    }
}

test();

// Listen to events
bridge.listen((data) => {
    console.log('Event from native:', data);
});
```

### Native Side Test

```swift
// In your view controller or handler
func testBridge() {
    bridgeInterface.publishEvent(bridgeName: "myBridge", data: [
        "event": "testEvent",
        "message": "Hello from iOS!"
    ])
}
```

## Debugging

### Enable Console Logging

Add print statements in your bridge handler:

```swift
class MyCustomBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        print("🔄 Bridge method called: \(method)")
        print("📦 Data received: \(data)")

        // ... your logic

        print("✅ Response prepared")
        return result
    }
}
```

### Use Safari Web Inspector

1. Connect your device via USB
2. Enable Web Inspector on your device (Settings > Safari > Advanced)
3. On Mac, open Safari > Develop > [Your Device] > [Your App]
4. Check Console for errors and logs

### Common Issues

**Issue: Bridge not found**

```swift
// Ensure bridge is registered before loading web content
override func viewDidLoad() {
    super.viewDidLoad()
    registerBridges()  // Register first
    loadWebContent()    // Then load
}
```

**Issue: MessageHandler not registered**

```swift
// Make sure to add the message handler to WKUserContentController
let userContentController = WKUserContentController()
userContentController.add(bridgeInterface, name: "gyoBridge")
```

**Issue: Timeout errors**

The default timeout is 30 seconds. Ensure your operations complete within this time.

## Security Considerations

1. **Validate all inputs** from the web side
2. **Don't execute arbitrary code** from web messages
3. **Use HTTPS** for loading web content
4. **Disable WKContentBlocking** only when necessary
5. **Sanitize error messages** before sending them to web

## Thread Safety

The `IOSBridgeInterface` uses `@MainActor` to ensure all WebView operations happen on the main thread:

```swift
@MainActor
public class IOSBridgeInterface: NSObject, WKScriptMessageHandler {
    // All methods are executed on the main thread
}
```

Your bridge handlers should also be main-actor safe:

```swift
@MainActor
class MyCustomBridgeHandler: BridgeHandler {
    func handle(method: String, data: [String: Any]) throws -> Any? {
        // Safe to access UI elements here
    }
}
```

## Additional Resources

- [Apple WKWebView Documentation](https://developer.apple.com/documentation/webkit/wkwebview)
- [WKScriptMessageHandler Guide](https://developer.apple.com/documentation/webkit/wkscriptmessagehandler)
- [Gyo Framework Documentation](https://gyo.dev/docs)
