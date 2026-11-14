import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchEntitlement, hasStoreBilling, purchasePlan, restorePurchases } from '../native/billing.js';
import { readJSON, writeJSON } from '../utils/storage.js';
import { haptic } from '../utils/haptics.js';
import PaywallSheet from '../components/membership/PaywallSheet.jsx';
import { STANDARD_LIMITS, TIERS } from '../data/membership.js';

export { FEATURES, STANDARD_LIMITS, TIERS } from '../data/membership.js';

/**
 * Тарифы приложения.
 *   Standard (бесплатно) — ручной учёт, первая выписка, аналитика, Stealth Mode.
 *   Private (Membership) — стратег без ограничений и ИИ-разбор, история выписок
 *   за много периодов, безлимитные цели дневника, код-пароль.
 *
 * Состояние — отдельный ключ tenge-finance.membership (не в резервной копии:
 * покупка привязана к Apple ID / Google-аккаунту, а не к файлу данных).
 * В Capacitor источник правды — RevenueCat (см. native/billing.js); в вебе —
 * Preview-переключатель в Профиле.
 */
const KEY = 'tenge-finance.membership';

const UNLIMITED = { insights: Infinity, diaryItems: Infinity };

const DEFAULT_STATE = { tier: 'standard', source: 'default', plan: null, since: null };
const SubscriptionContext = createContext(null);

const readState = () => {
  const saved = readJSON(KEY, null);
  return saved && TIERS[saved.tier] ? { ...DEFAULT_STATE, ...saved } : DEFAULT_STATE;
};

export function SubscriptionProvider({ children }) {
  const [state, setState] = useState(readState);
  const [paywall, setPaywall] = useState(null); // null | { feature }
  const store = hasStoreBilling();

  useEffect(() => {
    writeJSON(KEY, state);
  }, [state]);

  // В нативной сборке статус берём из магазина при каждом запуске.
  useEffect(() => {
    if (!store) return;
    fetchEntitlement().then((active) => {
      if (active == null) return;
      setState((s) => (active ? { ...s, tier: 'private', source: 'store' } : s.source === 'store' ? { ...DEFAULT_STATE } : s));
    });
  }, [store]);

  const isPrivate = state.tier === 'private';

  const openPaywall = useCallback((feature = null) => {
    haptic('light');
    setPaywall({ feature });
  }, []);
  const closePaywall = useCallback(() => setPaywall(null), []);

  /** true — можно; false — открыт пейвол. Для кнопок: `if (!require('passcode')) return;` */
  const require = useCallback(
    (feature) => {
      if (isPrivate) return true;
      openPaywall(feature);
      return false;
    },
    [isPrivate, openPaywall],
  );

  const activate = useCallback((plan, source) => setState({ tier: 'private', source, plan, since: new Date().toISOString() }), []);

  const purchase = useCallback(
    async (planId) => {
      const result = await purchasePlan(planId);
      if (result.status === 'purchased') activate(planId, 'store');
      if (result.status === 'preview') activate(planId, 'preview');
      if (result.status === 'purchased' || result.status === 'preview') haptic('success');
      if (result.status === 'error') haptic('error');
      return result;
    },
    [activate],
  );

  const restore = useCallback(async () => {
    const result = await restorePurchases();
    if (result.status === 'restored') activate(state.plan ?? 'annual', 'store');
    return result;
  }, [activate, state.plan]);

  /** Preview-переключатель из Профиля (только веб, до подключения RevenueCat). */
  const setPreviewTier = useCallback((tier) => {
    if (!TIERS[tier]) return;
    haptic('selection');
    setState(tier === 'private' ? { tier, source: 'preview', plan: 'annual', since: new Date().toISOString() } : { ...DEFAULT_STATE });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      isPrivate,
      hasStore: store,
      limits: isPrivate ? UNLIMITED : STANDARD_LIMITS,
      can: () => isPrivate,
      require,
      openPaywall,
      purchase,
      restore,
      setPreviewTier,
    }),
    [state, isPrivate, store, require, openPaywall, purchase, restore, setPreviewTier],
  );

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <PaywallSheet open={Boolean(paywall)} feature={paywall?.feature} onClose={closePaywall} />
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) throw new Error('useSubscription must be used inside <SubscriptionProvider>');
  return ctx;
}
