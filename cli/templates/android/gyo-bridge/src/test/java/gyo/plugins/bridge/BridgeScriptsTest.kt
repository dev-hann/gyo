package gyo.plugins.bridge

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Test

class BridgeScriptsTest {

    @Test
    fun resolvePassesCallbackIdAndResultThrough() {
        assertEquals(
            "window.gyoBridge.resolve(\"cb-1\", {\"ok\":true});",
            BridgeScripts.resolve("cb-1", "{\"ok\":true}")
        )
    }

    @Test
    fun rejectEscapesNewlineAndQuoteInError() {
        assertEquals(
            "window.gyoBridge.reject(\"cb-1\", \"boom\\n at \\\"x\\\"\");",
            BridgeScripts.reject("cb-1", "boom\n at \"x\"")
        )
    }

    @Test
    fun rejectKeepsBackslashAndSingleQuote() {
        assertEquals(
            "window.gyoBridge.reject(\"it's\", \"path C:\\\\temp\\nnext\");",
            BridgeScripts.reject("it's", "path C:\\temp\nnext")
        )
    }

    @Test
    fun publishQuotesTheBridgeName() {
        assertEquals(
            "window.gyoBridge.publish(\"it's\", 1);",
            BridgeScripts.publish("it's", "1")
        )
    }

    @Test
    fun aHandlerResultKeepsItsShape() {
        // The order of an object's keys carries no meaning: read the fields.
        val result = JSONObject(toJson(mapOf("granted" to listOf("a"), "denied" to emptyList<String>())))
        assertEquals("a", result.getJSONArray("granted").getString(0))
        assertEquals(0, result.getJSONArray("denied").length())
        assertEquals("""["a","b"]""", toJson(listOf("a", "b")))
        assertEquals("null", toJson(null))
        assertEquals("\"it's\"", toJson("it's"))
        assertEquals("42", toJson(42))
        assertEquals("true", toJson(true))
    }

    @Test
    fun aHandlerThatOnlyImplementsHandleTakesNoAsyncCall() {
        val handler = object : BridgeHandler {
            override fun handle(method: String, data: JSONObject): Any? = null
        }
        val call = object : PendingCall {
            override fun resolve(result: Any?) = Unit
            override fun reject(message: String) = Unit
        }

        assertFalse(handler.handleAsync("any", JSONObject(), call))
    }
}
