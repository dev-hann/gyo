package gyo.plugins.bridge

import org.json.JSONObject

/**
 * Bridge Handler Interface
 * All custom bridges must implement this interface
 */
interface BridgeHandler {
    fun handle(method: String, data: JSONObject): Any?
}
