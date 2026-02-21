package com.gyo.bridge

import org.json.JSONObject

/**
 * Interface for all Gyo bridge implementations
 */
interface BridgeInterface {
    /**
     * Unique name of the bridge (e.g., "gyo-camera")
     */
    val name: String
    
    /**
     * Invoke a bridge method
     * @param method Method name to invoke
     * @param data Optional data payload
     * @param callback Callback to return result or error
     */
    fun invoke(method: String, data: JSONObject?, callback: BridgeCallback)
}

/**
 * Callback interface for bridge methods
 */
interface BridgeCallback {
    /**
     * Called when the bridge method succeeds
     * @param data Result data (can be String, JSONObject, JSONArray, etc.)
     */
    fun resolve(data: Any?)
    
    /**
     * Called when the bridge method fails
     * @param error Error message
     */
    fun reject(error: String)
}
