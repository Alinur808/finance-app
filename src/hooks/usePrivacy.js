import { useCallback, useMemo } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import { formatMoney, maskMoneyInText, MONEY_MASK } from '../utils/format.js';
import { haptic } from '../utils/haptics.js';

const VEIL_MS = 160;

/**
 * Stealth Mode (Privacy Shield). Флаг — прежний settings.hideBalance, поэтому
 * старые данные и резервные копии работают без миграции.
 *
 *   const { hidden, toggle, money, text } = usePrivacy();
 *   money(4500)            → "4 500 ₸" или "•••••• ₸"
 *   text('Потрачено 4 500 ₸') → фраза с замаскированными суммами
 */
export function usePrivacy() {
  const { settings, updateSettings } = useFinance();
  const hidden = Boolean(settings.hideBalance);

  const toggle = useCallback(() => {
    haptic('medium');
    const root = typeof document !== 'undefined' ? document.documentElement : null;
    const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (!root || reduce) {
      updateSettings({ hideBalance: !hidden });
      return;
    }
    // суммы уходят в размытие → меняются → проявляются обратно
    root.classList.add('privacy-veil');
    setTimeout(() => {
      updateSettings({ hideBalance: !hidden });
      requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove('privacy-veil')));
    }, VEIL_MS);
  }, [hidden, updateSettings]);

  return useMemo(
    () => ({
      hidden,
      toggle,
      money: (value, opts) => (hidden ? MONEY_MASK : formatMoney(value, opts)),
      text: (s) => (hidden ? maskMoneyInText(s) : s),
    }),
    [hidden, toggle],
  );
}
