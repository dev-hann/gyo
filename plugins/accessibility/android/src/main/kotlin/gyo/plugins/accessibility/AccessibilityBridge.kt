package gyo.plugins.accessibility

import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONObject

/**
 * The one handler of the package, behind the `accessibility` bridge. It answers
 * the calls of `Accessibility`, `ScreenReader`, `ScreenAction` and `ScreenFind`
 * alike. Everything that needs the screen runs on [GyoAccessibilityService],
 * which does nothing until the user enables it in the system settings.
 */
class AccessibilityBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-Accessibility"
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "is_enabled" -> isEnabled()
            "open_settings" -> openSettings()
            "read" -> readScreen()
            "find" -> findNodes(data)
            "find_by_text" -> findByText(data)
            "find_by_id" -> findById(data)
            "tap" -> tap(data)
            "type" -> type(data)
            "swipe" -> swipe(data)
            "global" -> globalAction(data)
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
