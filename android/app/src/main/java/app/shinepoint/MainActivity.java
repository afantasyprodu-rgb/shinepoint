package app.shinepoint;

import android.os.Bundle;
import android.view.View;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WidgetBridgePlugin.class);
        super.onCreate(savedInstanceState);
        // Edge-to-edge: lets the WebView draw under the status/nav bars
        // instead of the OS reserving that space itself. Without this,
        // env(safe-area-inset-top/bottom) in CSS reports ~0 on Android — the
        // app's layout (AppShell's header padding, BottomTabBar's safe-area
        // padding, DetailerMap's locate button) was written assuming real
        // per-device inset values, so this makes those actually meaningful
        // instead of just falling back to their guessed floors. Also
        // mandatory outright on Android 15+ (API 35) for apps targeting it,
        // which this app does (compileSdk/targetSdk 36).
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    }

    @Override
    public void onStart() {
        super.onStart();
        // Vertical swipes were being eaten as WebView overscroll, so the
        // landing slab never saw a finger drag. Keep native scroll bounce
        // off; JS on ColdStart owns the drawer gesture.
        if (getBridge() == null) return;
        WebView webView = getBridge().getWebView();
        if (webView == null) return;
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setNestedScrollingEnabled(false);
        webView.setVerticalScrollBarEnabled(false);
    }
}
