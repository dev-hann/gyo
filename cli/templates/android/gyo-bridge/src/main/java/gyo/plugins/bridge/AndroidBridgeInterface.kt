package gyo.plugins.bridge

import android.net.Uri
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.webkit.JavaScriptReplyProxy
import androidx.webkit.WebMessageCompat
import androidx.webkit.WebViewCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.Executors

/**
 * A handler's result or an event's payload as JSON, whatever the handler
 * returned. A collection becomes an array; anything else becomes a string.
 */
internal fun toJson(value: Any?): String = when (value) {
    is Map<*, *> -> JSONObject(value).toString()
    is JSONObject, is JSONArray -> value.toString()
    is Collection<*> -> JSONArray(value).toString()
    is String -> JSONObject.quote(value)
    is Number, is Boolean -> value.toString()
    null -> "null"
    else -> JSONObject.quote(value.toString())
}

/**
 * Android Bridge Interface for the gyo bridge system.
 * Routes messages to registered handlers via BridgeRegistry.
 *
 * Security: registered as a [WebViewCompat.WebMessageListener] for the
 * origin of the configured serverUrl only, so Android never injects it into
 * a frame of any other origin, third-party iframes included. A WebView
 * without that feature gets [MainFrameCheckedInterface] instead.
 */
class AndroidBridgeInterface(private val webView: WebView) : WebViewCompat.WebMessageListener {

    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    /** Handlers run off the main thread; a slow one must not hold up the others. */
    private val executor = Executors.newCachedThreadPool()

    // Android calls this only for frames whose origin matches the rule the
    // listener was registered with.
    override fun onPostMessage(
        view: WebView,
        message: WebMessageCompat,
        sourceOrigin: Uri,
        isMainFrame: Boolean,
        replyProxy: JavaScriptReplyProxy
    ) {
        val request = message.data ?: return
        dispatch(request)
    }

    /**
     * Parses and dispatches a bridge message, from any thread.
     */
    internal fun dispatch(message: String) {
        val request = try {
            JSONObject(message)
        } catch (e: Exception) {
            Log.e("AndroidBridge", "Error parsing bridge message", e)
            return
        }
        val bridgeName = request.getString("bridgeName")
        val methodName = request.getString("methodName")
        val callbackId = request.getString("callbackId")
        val data = request.optJSONObject("data") ?: JSONObject()

        Log.d("AndroidBridge", "Received: bridge=$bridgeName, method=$methodName")

        val bridgeHandler = BridgeRegistry.get(bridgeName)
        if (bridgeHandler == null) {
            rejectCallback(callbackId, "Bridge '$bridgeName' not found")
            return
        }

        executor.execute {
            try {
                if (!bridgeHandler.handleAsync(methodName, data, pendingCall(callbackId))) {
                    resolveCallback(callbackId, bridgeHandler.handle(methodName, data))
                }
            } catch (e: Exception) {
                Log.e("AndroidBridge", "Error handling $bridgeName.$methodName", e)
                rejectCallback(callbackId, e.message ?: "Unknown error")
            }
        }
    }

    private fun pendingCall(callbackId: String): PendingCall = object : PendingCall {
        override fun resolve(result: Any?) = resolveCallback(callbackId, result)

        override fun reject(message: String) = rejectCallback(callbackId, message)
    }

    /**
     * Resolve a promise on the web side
     */
    private fun resolveCallback(callbackId: String, result: Any?) {
        handler.post {
            webView.evaluateJavascript(BridgeScripts.resolve(callbackId, toJson(result)), null)
        }
    }

    /**
     * Reject a promise on the web side
     */
    private fun rejectCallback(callbackId: String, error: String) {
        handler.post {
            webView.evaluateJavascript(BridgeScripts.reject(callbackId, error), null)
        }
    }

    /**
     * Publish an event to web listeners
     */
    fun publish(bridgeName: String, data: Any?) {
        handler.post {
            webView.evaluateJavascript(BridgeScripts.publish(bridgeName, toJson(data)), null)
        }
    }
}

/**
 * For a WebView without WebMessageListener (older than version 83).
 * `addJavascriptInterface` injects the object into every frame, so the
 * origin of the main frame is checked instead; that cannot see a
 * third-party iframe, which is why this is only the fallback.
 */
class MainFrameCheckedInterface(
    private val bridge: AndroidBridgeInterface,
    private val webView: WebView,
    private val allowedHost: String
) {
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    @JavascriptInterface
    fun postMessage(message: String) {
        // webView.url must be read on the main thread
        handler.post {
            val currentHost = try {
                Uri.parse(webView.url ?: "").host
            } catch (e: Exception) {
                null
            }

            if (currentHost == null || !currentHost.equals(allowedHost, ignoreCase = true)) {
                Log.w(
                    "AndroidBridge",
                    "Rejected bridge call from unauthorized origin: '$currentHost' (allowed: '$allowedHost')"
                )
                return@post
            }

            bridge.dispatch(message)
        }
    }
}
