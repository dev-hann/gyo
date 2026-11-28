package gyo.plugins.media

import android.webkit.MimeTypeMap
import okhttp3.HttpUrl
import okhttp3.MediaType
import org.json.JSONObject
import java.io.File

/** The media store takes 255 bytes in a name; the rest leaves room for the number of a name that is taken. */
private const val MAX_NAME_BYTES = 200
private const val OCTET_STREAM = "application/octet-stream"

/**
 * What a file name cannot hold on the file systems in use, and the format
 * characters that make a name read as another one, such as U+202E.
 */
private val UNSAFE = Regex("[\\\\/:*?\"<>|\\p{Cntrl}\\p{Cf}]")
private val MIME_TYPE = Regex("[a-z0-9][a-z0-9!#$&^_.+-]*/[a-z0-9][a-z0-9!#$&^_.+-]*")
private val mimeTypes = MimeTypeMap.getSingleton()

/** The string at `name`: null when it is missing, null or blank. */
internal fun JSONObject.text(name: String): String? =
    if (isNull(name)) null else optString(name).trim().takeIf { it.isNotEmpty() }

/**
 * A name without a path, made of what a file name may hold, and short
 * enough for the media store. Null when nothing is left.
 */
internal fun safeName(raw: String?): String? {
    if (raw == null) {
        return null
    }
    var name = raw.substringAfterLast('/').substringAfterLast('\\')
        .replace(UNSAFE, "_")
        .trim()
        .trim('.')
    while (name.toByteArray(Charsets.UTF_8).size > MAX_NAME_BYTES) {
        name = name.dropLast(1)
    }
    return name.ifEmpty { null }
}

/**
 * The folder asked for, as a path of safe names. Neither a separator at the
 * start nor a `..` survives, so the folder cannot lead out of the system
 * folder it sits in.
 */
internal fun safeFolder(raw: String?): String =
    raw.orEmpty().split('/', '\\').mapNotNull { safeName(it) }.joinToString("/")

/**
 * The type the file is stored under. The server's own comes first: it
 * describes the bytes that arrived. A server that says no more than
 * `application/octet-stream` is passed over for what the page says the
 * server names it, then for what the address ends in.
 */
internal fun mimeTypeFor(declared: String?, contentType: MediaType?, url: HttpUrl): String {
    val served = contentType?.let { "${it.type}/${it.subtype}" }
    val extension = url.pathSegments.last().substringAfterLast('.', "").lowercase()
    val guessed = if (extension.isEmpty()) null else mimeTypes.getMimeTypeFromExtension(extension)
    return sequenceOf(served, declared, guessed)
        .mapNotNull { it?.let(::normalized) }
        .firstOrNull { it != OCTET_STREAM }
        ?: OCTET_STREAM
}

/** The type in lower case, without parameters; null when it is not a MIME type at all. */
private fun normalized(raw: String): String? =
    raw.substringBefore(';').trim().lowercase().takeIf { MIME_TYPE.matches(it) }

/**
 * The name under which the file is stored: the one asked for, else the
 * last of the address, once redirects were followed. It ends in an
 * extension the system knows, which is what a gallery goes by.
 */
internal fun filenameFor(requested: String?, url: HttpUrl, mimeType: String): String {
    val name = safeName(requested)
        ?: safeName(url.pathSegments.last())
        ?: "gyo-${System.currentTimeMillis()}"
    val extension = name.substringAfterLast('.', "").lowercase()
    val known = extension.isNotEmpty() && mimeTypes.getMimeTypeFromExtension(extension) != null
    val ofMimeType = mimeTypes.getExtensionFromMimeType(mimeType)
    return if (known || ofMimeType == null) name else "$name.$ofMimeType"
}

/**
 * A new file of that name in the directory, numbered when the name is
 * taken: a save never writes over a file that is there. Creating is atomic,
 * so two saves at once cannot pick the same name.
 */
internal fun newFile(directory: File, name: String): File {
    val stem = name.substringBeforeLast('.', name)
    val extension = name.substringAfterLast('.', "").let { if (it.isEmpty()) "" else ".$it" }
    var file = File(directory, name)
    var number = 1
    while (!file.createNewFile()) {
        file = File(directory, "$stem (${++number})$extension")
    }
    return file
}
