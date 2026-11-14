import { nativePlugin } from './bridge.js';

/**
 * Покупки в App Store / Google Play через RevenueCat.
 *
 * Веб (PWA, GitHub Pages): плагина нет — работает режим Preview: «покупка»
 * просто включает Private на этом устройстве, деньги не списываются.
 *
 * Capacitor: установите @revenuecat/purchases-capacitor и один раз вызовите
 * `configureBilling({ apiKey })` при старте (ключ RevenueCat для iOS/Android).
 * Плагин регистрируется как window.Capacitor.Plugins.Purchases — этот модуль
 * найдёт его сам. Товары создайте в App Store Connect / Play Console с id ниже
 * и привяжите к entitlement `private` в RevenueCat.
 */
export const ENTITLEMENT_ID = 'private';

export const PLANS = {
  monthly: { id: 'monthly', productId: 'private_monthly', label: 'Месяц', price: 2990, period: 'мес', note: 'Помесячно, отмена в любой момент' },
  annual: { id: 'annual', productId: 'private_annual', label: 'Год', price: 24990, period: 'год', note: '≈ 2 083 ₸ в месяц', badge: '−30%' },
  lifetime: { id: 'lifetime', productId: 'private_lifetime', label: 'Навсегда', price: 79990, period: null, note: 'Один платёж, без подписки' },
};

const purchases = () => nativePlugin('Purchases');

/** Есть ли настоящий магазин (Capacitor + RevenueCat). */
export const hasStoreBilling = () => Boolean(purchases());

export async function configureBilling({ apiKey, appUserID } = {}) {
  const p = purchases();
  if (!p || !apiKey) return false;
  await p.configure({ apiKey, appUserID });
  return true;
}

const isEntitled = (customerInfo) => Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);

/** Цены из магазина (локализованные строки) — поверх цен по умолчанию. */
export async function loadStorePrices() {
  const p = purchases();
  if (!p) return null;
  try {
    const offerings = await p.getOfferings();
    const packages = offerings?.current?.availablePackages ?? [];
    const byProduct = Object.fromEntries(packages.map((pkg) => [pkg.product.identifier, pkg.product.priceString]));
    return Object.fromEntries(Object.values(PLANS).map((plan) => [plan.id, byProduct[plan.productId] ?? null]));
  } catch {
    return null;
  }
}

/**
 * Покупка тарифа. Возвращает { status: 'purchased' | 'cancelled' | 'preview' | 'error', message? }.
 */
export async function purchasePlan(planId) {
  const plan = PLANS[planId];
  const p = purchases();
  if (!p) return { status: 'preview' };
  try {
    const offerings = await p.getOfferings();
    const pkg = offerings?.current?.availablePackages?.find((x) => x.product.identifier === plan.productId);
    if (!pkg) return { status: 'error', message: 'Тариф пока недоступен в магазине' };
    const { customerInfo } = await p.purchasePackage({ aPackage: pkg });
    return isEntitled(customerInfo) ? { status: 'purchased' } : { status: 'error', message: 'Покупка не подтверждена магазином' };
  } catch (e) {
    if (e?.userCancelled || e?.code === '1' || /cancel/i.test(e?.message ?? '')) return { status: 'cancelled' };
    return { status: 'error', message: e?.message || 'Не удалось завершить покупку' };
  }
}

/** «Восстановить покупки» — обязательная кнопка для App Store. */
export async function restorePurchases() {
  const p = purchases();
  if (!p) return { status: 'preview' };
  try {
    const { customerInfo } = await p.restorePurchases();
    return { status: isEntitled(customerInfo) ? 'restored' : 'none' };
  } catch (e) {
    return { status: 'error', message: e?.message || 'Не удалось связаться с магазином' };
  }
}

/** Текущий статус подписки в магазине (при запуске приложения). */
export async function fetchEntitlement() {
  const p = purchases();
  if (!p) return null;
  try {
    const { customerInfo } = await p.getCustomerInfo();
    return isEntitled(customerInfo);
  } catch {
    return null;
  }
}
