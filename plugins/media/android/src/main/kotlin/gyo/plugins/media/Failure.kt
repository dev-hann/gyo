package gyo.plugins.media

import org.json.JSONObject

/**
 * The kinds of failure the web side tells apart. `canceled` is not among
 * them: the Android side does not watch what the user does in the chooser.
 */
internal enum class Failure {
    NETWORK,
    UNSUPPORTED,
    PERMISSION,
    STORAGE;

    val kind: String
        get() = name.lowercase()
}

/**
 * A request that cannot be carried out. The bridge rejects a call with a
 * message only, and a message cannot carry the kind, so the failure is
 * answered as a value instead. [reason] says what to do about it.
 */
internal class Rejected(val failure: Failure, val reason: String) : Exception(reason) {

    fun toJson(): JSONObject = JSONObject()
        .put("status", "failed")
        .put("error", JSONObject().put("kind", failure.kind).put("message", reason))
}

internal fun savedJson(uri: String, mimeType: String): JSONObject = JSONObject()
    .put("status", "saved")
    .put("uri", uri)
    .put("mimeType", mimeType)

internal fun sharedJson(): JSONObject = JSONObject().put("status", "shared")

/** What the exception says, or its type when it says nothing. */
internal fun Exception.describe(): String = message?.takeIf { it.isNotBlank() } ?: javaClass.simpleName
