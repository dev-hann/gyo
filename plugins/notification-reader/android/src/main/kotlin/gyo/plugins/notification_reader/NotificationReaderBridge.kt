package gyo.plugins.notification_reader

import android.app.Notification
import android.content.Context
import android.service.notification.StatusBarNotification
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import gyo.plugins.notification_listener.GyoNotificationListenerService
import org.json.JSONArray
import org.json.JSONObject

/** Reads the active notifications through the service `@gyo-framework/notification-listener` brings. */
@Suppress("UNUSED_PARAMETER")
class NotificationReaderBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-NotificationReader"
        private const val DEFAULT_LIMIT = 20
        private const val MAX_LIMIT = 200
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "list" -> listNotifications(data)
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    /** The newest first, at most `limit` of them; an empty list while notification access is not granted. */
    private fun listNotifications(data: JSONObject): JSONObject {
        val service = GyoNotificationListenerService.instance
        if (service == null) {
            Log.w(TAG, "list: notification access is not granted")
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
            Log.e(TAG, "list: failed", e)
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
}
