package gyo.plugins.bridge

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import org.json.JSONObject

class AndroidBridgeInterface(private val webView: WebView) {
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())

    @JavascriptInterface
    fun postMessage(message: String) {
        try {
            val request = JSONObject(message)
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

    private fun toJsonString(value: Any?): String {
        return when (value) {
            is Map<*, *> -> JSONObject(value as Map<String, Any?>).toString()
            is JSONObject -> value.toString()
            is String -> JSONObject.quote(value)
            is Number, is Boolean -> value.toString()
            null -> "null"
            else -> JSONObject.quote(value.toString())
        }
    }

    private fun resolveCallback(callbackId: String, result: Any?) {
        val resultJson = toJsonString(result)
        val escapedId = JSONObject.quote(callbackId)
        handler.post {
            val script = "window.gyoBridge.resolve($escapedId, $resultJson);"
            webView.evaluateJavascript(script, null)
        }
    }

    private fun rejectCallback(callbackId: String, error: String) {
        val errorJson = JSONObject.quote(error)
        val escapedId = JSONObject.quote(callbackId)
        handler.post {
            val script = "window.gyoBridge.reject($escapedId, $errorJson);"
            webView.evaluateJavascript(script, null)
        }
    }

    fun publish(bridgeName: String, data: Any?) {
        val dataJson = toJsonString(data)
        val escapedName = JSONObject.quote(bridgeName)
        handler.post {
            val script = "window.gyoBridge.publish($escapedName, $dataJson);"
            webView.evaluateJavascript(script, null)
        }
    }
}
