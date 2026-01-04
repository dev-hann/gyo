# Gyo Plugins - Android

Android bridge library for Gyo framework.

## 🎯 Overview

This library provides a bridge between WebView and native Android code, enabling seamless communication between your web application and native Android features.

## 📦 Installation

### Using JitPack

1. Add JitPack repository to your root `build.gradle` or `settings.gradle.kts`:

```gradle
repositories {
    maven { url 'https://jitpack.io' }
}
```

2. Add the dependency:

```gradle
dependencies {
    implementation 'gyo.plugins:android:0.1.0'
}
```

## 🚀 Usage

### Basic Setup

```kotlin
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry
import gyo.plugins.bridge.BridgeHandler
import android.webkit.WebView
import org.json.JSONObject

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        val webView = findViewById<WebView>(R.id.webView)
        
        // Setup WebView with bridge
        webView.settings.javaScriptEnabled = true
        val bridgeInterface = AndroidBridgeInterface(webView)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")
        
        // Load your web app
        webView.loadUrl("file:///android_asset/index.html")
    }
}
```

### Creating Custom Bridges

```kotlin
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONObject

class MyCustomBridgeHandler : BridgeHandler {
    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "getData" -> {
                // Handle getData method
                mapOf(
                    "success" to true,
                    "message" to "Hello from Android!"
                )
            }
            "doSomething" -> {
                val param = data.optString("param", "default")
                // Do something with param
                mapOf("result" to "processed: $param")
            }
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}

// Register the bridge
BridgeRegistry.register("myBridge", MyCustomBridgeHandler())
```

### Publishing Events to Web

```kotlin
val bridgeInterface = AndroidBridgeInterface(webView)

// Publish an event to web listeners
bridgeInterface.publish("myBridge", mapOf(
    "eventType" to "update",
    "data" to "Something happened!"
))
```

## 📚 API Reference

### BridgeHandler

Interface for creating custom bridge handlers.

```kotlin
interface BridgeHandler {
    fun handle(method: String, data: JSONObject): Any?
}
```

### BridgeRegistry

Singleton for managing bridge handlers.

```kotlin
object BridgeRegistry {
    fun register(bridgeName: String, handler: BridgeHandler)
    fun unregister(bridgeName: String)
    fun get(bridgeName: String): BridgeHandler?
    fun initialize()
}
```

### AndroidBridgeInterface

Main bridge interface for WebView communication.

```kotlin
class AndroidBridgeInterface(webView: WebView) {
    @JavascriptInterface
    fun postMessage(message: String)
    
    fun publish(bridgeName: String, data: Any?)
}
```

## 🔗 Related Packages

- **Web**: `gyo-plugins` (NPM)
- **iOS**: `gyo-plugins-ios` (Swift Package)

## 📄 License

MIT
