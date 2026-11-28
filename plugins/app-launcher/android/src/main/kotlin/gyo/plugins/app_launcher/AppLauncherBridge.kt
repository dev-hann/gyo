package gyo.plugins.app_launcher

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import org.json.JSONArray
import org.json.JSONObject

class AppLauncherBridge(private val context: Context) : BridgeHandler {

    private val apkInstalls = ApkInstalls(context)

    companion object {
        private const val TAG = "Gyo-AppLauncher"
    }

    override fun handle(method: String, data: JSONObject): Any? {
        return when (method) {
            "list_apps" -> listApps()
            "open_app" -> openApp(data)
            "open_url" -> openUrl(data)
            "search_apps" -> searchApps(data)
            "can_install_apk" -> apkInstalls.canInstall()
            "open_install_settings" -> apkInstalls.openInstallSettings()
            "install_apk" -> apkInstalls.install(data.getString("path"))
            else -> {
                Log.w(TAG, "Unknown method: $method")
                null
            }
        }
    }

    /**
     * Every app with a launcher icon. The intent query is what Android 11
     * and later answer completely; the installed list catches the rest.
     */
    private fun getLaunchableApps(): List<Pair<String, String>> {
        val pm = context.packageManager
        val seen = mutableSetOf<String>()

        val launcher = Intent(Intent.ACTION_MAIN, null).addCategory(Intent.CATEGORY_LAUNCHER)
        val fromLauncherIntent = pm.queryIntentActivities(launcher, 0).mapNotNull { resolved ->
            val packageName = resolved.activityInfo.packageName
            if (seen.add(packageName)) resolved.loadLabel(pm).toString() to packageName else null
        }

        val fromInstalledList = pm.getInstalledApplications(0).mapNotNull { app ->
            if (pm.getLaunchIntentForPackage(app.packageName) != null && seen.add(app.packageName)) {
                app.loadLabel(pm).toString() to app.packageName
            } else {
                null
            }
        }

        return fromLauncherIntent + fromInstalledList
    }

    private fun listApps(): JSONObject {
        return listAppsWith { true }
    }

    private fun searchApps(data: JSONObject): JSONObject {
        val query = data.optString("query", "")
        return listAppsWith { (name, packageName) ->
            query.isEmpty() || name.lowercase().contains(query.lowercase()) ||
                packageName.lowercase().contains(query.lowercase())
        }
    }

    private fun listAppsWith(keep: (Pair<String, String>) -> Boolean): JSONObject {
        val apps = JSONArray()
        for ((name, packageName) in getLaunchableApps().filter(keep)) {
            apps.put(JSONObject().put("packageName", packageName).put("name", name))
        }
        return JSONObject().put("apps", apps).put("count", apps.length())
    }

    private fun openApp(data: JSONObject): Boolean {
        val packageName = data.optString("packageName", "")
        if (packageName.isEmpty()) {
            Log.w(TAG, "open_app: packageName is empty")
            return false
        }

        val intent = context.packageManager.getLaunchIntentForPackage(packageName)
        if (intent == null) {
            Log.w(TAG, "open_app: app not found - $packageName")
            return false
        }

        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return try {
            context.startActivity(intent)
            Log.d(TAG, "Opened app: $packageName")
            true
        } catch (e: Exception) {
            Log.e(TAG, "open_app: failed to open $packageName", e)
            false
        }
    }

    private fun openUrl(data: JSONObject): Boolean {
        val url = data.optString("url", "")
        if (url.isEmpty()) {
            Log.w(TAG, "open_url: url is empty")
            return false
        }

        val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        try {
            context.startActivity(intent)
            Log.d(TAG, "Opened URL: $url")
            return true
        } catch (e: Exception) {
            Log.e(TAG, "open_url: failed to open $url", e)
            return false
        }
    }

}
