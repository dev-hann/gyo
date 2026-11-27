package {{PACKAGE_NAME}}

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONObject
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry
import gyo.plugins.bridge.PluginRegistry
import {{PACKAGE_NAME}}.BuildConfig

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var gyoConfig: GyoConfig
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

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
            allowFileAccess = gyoConfig.allowFileAccess
            allowContentAccess = true
            allowUniversalAccessFromFileURLs = gyoConfig.allowUniversalAccessFromFileURLs
            mediaPlaybackRequiresUserGesture = false

            // Empty unless gyo.config.json sets webview.userAgent. The WebView's own
            // user agent is what makes sites treat the shell as a browser.
            gyoConfig.userAgent?.let { userAgentString = it }
            
            // Enable debugging only in debug builds
            if (BuildConfig.DEBUG) {
                WebView.setWebContentsDebuggingEnabled(true)
            }
        }
        
        // Initialize BridgeRegistry, then the plugins installed in lib/.
        // PluginRegistry.kt is written by gyo.
        BridgeRegistry.initialize()
        PluginRegistry.registerAll(this)
        
        // Add JavaScript interface for bridge system (origin-restricted)
        val bridgeInterface = AndroidBridgeInterface(webView, gyoConfig.allowedHost)
        webView.addJavascriptInterface(bridgeInterface, "androidBridge")
        
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

            // Full-screen video (`video.requestFullscreen()`). Without these
            // two the WebView answers "Fullscreen is not supported".
            override fun onShowCustomView(view: View, callback: CustomViewCallback) {
                if (fullscreenView != null) {
                    callback.onCustomViewHidden()
                    return
                }
                fullscreenView = view
                fullscreenCallback = callback
                // The WebView must stay alive behind the video; hiding it
                // would tear the player down.
                webView.visibility = View.INVISIBLE
                addContentView(
                    view,
                    FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                )
            }

            override fun onHideCustomView() {
                hideFullscreen()
            }
        }
    }

    private fun hideFullscreen() {
        val view = fullscreenView
        fullscreenView = null
        (view?.parent as? ViewGroup)?.removeView(view)
        fullscreenCallback?.onCustomViewHidden()
        fullscreenCallback = null
        webView.visibility = View.VISIBLE
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
            val webview = jsonObject.optJSONObject("webview")
            val userAgent = webview
                ?.optString("userAgent")
                ?.trim()
                ?.takeIf { it.isNotEmpty() }

            return GyoConfig(
                serverUrl = serverUrl,
                allowedHost = allowedHost,
                userAgent = userAgent,
                allowFileAccess = webview?.optBoolean("allowFileAccess", false) ?: false,
                allowUniversalAccessFromFileURLs =
                    webview?.optBoolean("allowUniversalAccessFromFileURLs", false) ?: false
            )
        } catch (e: Exception) {
            Log.e("MainActivity", "Failed to load gyo-config.json from assets: ${e.message}")
            throw IllegalStateException("gyo-config.json must be present with valid serverUrl. Did you run 'gyo build' or 'gyo run'?", e)
        }
    }

    override fun onBackPressed() {
        when {
            fullscreenView != null -> hideFullscreen()
            webView.canGoBack() -> webView.goBack()
            else -> super.onBackPressed()
        }
    }
    
    data class GyoConfig(
        val serverUrl: String,
        val allowedHost: String,
        val userAgent: String? = null,
        val allowFileAccess: Boolean = false,
        val allowUniversalAccessFromFileURLs: Boolean = false
    )
}
