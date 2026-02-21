# Android Integration Guide

This guide explains how to integrate the `@gyo-framework/bridge` Android native code into your Android project.

## Prerequisites

- Android Studio Arctic Fox (2020.3.1) or later
- Android Gradle Plugin 7.0 or later
- Kotlin 1.5 or later
- Android SDK 24+ (API 24)

## Method 1: Copy Source Files

### Step 1: Locate the Bridge Code

After installing `@gyo-framework/bridge`, find the native code at:

```
node_modules/@gyo-framework/bridge/android/src/main/kotlin/gyo/plugins/bridge/
```

### Step 2: Copy to Your Project

Copy the following files to your Android project:

```
app/src/main/java/gyo/plugins/bridge/
├── AndroidBridgeInterface.kt
├── BridgeHandler.kt
└── BridgeRegistry.kt
```

### Step 3: Update Your Gradle Configuration

Add the required WebView dependency to your `app/build.gradle.kts`:

```kotlin
dependencies {
    implementation("androidx.webkit:webkit:1.8.0")
}
```

### Step 4: Configure WebView in Your Activity

```kotlin
package com.example.app

import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView
import androidx.appcompat.app.AppCompatActivity
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var bridgeInterface: AndroidBridgeInterface

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        setupWebView()
        registerBridges()
    }

    private fun setupWebView() {
        webView = findViewById(R.id.webView)

        // Configure WebView settings
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        }

        // Setup bridge interface
        bridgeInterface = AndroidBridgeInterface(webView)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")

        // Load your web content
        webView.loadUrl("file:///android_asset/index.html")
    }

    private fun registerBridges() {
        // Register your custom bridges
        BridgeRegistry.register("myBridge", MyCustomBridgeHandler())
    }
}
```

### Step 5: Create a Custom Bridge Handler

```kotlin
package com.example.app.bridges

import gyo.plugins.bridge.BridgeHandler
import org.json.JSONObject

class MyCustomBridgeHandler : BridgeHandler {
    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "getData" -> {
                val userId = data.optInt("userId")
                mapOf(
                    "name" to "John Doe",
                    "email" to "john@example.com",
                    "userId" to userId
                )
            }
            "saveData" -> {
                val name = data.optString("name")
                val email = data.optString("email")
                // Save to local storage
                mapOf("success" to true, "saved" to mapOf("name" to name, "email" to email))
            }
            else -> throw IllegalArgumentException("Unknown method: $method")
        }
    }
}
```

### Step 6: Send Events to Web

```kotlin
// Get reference to bridge interface
private fun sendEventToWeb() {
    bridgeInterface.publish("myBridge", mapOf(
        "event" to "userLoggedIn",
        "timestamp" to System.currentTimeMillis(),
        "userData" to mapOf(
            "id" to 123,
            "name" to "John Doe"
        )
    ))
}
```

## Method 2: Create a Gradle Module (Advanced)

If you prefer using Gradle modules:

### Step 1: Create a New Module

In Android Studio: `File > New > New Module > Android Library`

Name it `gyo-bridge-android`

### Step 2: Copy Source Files

Copy the bridge source files to `gyo-bridge-android/src/main/java/gyo/plugins/bridge/`

### Step 3: Update Module Build Configuration

`gyo-bridge-android/build.gradle.kts`:

```kotlin
plugins {
    id("com.android.library")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "gyo.plugins.bridge"
    compileSdk = 34

    defaultConfig {
        minSdk = 24
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_1_8
        targetCompatibility = JavaVersion.VERSION_1_8
    }

    kotlinOptions {
        jvmTarget = "1.8"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.8.0")
}
```

### Step 4: Add Module to Your App

In your app's `build.gradle.kts`:

```kotlin
dependencies {
    implementation(project(":gyo-bridge-android"))
}
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

```kotlin
// In your activity or handler
private fun testBridge() {
    val data = mapOf(
        "event" to "testEvent",
        "message" to "Hello from Android!"
    )
    bridgeInterface.publish("myBridge", data)
}
```

## Troubleshooting

### Issue: "Bridge not found"

**Solution**: Ensure you've registered your bridge handler in `onCreate()` before loading the WebView:

```kotlin
BridgeRegistry.register("myBridge", MyCustomBridgeHandler())
webView.loadUrl("file:///android_asset/index.html")
```

### Issue: JavaScript errors

**Solution**: Enable WebView debugging in debug builds:

```kotlin
if (BuildConfig.DEBUG) {
    WebView.setWebContentsDebuggingEnabled(true)
}
```

### Issue: Method timeout

**Solution**: The default timeout is 30 seconds. Ensure your native operations complete within this time, or adjust the timeout in the web-side Bridge class.

## Security Considerations

1. **Validate all inputs** from the web side before processing
2. **Don't execute arbitrary code** from web messages
3. **Use HTTPS** for loading web content in production
4. **Disable WebView debugging** in production builds
5. **Sanitize error messages** before sending them to web

## Additional Resources

- [Android WebView Documentation](https://developer.android.com/guide/webapps/webview)
- [JavaScript Interface Guide](https://developer.android.com/guide/webapps/webview#BindingJavaScript)
- [Gyo Framework Documentation](https://gyo.dev/docs)
