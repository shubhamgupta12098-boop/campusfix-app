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

function isAndroidApp() {
  return Boolean(window.CCMMSAndroid?.shareText || window.CCMMSAndroid?.shareToApp);
}

async function copyText(value) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch (error) {
    console.warn('Clipboard API failed.', error);
  }

  try {
    const area = document.createElement('textarea');
    area.value = value;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    area.style.pointerEvents = 'none';
    document.body.appendChild(area);
    area.select();
    const copied = document.execCommand('copy');
    area.remove();
    return copied;
  } catch (error) {
    console.warn('Clipboard fallback failed.', error);
    return false;
  }
}

async function openSystemShare(heading, shareBody, filename) {
  if (window.CCMMSAndroid?.shareText) {
    window.CCMMSAndroid.shareText(filename || 'ccmms-report.csv', 'text/plain', shareBody, heading, '');
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
      console.warn('System share chooser failed.', error);
    }
  }

  const subject = encodeURIComponent(heading);
  const body = encodeURIComponent(shareBody || 'Campus maintenance report');
  window.location.href = `mailto:?subject=${subject}&body=${body}`;
  return true;
}

function shareWithNativeTarget(target, heading, shareBody) {
  if (!window.CCMMSAndroid?.shareToApp) return false;
  try {
    window.CCMMSAndroid.shareToApp(target, heading, shareBody);
    return true;
  } catch (error) {
    console.warn(`Native ${target} share failed.`, error);
    return false;
  }
}

async function shareWithTarget(target, heading, shareBody, filename) {
  if (target === 'more') return openSystemShare(heading, shareBody, filename);

  // APK path: Android opens the selected app directly. If that app is not
  // installed or cannot receive text, the native code falls back to the
  // standard Android share chooser.
  if (isAndroidApp() && shareWithNativeTarget(target, heading, shareBody)) {
    return true;
  }

  if (target === 'whatsapp') {
    const url = `https://wa.me/?text=${encodeURIComponent(shareBody || heading)}`;
    window.location.href = url;
    return true;
  }

  if (target === 'gmail') {
    const subject = encodeURIComponent(heading);
    const body = encodeURIComponent(shareBody || heading);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    return true;
  }

  if (target === 'instagram') {
    // Mobile browsers cannot reliably hand plain text directly to Instagram.
    // Copy it first so the user can paste it, then prefer the platform share
    // sheet (which can include Instagram when the installed version accepts
    // the share). If Web Share is unavailable, open Instagram itself.
    await copyText(shareBody || heading);
    if (navigator.share) {
      try {
        await navigator.share({ title: heading, text: shareBody || heading });
        return true;
      } catch (error) {
        if (error?.name === 'AbortError') return false;
        console.warn('Instagram Web Share fallback failed.', error);
      }
    }
    window.location.href = 'https://www.instagram.com/';
    return true;
  }

  return openSystemShare(heading, shareBody, filename);
}

function createShareChooser({ heading, shareBody, filename }) {
  return new Promise((resolve) => {
    const oldChooser = document.getElementById('ccmms-share-chooser');
    if (oldChooser) oldChooser.remove();

    const overlay = document.createElement('div');
    overlay.id = 'ccmms-share-chooser';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-label', 'Share CCMMS report');
    overlay.innerHTML = `
      <style>
        #ccmms-share-chooser{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.62);display:flex;align-items:flex-end;justify-content:center;padding:12px;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;-webkit-tap-highlight-color:transparent}
        #ccmms-share-chooser .ccmms-share-sheet{width:min(100%,480px);background:#07131c;border:1px solid rgba(100,211,255,.22);border-radius:24px 24px 18px 18px;padding:18px 16px max(18px,env(safe-area-inset-bottom));box-shadow:0 -16px 48px rgba(0,0,0,.42);color:#fff;animation:ccmmsSheetIn .18s ease-out}
        #ccmms-share-chooser .ccmms-share-handle{width:44px;height:5px;border-radius:999px;background:#44505b;margin:0 auto 14px}
        #ccmms-share-chooser .ccmms-share-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:8px}
        #ccmms-share-chooser h3{font-size:20px;line-height:1.2;margin:0;font-weight:800;color:#f8fafc}
        #ccmms-share-chooser .ccmms-share-close{width:38px;height:38px;border:0;border-radius:50%;background:#132431;color:#d7e4ed;font-size:24px;line-height:1;display:grid;place-items:center;cursor:pointer}
        #ccmms-share-chooser .ccmms-share-subtitle{margin:0 0 18px;color:#91a5b5;font-size:13px;line-height:1.45}
        #ccmms-share-chooser .ccmms-share-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
        #ccmms-share-chooser .ccmms-share-option{border:0;background:transparent;color:#dfeaf2;display:flex;flex-direction:column;align-items:center;gap:8px;padding:6px 2px;min-width:0;cursor:pointer;font:inherit}
        #ccmms-share-chooser .ccmms-share-icon{width:58px;height:58px;border-radius:18px;display:grid;place-items:center;font-size:22px;font-weight:900;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14),0 8px 20px rgba(0,0,0,.22)}
        #ccmms-share-chooser .ccmms-share-option span:last-child{font-size:12px;font-weight:700;max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        #ccmms-share-chooser [data-share-target="whatsapp"] .ccmms-share-icon{background:#20b85a;color:white}
        #ccmms-share-chooser [data-share-target="gmail"] .ccmms-share-icon{background:white;color:#d93025}
        #ccmms-share-chooser [data-share-target="instagram"] .ccmms-share-icon{background:linear-gradient(135deg,#7c3aed,#db2777,#f59e0b);color:white}
        #ccmms-share-chooser [data-share-target="more"] .ccmms-share-icon{background:#1677ff;color:white}
        #ccmms-share-chooser .ccmms-share-note{margin:16px 0 0;padding-top:14px;border-top:1px solid #1f3340;color:#78909f;font-size:11px;text-align:center}
        @keyframes ccmmsSheetIn{from{transform:translateY(22px);opacity:.25}to{transform:translateY(0);opacity:1}}
        @media (min-width:700px){#ccmms-share-chooser{align-items:center}#ccmms-share-chooser .ccmms-share-sheet{border-radius:24px}}
      </style>
      <div class="ccmms-share-sheet">
        <div class="ccmms-share-handle"></div>
        <div class="ccmms-share-title">
          <h3>Share report</h3>
          <button type="button" class="ccmms-share-close" aria-label="Close share options">×</button>
        </div>
        <p class="ccmms-share-subtitle">Choose where you want to send this CCMMS report.</p>
        <div class="ccmms-share-grid">
          <button type="button" class="ccmms-share-option" data-share-target="whatsapp" aria-label="Share with WhatsApp">
            <span class="ccmms-share-icon">WA</span><span>WhatsApp</span>
          </button>
          <button type="button" class="ccmms-share-option" data-share-target="gmail" aria-label="Share with Gmail">
            <span class="ccmms-share-icon">M</span><span>Gmail</span>
          </button>
          <button type="button" class="ccmms-share-option" data-share-target="instagram" aria-label="Share with Instagram">
            <span class="ccmms-share-icon">IG</span><span>Instagram</span>
          </button>
          <button type="button" class="ccmms-share-option" data-share-target="more" aria-label="Show all sharing apps">
            <span class="ccmms-share-icon">•••</span><span>More apps</span>
          </button>
        </div>
        <p class="ccmms-share-note">Only installed and compatible apps can receive a share.</p>
      </div>`;

    const finish = (value) => {
      overlay.remove();
      resolve(value);
    };

    overlay.addEventListener('click', async (event) => {
      if (event.target === overlay || event.target.closest('.ccmms-share-close')) {
        finish(false);
        return;
      }

      const button = event.target.closest('[data-share-target]');
      if (!button) return;

      const target = button.getAttribute('data-share-target');
      button.disabled = true;
      try {
        const result = await shareWithTarget(target, heading, shareBody, filename);
        finish(result !== false);
      } catch (error) {
        console.error('Share target failed:', error);
        button.disabled = false;
        // The user can still try the full system chooser.
        await openSystemShare(heading, shareBody, filename);
        finish(true);
      }
    });

    document.body.appendChild(overlay);
  });
}

/**
 * Share report content through a mobile-friendly chooser.
 *
 * The app now presents explicit WhatsApp, Gmail, Instagram and "More apps"
 * actions first. Inside the Android APK those buttons use the native bridge;
 * in a normal mobile browser they use supported deep links / Web Share.
 */
export async function shareTextFile({ filename, content, mimeType = 'text/csv', title, text }) {
  void mimeType;
  const heading = title || filename || 'CCMMS Report';
  const intro = String(text || '').trim();
  const report = String(content || '').trim();
  const shareBody = [intro, report].filter(Boolean).join('\n\n') || heading;

  return createShareChooser({ heading, shareBody, filename });
}
