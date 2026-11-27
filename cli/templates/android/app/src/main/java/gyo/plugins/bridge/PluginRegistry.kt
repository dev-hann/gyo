package gyo.plugins.bridge

import android.content.Context

/**
 * Registers every Gyo plugin the project has installed. gyo run, gyo build
 * and gyo install rewrite it; handlers of your own belong elsewhere.
 */
object PluginRegistry {
    @Suppress("UNUSED_PARAMETER")
    fun registerAll(context: Context) {}
}
