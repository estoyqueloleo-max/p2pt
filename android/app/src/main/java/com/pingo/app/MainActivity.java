package com.pingo.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIntent(intent);
    }

    private void handleIntent(Intent intent) {
        if (intent == null) return;
        
        String action = intent.getAction();
        String type = intent.getType();

        if (Intent.ACTION_SEND.equals(action) && type != null) {
            if ("text/plain".equals(type)) {
                String sharedText = intent.getStringExtra(Intent.EXTRA_TEXT);
                if (sharedText != null) {
                    // Save for later (if JS not ready)
                    PingoNativePlugin.setPendingShare(sharedText);
                    // Also try to send immediately
                    sendToWeb(sharedText);
                }
            }
        }
    }

    private void sendToWeb(String text) {
        // Escape single quotes for JS
        String escapedText = text.replace("'", "\\'");
        String js = "window.dispatchEvent(new CustomEvent('pingoAndroidShare', { detail: { text: '" + escapedText + "' } }));";
        
        this.getBridge().eval(js, null);
    }
}
