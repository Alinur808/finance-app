import { CreditCard, Banknote } from 'lucide-react';
import statement from './statement.json';

/** Название карты, пока пользователь не задал своё в Профиле. */
export const DEFAULT_CARD_NAME = 'Основная карта';

/**
 * Счета приложения. Названия по умолчанию нейтральные: приложением может
 * пользоваться клиент любого банка, а своё название карты он задаёт в Профиле
 * (settings.cardName, хранится в localStorage и в резервной копии).
 *
 * id 'kaspi' — внутренний ключ: он остаётся прежним, чтобы старые резервные
 * копии и операции (accountId: 'kaspi') продолжали работать. На экране его не видно.
 *
 * `opening` — баланс до первой операции из выписки (0, если выписки нет).
 */
export const ACCOUNTS = [
  { id: 'kaspi', name: DEFAULT_CARD_NAME, kind: 'Банковская карта', icon: CreditCard, color: '#c9a35c', opening: statement.openingBalance },
  { id: 'cash', name: 'Наличные', kind: 'Кошелёк', icon: Banknote, color: '#0f8a5a', opening: 0 },
];

/** Счета с учётом пользовательского названия карты. */
export function resolveAccounts(settings = {}) {
  const cardName = settings.cardName?.trim();
  return ACCOUNTS.map((a) => (a.id === 'kaspi' && cardName ? { ...a, name: cardName } : a));
}

export const getAccount = (id) => ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
