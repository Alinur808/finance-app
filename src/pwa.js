import { flushFinanceState } from './context/FinanceContext.jsx';

/**
 * Автообновление PWA без ручной очистки кэша.
 *
 * Service worker (vite.config.js → workbox) сам вызывает skipWaiting() и
 * clientsClaim(): новая сборка с GitHub Pages активируется сразу и берёт под
 * контроль открытые вкладки, старые кэши удаляются (cleanupOutdatedCaches).
 * Здесь — вторая половина: когда сменился контроллер (controllerchange),
 * приложение тихо перезагружается на новую версию. Перед этим:
 *   - ждём, пока закроется открытый лист (не теряем введённую операцию);
 *   - дописываем зашифрованное сохранение (flushFinanceState).
 * Проверка обновлений — при каждом возврате в приложение и раз в 30 минут.
 */
const CHECK_EVERY_MS = 30 * 60 * 1000;

const sheetOpen = () => document.documentElement.classList.contains('sheet-open');

function whenSafeToReload() {
  return new Promise((resolve) => {
    if (!sheetOpen() || document.visibilityState === 'hidden') return resolve();
    const id = setInterval(() => {
      if (!sheetOpen() || document.visibilityState === 'hidden') {
        clearInterval(id);
        resolve();
      }
    }, 500);
  });
}

export function setupAutoUpdate({ swUrl = './sw.js' } = {}) {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  // первая установка тоже вызывает controllerchange — перезагружаемся только при обновлении
  let hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', async () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    await whenSafeToReload();
    try {
      await flushFinanceState();
    } catch {
      /* сохранение не удалось — данные останутся от прошлой записи */
    }
    window.location.reload();
  });

  const register = () =>
    navigator.serviceWorker
      .register(swUrl, { scope: './' })
      .then((reg) => {
        const check = () => reg.update().catch(() => {});
        setInterval(check, CHECK_EVERY_MS);
        document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && check());
      })
      .catch(() => {
        /* file://, приватный режим или нет sw.js (dev) — работаем без офлайна */
      });

  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
