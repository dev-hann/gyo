package gyo.plugins.http

import android.content.Context
import android.util.Log
import okhttp3.Call
import okhttp3.HttpUrl
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicLong

/** What the page is told as it is: why the server, or the storage, gave nothing. */
internal class Refused(message: String) : IOException(message)

/** A download while it runs: what to cancel, and whether the page asked for that. */
internal class RunningDownload(val call: Call) {
    val cancelled = AtomicBoolean(false)
    val lastProgressAt = AtomicLong(0L)
}

/**
 * Downloads to a file, for the web layer. The WebView could not keep what
 * it fetched itself: what the page needs is a path that another app, the
 * package installer for one, can open. Nothing is held in memory: the body
 * is streamed to the file.
 *
 * method "download":
 *   data     { url: String, headers?: Map<String, String>, fileName?: String, downloadId: String }
 *   returns  { path: String, bytesWritten: Int, status: Int, url: String, headers: JSONObject }
 *
 * The file is written to `downloads/` in the cache of the app, a private
 * place that needs no permission; the files older than a day there are
 * deleted. While the download runs, the event `{ type: "progress",
 * downloadId, bytesWritten, totalBytes }` is published for the page, at
 * most every 250 ms. A status other than 2xx fails the download and keeps
 * no file.
 *
 * method "cancel_download":
 *   data     { downloadId: String }
 */
internal class Downloads(context: Context, private val client: OkHttpClient) {

    private val appContext = context.applicationContext ?: context
    private val running = ConcurrentHashMap<String, RunningDownload>()

    /** The way to the page the handler was given, or null while no WebView serves the bridge. */
    @Volatile
    var events: ((data: Any?) -> Unit)? = null

    fun download(data: JSONObject): JSONObject {
        val downloadId = data.getString("downloadId")
        val url = data.getString("url")
        val builder = Request.Builder().url(url).get()
        data.optJSONObject("headers")?.let { headers ->
            headers.keys().forEach { builder.header(it, headers.getString(it)) }
        }

        val download = RunningDownload(client.newCall(builder.build()))
        running[downloadId] = download
        try {
            download.call.execute().use { response ->
                val file = save(response, data, downloadId, download)
                return result(response, file)
            }
        } catch (e: Exception) {
            throw refused(e, download, url)
        } finally {
            running.remove(downloadId)
        }
    }

    /** Ends the download: the call is cut off, and `download` fails as one the page cancelled. */
    fun cancel(downloadId: String) {
        val download = running[downloadId] ?: return
        download.cancelled.set(true)
        download.call.cancel()
    }

    private fun save(response: Response, data: JSONObject, downloadId: String, download: RunningDownload): File {
        if (!response.isSuccessful) {
            throw Refused("The server answered ${response.code} to ${response.request.url}.")
        }
        val body = response.body
            ?: throw Refused("The server sent no body for ${response.request.url}.")

        val directory = ensureDirectory(File(appContext.cacheDir, DIRECTORY))
        releaseOldFiles(directory)
        val target = File(directory, fileNameFor(data.optString("fileName"), response.request.url, downloadId))
        try {
            target.outputStream().use { out -> write(body.byteStream(), out, body.contentLength(), downloadId, download) }
        } catch (e: Exception) {
            // A file that is not whole is worth nothing: not to the page, nor to the next download.
            target.delete()
            throw e
        }
        Log.d(TAG, "${response.code} ${response.request.url} -> ${target.name}, ${target.length()} bytes")
        return target
    }

    private fun result(response: Response, file: File): JSONObject {
        val headers = JSONObject()
        response.headers.names().filter { it.lowercase() != "set-cookie" }.forEach { name ->
            headers.put(name.lowercase(), response.headers.values(name).joinToString(", "))
        }
        return JSONObject()
            .put("path", file.absolutePath)
            .put("bytesWritten", file.length())
            .put("status", response.code)
            .put("url", response.request.url.toString())
            .put("headers", headers)
    }

    /** What the page is told: that it cancelled, why the server refused, or else that the download failed. */
    private fun refused(e: Exception, download: RunningDownload, url: String): Exception {
        if (download.cancelled.get()) return IllegalStateException("Download cancelled")
        if (e is Refused) return e
        return Refused("Could not download $url: ${e.message ?: e.javaClass.simpleName}")
    }

    private fun write(input: InputStream, out: OutputStream, totalBytes: Long, downloadId: String, download: RunningDownload) {
        val buffer = ByteArray(BUFFER_SIZE)
        var written = 0L
        publishProgress(downloadId, download, written, totalBytes)
        while (true) {
            val read = input.read(buffer)
            if (read == -1) break
            out.write(buffer, 0, read)
            written += read
            publishProgress(downloadId, download, written, totalBytes)
        }
        out.flush()
        // The last event says how much there is, whatever the interval allowed just before.
        publishProgress(downloadId, download, written, totalBytes, force = true)
    }

    /** Tells the page how far the download is. Not for every chunk: a page redrawn that often would scroll badly. */
    private fun publishProgress(downloadId: String, download: RunningDownload, bytesWritten: Long, totalBytes: Long, force: Boolean = false) {
        val now = System.currentTimeMillis()
        if (!force && now - download.lastProgressAt.get() < PROGRESS_INTERVAL_MS) return
        download.lastProgressAt.set(now)
        events?.invoke(
            JSONObject()
                .put("type", "progress")
                .put("downloadId", downloadId)
                .put("bytesWritten", bytesWritten)
                .put("totalBytes", totalBytes)
        )
    }

    /** Deletes the files older than a day in the folder, so that it does not grow without end. */
    private fun releaseOldFiles(directory: File) {
        val before = System.currentTimeMillis() - KEEP_MILLIS
        directory.listFiles()
            ?.filter { it.isFile && it.lastModified() < before }
            ?.forEach { it.delete() }
    }

    /** The folder, made when it is missing. `mkdirs` answers false when a download running at the same time made it first. */
    private fun ensureDirectory(directory: File): File {
        if (!directory.isDirectory && !directory.mkdirs() && !directory.isDirectory) {
            throw Refused("Could not create the folder ${directory.absolutePath}.")
        }
        return directory
    }

    /** The name the page asked for, with what would make it a path taken out; else the last part of the address the server answered from, once redirects were followed; else the id. */
    private fun fileNameFor(requested: String?, url: HttpUrl, downloadId: String): String {
        val asked = requested?.substringAfterLast('/')?.substringAfterLast('\\')?.trim()
        if (!asked.isNullOrEmpty() && asked != "." && asked != "..") return asked
        return url.pathSegments.lastOrNull { it.isNotEmpty() } ?: "download-$downloadId"
    }

    private companion object {
        const val TAG = "HttpBridge"
        const val DIRECTORY = "downloads"
        const val BUFFER_SIZE = 64 * 1024
        const val PROGRESS_INTERVAL_MS = 250L
        const val KEEP_MILLIS = 24 * 60 * 60 * 1000L
    }
}
