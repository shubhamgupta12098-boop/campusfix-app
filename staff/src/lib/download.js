/** Download a text file in browser or the native CCMMS Android wrapper. */
export async function downloadTextFile(filename, content, mimeType = 'text/csv') {
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
