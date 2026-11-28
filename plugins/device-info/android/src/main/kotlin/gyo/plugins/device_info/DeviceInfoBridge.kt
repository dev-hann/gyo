package gyo.plugins.device_info

import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.os.BatteryManager
import android.os.Build
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONObject

class DeviceInfoBridge(private val context: Context) : BridgeHandler {

    companion object {
        private const val TAG = "Gyo-DeviceInfo"
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "get_info" -> getInfo()
            "get_package_info" -> getPackageInfo()
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    private fun getInfo(): JSONObject {
        val displayMetrics = getDisplayMetrics()
        val batteryInfo = getBatteryInfo()

        val info = JSONObject().apply {
            put("manufacturer", Build.MANUFACTURER ?: "Unknown")
            put("model", Build.MODEL ?: "Unknown")
            put("brand", Build.BRAND ?: "Unknown")
            put("device", Build.DEVICE ?: "Unknown")
            put("androidVersion", Build.VERSION.RELEASE ?: "Unknown")
            put("sdkVersion", Build.VERSION.SDK_INT)
            put("securityPatch", getSecurityPatch())
            put("screenDensity", displayMetrics.densityDpi)
            put("screenWidth", displayMetrics.widthPixels)
            put("screenHeight", displayMetrics.heightPixels)
            put("batteryLevel", batteryInfo.first)
            put("isCharging", batteryInfo.second)
        }

        return JSONObject().apply {
            put("info", info)
        }
    }

    /**
     * The app as Android installed it. `versionCode` is what an update is
     * decided on and `versionName` what people read; both are what the build
     * put in, as gyo wrote them from gyo.config.json.
     */
    private fun getPackageInfo(): JSONObject {
        val pm = context.packageManager
        @Suppress("DEPRECATION")
        val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(0))
        } else {
            pm.getPackageInfo(context.packageName, 0)
        }
        @Suppress("DEPRECATION")
        val versionCode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            info.longVersionCode
        } else {
            info.versionCode.toLong()
        }
        return JSONObject()
            .put("packageName", context.packageName)
            .put("appName", context.applicationInfo.loadLabel(pm).toString())
            .put("versionName", info.versionName ?: "")
            .put("versionCode", versionCode)
    }

    private fun getSecurityPatch(): String {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            Build.VERSION.SECURITY_PATCH ?: "Unknown"
        } else {
            "Unknown"
        }
    }

    private fun getDisplayMetrics(): DisplayMetrics {
        val metrics = DisplayMetrics()
        metrics.density = context.resources.displayMetrics.density
        metrics.densityDpi = context.resources.displayMetrics.densityDpi

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val windowManager = context.getSystemService(WindowManager::class.java)
            val bounds = windowManager.currentWindowMetrics.bounds
            metrics.widthPixels = bounds.width()
            metrics.heightPixels = bounds.height()
        } else {
            @Suppress("DEPRECATION")
            val display = (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay
            @Suppress("DEPRECATION")
            display.getRealMetrics(metrics)
        }

        return metrics
    }

    private fun getBatteryInfo(): Pair<Int, Boolean> {
        val bm = context.getSystemService(Context.BATTERY_SERVICE) as BatteryManager
        val level = bm.getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)

        val filter = IntentFilter(Intent.ACTION_BATTERY_CHANGED)
        val batteryStatus = context.registerReceiver(null, filter)

        val isCharging = batteryStatus?.let { status ->
            val chargeStatus = status.getIntExtra(BatteryManager.EXTRA_STATUS, -1)
            chargeStatus == BatteryManager.BATTERY_STATUS_CHARGING ||
                chargeStatus == BatteryManager.BATTERY_STATUS_FULL
        } ?: false

        return Pair(level, isCharging)
    }
}
