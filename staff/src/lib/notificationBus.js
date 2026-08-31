const EVENT_NAME = 'campusfix:notifications-changed';
const STORAGE_KEY = 'campusfix_notifications_changed';

export function announceNotificationChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(EVENT_NAME));
  try {
    window.localStorage.setItem(STORAGE_KEY, `${Date.now()}-${Math.random()}`);
  } catch {
    // Local event still keeps the current tab in sync.
  }
}

export function subscribeNotificationChanges(handler) {
  if (typeof window === 'undefined') return () => {};
  const onLocal = () => handler();
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY) handler();
  };
  window.addEventListener(EVENT_NAME, onLocal);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onLocal);
    window.removeEventListener('storage', onStorage);
  };
}
