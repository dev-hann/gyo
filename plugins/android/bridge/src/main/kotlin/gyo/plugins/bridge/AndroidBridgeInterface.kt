package gyo.plugins.bridge

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

/**
 * Android Bridge Interface for gyo-bridge system
 * Routes messages to registered bridge handlers via BridgeRegistry
 */
class AndroidBridgeInterface(private val webView: WebView) {
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    /**
     * Main entry point from JavaScript
     * Routes requests to registered bridge handlers
     */
    @JavascriptInterface
    fun postMessage(message: String) {
        try {
            val request = JSONObject(message)
            val bridgeName = request.getString("bridgeName")
            val methodName = request.getString("methodName")
            val callbackId = request.getString("callbackId")
            val data = request.optJSONObject("data") ?: JSONObject()

            Log.d("AndroidBridge", "Received: bridge=$bridgeName, method=$methodName")

            // Get handler from registry
            val bridgeHandler = BridgeRegistry.get(bridgeName)
            if (bridgeHandler == null) {
                rejectCallback(callbackId, "Bridge '$bridgeName' not found")
                return
            }

            // Process in background thread
            Thread {
                try {
                    val result = bridgeHandler.handle(methodName, data)
                    resolveCallback(callbackId, result)
                } catch (e: Exception) {
                    Log.e("AndroidBridge", "Error handling $bridgeName.$methodName", e)
                    rejectCallback(callbackId, e.message ?: "Unknown error")
                }
            }.start()

        } catch (e: Exception) {
            Log.e("AndroidBridge", "Error parsing bridge message", e)
        }
    }

    /**
     * Resolve a promise on the web side
     */
    private fun resolveCallback(callbackId: String, result: Any?) {
        val resultJson = when (result) {
            is Map<*, *> -> JSONObject(result as Map<String, Any?>).toString()
            is JSONObject -> result.toString()
            is String -> JSONObject.quote(result)
            is Number, is Boolean -> result.toString()
            null -> "null"
            else -> JSONObject.quote(result.toString())
        }

        handler.post {
            val script = "window.gyoBridge.resolve('$callbackId', $resultJson);"
            webView.evaluateJavascript(script, null)
        }
    }

    /**
     * Reject a promise on the web side
     */
    private fun rejectCallback(callbackId: String, error: String) {
        val escapedError = error.replace("'", "\\'")
        handler.post {
            val script = "window.gyoBridge.reject('$callbackId', '$escapedError');"
            webView.evaluateJavascript(script, null)
        }
    }

    /**
     * Publish an event to web listeners
     */
    fun publish(bridgeName: String, data: Any?) {
        val dataJson = when (data) {
            is Map<*, *> -> JSONObject(data as Map<String, Any?>).toString()
            is JSONObject -> data.toString()
            is String -> JSONObject.quote(data)
            is Number, is Boolean -> data.toString()
            null -> "null"
            else -> JSONObject.quote(data.toString())
        }

        handler.post {
            val script = "window.gyoBridge.publish('$bridgeName', $dataJson);"
            webView.evaluateJavascript(script, null)
        }
    }
}
