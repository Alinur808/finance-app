import { useMemo } from 'react';
import { Globe2, Lock } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { useSubscription } from '../../context/SubscriptionContext.jsx';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { ACCOUNTS } from '../../data/accounts.js';
import { accountBalances } from '../../utils/analytics.js';
import { REFERENCE_RATES } from '../../utils/fxRates.js';
import { groupDigits, MONEY_MASK } from '../../utils/format.js';
import { Card } from '../ui.jsx';

const CURRENCIES = [
  ['USD', '$'],
  ['EUR', '€'],
  ['AED', ''], // код валюты уже в подписи
];

/** Мультивалютный капитал (Private): весь капитал в тенге, долларах, евро и дирхамах по ориентировочному курсу. */
export default function CapitalCurrencies() {
  const { transactions, settings } = useFinance();
  const { isPrivate, openPaywall } = useSubscription();
  const { hidden, money } = usePrivacy();
  const total = useMemo(() => Object.values(accountBalances(transactions, ACCOUNTS, settings.openings)).reduce((a, b) => a + b, 0), [transactions, settings.openings]);

  if (!isPrivate) {
    return (
      <button onClick={() => openPaywall('capital')} className="pressable flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-card" data-testid="capital-locked">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-50 text-amber-700">
          <Globe2 size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold">Капитал в $, € и AED</span>
          <span className="block text-[13px] text-ink-muted">Мультивалютный капитал — в Private</span>
        </span>
        <Lock size={16} className="shrink-0 text-ink-muted" />
      </button>
    );
  }

  return (
    <Card className="p-4" data-testid="capital-currencies">
      <div className="mb-2 flex items-center gap-2">
        <Globe2 size={17} className="text-brand-600" />
        <h3 className="flex-1 text-[15px] font-semibold">Капитал в валютах</h3>
        <span className="tabular text-[13px] font-semibold">{money(total, { decimals: false })}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {CURRENCIES.map(([code, sign]) => (
          <div key={code} className="min-w-0 rounded-2xl bg-gray-50 px-3 py-2">
            <p className="text-[11px] text-ink-muted">{code}</p>
            <p className="tabular truncate text-[15px] font-semibold">{hidden ? MONEY_MASK.replace('₸', sign).trim() : `${groupDigits(total / REFERENCE_RATES[code], { decimals: false })}${sign ? ` ${sign}` : ''}`}</p>
          </div>
        ))}
      </div>
      {!hidden && (
        <p className="mt-2 text-[11px] text-ink-muted">
          Ориентировочный курс: $1 = {String(REFERENCE_RATES.USD).replace('.', ',')} ₸, €1 = {REFERENCE_RATES.EUR} ₸.
        </p>
      )}
    </Card>
  );
}
