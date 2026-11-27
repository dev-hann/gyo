package gyo.plugins.accessibility

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_BACK
import android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_HOME
import android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_NOTIFICATIONS
import android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_POWER_DIALOG
import android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_QUICK_SETTINGS
import android.accessibilityservice.AccessibilityService.GLOBAL_ACTION_RECENTS
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONObject

private const val TAG = "Gyo-ScreenAction"

/** Taps at (x, y) with a gesture, for `ScreenAction.tap()`. */
internal fun tap(data: JSONObject): Boolean {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "tap: accessibility service is not enabled")
        return false
    }

    val x = data.optDouble("x", -1.0).toFloat()
    val y = data.optDouble("y", -1.0).toFloat()
    if (x < 0 || y < 0) {
        Log.w(TAG, "tap: invalid coordinates ($x, $y)")
        return false
    }

    val path = Path().apply {
        moveTo(x, y)
    }

    val gesture = GestureDescription.Builder()
        .addStroke(GestureDescription.StrokeDescription(path, 0L, 50L))
        .build()

    return try {
        val result = BooleanArray(1)
        val callback = object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                result[0] = true
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                result[0] = false
            }
        }
        service.dispatchGesture(gesture, callback, null)
        Log.d(TAG, "tap dispatched at ($x, $y)")
        true
    } catch (e: Exception) {
        Log.e(TAG, "tap: failed", e)
        false
    }
}

/** Puts text in the focused input, for `ScreenAction.type()`. */
internal fun type(data: JSONObject): Boolean {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "type: accessibility service is not enabled")
        return false
    }

    val text = data.optString("text", "")
    if (text.isEmpty()) {
        Log.w(TAG, "type: text is empty")
        return false
    }

    val rootNode = service.rootInActiveWindow
    if (rootNode == null) {
        Log.w(TAG, "type: no active window")
        return false
    }

    val focusNode = findFocusNode(rootNode)
    if (focusNode != null) {
        val arguments = android.os.Bundle()
        arguments.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text)
        val result = focusNode.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, arguments)
        Log.d(TAG, "type: ACTION_SET_TEXT result=$result")
        return result
    }

    Log.w(TAG, "type: no focused node found")
    return false
}

private fun findFocusNode(node: AccessibilityNodeInfo): AccessibilityNodeInfo? {
    val focus = node.findFocus(AccessibilityNodeInfo.FOCUS_INPUT)
    return focus
}

/** Swipes from one point to another over a duration, for `ScreenAction.swipe()`. */
internal fun swipe(data: JSONObject): Boolean {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "swipe: accessibility service is not enabled")
        return false
    }

    val startX = data.optDouble("startX", -1.0).toFloat()
    val startY = data.optDouble("startY", -1.0).toFloat()
    val endX = data.optDouble("endX", -1.0).toFloat()
    val endY = data.optDouble("endY", -1.0).toFloat()
    val duration = data.optLong("duration", 300L)

    if (startX < 0 || startY < 0 || endX < 0 || endY < 0) {
        Log.w(TAG, "swipe: invalid coordinates")
        return false
    }

    val path = Path().apply {
        moveTo(startX, startY)
        lineTo(endX, endY)
    }

    val gesture = GestureDescription.Builder()
        .addStroke(
            GestureDescription.StrokeDescription(
                path, 0L, duration
            )
        )
        .build()

    return try {
        val callback = object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(gestureDescription: GestureDescription?) {
                Log.d(TAG, "swipe completed")
            }

            override fun onCancelled(gestureDescription: GestureDescription?) {
                Log.w(TAG, "swipe cancelled")
            }
        }
        service.dispatchGesture(gesture, callback, null)
        Log.d(TAG, "swipe dispatched from ($startX,$startY) to ($endX,$endY)")
        true
    } catch (e: Exception) {
        Log.e(TAG, "swipe: failed", e)
        false
    }
}

/** Performs a global action by the name `ScreenAction.globalAction()` takes. */
internal fun globalAction(data: JSONObject): Boolean {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "global: accessibility service is not enabled")
        return false
    }

    val action = data.optString("action", "").lowercase()
    val globalActionId = when (action) {
        "back" -> GLOBAL_ACTION_BACK
        "home" -> GLOBAL_ACTION_HOME
        "recents" -> GLOBAL_ACTION_RECENTS
        "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
        "quick_settings" -> GLOBAL_ACTION_QUICK_SETTINGS
        "power_dialog" -> GLOBAL_ACTION_POWER_DIALOG
        else -> {
            Log.w(TAG, "global: unknown action '$action'")
            return false
        }
    }

    val result = service.performGlobalAction(globalActionId)
    Log.d(TAG, "global: action='$action' result=$result")
    return result
}
