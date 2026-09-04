package com.ccmms.campusfix;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import android.webkit.MimeTypeMap;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.Locale;

/**
 * Read-only provider for temporary report exports in cache/exports.
 * It lets Android share CSV/PDF files without requiring storage permission
 * and without creating a permanent Downloads copy first.
 */
public class ExportFileProvider extends ContentProvider {
    @Override
    public boolean onCreate() {
        return true;
    }

    private File resolveFile(Uri uri) throws FileNotFoundException {
        if (getContext() == null) throw new FileNotFoundException("No context");
        String name = uri.getLastPathSegment();
        if (name == null || name.trim().isEmpty()) throw new FileNotFoundException("Missing file");

        File root = new File(getContext().getCacheDir(), "exports");
        File target = new File(root, name);
        try {
            String rootPath = root.getCanonicalPath() + File.separator;
            String targetPath = target.getCanonicalPath();
            if (!targetPath.startsWith(rootPath) || !target.isFile()) {
                throw new FileNotFoundException("File not found");
            }
            return target;
        } catch (IOException ex) {
            throw new FileNotFoundException("Invalid export path");
        }
    }

    @Override
    public String getType(Uri uri) {
        try {
            File file = resolveFile(uri);
            String name = file.getName();
            int dot = name.lastIndexOf('.');
            if (dot >= 0 && dot < name.length() - 1) {
                String ext = name.substring(dot + 1).toLowerCase(Locale.US);
                String mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext);
                if (mime != null) return mime;
                if ("csv".equals(ext)) return "text/csv";
                if ("pdf".equals(ext)) return "application/pdf";
            }
        } catch (Exception ignored) {
        }
        return "application/octet-stream";
    }

    @Override
    public Cursor query(Uri uri, String[] projection, String selection,
                        String[] selectionArgs, String sortOrder) {
        try {
            File file = resolveFile(uri);
            String[] cols = projection != null && projection.length > 0
                    ? projection
                    : new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE};
            MatrixCursor cursor = new MatrixCursor(cols, 1);
            Object[] row = new Object[cols.length];
            for (int i = 0; i < cols.length; i++) {
                if (OpenableColumns.DISPLAY_NAME.equals(cols[i])) row[i] = file.getName();
                else if (OpenableColumns.SIZE.equals(cols[i])) row[i] = file.length();
                else row[i] = null;
            }
            cursor.addRow(row);
            return cursor;
        } catch (FileNotFoundException ex) {
            return null;
        }
    }

    @Override
    public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (mode != null && mode.contains("w")) throw new FileNotFoundException("Read only");
        return ParcelFileDescriptor.open(resolveFile(uri), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override
    public Uri insert(Uri uri, ContentValues values) {
        throw new UnsupportedOperationException("Read only");
    }

    @Override
    public int delete(Uri uri, String selection, String[] selectionArgs) {
        return 0;
    }

    @Override
    public int update(Uri uri, ContentValues values, String selection, String[] selectionArgs) {
        return 0;
    }
}
