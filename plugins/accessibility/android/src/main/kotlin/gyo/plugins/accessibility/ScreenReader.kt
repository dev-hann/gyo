package gyo.plugins.accessibility

import android.graphics.Rect
import android.util.Log
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject

private const val TAG = "Gyo-ScreenReader"

/** What the active window holds, for `ScreenReader.read()`: no tree until the service is on and a window can be read. */
internal fun readScreen(): JSONObject {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "read: AccessibilityService not connected")
        return noReadResult()
    }

    val rootNode = service.rootInActiveWindow
    if (rootNode == null) {
        Log.w(TAG, "read: rootInActiveWindow is null")
        return noReadResult()
    }

    val packageName = rootNode.packageName?.toString() ?: ""
    val windowName = rootNode.window?.let { window ->
        window.title?.toString() ?: ""
    } ?: ""

    return JSONObject().apply {
        put("root", nodeToJson(rootNode))
        put("windowName", windowName)
        put("packageName", packageName)
    }
}

/** The nodes of the active window that hold the given text, for `ScreenReader.find()`. */
internal fun findNodes(data: JSONObject): JSONObject {
    val service = GyoAccessibilityService.instance
    if (service == null) {
        Log.w(TAG, "find: AccessibilityService not connected")
        return noNodes()
    }

    val query = data.optString("text", "")
    if (query.isEmpty()) {
        Log.w(TAG, "find: text is empty")
        return noNodes()
    }

    val rootNode = service.rootInActiveWindow
    if (rootNode == null) {
        Log.w(TAG, "find: rootInActiveWindow is null")
        return noNodes()
    }

    val foundNodes = rootNode.findAccessibilityNodeInfosByText(query)
    val resultArray = JSONArray()

    for (node in foundNodes) {
        resultArray.put(nodeToJson(node))
    }

    return JSONObject().apply {
        put("nodes", resultArray)
        put("count", resultArray.length())
    }
}

private fun nodeToJson(node: AccessibilityNodeInfo): JSONObject {
    val bounds = Rect()
    node.getBoundsInScreen(bounds)

    val childrenArray = JSONArray()
    val childCount = node.childCount
    for (i in 0 until childCount) {
        val child = node.getChild(i)
        if (child != null) {
            childrenArray.put(nodeToJson(child))
        }
    }

    return JSONObject().apply {
        put("text", node.text?.toString() ?: "")
        put("contentDescription", node.contentDescription?.toString() ?: "")
        put("className", node.className?.toString() ?: "")
        put("bounds", bounds.toShortString())
        put("isClickable", node.isClickable)
        put("isEditable", node.isEditable)
        put("children", childrenArray)
    }
}

private fun noReadResult(): JSONObject {
    return JSONObject().apply {
        put("root", JSONObject.NULL)
        put("windowName", "")
        put("packageName", "")
    }
}

private fun noNodes(): JSONObject {
    return JSONObject().apply {
        put("nodes", JSONArray())
        put("count", 0)
    }
}
