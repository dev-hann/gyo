package {{PACKAGE_NAME}}.gyo

import android.util.Log
import org.json.JSONArray
import org.json.JSONObject

/**
 * Console Bridge Handler - handles console logs from web
 */
class ConsoleBridgeHandler : BridgeHandler {
    override fun handle(method: String, data: JSONObject): Any? {
        when (method) {
            "log" -> {
                val level = data.optString("level", "log")
                val args = data.optJSONArray("args") ?: JSONArray()
                val timestamp = data.optLong("timestamp", System.currentTimeMillis())
                
                val message = formatConsoleMessage(args)
                val tag = "WebConsole"
                
                when (level) {
                    "error" -> Log.e(tag, message)
                    "warn" -> Log.w(tag, message)
                    "info" -> Log.i(tag, message)
                    "debug" -> Log.d(tag, message)
                    else -> Log.d(tag, message)
                }
                
                return mapOf("success" to true)
            }
            else -> throw IllegalArgumentException("Unknown console method: $method")
        }
    }
    
    private fun formatConsoleMessage(args: JSONArray): String {
        val parts = mutableListOf<String>()
        for (i in 0 until args.length()) {
            val arg = args.get(i)
            parts.add(formatArg(arg))
        }
        return parts.joinToString(" ")
    }
    
    private fun formatArg(arg: Any?): String {
        return when (arg) {
            is JSONObject -> {
                if (arg.has("__type")) {
                    when (arg.getString("__type")) {
                        "Error" -> "${arg.optString("name")}: ${arg.optString("message")}"
                        "Date" -> arg.optString("value")
                        else -> arg.toString()
                    }
                } else {
                    arg.toString()
                }
            }
            is JSONArray -> arg.toString()
            null -> "null"
            else -> arg.toString()
        }
    }
}
