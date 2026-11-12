/**
 * Определение платформы для подсказки «На экран Домой».
 * Все проверки безопасны вне браузера (SSR/тесты): возвращают false.
 */

/** iPhone, iPod или iPad (iPadOS 13+ притворяется Mac, но у него есть тач-экран). */
export function isIOS() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return /iPad|iPhone|iPod/.test(ua) || iPadOS;
}

/** Safari на iOS (не Chrome/Firefox/Edge/Opera и не встроенный браузер Instagram/Telegram и т.п.). */
export function isIOSSafari() {
  if (!isIOS()) return false;
  const ua = navigator.userAgent || '';
  const otherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|YaBrowser|GSA\//.test(ua);
  const inAppWebView = /FBAN|FBAV|Instagram|Line\/|Telegram|WhatsApp/.test(ua);
  return /Safari/.test(ua) && !otherBrowser && !inAppWebView;
}

/** Приложение запущено с экрана «Домой» (без интерфейса браузера). */
export function isStandalone() {
  if (typeof window === 'undefined') return false;
  return window.navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true;
}

const DISMISS_KEY = 'tenge-finance.ios-install-hint-dismissed-at';
const REMIND_AFTER_DAYS = 14;

/** Показать подсказку: iOS Safari, открыто во вкладке, и пользователь не закрывал её последние 14 дней. */
export function shouldShowIOSInstallHint() {
  if (!isIOSSafari() || isStandalone()) return false;
  try {
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    return Date.now() - dismissedAt > REMIND_AFTER_DAYS * 86400000;
  } catch {
    return true; // хранилище недоступно (приватный режим) — просто показываем
  }
}

export function rememberIOSInstallHintDismissed() {
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* приватный режим: подсказка появится снова при следующем открытии */
  }
}
