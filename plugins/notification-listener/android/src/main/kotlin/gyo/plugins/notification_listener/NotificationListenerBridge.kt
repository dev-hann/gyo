package gyo.plugins.notification_listener

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.StatusBarNotification
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONArray
import org.json.JSONObject

class NotificationListenerBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-NotificationListener"
        private const val DEFAULT_LIMIT = 50
        private const val MAX_LIMIT = 200
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "is_enabled" -> isEnabled()
            "get_notifications" -> getNotifications(data)
            "open_settings" -> openSettings()
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    private fun isEnabled(): JSONObject {
        return JSONObject().put("enabled", GyoNotificationListenerService.instance != null)
    }

    /** The newest first, at most `limit` of them; an empty list while access is not granted. */
    private fun getNotifications(data: JSONObject): JSONObject {
        val service = GyoNotificationListenerService.instance
        if (service == null) {
            Log.w(TAG, "get_notifications: notification access is not granted")
            return result(JSONArray())
        }

        val limit = data.optInt("limit", DEFAULT_LIMIT).coerceIn(1, MAX_LIMIT)
        val notifications = JSONArray()

        try {
            service.activeNotifications
                .sortedByDescending { it.postTime }
                .take(limit)
                .forEach { notifications.put(describe(it)) }
        } catch (e: Exception) {
            Log.e(TAG, "get_notifications: failed", e)
        }

        return result(notifications)
    }

    private fun describe(sbn: StatusBarNotification): JSONObject {
        val extras = sbn.notification.extras
        fun text(key: String): String = extras.getCharSequence(key, "")?.toString() ?: ""

        val bigText = text(Notification.EXTRA_BIG_TEXT)
        return JSONObject()
            .put("packageName", sbn.packageName)
            .put("title", text(Notification.EXTRA_TITLE))
            .put("text", if (bigText.isNotEmpty()) bigText else text(Notification.EXTRA_TEXT))
            .put("postTime", sbn.postTime)
            .put("category", sbn.notification.category ?: "")
            .put("id", sbn.id)
    }

    private fun result(notifications: JSONArray): JSONObject {
        return JSONObject()
            .put("notifications", notifications)
            .put("count", notifications.length())
    }

    /** Works before access is granted: that is when it is needed most. */
    private fun openSettings(): JSONObject {
        return try {
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
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
