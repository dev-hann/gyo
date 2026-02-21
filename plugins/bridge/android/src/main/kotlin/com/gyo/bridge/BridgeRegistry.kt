package com.gyo.bridge

import android.util.Log
import org.json.JSONObject

/**
 * Central registry for all Gyo bridges
 * Singleton pattern for global access
 */
object BridgeRegistry {
    private const val TAG = "BridgeRegistry"
    private val bridges = mutableMapOf<String, BridgeInterface>()
    
    /**
     * Register a bridge implementation
     * @param bridge Bridge implementation to register
     */
    fun register(bridge: BridgeInterface) {
        bridges[bridge.name] = bridge
        Log.d(TAG, "Registered bridge: ${bridge.name}")
    }
    
    /**
     * Unregister a bridge
     * @param bridgeName Name of the bridge to unregister
     */
    fun unregister(bridgeName: String) {
        bridges.remove(bridgeName)
        Log.d(TAG, "Unregistered bridge: $bridgeName")
    }
    
    /**
     * Invoke a method on a registered bridge
     * @param bridgeName Name of the bridge
     * @param method Method name to invoke
     * @param data Optional data payload
     * @param callback Callback to return result or error
     */
    fun invoke(
        bridgeName: String,
        method: String,
        data: JSONObject?,
        callback: BridgeCallback
    ) {
        val bridge = bridges[bridgeName]
        
        if (bridge == null) {
            val error = "Bridge not found: $bridgeName (available: ${bridges.keys.joinToString(", ")})"
            Log.e(TAG, error)
            callback.reject(error)
            return
        }
        
        try {
            Log.d(TAG, "Invoking $bridgeName.$method")
            bridge.invoke(method, data, callback)
        } catch (e: Exception) {
            val error = "Bridge invocation failed: ${e.message}"
            Log.e(TAG, error, e)
            callback.reject(error)
        }
    }
    
    /**
     * Check if a bridge is registered
     * @param bridgeName Name of the bridge
     * @return true if the bridge is registered
     */
    fun isRegistered(bridgeName: String): Boolean {
        return bridges.containsKey(bridgeName)
    }
    
    /**
     * Get all registered bridge names
     * @return List of registered bridge names
     */
    fun getRegisteredBridges(): List<String> {
        return bridges.keys.toList()
    }
}
