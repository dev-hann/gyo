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
import {{PACKAGE_NAME}}.gyo.AndroidBridgeInterface
import {{PACKAGE_NAME}}.gyo.BridgeRegistry
import {{PACKAGE_NAME}}.gyo.ConsoleBridgeHandler

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
            
            // Enable debugging
            WebView.setWebContentsDebuggingEnabled(true)
        }
        
        // Initialize BridgeRegistry with default handlers
        BridgeRegistry.initialize()
        
        // Register built-in console bridge
        BridgeRegistry.register("gyo-console", ConsoleBridgeHandler())
        
        // Add JavaScript interface for bridge system
        val bridgeInterface = AndroidBridgeInterface(webView)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")
        
        // Example: Register custom bridge (developers can add their own)
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

    data class GyoConfig(
        val serverUrl: String
    )
}
