package gyo.plugins.bridge

import org.junit.Assert.assertEquals
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
}
