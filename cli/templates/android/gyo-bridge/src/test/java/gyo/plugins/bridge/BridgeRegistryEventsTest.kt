package gyo.plugins.bridge

import org.json.JSONObject
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BridgeRegistryEventsTest {

    @After
    fun tearDown() {
        BridgeRegistry.initialize()
    }

    @Test
    fun aHandlerCanPublishOnceAWebViewServesTheBridge() {
        val handler = RecordingHandler()
        BridgeRegistry.register("demo", handler)
        assertNull("no WebView serves the bridge yet", handler.publish)

        val sink = RecordingSink()
        BridgeRegistry.attach(sink)

        handler.publish?.invoke(JSONObject().put("progress", 50))
        assertEquals(listOf("demo:{\"progress\":50}"), sink.published)
    }

    @Test
    fun aHandlerRegisteredAfterTheWebViewIsGivenTheSameWay() {
        val sink = RecordingSink()
        BridgeRegistry.attach(sink)

        val handler = RecordingHandler()
        BridgeRegistry.register("demo", handler)

        handler.publish?.invoke("done")
        // The registry hands on what it is given: the WebView's bridge turns it into JSON.
        assertEquals(listOf("demo:done"), sink.published)
    }

    @Test
    fun detachTakesTheWayAwayFromEveryHandler() {
        val first = RecordingHandler()
        val second = RecordingHandler()
        BridgeRegistry.register("first", first)
        BridgeRegistry.register("second", second)
        val sink = RecordingSink()
        BridgeRegistry.attach(sink)

        BridgeRegistry.detach(sink)

        assertNull(first.publish)
        assertNull(second.publish)
    }

    @Test
    fun detachingAWebViewThatNoLongerServesTheBridgeChangesNothing() {
        val handler = RecordingHandler()
        BridgeRegistry.register("demo", handler)
        val old = RecordingSink()
        val current = RecordingSink()
        BridgeRegistry.attach(old)
        BridgeRegistry.attach(current)

        BridgeRegistry.detach(old)

        handler.publish?.invoke(1)
        assertEquals(listOf("demo:1"), current.published)
    }

    @Test
    fun theNextWebViewTakesThePlaceOfTheFirst() {
        val handler = RecordingHandler()
        BridgeRegistry.register("demo", handler)
        val first = RecordingSink()
        val second = RecordingSink()
        BridgeRegistry.attach(first)

        BridgeRegistry.attach(second)
        handler.publish?.invoke(2)

        assertEquals(emptyList<String>(), first.published)
        assertEquals(listOf("demo:2"), second.published)
    }

    @Test
    fun initializeForgetsTheWebViewToo() {
        val handler = RecordingHandler()
        BridgeRegistry.register("demo", handler)
        BridgeRegistry.attach(RecordingSink())

        BridgeRegistry.initialize()

        assertNull(handler.publish)
    }

    @Test
    fun unregisteringAHandlerTakesItsWayAway() {
        val handler = RecordingHandler()
        BridgeRegistry.register("demo", handler)
        BridgeRegistry.attach(RecordingSink())

        BridgeRegistry.unregister("demo")

        assertNull(handler.publish)
    }

    private class RecordingHandler : BridgeHandler {
        override fun handle(method: String, data: JSONObject): Any? = null

        var publish: ((data: Any?) -> Unit)? = null

        override fun attachEvents(publish: ((data: Any?) -> Unit)?) {
            this.publish = publish
        }
    }

    private class RecordingSink : BridgeEventSink {
        val published = mutableListOf<String>()

        override fun publish(bridgeName: String, data: Any?) {
            published += "$bridgeName:$data"
        }
    }
}
