package gyo.plugins.app_launcher

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import androidx.core.content.FileProvider
import java.io.File

/**
 * Installs an APK with Android's installer. An app that is not in a store
 * brings its new version itself: the page has it downloaded into the cache
 * of the app (`@gyo-community/http`) and hands its path here.
 *
 * method "can_install_apk":
 *   returns  Boolean. Android 8 and later let the reader allow an app to
 *            install APKs, in the settings; before that any app could.
 * method "open_install_settings":
 *   returns  Boolean, whether the settings opened.
 * method "install_apk":
 *   data     { path: String }
 *   returns  Boolean, whether the installer was started. What the reader
 *            does there is not reported.
 *
 * The file is copied into `apk_install/` in the cache and handed to the
 * installer through the FileProvider of this module, which gives out that
 * folder and nothing else of the app. The app has to declare
 * `REQUEST_INSTALL_PACKAGES` for Android 8 and later to let it install.
 */
internal class ApkInstalls(private val context: Context) {

    fun canInstall(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

    fun openInstallSettings(): Boolean {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        } else {
            // Before Android 8 there is no permission to give: the security settings hold "unknown sources".
            Intent(Settings.ACTION_SECURITY_SETTINGS)
        }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)

        return try {
            context.startActivity(intent)
            true
        } catch (e: Exception) {
            Log.e(TAG, "Could not open the install settings", e)
            false
        }
    }

    fun install(path: String): Boolean {
        val source = File(path)
        if (!source.isFile) {
            throw IllegalArgumentException("No file at $path.")
        }
        val folder = File(context.cacheDir, DIRECTORY)
        // mkdirs answers false when a call running at the same time made it first.
        if (!folder.isDirectory && !folder.mkdirs() && !folder.isDirectory) {
            throw IllegalStateException("Could not create the folder ${folder.absolutePath}.")
        }
        val file = File(folder, source.name)
        source.copyTo(file, overwrite = true)

        val uri = FileProvider.getUriForFile(context, "${context.packageName}$AUTHORITY_SUFFIX", file)
        val intent = Intent(Intent.ACTION_VIEW).apply {
            setDataAndType(uri, "application/vnd.android.package-archive")
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }

        return try {
            context.startActivity(intent)
            Log.d(TAG, "Started the installer for ${file.name}")
            true
        } catch (e: Exception) {
            Log.e(TAG, "Could not start the installer for ${file.name}", e)
            false
        }
    }

    private companion object {
        const val TAG = "Gyo-AppLauncher"
        const val DIRECTORY = "apk_install"
        const val AUTHORITY_SUFFIX = ".gyo.app_launcher"
    }
}
