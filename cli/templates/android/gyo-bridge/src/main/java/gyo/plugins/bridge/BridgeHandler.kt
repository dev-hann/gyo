package gyo.plugins.bridge

import org.json.JSONObject

interface BridgeHandler {
    /** Answers a call. Returns what the web side receives; throw to reject it. */
    fun handle(method: String, data: JSONObject): Any?

    /**
     * For a call whose answer is not ready when the method returns, such as
     * one that waits for the user. Answers `call` exactly once, from any
     * thread. Returns false when `method` is not one of these.
     */
    fun handleAsync(method: String, data: JSONObject, call: PendingCall): Boolean = false

    /**
     * Gives the handler the way to publish an event to the page for its
     * bridge, and takes it away again with null when no WebView serves the
     * bridge. Called when a WebView starts serving the bridge, and once more
     * for the next WebView. The page receives the data in what it gave to
     * `Bridge.listen`. May be called from any thread.
     */
    fun attachEvents(publish: ((data: Any?) -> Unit)?) {}
}

/** The way a handler answers a call it took charge of in [BridgeHandler.handleAsync]. */
interface PendingCall {
    fun resolve(result: Any?)
    fun reject(message: String)
}

/** What the bridge of a WebView offers the handlers: an event published for a bridge reaches the page. */
interface BridgeEventSink {
    fun publish(bridgeName: String, data: Any?)
}
