package gyo.plugins.notifications

import android.service.notification.NotificationListenerService
import android.util.Log

/**
 * The notification listener `NotificationListener` and `NotificationReader`
 * read through. It keeps nothing: they ask for the active notifications when a
 * call comes in. It is connected for as long as the user allows notification
 * access, which `NotificationListener.openSettings()` leads to.
 */
class GyoNotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "Gyo-NotificationListener"

        /** The connected listener, or null while the user has not allowed access. */
        @Volatile
        var instance: GyoNotificationListenerService? = null
            private set
    }

    override fun onListenerConnected() {
        instance = this
        Log.d(TAG, "Notification listener connected")
    }

    override fun onListenerDisconnected() {
        instance = null
        Log.d(TAG, "Notification listener disconnected")
    }
}
