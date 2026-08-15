package com.velvetstore.inventario;

import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {

    @PluginMethod
    public void version(PluginCall call) {
        try {
            String versionName = getContext().getPackageManager()
                    .getPackageInfo(getContext().getPackageName(), 0).versionName;
            call.resolve(new JSObject().put("version", versionName != null ? versionName : "0"));
        } catch (PackageManager.NameNotFoundException e) {
            call.resolve(new JSObject().put("version", "0"));
        }
    }

    @PluginMethod
    public void instalar(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.isEmpty()) {
            call.reject("Falta la URL de la APK");
            return;
        }
        new Thread(() -> {
            try {
                File apk = descargar(url);
                if (apk == null) {
                    call.reject("No se pudo descargar la APK");
                    return;
                }
                Intent intent = new Intent(Intent.ACTION_VIEW);
                Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", apk);
                intent.setDataAndType(uri, "application/vnd.android.package-archive");
                intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    intent.addFlags(Intent.FLAG_GRANT_PREFIX_URI_PERMISSION);
                }
                getContext().startActivity(intent);
                call.resolve(new JSObject().put("ok", true));
            } catch (Exception e) {
                call.reject("Error al instalar: " + e.getMessage());
            }
        }).start();
    }

    private File descargar(String urlString) throws Exception {
        URL url = new URL(urlString);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setInstanceFollowRedirects(true);
        con.connect();
        if (con.getResponseCode() != 200) return null;

        File dir = new File(getContext().getCacheDir(), "apk");
        if (!dir.exists()) dir.mkdirs();
        File apk = new File(dir, "velvet-store.apk");
        if (apk.exists()) apk.delete();

        try (InputStream in = con.getInputStream(); FileOutputStream out = new FileOutputStream(apk)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
        }
        con.disconnect();
        return apk;
    }
}
