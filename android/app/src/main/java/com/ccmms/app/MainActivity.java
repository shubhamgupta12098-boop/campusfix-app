package com.ccmms.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.provider.MediaStore;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.ProgressBar;
import android.widget.Toast;

import java.io.File;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

import androidx.core.content.FileProvider;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 4101;
    private static final int SAVE_REPORT_REQUEST = 4102;

    private WebView webView;
    private ProgressBar progressBar;
    private ValueCallback<Uri[]> fileChooserCallback;
    private Uri cameraPhotoUri;
    private byte[] pendingSaveBytes;
    private String pendingSaveMime = "text/csv";

    @Override
    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(2, 16, 12));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(2, 16, 12));
        root.addView(webView, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        progressBar = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progressBar.setMax(100);
        FrameLayout.LayoutParams progressParams = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                6
        );
        root.addView(progressBar, progressParams);
        setContentView(root);

        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setDatabaseEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(true);
        webView.getSettings().setMediaPlaybackRequiresUserGesture(false);
        webView.getSettings().setUserAgentString(
                webView.getSettings().getUserAgentString() + " CCMMSAndroid/1.0"
        );

        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, true);

        webView.addJavascriptInterface(new AndroidBridge(), "CCMMSAndroid");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleExternalUrl(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleExternalUrl(Uri.parse(url));
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                progressBar.setProgress(newProgress);
                progressBar.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams
            ) {
                if (fileChooserCallback != null) fileChooserCallback.onReceiveValue(null);
                fileChooserCallback = filePathCallback;
                cameraPhotoUri = null;

                try {
                    Intent pickerIntent = fileChooserParams.createIntent();
                    Intent cameraIntent = createCameraIntent();

                    // An HTML input with capture="environment" is the CCMMS
                    // "Take Photo" action. Open the camera directly so Android
                    // WebView does not silently fall back to a document picker.
                    if (fileChooserParams.isCaptureEnabled() && cameraIntent != null) {
                        startActivityForResult(cameraIntent, FILE_CHOOSER_REQUEST);
                        return true;
                    }

                    Intent chooser = new Intent(Intent.ACTION_CHOOSER);
                    chooser.putExtra(Intent.EXTRA_INTENT, pickerIntent);
                    chooser.putExtra(Intent.EXTRA_TITLE, "Choose photo or video");
                    if (cameraIntent != null && acceptsImages(fileChooserParams.getAcceptTypes())) {
                        chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                    }
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (Exception e) {
                    fileChooserCallback = null;
                    cameraPhotoUri = null;
                    Toast.makeText(MainActivity.this, "Camera/file picker could not be opened.", Toast.LENGTH_SHORT).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener((url, userAgent, contentDisposition, mimetype, contentLength) -> {
            if (url == null || !(url.startsWith("https://") || url.startsWith("http://"))) {
                Toast.makeText(this, "Use the Export button to save this report.", Toast.LENGTH_SHORT).show();
                return;
            }
            try {
                DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
                request.setMimeType(mimetype);
                request.addRequestHeader("User-Agent", userAgent);
                String cookies = CookieManager.getInstance().getCookie(url);
                if (cookies != null) request.addRequestHeader("Cookie", cookies);
                request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
                request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, "ccmms-download");
                DownloadManager manager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
                manager.enqueue(request);
                Toast.makeText(this, "Download started.", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                Toast.makeText(this, "Download failed.", Toast.LENGTH_SHORT).show();
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(BuildConfig.WEB_APP_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }


    private Intent createCameraIntent() {
        Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        if (cameraIntent.resolveActivity(getPackageManager()) == null) return null;

        try {
            File pictureDirectory = getExternalFilesDir(Environment.DIRECTORY_PICTURES);
            if (pictureDirectory == null) pictureDirectory = getCacheDir();
            File photoFile = File.createTempFile("ccmms-photo-", ".jpg", pictureDirectory);
            cameraPhotoUri = FileProvider.getUriForFile(
                    this,
                    getPackageName() + ".fileprovider",
                    photoFile
            );
            cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
            cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
            return cameraIntent;
        } catch (IOException | IllegalArgumentException e) {
            cameraPhotoUri = null;
            return null;
        }
    }

    private static boolean acceptsImages(String[] acceptTypes) {
        if (acceptTypes == null || acceptTypes.length == 0) return true;
        for (String type : acceptTypes) {
            if (type == null || type.trim().isEmpty() || type.startsWith("image/") || "*/*".equals(type)) {
                return true;
            }
        }
        return false;
    }

    private boolean handleExternalUrl(Uri uri) {
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if ("http".equals(scheme) || "https".equals(scheme)) {
            String appHost = Uri.parse(BuildConfig.WEB_APP_URL).getHost();
            if (appHost != null && appHost.equalsIgnoreCase(uri.getHost())) return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (Exception e) {
            Toast.makeText(this, "No app found to open this link.", Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        webView.saveState(outState);
        super.onSaveInstanceState(outState);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (fileChooserCallback != null) {
                Uri[] results = null;
                if (resultCode == RESULT_OK) {
                    if ((data == null || data.getData() == null) && cameraPhotoUri != null) {
                        results = new Uri[]{cameraPhotoUri};
                    } else {
                        results = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
                    }
                }
                fileChooserCallback.onReceiveValue(results);
                fileChooserCallback = null;
            }
            cameraPhotoUri = null;
            return;
        }

        if (requestCode == SAVE_REPORT_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingSaveBytes != null) {
                try (OutputStream stream = getContentResolver().openOutputStream(data.getData())) {
                    if (stream != null) {
                        stream.write(pendingSaveBytes);
                        stream.flush();
                        Toast.makeText(this, "Report saved.", Toast.LENGTH_SHORT).show();
                    }
                } catch (Exception e) {
                    Toast.makeText(this, "Could not save report.", Toast.LENGTH_SHORT).show();
                }
            }
            pendingSaveBytes = null;
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public void downloadText(String filename, String mimeType, String content) {
            runOnUiThread(() -> {
                pendingSaveBytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
                pendingSaveMime = normalizeMime(mimeType);

                Intent saveIntent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                saveIntent.addCategory(Intent.CATEGORY_OPENABLE);
                saveIntent.setType(pendingSaveMime);
                saveIntent.putExtra(Intent.EXTRA_TITLE, safeFilename(filename));
                startActivityForResult(saveIntent, SAVE_REPORT_REQUEST);
            });
        }

        @JavascriptInterface
        public void shareText(String filename, String mimeType, String content, String title, String text) {
            runOnUiThread(() -> {
                // Use text/plain for the Android share chooser so the widest set of
                // installed apps can appear (WhatsApp, Gmail, Messages, Instagram
                // when that installed version accepts text shares, etc.).
                Intent shareIntent = new Intent(Intent.ACTION_SEND);
                shareIntent.setType("text/plain");
                shareIntent.putExtra(
                    Intent.EXTRA_SUBJECT,
                    title == null || title.isEmpty() ? safeFilename(filename) : title
                );

                String intro = text == null ? "" : text.trim();
                String report = content == null ? "" : content.trim();
                String shareBody;
                if (intro.isEmpty()) {
                    shareBody = report;
                } else if (report.isEmpty()) {
                    shareBody = intro;
                } else {
                    shareBody = intro + "\n\n" + report;
                }

                shareIntent.putExtra(Intent.EXTRA_TEXT, shareBody);
                Intent chooser = Intent.createChooser(shareIntent, "Share CCMMS report via");
                startActivity(chooser);
            });
        }
    }

    private static String normalizeMime(String mimeType) {
        if (mimeType == null || mimeType.trim().isEmpty()) return "text/csv";
        int semicolon = mimeType.indexOf(';');
        return semicolon > 0 ? mimeType.substring(0, semicolon).trim() : mimeType.trim();
    }

    private static String safeFilename(String filename) {
        String name = filename == null ? "ccmms-report.csv" : filename.trim();
        if (name.isEmpty()) name = "ccmms-report.csv";
        return name.replaceAll("[\\\\/:*?\"<>|]", "-");
    }
}
