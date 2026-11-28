package gyo.plugins.bridge

import android.util.Log

/**
 * Bridge Registry - Singleton for managing custom bridges
 */
object BridgeRegistry {
    private val handlers = mutableMapOf<String, BridgeHandler>()

    /** The WebView that serves the bridge now; read from the threads the handlers answer on. */
    @Volatile
    private var sink: BridgeEventSink? = null

    fun initialize() {
        handlers.values.forEach { it.attachEvents(null) }
        handlers.clear()
        sink = null
    }

    fun register(bridgeName: String, handler: BridgeHandler) {
        handlers[bridgeName] = handler
        // Registered after the WebView came: it gets what the others already have.
        sink?.let { handler.attachEvents(publisherOf(bridgeName, it)) }
        Log.d("BridgeRegistry", "Registered bridge: $bridgeName")
    }

    fun unregister(bridgeName: String) {
        handlers.remove(bridgeName)?.attachEvents(null)
        Log.d("BridgeRegistry", "Unregistered bridge: $bridgeName")
    }

    /** A WebView serves the bridge: from now on every handler can publish to its page. */
    fun attach(sink: BridgeEventSink) {
        this.sink = sink
        handlers.forEach { (bridgeName, handler) -> handler.attachEvents(publisherOf(bridgeName, sink)) }
    }

    /** The WebView no longer serves the bridge. Another WebView's attach is not undone by it. */
    fun detach(sink: BridgeEventSink) {
        if (this.sink !== sink) return
        this.sink = null
        handlers.values.forEach { it.attachEvents(null) }
    }

    private fun publisherOf(bridgeName: String, sink: BridgeEventSink): (data: Any?) -> Unit =
        { data -> sink.publish(bridgeName, data) }

    fun get(bridgeName: String): BridgeHandler? {
        return handlers[bridgeName]
    }
}
