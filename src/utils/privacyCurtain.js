/**
 * Шторка приватности для переключателя приложений iOS/Android.
 *
 * Снимок экрана для переключателя система делает в момент ухода в фон, поэтому
 * шторку нужно показать синхронно — в самом обработчике события, без ожидания
 * отрисовки React. Мы ставим класс на <html>, а CSS (index.css) мгновенно
 * показывает непрозрачный слой Obsidian поверх балансов и графиков.
 *
 *   показать: blur окна, pagehide, visibilitychange → hidden
 *   убрать:   focus, pageshow, visibilitychange → visible
 *
 * Работает и без код-пароля: суммы не видны в переключателе никогда.
 */
const CLASS = 'privacy-curtain';
let installed = false;

export function installPrivacyCurtain(win = typeof window !== 'undefined' ? window : null) {
  if (!win || installed) return () => {};
  installed = true;
  const doc = win.document;
  const root = doc.documentElement;

  const curtain = doc.createElement('div');
  curtain.id = 'privacy-curtain';
  curtain.setAttribute('aria-hidden', 'true');
  const mark = doc.createElement('div');
  mark.className = 'privacy-curtain-mark';
  mark.textContent = '₸';
  curtain.appendChild(mark);
  doc.body.appendChild(curtain);

  const show = () => root.classList.add(CLASS);
  const hide = () => root.classList.remove(CLASS);
  const onVisibility = () => (doc.visibilityState === 'hidden' ? show() : hide());
  // focus возвращается позже visibilitychange; на iOS иногда приходит только pageshow
  const onFocus = () => doc.visibilityState !== 'hidden' && hide();

  win.addEventListener('blur', show);
  win.addEventListener('pagehide', show);
  win.addEventListener('focus', onFocus);
  win.addEventListener('pageshow', onFocus);
  doc.addEventListener('visibilitychange', onVisibility);

  return () => {
    installed = false;
    win.removeEventListener('blur', show);
    win.removeEventListener('pagehide', show);
    win.removeEventListener('focus', onFocus);
    win.removeEventListener('pageshow', onFocus);
    doc.removeEventListener('visibilitychange', onVisibility);
    curtain.remove();
    hide();
  };
}
