package gyo.plugins.bridge

import android.app.Activity
import android.content.pm.PackageManager
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * The one handler every app has: asks the user for run-time permissions on
 * behalf of the web layer.
 *
 * Only permissions the app declares in its manifest can be granted; for any
 * other the system denies the request without prompting, so the manifest is
 * the list of what the web layer may ask for.
 */
class PermissionBridge(private val activity: Activity) : BridgeHandler {

    private data class Request(val call: PendingCall, val permissions: List<String>)

    /** Request codes live in the lower 16 bits of the activity result. */
    private val nextRequestCode = AtomicInteger(1)
    private val requests = ConcurrentHashMap<Int, Request>()

    override fun handle(method: String, data: JSONObject): Any? = null

    override fun handleAsync(method: String, data: JSONObject, call: PendingCall): Boolean {
        if (method != "request") {
            return false
        }

        val permissions = data.optJSONArray("permissions")?.let { array ->
            (0 until array.length()).map { array.getString(it) }
        } ?: emptyList()
        val malformed = permissions.filter { !PERMISSION.matches(it) }
        if (malformed.isNotEmpty()) {
            call.reject("Not Android permissions: ${malformed.joinToString()}")
            return true
        }

        val granted = permissions.filter {
            ContextCompat.checkSelfPermission(activity, it) == PackageManager.PERMISSION_GRANTED
        }
        val toAsk = permissions.filter { it !in granted }
        if (toAsk.isEmpty()) {
            call.resolve(result(granted, emptyList()))
            return true
        }

        val requestCode = nextRequestCode.getAndIncrement() and 0xFFFF
        requests[requestCode] = Request(call, permissions)
        Log.d(TAG, "Asking the user for $toAsk")
        ActivityCompat.requestPermissions(activity, toAsk.toTypedArray(), requestCode)
        return true
    }

    /**
     * The app's activity forwards its `onRequestPermissionsResult` here.
     */
    fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        val request = requests.remove(requestCode) ?: return

        val granted = permissions.filterIndexed { index, _ ->
            index < grantResults.size && grantResults[index] == PackageManager.PERMISSION_GRANTED
        }
        request.call.resolve(result(granted, permissions.filter { it !in granted }))
    }

    private fun result(granted: List<String>, denied: List<String>): JSONObject = JSONObject()
        .put("granted", JSONArray(granted))
        .put("denied", JSONArray(denied))

    companion object {
        const val NAME = "permissions"
        private const val TAG = "GyoPermissions"
        private val PERMISSION = Regex("android\\.permission\\.[A-Z_]+")
    }
}
