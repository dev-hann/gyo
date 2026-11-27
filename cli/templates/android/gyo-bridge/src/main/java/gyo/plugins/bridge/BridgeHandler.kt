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
}

/** The way a handler answers a call it took charge of in [BridgeHandler.handleAsync]. */
interface PendingCall {
    fun resolve(result: Any?)
    fun reject(message: String)
}
