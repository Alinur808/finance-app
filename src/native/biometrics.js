import { nativePlugin } from './bridge.js';

/**
 * Face ID / Touch ID для экрана код-пароля. В браузере недоступно.
 * Под Capacitor подходит плагин с API capacitor-native-biometric
 * (`NativeBiometric.isAvailable()` / `verifyIdentity()`): установите его —
 * экран блокировки сам покажет кнопку Face ID. Код-пароль остаётся запасным
 * способом, как в банковских приложениях.
 */
const plugin = () => nativePlugin('NativeBiometric');

export async function biometricAvailable() {
  try {
    const result = await plugin()?.isAvailable?.();
    return Boolean(result?.isAvailable);
  } catch {
    return false;
  }
}

/** true — личность подтверждена; false — отмена или ошибка. */
export async function authenticateBiometric(reason = 'Разблокировать «Финансы»') {
  const p = plugin();
  if (!p) return false;
  try {
    await p.verifyIdentity({ reason, title: 'Финансы', subtitle: reason, description: '' });
    return true;
  } catch {
    return false;
  }
}
