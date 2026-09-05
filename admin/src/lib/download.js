/** Download a text file without accidentally opening the native share sheet. */
export async function downloadTextFile(filename, content, mimeType = 'text/csv') {
  // Native Android APK bridge: opens Android's Save As dialog.
  if (window.CCMMSAndroid?.downloadText) {
    window.CCMMSAndroid.downloadText(filename, mimeType, content);
    return true;
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
  return true;
}

/**
 * Share report content through the platform share chooser.
 *
 * We intentionally share as plain text (instead of a CSV attachment) because
 * Android/iOS/Chrome then offer a much wider set of compatible targets such as
 * WhatsApp, Gmail, Messages and other installed social apps. Users who need the
 * actual CSV file can still use the separate Export button.
 */
export async function shareTextFile({ filename, content, mimeType = 'text/csv', title, text }) {
  const heading = title || filename || 'CCMMS Report';
  const intro = String(text || '').trim();
  const report = String(content || '').trim();
  const shareBody = [intro, report].filter(Boolean).join('\n\n');

  if (window.CCMMSAndroid?.shareText) {
    window.CCMMSAndroid.shareText(filename, 'text/plain', report, heading, intro);
    return true;
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: heading,
        text: shareBody || heading,
      });
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      console.warn('System share chooser failed; using email fallback.', error);
    }
  }

  const subject = encodeURIComponent(heading);
  const body = encodeURIComponent(shareBody || 'Campus maintenance report');
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  return true;
}
