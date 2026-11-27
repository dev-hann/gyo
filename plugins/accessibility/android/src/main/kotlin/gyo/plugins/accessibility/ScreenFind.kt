package gyo.plugins.accessibility

import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "Gyo-ScreenFind"

/** The elements of the active window that hold the given text, for `ScreenFind.findByText()`. */
internal fun findByText(data: JSONObject): JSONObject {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "findByText: AccessibilityService not available")
        return emptyResult()
    }

    val text = data.optString("text", "")
    val exact = data.optBoolean("exact", false)

    if (text.isEmpty()) {
        Log.w(TAG, "findByText: text is empty")
        return emptyResult()
    }

    val root = service.rootInActiveWindow
    if (root == null) {
        Log.w(TAG, "findByText: rootInActiveWindow is null")
        return emptyResult()
    }

    val nodes = root.findAccessibilityNodeInfosByText(text)
    val resultArray = JSONArray()

    for (node in nodes) {
        if (exact && node.text?.toString() != text) {
            continue
        }
        resultArray.put(nodeToElementInfo(node))
    }

    return JSONObject().apply {
        put("elements", resultArray)
        put("count", resultArray.length())
    }
}

/** The elements of the active window with the given view ID, for `ScreenFind.findById()`. */
internal fun findById(data: JSONObject): JSONObject {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "findById: AccessibilityService not available")
        return emptyResult()
    }

    val id = data.optString("id", "")
    if (id.isEmpty()) {
        Log.w(TAG, "findById: id is empty")
        return emptyResult()
    }

    val root = service.rootInActiveWindow
    if (root == null) {
        Log.w(TAG, "findById: rootInActiveWindow is null")
        return emptyResult()
    }

    val nodes = root.findAccessibilityNodeInfosByViewId(id)
    val resultArray = JSONArray()

    for (node in nodes) {
        resultArray.put(nodeToElementInfo(node))
    }

    return JSONObject().apply {
        put("elements", resultArray)
        put("count", resultArray.length())
    }
}

private fun nodeToElementInfo(node: AccessibilityNodeInfo): JSONObject {
    val bounds = Rect()
    node.getBoundsInScreen(bounds)

    return JSONObject().apply {
        put("text", node.text?.toString() ?: "")
        put("contentDescription", node.contentDescription?.toString() ?: "")
        put("className", node.className?.toString() ?: "")
        put("bounds", bounds.toShortString())
        put("isClickable", node.isClickable)
        put("isFocusable", node.isFocusable)
        put("isEditable", node.isEditable)
        put("centerX", bounds.centerX())
        put("centerY", bounds.centerY())
    }
}

private fun emptyResult(): JSONObject {
    return JSONObject().apply {
        put("elements", JSONArray())
        put("count", 0)
    }
}
