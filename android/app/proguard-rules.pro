# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# --- ShinePoint app classes (R8 enabled in release) ---

# The Capacitor plugin is registered by class reference in MainActivity and
# dispatched reflectively by the Capacitor runtime — keep its class + @PluginMethod
# methods so the JS->native bridge keeps working under R8.
-keep class app.shinepoint.WidgetBridgePlugin { *; }

# The AppWidgetProvider is instantiated by the system via the manifest (class
# name resolved by name, not by reference), and its static pushUpdate is called
# from the plugin. Keep the class and its static entry points.
-keep class app.shinepoint.ShinePointWidgetProvider { *; }
-keepclassmembers class app.shinepoint.ShinePointWidgetProvider { static void pushUpdate(...); }

# MainActivity extends BridgeActivity; Capacitor's own keep rules cover the
# bridge, but keep the plugin registration hook explicit.
-keep class app.shinepoint.MainActivity { *; }

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile
