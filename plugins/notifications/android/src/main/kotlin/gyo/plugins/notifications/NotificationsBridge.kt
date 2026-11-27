package gyo.plugins.notifications

import android.app.Notification
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.service.notification.StatusBarNotification
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONArray
import org.json.JSONObject

/**
 * Answers `NotificationListener` and `NotificationReader`. Both read the active
 * notifications through `GyoNotificationListenerService`, which this module
 * declares.
 */
class NotificationsBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-Notifications"
        private const val MAX_LIMIT = 200

        /** How many notifications a method reads when the web side names no limit. */
        private const val GET_NOTIFICATIONS_DEFAULT_LIMIT = 50
        private const val LIST_DEFAULT_LIMIT = 20
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "is_enabled" -> isEnabled()
            "get_notifications" -> activeNotifications(method, data, GET_NOTIFICATIONS_DEFAULT_LIMIT)
            "open_settings" -> openSettings()
            "list" -> activeNotifications(method, data, LIST_DEFAULT_LIMIT)
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    private fun isEnabled(): JSONObject {
        return JSONObject().put("enabled", GyoNotificationListenerService.instance != null)
    }

    /** The newest first, at most `limit` of them; an empty list while notification access is not granted. */
    private fun activeNotifications(method: String, data: JSONObject, defaultLimit: Int): JSONObject {
        val service = GyoNotificationListenerService.instance
        if (service == null) {
            Log.w(TAG, "$method: notification access is not granted")
            return result(JSONArray())
        }

        val limit = data.optInt("limit", defaultLimit).coerceIn(1, MAX_LIMIT)
        val notifications = JSONArray()

        try {
            service.activeNotifications
                .sortedByDescending { it.postTime }
                .take(limit)
                .forEach { notifications.put(describe(it)) }
        } catch (e: Exception) {
            Log.e(TAG, "$method: failed", e)
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
