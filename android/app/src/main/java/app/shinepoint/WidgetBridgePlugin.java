package app.shinepoint;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

// Bridges live app state (the customer/detailer's current booking) into the
// home-screen widget. Widgets run in the launcher's process via RemoteViews,
// not the app's WebView, so there is no direct way for JS to draw into one —
// this plugin is the one-way handoff: JS calls update() whenever the
// relevant booking changes, this writes it to SharedPreferences (the only
// storage a widget's onUpdate can cheaply read), then asks the widget
// manager to redraw. See ShinePointWidgetProvider for the read side.
@CapacitorPlugin(name = "WidgetBridge")
public class WidgetBridgePlugin extends Plugin {
    static final String PREFS = "shinepoint_widget";
    static final String KEY_TITLE = "title";
    static final String KEY_BODY = "body";
    static final String KEY_PATH = "path";

    @PluginMethod
    public void update(PluginCall call) {
        String title = call.getString("title", "ShinePoint");
        String body = call.getString("body", "Book a detail");
        String path = call.getString("path", "/");

        Context ctx = getContext();
        SharedPreferences.Editor prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit();
        prefs.putString(KEY_TITLE, title);
        prefs.putString(KEY_BODY, body);
        prefs.putString(KEY_PATH, path);
        prefs.apply();

        AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
        int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, ShinePointWidgetProvider.class));
        if (ids.length > 0) {
            ShinePointWidgetProvider.pushUpdate(ctx, mgr, ids);
        }

        call.resolve(new JSObject());
    }
}
