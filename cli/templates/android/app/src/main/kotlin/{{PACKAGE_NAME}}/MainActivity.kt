package {{PACKAGE_NAME}}

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry
import {{PACKAGE_NAME}}.BuildConfig

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var gyoConfig: GyoConfig

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        
        // Load gyo configuration
        gyoConfig = loadGyoConfig()
        
        // Setup WebView
        webView = WebView(this)
        setContentView(webView)
        
        setupWebView()
        loadApp()
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun setupWebView() {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = false
            allowContentAccess = true
            allowUniversalAccessFromFileURLs = false
            mediaPlaybackRequiresUserGesture = false
            
            // Enable debugging only in debug builds
            if (BuildConfig.DEBUG) {
                WebView.setWebContentsDebuggingEnabled(true)
            }
        }
        
        // Initialize BridgeRegistry
        BridgeRegistry.initialize()
        
        // Add JavaScript interface for bridge system (origin-restricted)
        val bridgeInterface = AndroidBridgeInterface(webView, gyoConfig.allowedHost)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")
        
        // Example: Register custom bridges here
        // BridgeRegistry.register("my-custom-bridge", MyCustomBridgeHandler())
        
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val target = request?.url ?: return false
                val targetHost = target.host ?: return false
                
                // Same origin as the configured server: load inside the WebView
                if (targetHost.equals(gyoConfig.allowedHost, ignoreCase = true)) {
                    return false
                }
                
                // External origin: never load inside the WebView — the native bridge
                // must not be reachable from third-party pages. Open externally.
                Log.w("MainActivity", "Blocking external navigation in WebView: $target")
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, target))
                } catch (e: Exception) {
                    Log.w("MainActivity", "Could not open external URL: ${e.message}")
                }
                return true
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectGyoRuntime()
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                val logTag = "WebView-Console"
                val message = "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}"
                
                when (consoleMessage.messageLevel()) {
                    ConsoleMessage.MessageLevel.ERROR -> Log.e(logTag, message)
                    ConsoleMessage.MessageLevel.WARNING -> Log.w(logTag, message)
                    ConsoleMessage.MessageLevel.DEBUG -> Log.d(logTag, message)
                    else -> Log.i(logTag, message)
                }
                
                return true
            }
        }
    }

    private fun loadApp() {
        val url = gyoConfig.serverUrl
        webView.loadUrl(url)
    }

    private fun injectGyoRuntime() {
        val script = """
            (function() {
                // Low-level message passing to native
                function postMessage(message) {
                    if (window.androidBridge) {
                        window.androidBridge.postMessage(JSON.stringify(message));
                    }
                }
            
                // gyo runtime
                window.gyo = {
                    platform: 'android',
                    
                    // The gyo-bridge plugin will use this to send messages
                    __bridge: {
                        postMessage: postMessage
                    }
                };
                
                console.log('gyo runtime initialized on Android');
            })();
        """.trimIndent()
        
        webView.evaluateJavascript(script, null)
    }

    private fun loadGyoConfig(): GyoConfig {
        // Try to load from assets/gyo-config.json
        try {
            val json = assets.open("gyo-config.json").bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(json)
            val serverUrl = jsonObject.optString("serverUrl", "")
            
            if (serverUrl.isEmpty()) {
                Log.e("MainActivity", "serverUrl is empty in gyo-config.json")
                throw IllegalStateException("serverUrl is empty in gyo-config.json")
            }
            
            val allowedHost = try {
                Uri.parse(serverUrl).host ?: ""
            } catch (e: Exception) {
                ""
            }
            if (allowedHost.isEmpty()) {
                Log.e("MainActivity", "Could not parse host from serverUrl: $serverUrl")
                throw IllegalStateException("Invalid serverUrl in gyo-config.json: $serverUrl")
            }
            
            Log.i("MainActivity", "Loaded config - serverUrl: $serverUrl")
            return GyoConfig(serverUrl = serverUrl, allowedHost = allowedHost)
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to load gyo-config.json from assets: ${e.message}")
            throw IllegalStateException("gyo-config.json must be present with valid serverUrl. Did you run 'gyo build' or 'gyo run'?", e)
        }
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack()
        } else {
            super.onBackPressed()
        }
    }
    
    data class GyoConfig(
        val serverUrl: String,
        val allowedHost: String
    )
}
