package gyo.plugins.bridge

import org.json.JSONObject

/**
 * Builds the JavaScript that answers a bridge call.
 *
 * Callback ids, bridge names and error messages go through `JSONObject.quote`.
 * Interpolated raw, a quote, a backslash or a newline inside them would break
 * the statement, and the promise on the web side would then stay pending
 * until it times out.
 */
object BridgeScripts {
    fun resolve(callbackId: String, resultJson: String): String =
        "window.gyoBridge.resolve(${JSONObject.quote(callbackId)}, $resultJson);"

    fun reject(callbackId: String, error: String): String =
        "window.gyoBridge.reject(${JSONObject.quote(callbackId)}, ${JSONObject.quote(error)});"

    fun publish(bridgeName: String, dataJson: String): String =
        "window.gyoBridge.publish(${JSONObject.quote(bridgeName)}, $dataJson);"
}
