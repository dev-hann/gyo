package {{PACKAGE_NAME}}

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.net.URI

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var gyoConfig: GyoConfig
    private var hotReloadWebSocket: WebSocket? = null
    private val okHttpClient = OkHttpClient()

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
            
            // Enable debugging
            WebView.setWebContentsDebuggingEnabled(true)
        }
        
        // Initialize BridgeRegistry
        BridgeRegistry.initialize()
        
        // Add JavaScript interface for bridge system
        val bridgeInterface = AndroidBridgeInterface(webView)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")
        
        // Example: Register custom bridges here
        // BridgeRegistry.register("my-custom-bridge", MyCustomBridgeHandler())
        
        webView.webViewClient = object : WebViewClient() {
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
        
        // Connect to Hot Reload WebSocket in development mode
        connectHotReload(url)
    }
    
    private fun connectHotReload(serverUrl: String) {
        try {
            // Extract host from server URL
            val uri = URI(serverUrl)
            val host = uri.host
            val wsUrl = "ws://$host:3001"
            
            Log.i("MainActivity", "Connecting to Hot Reload WebSocket: $wsUrl")
            
            val request = Request.Builder()
                .url(wsUrl)
                .build()
            
            hotReloadWebSocket = okHttpClient.newWebSocket(request, object : WebSocketListener() {
                override fun onOpen(webSocket: WebSocket, response: okhttp3.Response) {
                    Log.i("HotReload", "WebSocket connected")
                }
                
                override fun onMessage(webSocket: WebSocket, text: String) {
                    Log.i("HotReload", "Received message: $text")
                    if (text == "reload") {
                        runOnUiThread {
                            Log.i("HotReload", "Reloading WebView")
                            webView.reload()
                        }
                    }
                }
                
                override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                    Log.i("HotReload", "WebSocket closing: $reason")
                }
                
                override fun onFailure(webSocket: WebSocket, t: Throwable, response: okhttp3.Response?) {
                    Log.w("HotReload", "WebSocket connection failed (this is normal in production): ${t.message}")
                }
            })
        } catch (e: Exception) {
            Log.w("HotReload", "Failed to connect to Hot Reload (this is normal in production): ${e.message}")
        }
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
            
            Log.i("MainActivity", "Loaded config - serverUrl: $serverUrl")
            return GyoConfig(serverUrl = serverUrl)
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
    
    override fun onDestroy() {
        super.onDestroy()
        hotReloadWebSocket?.close(1000, "Activity destroyed")
    }

    data class GyoConfig(
        val serverUrl: String
    )
}
