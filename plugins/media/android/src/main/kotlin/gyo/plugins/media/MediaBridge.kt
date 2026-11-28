package gyo.plugins.media

import android.content.ActivityNotFoundException
import android.content.ClipData
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.MediaScannerConnection
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.util.Log
import androidx.annotation.RequiresApi
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider.getUriForFile
import gyo.plugins.bridge.BridgeHandler
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.CompletableFuture
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Saves and shares media for the web layer, which cannot do either from a
 * WebView: a page cannot read the bytes of the image it shows, the Web Share
 * API does not exist there, and the shell's download handling only takes
 * what the WebView cannot show.
 *
 * A failure of the request is answered as a value, never as an exception:
 * the bridge rejects with a message only, which cannot carry the kind.
 *
 * method "save_to_gallery":
 *   data     { url: String, mimeType?: String?, filename?: String, userAgent?: String, folder?: String }
 *   returns  { status: "saved", uri: String, mimeType: String }
 *            or { status: "failed", error: { kind: String, message: String } }
 * method "share":
 *   data     the same, or { text: String }
 *   returns  { status: "shared" }, once the chooser is open, or the same failure
 *
 * A download is written to a file of the cache first. A save copies that
 * file into the media store and deletes it; a share keeps it, for the app
 * the user picks to read.
 */
class MediaBridge(context: Context) : BridgeHandler {

    // The handler stays registered for the life of the process. Holding the
    // activity it was given would keep that one alive for as long.
    private val appContext = context.applicationContext
    private val mainHandler = Handler(Looper.getMainLooper())

    /**
     * Takes the media store one save at a time. Two pending files of one
     * name, inserted at once, come back as one row: every save answers
     * "saved" and all but one of the files is lost.
     */
    private val mediaStoreLock = Any()

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    override fun handle(method: String, data: JSONObject): Any? {
        val result = try {
            when (method) {
                "save_to_gallery" -> save(data)
                "share" -> share(data)
                else -> throw IllegalArgumentException("Unknown method: $method")
            }
        } catch (e: Rejected) {
            Log.w(TAG, "$method: ${e.failure.kind}: ${e.reason}")
            e.toJson()
        }
        if (result.optString("status") != "failed") {
            Log.i(TAG, "$method: $result")
        }
        return result
    }

    private fun save(data: JSONObject): JSONObject = download(data, STAGING_DIRECTORY) { staged ->
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                saveThroughMediaStore(staged)
            } else {
                saveToPublicDirectory(staged)
            }
        } finally {
            staged.file.delete()
        }
    }

    /** A text is shared in place of whatever else the request names. */
    private fun share(data: JSONObject): JSONObject {
        data.text("text")?.let { return openChooser(shareText(it)) }
        return download(data, SHARE_DIRECTORY) { staged -> openChooser(shareFile(staged)) }
    }

    /**
     * GETs the url, writes what arrived to a new file in the cache folder
     * and hands it to `use`. The file is deleted when `use` fails; what
     * becomes of it otherwise is up to `use`. Nothing is kept in memory:
     * the body is streamed to the file.
     */
    private fun download(data: JSONObject, folder: String, use: (Staged) -> JSONObject): JSONObject {
        val url = data.text("url")
            ?: throw Rejected(Failure.UNSUPPORTED, "The request has no url.")
        val request = try {
            Request.Builder()
                .url(url)
                .header("User-Agent", data.text("userAgent") ?: USER_AGENT)
                .build()
        } catch (e: IllegalArgumentException) {
            // What OkHttp says about an address that is not http or https, or a header it cannot send.
            throw Rejected(Failure.UNSUPPORTED, "\"$url\" cannot be downloaded from: ${e.describe()}")
        }
        val response = try {
            client.newCall(request).execute()
        } catch (e: IOException) {
            throw Rejected(Failure.NETWORK, "Could not download $url: ${e.describe()}")
        }

        val downloaded = response.use { downloaded(response, url, data, folder) }
        return try {
            use(downloaded)
        } catch (e: Exception) {
            runCatching { downloaded.file.delete() }
            throw e
        }
    }

    private fun downloaded(response: Response, url: String, data: JSONObject, folder: String): Staged {
        if (!response.isSuccessful) {
            throw Rejected(Failure.NETWORK, "The server answered ${response.code} to $url.")
        }
        val body = response.body
            ?: throw Rejected(Failure.NETWORK, "The server sent no body for $url.")
        val mimeType = mimeTypeFor(data.text("mimeType"), body.contentType(), response.request.url)
        if (mimeType == "text/html") {
            // A web page in place of a file is what a site answers to a client it does not accept.
            throw Rejected(
                Failure.UNSUPPORTED,
                "The server sent a web page for $url, not a file. Send the page's own user agent as userAgent, " +
                    "or look at the address in a browser."
            )
        }
        val directory = ensureDirectory(File(appContext.cacheDir, folder))
        releaseOldFiles(directory)

        val name = filenameFor(data.text("filename"), response.request.url, mimeType)
        val target = newFile(directory, name)
        try {
            target.outputStream().use { out -> write(body.byteStream(), out, url) }
        } catch (e: Exception) {
            runCatching { target.delete() }
            throw e.toFailure("write ${target.absolutePath}")
        }
        return Staged(target, mimeType, safeFolder(data.text("folder")))
    }

    /**
     * Stores the file through MediaStore, which needs no permission from
     * Android 10 on. The entry stays pending until the last byte is
     * written, so that the gallery never lists half a file.
     */
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun saveThroughMediaStore(staged: Staged): JSONObject = synchronized(mediaStoreLock) {
        val resolver = appContext.contentResolver
        val name = staged.file.name
        val folder = listOf(directoryOf(staged.mimeType), staged.folder)
            .filter { it.isNotEmpty() }
            .joinToString("/")
        val entry = ContentValues().apply {
            put(MediaStore.MediaColumns.DISPLAY_NAME, name)
            put(MediaStore.MediaColumns.MIME_TYPE, staged.mimeType)
            put(MediaStore.MediaColumns.RELATIVE_PATH, folder)
            put(MediaStore.MediaColumns.IS_PENDING, 1)
        }
        val uri = try {
            resolver.insert(collectionOf(staged.mimeType), entry)
        } catch (e: IllegalArgumentException) {
            // The media store says what it refuses: a folder it does not allow, a type that does not fit the collection.
            throw Rejected(
                Failure.UNSUPPORTED,
                "The system does not store a file of type ${staged.mimeType} in $folder: ${e.describe()}"
            )
        } ?: throw Rejected(Failure.STORAGE, "The media store took no entry for $folder.")

        try {
            resolver.openOutputStream(uri)?.use { out -> staged.file.inputStream().use { it.copyTo(out) } }
                ?: throw IOException("the media store did not open the entry for writing")
            val published = ContentValues().apply { put(MediaStore.MediaColumns.IS_PENDING, 0) }
            // No row answered: the entry is gone, and with it the file.
            if (resolver.update(uri, published, null, null) != 1) {
                throw Rejected(Failure.UNSUPPORTED, "The system did not keep $name as ${staged.mimeType}.")
            }
        } catch (e: Exception) {
            runCatching { resolver.delete(uri, null, null) }
            throw e.toFailure("write $name into $folder")
        }
        savedJson(uri.toString(), staged.mimeType)
    }

    /**
     * Stores the file in the public folder the gallery reads, the way of
     * Android before 10. It takes a permission the app declares for up to
     * Android 9 and the page asks the user for.
     */
    @Suppress("DEPRECATION") // before Android 10 the public folder is where the gallery looks
    private fun saveToPublicDirectory(staged: Staged): JSONObject {
        val permission = "android.permission.WRITE_EXTERNAL_STORAGE"
        if (ContextCompat.checkSelfPermission(appContext, permission) != PackageManager.PERMISSION_GRANTED) {
            throw Rejected(
                Failure.PERMISSION,
                "Saving needs $permission on this Android version. The app declares it in " +
                    "android/app/src/main/AndroidManifest.xml with android:maxSdkVersion=\"28\"; ask the user for it " +
                    "with requestPermissions() of @gyo-framework/bridge, then save again."
            )
        }
        var directory: File = Environment.getExternalStoragePublicDirectory(directoryOf(staged.mimeType))
        for (part in staged.folder.split('/').filter { it.isNotEmpty() }) {
            directory = File(directory, part)
        }
        ensureDirectory(directory)

        val target = newFile(directory, staged.file.name)
        try {
            // `target` is the empty file newFile just made; nothing of another save is overwritten.
            staged.file.copyTo(target, overwrite = true)
        } catch (e: Exception) {
            runCatching { target.delete() }
            throw e.toFailure("write ${target.absolutePath}")
        }
        return savedJson(indexedByScanner(target, staged.mimeType), staged.mimeType)
    }

    /**
     * Has the media scanner index the file, which is what makes the gallery
     * list it, and answers the uri the scan gives it. The scan answers on a
     * thread of its own, and may stay out: the file's own uri stands in then.
     */
    private fun indexedByScanner(target: File, mimeType: String): String {
        val scanned = CompletableFuture<Uri?>()
        MediaScannerConnection.scanFile(
            appContext,
            arrayOf(target.absolutePath),
            arrayOf(mimeType)
        ) { _, uri -> scanned.complete(uri) }
        val uri = runCatching { scanned.get(SCANNER_WAIT_SECONDS, TimeUnit.SECONDS) }.getOrNull()
        return uri?.toString() ?: Uri.fromFile(target).toString()
    }

    /** What offers the staged file, from the folder the module's share provider grants, and nothing else. */
    private fun shareFile(staged: Staged): Intent {
        val uri = getUriForFile(appContext, appContext.packageName + SHARE_AUTHORITY_SUFFIX, staged.file)
        // The grant follows the clip too: the chooser passes the file on to the app the user picks.
        return Intent(Intent.ACTION_SEND)
            .setType(staged.mimeType)
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
            .apply { clipData = ClipData.newUri(appContext.contentResolver, staged.file.name, uri) }
    }

    private fun shareText(text: String): Intent =
        Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)

    /** Deletes the files older than a day in the folder, so that it does not grow without end. */
    private fun releaseOldFiles(directory: File) {
        val before = System.currentTimeMillis() - KEEP_MILLIS
        directory.listFiles()
            ?.filter { it.isFile && it.lastModified() < before }
            ?.forEach { it.delete() }
    }

    /** The folder, made when it is missing. `mkdirs` answers false when a call running at the same time made it first. */
    private fun ensureDirectory(directory: File): File {
        if (!directory.isDirectory && !directory.mkdirs() && !directory.isDirectory) {
            throw Rejected(Failure.STORAGE, "Could not create the folder ${directory.absolutePath}.")
        }
        return directory
    }

    /**
     * Opens the system chooser on the main thread, where an activity
     * starts, and answers once it is open. What the user does in the
     * chooser is not reported.
     */
    private fun openChooser(send: Intent): JSONObject {
        var refusal: Rejected? = null
        onMainThread {
            try {
                val chooser = Intent.createChooser(send, null).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                appContext.startActivity(chooser)
            } catch (e: ActivityNotFoundException) {
                refusal = Rejected(
                    Failure.UNSUPPORTED,
                    "No app on this device takes what is shared, as ${send.type}."
                )
            }
        }
        refusal?.let { throw it }
        return sharedJson()
    }

    /** Runs `block` on the main thread and waits for it: an activity starts there, or fails to there. */
    private fun onMainThread(block: () -> Unit) {
        if (Looper.myLooper() == Looper.getMainLooper()) {
            block()
            return
        }
        val done = CountDownLatch(1)
        mainHandler.post {
            try {
                block()
            } finally {
                done.countDown()
            }
        }
        // The bridge gives handlers threads of their own, so this one may wait.
        check(done.await(MAIN_THREAD_WAIT_SECONDS, TimeUnit.SECONDS)) {
            "The main thread did not get to run within $MAIN_THREAD_WAIT_SECONDS seconds"
        }
    }

    /**
     * Writes what the server sends. A read that fails is a failure of the
     * download, a write that fails one of the storage. Nothing at all is
     * nothing to store: the server sent no file.
     */
    private fun write(body: InputStream, out: OutputStream, url: String) {
        val buffer = ByteArray(BUFFER_BYTES)
        var written = 0L
        while (true) {
            val read = try {
                body.read(buffer)
            } catch (e: IOException) {
                throw Rejected(Failure.NETWORK, "The download of $url broke off: ${e.describe()}")
            }
            if (read == -1) {
                break
            }
            try {
                out.write(buffer, 0, read)
            } catch (e: IOException) {
                throw Rejected(Failure.STORAGE, "Could not write the file: ${e.describe()}")
            }
            written += read
        }
        if (written == 0L) {
            throw Rejected(Failure.NETWORK, "The server sent an empty body for $url.")
        }
    }

    /** The system folder for a file of this type. */
    private fun directoryOf(mimeType: String): String = when {
        mimeType.startsWith("image/") -> Environment.DIRECTORY_PICTURES
        mimeType.startsWith("video/") -> Environment.DIRECTORY_MOVIES
        else -> Environment.DIRECTORY_DOWNLOADS
    }

    /** The collection the media store keeps a file of this type in. */
    @RequiresApi(Build.VERSION_CODES.Q)
    private fun collectionOf(mimeType: String): Uri = when {
        mimeType.startsWith("image/") -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
        mimeType.startsWith("video/") -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
        else -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
    }

    /** A request that already says why it failed stays as it is; any other failure of writing is one of the storage. */
    private fun Exception.toFailure(doing: String): Rejected =
        this as? Rejected ?: Rejected(Failure.STORAGE, "Could not $doing: ${describe()}")

    /** A download written to a file of the cache, and the folder asked for it. */
    private class Staged(val file: File, val mimeType: String, val folder: String)

    private companion object {
        const val TAG = "MediaBridge"

        // Sites block a client they do not recognise; the page sends its own agent where that is not enough.
        const val USER_AGENT =
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/131.0.0.0 Safari/537.36"

        /** The suffix of the authority the module's manifest gives its share provider, after the application id. */
        const val SHARE_AUTHORITY_SUFFIX = ".gyo.media"

        /** Where a share keeps its file, for the app the user picks; where a save keeps it while it is stored. */
        const val SHARE_DIRECTORY = "share"
        const val STAGING_DIRECTORY = "save"

        const val KEEP_MILLIS = 24 * 60 * 60 * 1000L
        const val SCANNER_WAIT_SECONDS = 10L
        const val MAIN_THREAD_WAIT_SECONDS = 10L
        const val BUFFER_BYTES = 16 * 1024
    }
}
