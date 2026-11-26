package gyo.plugins.http

import android.content.Context
import android.util.Base64
import android.util.Log
import gyo.plugins.bridge.BridgeHandler
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * HTTP relay for the web layer: a GET with the headers the caller chooses,
 * answered with the raw body. The WebView cannot make these requests itself:
 * CORS hides cross-origin responses, and many servers answer a WebView's own
 * user agent or a foreign Referer with a redirect or a 403. Decoding and
 * parsing stay on the web side, which knows the charset.
 *
 * method "request":
 *   data     { url: String, headers?: Map<String, String>, jar?: String }
 *   returns  { status: Int, url: String, headers: JSONObject, bodyBase64: String }
 *
 * Redirects are followed and `url` is where the answer came from. Requests
 * that name the same `jar` share cookies, which outlive the process; a
 * request without `jar` neither stores nor sends cookies. `headers` leaves
 * out `set-cookie`, which the jar owns.
 */
class HttpBridge(context: Context) : BridgeHandler {

    private val jars = CookieJars(context)

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    override fun handle(method: String, data: JSONObject): Any? {
        if (method != "request") {
            throw IllegalArgumentException("Unknown method: $method")
        }

        val builder = Request.Builder().url(data.getString("url")).get()
        data.optJSONObject("headers")?.let { headers ->
            headers.keys().forEach { builder.header(it, headers.getString(it)) }
        }

        // newBuilder() keeps the connection pool, so this is cheap per request
        val jar = data.optString("jar")
        val requestClient = if (jar.isEmpty()) {
            client
        } else {
            client.newBuilder().cookieJar(CookieJarOf(jars.named(jar))).build()
        }

        requestClient.newCall(builder.build()).execute().use { response ->
            val headers = JSONObject()
            response.headers.names().filter { it.lowercase() != "set-cookie" }.forEach { name ->
                headers.put(name.lowercase(), response.headers.values(name).joinToString(", "))
            }
            Log.d(TAG, "${response.code} ${response.request.url}")

            return JSONObject()
                .put("status", response.code)
                .put("url", response.request.url.toString())
                .put("headers", headers)
                .put("bodyBase64", Base64.encodeToString(response.body?.bytes() ?: ByteArray(0), Base64.NO_WRAP))
        }
    }

    private companion object {
        const val TAG = "HttpBridge"
    }
}
