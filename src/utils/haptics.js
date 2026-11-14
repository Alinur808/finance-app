import { nativePlugin } from '../native/bridge.js';
import { readJSON, writeJSON } from './storage.js';

/**
 * Тактильный отклик.
 *  - в Capacitor-приложении — @capacitor/haptics (Taptic Engine на iPhone);
 *  - в браузере — navigator.vibrate (Android Chrome; Safari его не поддерживает —
 *    тогда вызов просто ничего не делает).
 *
 * haptic('light' | 'medium' | 'heavy' | 'selection' | 'success' | 'warning' | 'error')
 */
const KEY = 'tenge-finance.haptics';
const PATTERNS = { selection: 6, light: 8, medium: 14, heavy: 22, success: [10, 40, 14], warning: [16, 50, 16], error: [24, 40, 24, 40, 24] };
const IMPACT = { light: 'LIGHT', medium: 'MEDIUM', heavy: 'HEAVY' };
const NOTIFY = { success: 'SUCCESS', warning: 'WARNING', error: 'ERROR' };

let enabled = readJSON(KEY, true) !== false;

export const hapticsEnabled = () => enabled;
export function setHapticsEnabled(on) {
  enabled = Boolean(on);
  writeJSON(KEY, enabled);
}

export function haptic(style = 'light') {
  if (!enabled) return;
  try {
    const native = nativePlugin('Haptics');
    if (native) {
      if (style === 'selection') native.selectionChanged?.();
      else if (NOTIFY[style]) native.notification?.({ type: NOTIFY[style] });
      else native.impact?.({ style: IMPACT[style] ?? 'LIGHT' });
      return;
    }
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') navigator.vibrate(PATTERNS[style] ?? PATTERNS.light);
  } catch {
    /* отклик — украшение, ошибки не важны */
  }
}
