package com.ccmms.campusfix;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ClipData;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.CancellationSignal;
import android.os.ParcelFileDescriptor;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintDocumentInfo;
import android.print.PageRange;
import android.util.Base64;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4102;
    private static final String TRUSTED_HOST = "campusfix-app-x04t.onrender.com";
    private static final long MAX_NATIVE_DOWNLOAD_BYTES = 15L * 1024L * 1024L;

    private WebView webView;
    private ProgressBar progressBar;
    private LinearLayout errorView;
    private TextView errorText;
    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(0, 28, 24));
        getWindow().setNavigationBarColor(Color.rgb(0, 28, 24));

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(0, 28, 24));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(0, 28, 24));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                dp(3));
        progressParams.gravity = Gravity.TOP;
        root.addView(progressBar, progressParams);

        errorView = buildErrorView();
        root.addView(errorView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT));
        errorView.setVisibility(View.GONE);

        setContentView(root);
        configureWebView();

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            loadHome();
        }
    }

    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportZoom(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " CCMMS-Android/1.1");

        CookieManager cookieManager = CookieManager.getInstance();
        cookieManager.setAcceptCookie(true);
        cookieManager.setAcceptThirdPartyCookies(webView, true);

        // Native bridge used by report CSV/PDF export inside the APK.
        webView.addJavascriptInterface(new CampusFixAndroidBridge(), "CampusFixAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("http".equalsIgnoreCase(scheme) || "https".equalsIgnoreCase(scheme)) {
                    if (isTrustedUri(uri)) return false;
                    return openExternal(uri);
                }
                return openExternal(uri);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                progressBar.setVisibility(View.GONE);
                errorView.setVisibility(View.GONE);
                CookieManager.getInstance().flush();
                if (isTrustedUri(Uri.parse(url))) {
                    installNativeExportHooks(view);
                }
                super.onPageFinished(view, url);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) {
                    showError("Page load nahi hui. Internet/Render service check karke Retry karein.");
                }
                super.onReceivedError(view, request, error);
            }

            @Override
            public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
                if (request.isForMainFrame() && errorResponse.getStatusCode() >= 500) {
                    showError("Server abhi available nahi hai (" + errorResponse.getStatusCode() + "). Retry karein.");
                }
                super.onReceivedHttpError(view, request, errorResponse);
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
                progressBar.setProgress(newProgress);
                super.onProgressChanged(view, newProgress);
            }

            @Override
            public boolean onShowFileChooser(WebView webView,
                                             ValueCallback<Uri[]> filePathCallbackNew,
                                             FileChooserParams fileChooserParams) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = filePathCallbackNew;
                try {
                    Intent intent = fileChooserParams.createIntent();
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception ex) {
                    filePathCallback = null;
                    Toast.makeText(MainActivity.this, "File picker open nahi hua", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }

            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> request.grant(request.getResources()));
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimeType, contentLength) -> {
            if (url == null) return;
            // blob: is handled by the injected native share hook / JS bridge.
            if (url.startsWith("blob:") || url.startsWith("data:")) {
                Toast.makeText(this, "Preparing download…", Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimeType);
                request.addRequestHeader("User-Agent", userAgent);
                String cookie = CookieManager.getInstance().getCookie(url);
                if (cookie != null) request.addRequestHeader("Cookie", cookie);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                String fileName = android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, fileName);
                DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                manager.enqueue(request);
                Toast.makeText(this, "Download started", Toast.LENGTH_SHORT).show();
            } catch (Exception ex) {
                openExternal(Uri.parse(url));
            }
        });
    }

    /**
     * Backward-compatible support for the currently deployed web app.
     * It catches <a download href="blob:..."> and window.print() even before
     * the updated React build is deployed.
     */
    private void installNativeExportHooks(WebView view) {
        String js = "(function(){" +
                "if(window.__campusfixNativeExportInstalled)return;" +
                "window.__campusfixNativeExportInstalled=true;" +
                "var blobs=new Map();" +
                "var create=URL.createObjectURL.bind(URL);" +
                "var revoke=URL.revokeObjectURL.bind(URL);" +
                "URL.createObjectURL=function(o){var u=create(o);try{blobs.set(u,o);}catch(e){}return u;};" +
                "URL.revokeObjectURL=function(u){setTimeout(function(){try{blobs.delete(u);revoke(u);}catch(e){}},3000);};" +
                "document.addEventListener('click',function(e){" +
                "var a=e.target&&e.target.closest?e.target.closest('a[download]'):null;" +
                "if(!a||!a.href||!window.CampusFixAndroid)return;" +
                "var b=blobs.get(a.href);if(!b)return;" +
                "e.preventDefault();e.stopImmediatePropagation();" +
                "var r=new FileReader();r.onloadend=function(){" +
                "var s=String(r.result||'');var i=s.indexOf(',');" +
                "try{var fn=CampusFixAndroid.shareBase64||CampusFixAndroid.saveBase64;if(fn){fn.call(CampusFixAndroid,a.download||'campusfix-download',b.type||'application/octet-stream',i>=0?s.slice(i+1):'');}}" +
                "catch(x){console.error(x);}};r.readAsDataURL(b);" +
                "},true);" +
                "var oldPrint=window.print;window.print=function(){" +
                "try{if(window.CampusFixAndroid){if(CampusFixAndroid.sharePageAsPdf){CampusFixAndroid.sharePageAsPdf();return;}if(CampusFixAndroid.printPage){CampusFixAndroid.printPage();return;}}}catch(e){}" +
                "if(oldPrint)return oldPrint.call(window);};" +
                "})();";
        view.evaluateJavascript(js, null);
    }

    private boolean isTrustedUri(Uri uri) {
        if (uri == null) return false;
        String host = uri.getHost();
        return host != null && (host.equalsIgnoreCase(TRUSTED_HOST) || host.endsWith("." + TRUSTED_HOST));
    }

    private class CampusFixAndroidBridge {
        /**
         * New APK behavior: export opens Android's share sheet instead of
         * silently saving a copy in Downloads.
         */
        @JavascriptInterface
        public void shareBase64(String filename, String mimeType, String base64Data) {
            if (base64Data == null || base64Data.isEmpty()) {
                showToast("Export file empty hai");
                return;
            }

            String safeMime = normalizeAllowedMime(mimeType);
            if (safeMime == null) {
                showToast("Unsupported export type");
                return;
            }

            byte[] bytes;
            try {
                bytes = Base64.decode(base64Data, Base64.DEFAULT);
            } catch (Exception ex) {
                showToast("Export decode nahi hua");
                return;
            }

            if (bytes.length > MAX_NATIVE_DOWNLOAD_BYTES) {
                showToast("Export file bahut badi hai");
                return;
            }

            try {
                String safeName = sanitizeFilename(filename, safeMime);
                File target = writeExportToCache(safeName, bytes);
                shareCachedFile(target, safeMime);
            } catch (Exception ex) {
                showToast("Export share nahi hua: " + ex.getMessage());
            }
        }

        /** Backward compatibility with an already-deployed web build. */
        @JavascriptInterface
        public void saveBase64(String filename, String mimeType, String base64Data) {
            shareBase64(filename, mimeType, base64Data);
        }

        /** New direct PDF share API. */
        @JavascriptInterface
        public void sharePageAsPdf() {
            runOnUiThread(() -> createAndSharePdf());
        }

        /** Backward compatibility: old frontend calls printPage(). */
        @JavascriptInterface
        public void printPage() {
            runOnUiThread(() -> createAndSharePdf());
        }
    }

    private String normalizeAllowedMime(String mimeType) {
        String value = mimeType == null ? "" : mimeType.toLowerCase(Locale.US).split(";", 2)[0].trim();
        if (value.equals("text/csv") || value.equals("application/csv") || value.equals("text/plain")) {
            return "text/csv";
        }
        if (value.equals("application/pdf")) {
            return "application/pdf";
        }
        return null;
    }

    private String sanitizeFilename(String filename, String mimeType) {
        String fallback = mimeType.equals("application/pdf") ? "campusfix-report.pdf" : "campusfix-report.csv";
        String name = filename == null || filename.trim().isEmpty() ? fallback : filename.trim();
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        if (name.length() > 100) name = name.substring(0, 100);
        if (mimeType.equals("text/csv") && !name.toLowerCase(Locale.US).endsWith(".csv")) name += ".csv";
        if (mimeType.equals("application/pdf") && !name.toLowerCase(Locale.US).endsWith(".pdf")) name += ".pdf";
        return name;
    }

    private File getExportCacheDir() throws IOException {
        File dir = new File(getCacheDir(), "exports");
        if (!dir.exists() && !dir.mkdirs()) {
            throw new IOException("Temporary export folder create nahi hua");
        }
        // Keep cache tidy. Anything older than one day can be removed safely.
        File[] oldFiles = dir.listFiles();
        if (oldFiles != null) {
            long cutoff = System.currentTimeMillis() - (24L * 60L * 60L * 1000L);
            for (File old : oldFiles) {
                if (old.isFile() && old.lastModified() < cutoff) old.delete();
            }
        }
        return dir;
    }

    private File writeExportToCache(String filename, byte[] bytes) throws IOException {
        File target = uniqueFile(getExportCacheDir(), filename);
        try (FileOutputStream out = new FileOutputStream(target)) {
            out.write(bytes);
            out.flush();
        }
        return target;
    }

    private void shareCachedFile(File file, String mimeType) {
        runOnUiThread(() -> {
            try {
                Uri uri = new Uri.Builder()
                        .scheme("content")
                        .authority(getPackageName() + ".exports")
                        .appendPath(file.getName())
                        .build();

                Intent share = new Intent(Intent.ACTION_SEND);
                share.setType(mimeType);
                share.putExtra(Intent.EXTRA_STREAM, uri);
                share.putExtra(Intent.EXTRA_SUBJECT, file.getName());
                share.setClipData(ClipData.newUri(getContentResolver(), file.getName(), uri));
                share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                Intent chooser = Intent.createChooser(share, "Share " + file.getName());
                startActivity(chooser);
            } catch (Exception ex) {
                Toast.makeText(MainActivity.this, "Share menu open nahi hua", Toast.LENGTH_SHORT).show();
            }
        });
    }

    /**
     * Render the current WebView into a temporary PDF and then open Android's
     * standard share chooser. No permanent Downloads copy is created first.
     */
    private void createAndSharePdf() {
        if (webView == null) return;
        try {
            String stamp = new SimpleDateFormat("yyyy-MM-dd-HHmmss", Locale.US).format(new Date());
            String jobName = "CampusFix-report-" + stamp;
            File pdf = uniqueFile(getExportCacheDir(), jobName + ".pdf");
            ParcelFileDescriptor descriptor = ParcelFileDescriptor.open(
                    pdf,
                    ParcelFileDescriptor.MODE_CREATE |
                            ParcelFileDescriptor.MODE_TRUNCATE |
                            ParcelFileDescriptor.MODE_READ_WRITE);

            PrintDocumentAdapter adapter = webView.createPrintDocumentAdapter(jobName);
            PrintAttributes attributes = new PrintAttributes.Builder()
                    .setMediaSize(PrintAttributes.MediaSize.ISO_A4)
                    .setColorMode(PrintAttributes.COLOR_MODE_COLOR)
                    .setMinMargins(new PrintAttributes.Margins(0, 0, 0, 0))
                    .build();
            CancellationSignal cancellationSignal = new CancellationSignal();

            Toast.makeText(this, "Preparing PDF…", Toast.LENGTH_SHORT).show();

            adapter.onLayout(
                    null,
                    attributes,
                    cancellationSignal,
                    new PrintDocumentAdapter.LayoutResultCallback() {
                        @Override
                        public void onLayoutFinished(PrintDocumentInfo info, boolean changed) {
                            adapter.onWrite(
                                    new PageRange[]{PageRange.ALL_PAGES},
                                    descriptor,
                                    cancellationSignal,
                                    new PrintDocumentAdapter.WriteResultCallback() {
                                        @Override
                                        public void onWriteFinished(PageRange[] pages) {
                                            closeQuietly(descriptor);
                                            adapter.onFinish();
                                            if (pdf.exists() && pdf.length() > 0) {
                                                shareCachedFile(pdf, "application/pdf");
                                            } else {
                                                showToast("PDF create nahi hui");
                                            }
                                        }

                                        @Override
                                        public void onWriteFailed(CharSequence error) {
                                            closeQuietly(descriptor);
                                            adapter.onFinish();
                                            showToast("PDF export failed");
                                        }

                                        @Override
                                        public void onWriteCancelled() {
                                            closeQuietly(descriptor);
                                            adapter.onFinish();
                                        }
                                    });
                        }

                        @Override
                        public void onLayoutFailed(CharSequence error) {
                            closeQuietly(descriptor);
                            adapter.onFinish();
                            showToast("PDF layout failed");
                        }

                        @Override
                        public void onLayoutCancelled() {
                            closeQuietly(descriptor);
                            adapter.onFinish();
                        }
                    },
                    null);
        } catch (Exception ex) {
            Toast.makeText(this, "PDF share open nahi hua: " + ex.getMessage(), Toast.LENGTH_SHORT).show();
        }
    }

    private void closeQuietly(ParcelFileDescriptor descriptor) {
        if (descriptor == null) return;
        try {
            descriptor.close();
        } catch (IOException ignored) {
        }
    }

    private File uniqueFile(File folder, String filename) {
        File target = new File(folder, filename);
        if (!target.exists()) return target;
        int dot = filename.lastIndexOf('.');
        String base = dot > 0 ? filename.substring(0, dot) : filename;
        String ext = dot > 0 ? filename.substring(dot) : "";
        int index = 1;
        while (target.exists()) {
            target = new File(folder, base + "-" + index + ext);
            index++;
        }
        return target;
    }

    private void showToast(String message) {
        runOnUiThread(() -> Toast.makeText(MainActivity.this, message, Toast.LENGTH_LONG).show());
    }

    private LinearLayout buildErrorView() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(dp(28), dp(28), dp(28), dp(28));
        box.setBackgroundColor(Color.rgb(0, 28, 24));

        TextView title = new TextView(this);
        title.setText("CCMMS");
        title.setTextColor(Color.WHITE);
        title.setTextSize(28f);
        title.setGravity(Gravity.CENTER);
        box.addView(title);

        errorText = new TextView(this);
        errorText.setTextColor(Color.rgb(190, 220, 211));
        errorText.setTextSize(16f);
        errorText.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams messageParams = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.WRAP_CONTENT);
        messageParams.setMargins(0, dp(16), 0, dp(20));
        box.addView(errorText, messageParams);

        Button retry = new Button(this);
        retry.setText("Retry");
        retry.setTextSize(16f);
        retry.setOnClickListener(v -> loadHome());
        box.addView(retry, new LinearLayout.LayoutParams(dp(180), dp(52)));

        Button networkSettings = new Button(this);
        networkSettings.setText("Network Settings");
        networkSettings.setOnClickListener(v -> {
            try {
                startActivity(new Intent(Settings.ACTION_WIRELESS_SETTINGS));
            } catch (Exception ignored) {
            }
        });
        LinearLayout.LayoutParams networkParams = new LinearLayout.LayoutParams(dp(180), dp(52));
        networkParams.setMargins(0, dp(10), 0, 0);
        box.addView(networkSettings, networkParams);

        return box;
    }

    private void loadHome() {
        errorView.setVisibility(View.GONE);
        progressBar.setVisibility(View.VISIBLE);
        webView.loadUrl(BuildConfig.WEB_URL);
    }

    private void showError(String message) {
        errorText.setText(message + "\n\n" + BuildConfig.WEB_URL);
        errorView.setVisibility(View.VISIBLE);
        progressBar.setVisibility(View.GONE);
    }

    private boolean openExternal(Uri uri) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, uri);
            startActivity(intent);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    private int dp(int value) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(value * density);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == FILE_CHOOSER_REQUEST && filePathCallback != null) {
            Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
            filePathCallback.onReceiveValue(result);
            filePathCallback = null;
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }
        super.onDestroy();
    }
}
