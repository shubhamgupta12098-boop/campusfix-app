import { Capacitor } from '@capacitor/core';

/**
 * Saves/shares a text file (e.g. a CSV report) in a way that actually works on every
 * platform CampusFix runs on:
 *
 * 1. Native Android/iOS app (Capacitor): a plain `<a download>` click does nothing in an
 *    Android WebView because there is no download manager listening for blob: URLs. Instead
 *    we write the file with the Capacitor Filesystem plugin and hand it to the native Share
 *    sheet, so the user can save it to Downloads or send it via WhatsApp/Drive/email.
 * 2. Mobile web browsers that support the Web Share API with files (most current Android
 *    Chrome, and iOS Safari) get the same native share sheet.
 * 3. Everything else (desktop browsers) falls back to the classic blob + <a download> click.
 */
export async function downloadTextFile(filename: string, content: string, mimeType = 'text/csv') {
  if (Capacitor.isNativePlatform()) {
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const { Share } = await import('@capacitor/share');
    await Filesystem.writeFile({
      path: filename,
      data: content,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    const { uri } = await Filesystem.getUri({ path: filename, directory: Directory.Cache });
    await Share.share({ title: filename, url: uri, dialogTitle: `Save or share ${filename}` });
    return;
  }

  const file = new File([content], filename, { type: mimeType });

  // Web Share API (level 2, file sharing) — the reliable way to get a genuine "Save/Share"
  // sheet on mobile browsers, where blob-URL downloads are frequently blocked or ignored.
  const nav = navigator as Navigator & { canShare?: (data?: ShareData) => boolean; share?: (data: ShareData) => Promise<void> };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (error) {
      // AbortError means the user dismissed the share sheet themselves — that's not a failure.
      if ((error as DOMException)?.name === 'AbortError') return;
      // Otherwise fall through to the classic download below.
    }
  }

  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
