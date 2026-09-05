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
 * Share a generated text file when supported. In the Android APK this opens
 * the native share sheet. Browsers use Web Share and then email fallback.
 */
export async function shareTextFile({ filename, content, mimeType = 'text/csv', title, text }) {
  if (window.CCMMSAndroid?.shareText) {
    window.CCMMSAndroid.shareText(filename, mimeType, content, title || filename, text || '');
    return true;
  }

  const file = new File([content], filename, { type: mimeType });

  if (navigator.share) {
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: title || filename, text: text || '' });
      } else {
        await navigator.share({ title: title || filename, text: text || '' });
      }
      return true;
    } catch (error) {
      if (error?.name === 'AbortError') return false;
      console.warn('Native report share failed; using email fallback.', error);
    }
  }

  const subject = encodeURIComponent(title || filename);
  const body = encodeURIComponent(
    `${text || 'Campus maintenance report'}\n\n` +
    'The generated CSV could not be attached automatically in this browser. Use Export to download it and attach it to this email.',
  );
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  return true;
}
