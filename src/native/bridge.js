/**
 * Мост к нативным плагинам Capacitor. В браузере (PWA, GitHub Pages) плагинов
 * нет — функции возвращают null, и приложение использует веб-запасные варианты.
 * Пакеты @capacitor/* не импортируются: Capacitor сам кладёт плагины в
 * window.Capacitor.Plugins, поэтому веб-сборка не зависит от них.
 */
export const isNativePlatform = () => typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.() === true;

export function nativePlugin(name) {
  if (typeof window === 'undefined') return null;
  return window.Capacitor?.Plugins?.[name] ?? null;
}
