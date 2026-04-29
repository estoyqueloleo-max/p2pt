package com.pingo.app;

import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "PingoNative")
public class PingoNativePlugin extends Plugin {

    private static String pendingShare = null;

    public static void setPendingShare(String text) {
        pendingShare = text;
    }

    @PluginMethod
    public void getPendingShare(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("text", pendingShare);
        pendingShare = null; // Clear after reading
        call.resolve(ret);
    }

    @PluginMethod
    public void shareFile(PluginCall call) {
        String filename = call.getString("filename");
        String content = call.getString("content");

        if (filename == null || content == null) {
            call.reject("Filename and content are required");
            return;
        }

        try {
            // Save file to cache directory
            File cachePath = new File(getContext().getCacheDir(), "exports");
            cachePath.mkdirs();
            File newFile = new File(cachePath, filename);
            FileOutputStream stream = new FileOutputStream(newFile);
            stream.write(content.getBytes());
            stream.close();

            // Share the file
            Uri contentUri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", newFile);

            if (contentUri != null) {
                Intent shareIntent = new Intent();
                shareIntent.setAction(Intent.ACTION_SEND);
                shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION); // temp permission for receiving app to read this file
                shareIntent.setDataAndType(contentUri, getContext().getContentResolver().getType(contentUri));
                shareIntent.putExtra(Intent.EXTRA_STREAM, contentUri);
                shareIntent.setType("application/json");

                getContext().startActivity(Intent.createChooser(shareIntent, "Exportar Backup"));
                call.resolve();
            } else {
                call.reject("Could not create content URI");
            }
        } catch (Exception e) {
            call.reject("Error exporting file: " + e.getMessage());
        }
    }

    @PluginMethod
    public void startService(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), PingoService.class);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(serviceIntent);
        } else {
            getContext().startService(serviceIntent);
        }
        JSObject ret = new JSObject();
        ret.put("status", "started");
        call.resolve(ret);
    }

    @PluginMethod
    public void stopService(PluginCall call) {
        Intent serviceIntent = new Intent(getContext(), PingoService.class);
        getContext().stopService(serviceIntent);
        JSObject ret = new JSObject();
        ret.put("status", "stopped");
        call.resolve(ret);
    }
}
