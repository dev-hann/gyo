package {{PACKAGE_NAME}}

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import android.webkit.JavascriptInterface
import org.json.JSONObject

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
        
        // Add JavaScript interface
        webView.addJavascriptInterface(GyoBridge(this), "GyoAndroid")
        
        webView.webViewClient = WebViewClient()
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
        
        // Inject gyo runtime after page loads
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                injectGyoRuntime()
            }
        }
    }

    private fun injectGyoRuntime() {
        val script = """
            (function() {
                window.gyo = {
                    platform: 'android',
                    callNative: function(method, params) {
                        return new Promise(function(resolve, reject) {
                            try {
                                var result = GyoAndroid.callNative(method, JSON.stringify(params || {}));
                                resolve(JSON.parse(result));
                            } catch (e) {
                                reject(e);
                            }
                        });
                    },
                    onMessage: function(callback) {
                        window.gyoMessageCallback = callback;
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
            val webviewUrl = jsonObject.optString("webviewUrl", "http://10.0.2.2:3000")
            return GyoConfig(serverUrl = webviewUrl)
        } catch (e: Exception) {
            Log.w("MainActivity", "Failed to load gyo-config.json from assets, using defaults: ${e.message}")
            // Fallback to default for development
            return GyoConfig(serverUrl = "http://10.0.2.2:3000")
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

    class GyoBridge(private val activity: MainActivity) {
        @JavascriptInterface
        fun callNative(method: String, paramsJson: String): String {
            val params = JSONObject(paramsJson)
            
            // Handle different native methods
            return when (method) {
                "test" -> {
                    JSONObject().apply {
                        put("success", true)
                        put("message", "Hello from Android!")
                        put("platform", "android")
                    }.toString()
                }
                else -> {
                    JSONObject().apply {
                        put("success", false)
                        put("error", "Unknown method: $method")
                    }.toString()
                }
            }
        }
    }
}
