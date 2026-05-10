package gyo.plugins.bridge

import android.util.Log
import java.util.concurrent.ConcurrentHashMap

object BridgeRegistry {
    private val handlers = ConcurrentHashMap<String, BridgeHandler>()

    fun initialize() {
        handlers.clear()
    }

    fun register(bridgeName: String, handler: BridgeHandler) {
        handlers[bridgeName] = handler
        Log.d("BridgeRegistry", "Registered bridge: $bridgeName")
    }

    fun unregister(bridgeName: String) {
        handlers.remove(bridgeName)
        Log.d("BridgeRegistry", "Unregistered bridge: $bridgeName")
    }

    fun get(bridgeName: String): BridgeHandler? {
        return handlers[bridgeName]
    }
}
