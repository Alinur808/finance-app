/**
 * localStorage без исключений: приватный режим Safari, отключённые cookies,
 * SSR/тесты в Node и WebView без хранилища просто возвращают запасное значение.
 */
const hasWindow = () => typeof window !== 'undefined';

export function readJSON(key, fallback) {
  if (!hasWindow()) return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJSON(key, value) {
  if (!hasWindow()) return false;
  try {
    if (value === undefined || value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
