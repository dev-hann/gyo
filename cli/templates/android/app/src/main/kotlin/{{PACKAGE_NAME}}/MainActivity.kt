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
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import org.json.JSONObject
import gyo.plugins.bridge.AndroidBridgeInterface
import gyo.plugins.bridge.BridgeRegistry
import gyo.plugins.bridge.MainFrameCheckedInterface
import gyo.plugins.bridge.PermissionBridge
import gyo.plugins.bridge.PluginRegistry
import {{PACKAGE_NAME}}.BuildConfig

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private lateinit var gyoConfig: GyoConfig
    private lateinit var permissionBridge: PermissionBridge
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    @SuppressLint("SetJavaScriptEnabled")
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

        // Initialize BridgeRegistry, then the shell's own handler and the
        // plugins installed in lib/ (PluginRegistry.kt is written by gyo).
        BridgeRegistry.initialize()
        permissionBridge = PermissionBridge(this)
        BridgeRegistry.register(PermissionBridge.NAME, permissionBridge)
        PluginRegistry.registerAll(this)

        // The native half of the bridge, for the origin of serverUrl only:
        // Android does not inject it into any other frame, iframe included.
        val bridgeInterface = AndroidBridgeInterface(webView)
        if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            WebViewCompat.addWebMessageListener(
                webView,
                BRIDGE_OBJECT,
                setOf(gyoConfig.originRule),
                bridgeInterface
            )
        } else {
            Log.w(
                TAG,
                "This Android System WebView cannot restrict the bridge by origin; " +
                    "the main frame is checked instead. Update Android System WebView."
            )
            webView.addJavascriptInterface(
                MainFrameCheckedInterface(bridgeInterface, webView, gyoConfig.origin.host ?: ""),
                BRIDGE_OBJECT
            )
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(
                view: WebView?,
                request: WebResourceRequest?
            ): Boolean {
                val target = request?.url ?: return false

                // No host to compare (about:blank, blob: ...), or the same
                // origin as the configured server: load inside the WebView
                if (target.host == null || gyoConfig.isSameOrigin(target)) {
                    return false
                }

                // Another origin: never load inside the WebView, where the
                // native bridge must not be reachable. Open externally.
                Log.w(TAG, "Opening outside the WebView: $target")
                try {
                    startActivity(Intent(Intent.ACTION_VIEW, target))
                } catch (e: Exception) {
                    Log.w(TAG, "Could not open external URL: ${e.message}")
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
                Log.e(TAG, "serverUrl is empty in gyo-config.json")
                throw IllegalStateException("serverUrl is empty in gyo-config.json")
            }

            val origin = Uri.parse(serverUrl)
            if (origin.scheme.isNullOrBlank() || origin.host.isNullOrBlank()) {
                Log.e(TAG, "Could not parse an origin from serverUrl: $serverUrl")
                throw IllegalStateException("Invalid serverUrl in gyo-config.json: $serverUrl")
            }

            Log.i(TAG, "Loaded config - serverUrl: $serverUrl")
            val webview = jsonObject.optJSONObject("webview")
            val userAgent = webview
                ?.optString("userAgent")
                ?.trim()
                ?.takeIf { it.isNotEmpty() }

            return GyoConfig(
                serverUrl = serverUrl,
                origin = origin,
                userAgent = userAgent,
                allowFileAccess = webview?.optBoolean("allowFileAccess", false) ?: false,
                allowUniversalAccessFromFileURLs =
                    webview?.optBoolean("allowUniversalAccessFromFileURLs", false) ?: false
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load gyo-config.json from assets: ${e.message}")
            throw IllegalStateException("gyo-config.json must be present with valid serverUrl. Did you run 'gyo build' or 'gyo run'?", e)
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        permissionBridge.onRequestPermissionsResult(requestCode, permissions, grantResults)
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
        /** Where the app is served from: the one origin that may use the bridge and load in the WebView. */
        val origin: Uri,
        val userAgent: String? = null,
        val allowFileAccess: Boolean = false,
        val allowUniversalAccessFromFileURLs: Boolean = false
    ) {
        /** The origin as androidx.webkit spells an allowed-origin rule: `scheme://host[:port]`. */
        val originRule: String
            get() = buildString {
                append(origin.scheme).append("://").append(origin.host)
                if (origin.port != -1) {
                    append(':').append(origin.port)
                }
            }

        fun isSameOrigin(other: Uri): Boolean =
            other.scheme.equals(origin.scheme, ignoreCase = true) &&
                other.host.equals(origin.host, ignoreCase = true) &&
                other.effectivePort() == origin.effectivePort()

        private fun Uri.effectivePort(): Int =
            if (port != -1) port else if (scheme.equals("https", ignoreCase = true)) 443 else 80
    }

    companion object {
        private const val TAG = "MainActivity"

        /** The name `@gyo-framework/bridge` looks for on window. */
        private const val BRIDGE_OBJECT = "androidBridge"
    }
}
