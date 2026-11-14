import { useEffect, useMemo, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import { useAccounts } from '../hooks/useAccounts.js';
import { categoryList } from '../data/categories.js';
import { addDays, dayKey } from '../utils/dates.js';
import { amountToNumber, displayAmount, sanitizeAmount } from '../utils/amountInput.js';
import BottomSheet from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { PrimaryButton } from './ui.jsx';

const blank = () => ({ type: 'expense', amount: '', categoryId: null, merchant: '', accountId: 'kaspi', day: dayKey(new Date()) });
const chip = (on) => `pressable h-11 shrink-0 rounded-2xl px-4 text-[15px] font-semibold ${on ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`;

/**
 * Быстрый ввод операции: сумма (цифровая клавиатура с запятой) → категория
 * (часто используемые — первыми) → при желании описание, счёт и дата.
 */
export default function AddTransactionSheet({ open, onClose, onSave }) {
  const { transactions } = useFinance();
  const { accounts } = useAccounts();
  const [form, setForm] = useState(blank);
  const amountRef = useRef(null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (!open) return undefined;
    setForm(blank());
    // фокус после анимации листа — iOS иначе может не показать клавиатуру
    const t = setTimeout(() => amountRef.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [open]);

  // категории, которыми пользуются чаще, — в начале сетки
  const usage = useMemo(() => {
    const counts = new Map();
    for (const t of transactions.slice(0, 500)) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    return counts;
  }, [transactions]);
  const categories = useMemo(
    () => categoryList(form.type).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)),
    [form.type, usage],
  );

  const amount = amountToNumber(form.amount);
  const valid = amount > 0 && form.categoryId;
  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  const expense = form.type === 'expense';

  const submit = () => {
    if (!valid) return;
    const now = new Date();
    const [y, m, d] = form.day.split('-').map(Number);
    const date = new Date(y, m - 1, d, now.getHours(), now.getMinutes());
    onSave({ type: form.type, amount: Math.round(amount * 100) / 100, categoryId: form.categoryId, merchant: form.merchant.trim(), accountId: form.accountId, date: date.toISOString() });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Новая операция"
      tall
      footer={
        <PrimaryButton disabled={!valid} onClick={submit}>
          {valid ? `Добавить ${expense ? 'расход' : 'доход'}` : amount > 0 ? 'Выберите категорию' : 'Введите сумму'}
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            onClick={() => set({ type: t, categoryId: null })}
            className={`h-10 rounded-xl text-[15px] font-semibold transition-colors ${form.type === t ? 'bg-white shadow-card' : 'text-ink-muted'}`}
          >
            {t === 'expense' ? 'Расход' : 'Доход'}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Сумма</span>
        <div className={`mt-1 flex items-baseline justify-center gap-2 ${expense ? 'text-ink' : 'text-brand-600'}`}>
          <span className="text-3xl font-bold">{expense ? '−' : '+'}</span>
          <input
            ref={amountRef}
            id="tx-amount"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0"
            value={displayAmount(form.amount)}
            onChange={(e) => set({ amount: sanitizeAmount(e.target.value) })}
            style={{ width: `${Math.max(1, displayAmount(form.amount).length || 1) * 0.6 + 0.2}em` }}
            className="min-w-0 max-w-[260px] bg-transparent text-center text-[44px] font-extrabold tracking-tight outline-none placeholder:text-gray-300"
            aria-label="Сумма в тенге"
          />
          <span className="text-3xl font-bold text-ink-muted">₸</span>
        </div>
      </label>

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Категория</p>
      <div className="grid grid-cols-4 gap-2">
        {categories.map((c) => {
          const on = form.categoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => set({ categoryId: c.id })}
              aria-pressed={on}
              className={`pressable flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-gray-50'}`}
            >
              <CategoryIcon categoryId={c.id} size={40} />
              <span className="line-clamp-1 text-[11px] font-semibold text-ink-soft">{c.short}</span>
            </button>
          );
        })}
      </div>

      <label htmlFor="tx-merchant" className="mb-2 mt-5 block text-sm font-semibold text-ink-soft">
        Описание
      </label>
      <input
        id="tx-merchant"
        value={form.merchant}
        onChange={(e) => set({ merchant: e.target.value })}
        maxLength={80}
        enterKeyHint="done"
        placeholder={expense ? 'Например, Magnum' : 'Например, зарплата'}
        className="h-12 w-full rounded-2xl bg-gray-100 px-4 text-base outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-brand-500"
      />

      {accounts.length > 1 && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Счёт</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {accounts.map((a) => (
              <button key={a.id} onClick={() => set({ accountId: a.id })} className={`${chip(form.accountId === a.id)} flex items-center gap-2`}>
                <a.icon size={16} />
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Дата</p>
      <div className="flex gap-2">
        <button onClick={() => set({ day: today })} className={chip(form.day === today)}>
          Сегодня
        </button>
        <button onClick={() => set({ day: yesterday })} className={chip(form.day === yesterday)}>
          Вчера
        </button>
        <input
          id="tx-date"
          type="date"
          max={today}
          value={form.day}
          onChange={(e) => e.target.value && set({ day: e.target.value })}
          className={`h-11 min-w-0 flex-1 rounded-2xl px-3 text-base font-semibold outline-none ${form.day !== today && form.day !== yesterday ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}
          aria-label="Выбрать дату"
        />
      </div>
    </BottomSheet>
  );
}
