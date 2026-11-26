package gyo.plugins.http

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray
import org.json.JSONObject
import java.net.CookieHandler
import java.net.CookieManager
import java.net.URI
import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl

/**
 * Cookie jars that outlive the process, one per name.
 */
internal class CookieJars(context: Context) {
    private val history = context.getSharedPreferences("gyo_http_cookies", Context.MODE_PRIVATE)
    private val open = mutableMapOf<String, CookieHandler>()

    @Synchronized
    fun named(name: String): CookieHandler =
        open.getOrPut(name) { PersistedCookies(history, name) }
}

/**
 * Hands OkHttp's cookies to a CookieHandler, the way OkHttp's own JavaNetCookieJar does. That
 * class ships in the okhttp-urlconnection module, which the app does not have.
 */
internal class CookieJarOf(private val handler: CookieHandler) : CookieJar {

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        handler.put(URI(url.toString()), mapOf("Set-Cookie" to cookies.map { it.toString() }))
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> {
        val uri = URI(url.toString())
        val header = handler.get(uri, mapOf("Cookie" to emptyList<String>()))["Cookie"]
            ?: return emptyList()
        return header.mapNotNull { Cookie.parse(url, it) }
    }
}

/**
 * The cookie handling of the platform CookieManager, made to survive process death: servers that
 * tie a session to a cookie refuse a client that drops it, such as a community answering a detail
 * page with a 503.
 *
 * The manager parses and matches cookies but forgets them with the process, so every Set-Cookie
 * header it receives is also written to SharedPreferences in place of the header that defined the
 * same cookie. The next time the jar opens, the stored headers are fed to a fresh manager as they
 * arrived. A header whose cookie has expired since is dropped there, so only live and session
 * cookies return.
 */
private class PersistedCookies(
    private val history: SharedPreferences,
    private val key: String,
) : CookieHandler() {
    private val manager = CookieManager()

    init {
        val stored = entries()
        for (i in 0 until stored.length()) {
            val entry = stored.getJSONObject(i)
            manager.put(URI.create(entry.getString("url")), mapOf("Set-Cookie" to listOf(entry.getString("header"))))
        }
    }

    override fun get(
        uri: URI,
        requestHeaders: Map<String, List<String>>,
    ): Map<String, List<String>> = manager.get(uri, requestHeaders)

    @Synchronized
    override fun put(uri: URI, responseHeaders: Map<String, List<String>>) {
        manager.put(uri, responseHeaders)
        responseHeaders["Set-Cookie"]?.forEach { record(uri, it) }
    }

    private fun record(uri: URI, header: String) {
        val kept = JSONArray()
        val stored = entries()
        for (i in 0 until stored.length()) {
            val entry = stored.getJSONObject(i)
            val from = URI.create(entry.getString("url"))
            if (keyOf(from, entry.getString("header")) != keyOf(uri, header)) {
                kept.put(entry)
            }
        }
        kept.put(JSONObject().put("url", uri.toString()).put("header", header))
        history.edit().putString(key, kept.toString()).apply()
    }

    private fun entries(): JSONArray =
        runCatching { JSONArray(history.getString(key, null) ?: "[]") }.getOrDefault(JSONArray())

    private companion object {
        /**
         * Which cookie a Set-Cookie header defines. Hosts and domains ignore case; names and
         * paths do not.
         */
        fun keyOf(uri: URI, header: String): String {
            val name = header.substringBefore(';').substringBefore('=').trim()
            fun attribute(prefix: String): String =
                header.split(';').drop(1)
                    .firstOrNull { it.trim().startsWith(prefix, ignoreCase = true) }
                    ?.substringAfter('=')?.trim() ?: ""
            return listOf(
                uri.host.lowercase(),
                name,
                attribute("domain").lowercase(),
                attribute("path"),
            ).joinToString("|")
        }
    }
}
