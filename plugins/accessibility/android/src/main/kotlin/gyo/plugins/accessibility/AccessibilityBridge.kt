package gyo.plugins.accessibility

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONObject

class AccessibilityBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-Accessibility"
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "is_enabled" -> isEnabled()
            "open_settings" -> openSettings()
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    private fun isEnabled(): JSONObject {
        return JSONObject().put("enabled", GyoAccessibilityService.instance != null)
    }

    /** Works before the service is enabled: that is when it is needed most. */
    private fun openSettings(): JSONObject {
        return try {
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
            JSONObject().put("opened", true)
        } catch (e: Exception) {
            Log.e(TAG, "open_settings: failed", e)
            JSONObject().put("opened", false).put("error", e.message)
        }
    }
}
