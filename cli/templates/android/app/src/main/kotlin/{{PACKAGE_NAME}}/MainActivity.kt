package {{PACKAGE_NAME}}

import android.content.Context
import android.annotation.SuppressLint
import android.app.Activity
import android.app.DownloadManager
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.util.Log
import android.view.View
import android.view.ViewGroup
import android.webkit.ConsoleMessage
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.URLUtil
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.ActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
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
    private lateinit var errorView: View
    private lateinit var errorTitle: TextView
    private lateinit var errorDetail: TextView
    private lateinit var retryButton: Button
    private lateinit var permissionBridge: PermissionBridge

    /** Null when gyo-config.json is missing or unreadable: nothing can be loaded then. */
    private var gyoConfig: GyoConfig? = null
    private var fullscreenView: View? = null
    private var fullscreenCallback: WebChromeClient.CustomViewCallback? = null

    /** True from a failed main-frame load until the next one starts. */
    private var loadFailed = false
    private var loadError = ""

    /** The page is waiting for the user to pick files. */
    private var fileChooserCallback: ValueCallback<Array<Uri>>? = null

    private val pickFiles =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = fileChooserCallback ?: return@registerForActivityResult
            fileChooserCallback = null
            callback.onReceiveValue(chosenUris(result))
        }

    /** Back closes full-screen video, then leaves the previous page, then the app. */
    private val backHandler = object : OnBackPressedCallback(true) {
        override fun handleOnBackPressed() {
            when {
                fullscreenView != null -> hideFullscreen()
                webView.canGoBack() -> webView.goBack()
                else -> {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = WebView(this)
        val content = FrameLayout(this)
        content.addView(
            webView,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
            )
        )
        content.addView(buildErrorView())
        setContentView(content)

        onBackPressedDispatcher.addCallback(this, backHandler)
        keepClearOfSystemBars(content)

        val config = loadGyoConfig()
        gyoConfig = config
        if (config == null) {
            // A shell without an address is what `gyo create` writes; only
            // `gyo run` and `gyo build` put the address in.
            showError(
                "This app has no server to load",
                "Run `gyo run` or `gyo build android` once; they write the server address into the app.",
                canRetry = false
            )
            return
        }

        setupWebView(config)
        loadApp(config)
    }

    /**
     * Android 15 and later draw the app edge to edge. Keep the content clear
     * of the system bars, the cutout and the keyboard; a page then scrolls
     * its inputs into what is left.
     */
    private fun keepClearOfSystemBars(content: View) {
        ViewCompat.setOnApplyWindowInsetsListener(content) { view, insets ->
            val covered = insets.getInsets(
                WindowInsetsCompat.Type.systemBars() or
                    WindowInsetsCompat.Type.displayCutout() or
                    WindowInsetsCompat.Type.ime()
            )
            view.setPadding(covered.left, covered.top, covered.right, covered.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }

    @Suppress("DEPRECATION") // allowUniversalAccessFromFileURLs is the setting gyo.config.json names
    private fun setupWebView(gyoConfig: GyoConfig) {
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
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

            override fun onPageStarted(view: WebView?, url: String?, favicon: Bitmap?) {
                super.onPageStarted(view, url, favicon)
                loadFailed = false
                hideError()
            }

            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                // Android also reports the end of a page that failed: keep
                // the explanation up instead of showing its error page.
                if (loadFailed) {
                    showError("Can't reach ${gyoConfig.origin.host}", loadError, canRetry = true)
                } else {
                    injectGyoRuntime()
                }
            }

            override fun onReceivedError(
                view: WebView?,
                request: WebResourceRequest?,
                error: WebResourceError?
            ) {
                // A failed picture is not a failed page: only the main frame matters.
                if (request?.isForMainFrame != true) {
                    return
                }
                Log.w(TAG, "Could not load ${request.url}: ${error?.description} (${error?.errorCode})")
                loadFailed = true
                loadError = describeLoadError(error?.errorCode)
                showError("Can't reach ${gyoConfig.origin.host}", loadError, canRetry = true)
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

            /** `<input type="file">`: without this the WebView ignores the tap. */
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                val callback = filePathCallback ?: return false
                // A second chooser answers the first one: no promise may stay open.
                fileChooserCallback?.onReceiveValue(null)
                fileChooserCallback = callback

                return try {
                    // The system picker asks for what the input accepts and
                    // allows several files when the input does. It needs no
                    // permission.
                    pickFiles.launch(fileChooserParams?.createIntent())
                    true
                } catch (e: Exception) {
                    Log.w(TAG, "Could not open a file picker: ${e.message}")
                    fileChooserCallback = null
                    callback.onReceiveValue(null)
                    false
                }
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

        // What the WebView cannot show itself it hands over as a download.
        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            download(url, userAgent, contentDisposition, mimeType)
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

    private fun loadApp(gyoConfig: GyoConfig) {
        webView.loadUrl(gyoConfig.serverUrl)
    }

    /**
     * Says why a load failed in the terms of someone running `gyo run`: the
     * usual cause is a dev server that is not up, or a device on another
     * network.
     */
    private fun describeLoadError(code: Int?): String = when (code) {
        WebViewClient.ERROR_HOST_LOOKUP -> "The server's address could not be found."
        WebViewClient.ERROR_CONNECT, WebViewClient.ERROR_TIMEOUT ->
            "The server did not answer in time."
        WebViewClient.ERROR_FAILED_SSL_HANDSHAKE -> "The server's certificate was not accepted."
        else -> "The server could not be reached."
    } + " Check that the server is running and that this device is on its network."

    /** Puts a file where the user finds it, without asking for a storage permission. */
    @Suppress("DEPRECATION") // the public Downloads folder is the right place on 29 and later
    private fun download(url: String, userAgent: String, contentDisposition: String, mimeType: String) {
        val request = DownloadManager.Request(Uri.parse(url))
            .setMimeType(mimeType)
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
        val fileName = URLUtil.guessFileName(url, contentDisposition, mimeType)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName)
        } else {
            request.setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, fileName)
        }

        try {
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
        } catch (e: Exception) {
            Log.w(TAG, "Could not download $url: ${e.message}")
        }
    }

    private fun chosenUris(result: ActivityResult): Array<Uri>? {
        val data = result.data
        if (result.resultCode != Activity.RESULT_OK || data == null) {
            return null
        }
        val chosen = data.clipData
        return when {
            chosen != null ->
                Array(chosen.itemCount) { index -> chosen.getItemAt(index).uri }
            else -> data.data?.let { arrayOf(it) }
        }
    }

    /** What the page shows when nothing can be loaded: an explanation and a way to retry. */
    private fun buildErrorView(): View {
        val padding = (24 * resources.displayMetrics.density).toInt()
        errorTitle = TextView(this).apply { textSize = 20f }
        errorDetail = TextView(this).apply { textSize = 15f }
        retryButton = Button(this).apply {
            text = "Retry"
            setOnClickListener { webView.reload() }
        }
        return LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, padding, padding, padding)
            addView(errorTitle)
            addView(errorDetail)
            addView(retryButton)
            visibility = View.GONE
            isClickable = true
        }.also { errorView = it }
    }

    private fun showError(title: String, detail: String, canRetry: Boolean) {
        if (!::errorTitle.isInitialized) {
            return
        }
        errorTitle.text = title
        errorDetail.text = detail
        retryButton.visibility = if (canRetry) View.VISIBLE else View.GONE
        errorView.visibility = View.VISIBLE
    }

    private fun hideError() {
        if (::errorView.isInitialized) {
            errorView.visibility = View.GONE
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

    /** Null when the app has no readable config: the caller says so on the screen. */
    private fun loadGyoConfig(): GyoConfig? {
        return try {
            val json = assets.open("gyo-config.json").bufferedReader().use { it.readText() }
            val jsonObject = JSONObject(json)
            val serverUrl = jsonObject.optString("serverUrl", "")

            val origin = Uri.parse(serverUrl)
            if (serverUrl.isEmpty() || origin.scheme.isNullOrBlank() || origin.host.isNullOrBlank()) {
                Log.e(TAG, "Invalid serverUrl in gyo-config.json: '$serverUrl'")
                return null
            }

            Log.i(TAG, "Loaded config - serverUrl: $serverUrl")
            val webview = jsonObject.optJSONObject("webview")
            val userAgent = webview
                ?.optString("userAgent")
                ?.trim()
                ?.takeIf { it.isNotEmpty() }

            GyoConfig(
                serverUrl = serverUrl,
                origin = origin,
                userAgent = userAgent,
                allowFileAccess = webview?.optBoolean("allowFileAccess", false) ?: false,
                allowUniversalAccessFromFileURLs =
                    webview?.optBoolean("allowUniversalAccessFromFileURLs", false) ?: false
            )
        } catch (e: Exception) {
            Log.e(TAG, "Failed to load gyo-config.json from assets: ${e.message}")
            null
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (::permissionBridge.isInitialized) {
            permissionBridge.onRequestPermissionsResult(requestCode, permissions, grantResults)
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
