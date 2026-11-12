import { useMemo } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import { resolveAccounts } from '../data/accounts.js';

/**
 * Счета с названиями из настроек пользователя.
 * Используйте вместо прямого импорта ACCOUNTS везде, где название видно на экране.
 */
export function useAccounts() {
  const { settings } = useFinance();
  return useMemo(() => {
    const accounts = resolveAccounts(settings);
    const getAccount = (id) => accounts.find((a) => a.id === id) ?? accounts[0];
    return { accounts, getAccount };
  }, [settings]);
}
