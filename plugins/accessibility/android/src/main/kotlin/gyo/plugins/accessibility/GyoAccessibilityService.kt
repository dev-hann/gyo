package gyo.plugins.accessibility

import android.accessibilityservice.AccessibilityService
import android.util.Log
import android.view.accessibility.AccessibilityEvent

/**
 * The one accessibility service the screen plugins read and act through.
 * It does nothing on its own: they ask for the active window when a call
 * comes in. It exists as long as the user keeps it enabled in the system
 * settings, which `Accessibility.openSettings()` leads to.
 */
class GyoAccessibilityService : AccessibilityService() {

    companion object {
        private const val TAG = "Gyo-Accessibility"

        /** The connected service, or null while the user has it disabled. */
        @Volatile
        var instance: GyoAccessibilityService? = null
            private set
    }

    override fun onServiceConnected() {
        instance = this
        Log.d(TAG, "Accessibility service connected")
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        // Nothing to do: the plugins poll the active window.
    }

    override fun onInterrupt() {
        Log.w(TAG, "Accessibility service interrupted")
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        instance = null
        return super.onUnbind(intent)
    }

    override fun onDestroy() {
        instance = null
        Log.d(TAG, "Accessibility service destroyed")
        super.onDestroy()
    }
}
