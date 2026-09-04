/**
 * Download a text file.
 * In the Android APK, use the native bridge so blob: URLs are not handed to
 * Android DownloadManager (which cannot download blob: URLs).
 */
export async function downloadTextFile(filename, content, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });

  // Native Android WebView export. Saves directly in Downloads/CampusFix.
  if (window.CampusFixAndroid?.saveBase64) {
    const dataUrl = await blobToDataUrl(blob);
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : '';
    window.CampusFixAndroid.saveBase64(filename, mimeType, base64);
    return;
  }

  // Normal mobile/desktop browser share sheet when supported.
  const file = new File([content], filename, { type: mimeType });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (error) {
      if (error?.name === 'AbortError') return;
    }
  }

  // Browser fallback.
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Open Android's Save-as-PDF flow in the APK, or browser print otherwise. */
export function exportPageAsPdf() {
  if (window.CampusFixAndroid?.printPage) {
    window.CampusFixAndroid.printPage();
    return;
  }
  window.print();
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read export file'));
    reader.readAsDataURL(blob);
  });
}
