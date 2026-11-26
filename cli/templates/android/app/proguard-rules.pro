# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# The WebView reaches the bridge through the @JavascriptInterface methods
# by name. AGP's default rules already keep annotated methods; this states
# the dependency so a change to the defaults cannot silently break the
# bridge in release builds.
-keepclassmembers class gyo.plugins.bridge.AndroidBridgeInterface {
    @android.webkit.JavascriptInterface <methods>;
}

# Uncomment this to preserve the line number information for
# debugging stack traces.
-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
-renamesourcefileattribute SourceFile
