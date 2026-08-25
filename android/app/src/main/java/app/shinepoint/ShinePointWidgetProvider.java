package app.shinepoint;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.widget.RemoteViews;

// Home-screen widget: a branded tile showing the signed-in user's nearest
// active booking (customer: "Detailer en route" etc; detailer: their next
// job), or a plain "Book a detail" shortcut when there's nothing to show —
// logged out, or no bookings. Content comes from WidgetBridgePlugin, which
// JS calls whenever the relevant booking changes; this class only reads
// whatever was last written and draws it. Tapping deep-links into the app
// via the shinepoint://widget URI, caught by NativeBridge.jsx's
// appUrlOpen listener (same mechanism as the OAuth return link).
public class ShinePointWidgetProvider extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        pushUpdate(context, appWidgetManager, appWidgetIds);
    }

    static void pushUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        SharedPreferences prefs = context.getSharedPreferences(WidgetBridgePlugin.PREFS, Context.MODE_PRIVATE);
        String title = prefs.getString(WidgetBridgePlugin.KEY_TITLE, "ShinePoint");
        String body = prefs.getString(WidgetBridgePlugin.KEY_BODY, "Book a detail");
        String path = prefs.getString(WidgetBridgePlugin.KEY_PATH, "/");

        for (int id : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_shinepoint);
            views.setTextViewText(R.id.widget_title, title);
            views.setTextViewText(R.id.widget_body, body);

            Uri uri = Uri.parse("shinepoint://widget").buildUpon().appendQueryParameter("path", path).build();
            Intent intent = new Intent(Intent.ACTION_VIEW, uri, context, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            PendingIntent pending = PendingIntent.getActivity(
                context,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            views.setOnClickPendingIntent(R.id.widget_root, pending);

            appWidgetManager.updateAppWidget(id, views);
        }
    }
}
