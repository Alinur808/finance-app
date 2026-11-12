import { CreditCard, Banknote } from 'lucide-react';
import statement from './statement.json';

/**
 * `opening` — баланс до первой операции из выписки. Он подобран так,
 * чтобы текущий баланс Kaspi Gold был ровно 265 568,92 ₸
 * (см. scripts/parse_kaspi_statement.py --balance).
 */
export const ACCOUNTS = [
  { id: 'kaspi', name: 'Kaspi Gold', kind: 'Карта *9396', icon: CreditCard, color: '#c9a35c', opening: statement.openingBalance },
  { id: 'cash', name: 'Наличные', kind: 'Кошелёк', icon: Banknote, color: '#0f8a5a', opening: 0 },
];

export const getAccount = (id) => ACCOUNTS.find((a) => a.id === id) ?? ACCOUNTS[0];
