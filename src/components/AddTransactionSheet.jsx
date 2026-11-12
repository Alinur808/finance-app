import { useEffect, useState } from 'react';
import { useAccounts } from '../hooks/useAccounts.js';
import { categoryList } from '../data/categories.js';
import { addDays, dayKey } from '../utils/dates.js';
import { groupDigits } from '../utils/format.js';
import BottomSheet from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { PrimaryButton } from './ui.jsx';

const blank = () => ({ type: 'expense', amount: '', categoryId: null, merchant: '', accountId: 'kaspi', day: dayKey(new Date()) });

/** Add-transaction flow: type → amount → category → details → save. */
export default function AddTransactionSheet({ open, onClose, onSave }) {
  const { accounts } = useAccounts();
  const [form, setForm] = useState(blank);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  useEffect(() => {
    if (open) setForm(blank());
  }, [open]);

  const amount = Number(form.amount || 0);
  const valid = amount > 0 && form.categoryId;
  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  const expense = form.type === 'expense';

  const submit = () => {
    if (!valid) return;
    const now = new Date();
    const [y, m, d] = form.day.split('-').map(Number);
    const date = new Date(y, m - 1, d, now.getHours(), now.getMinutes());
    onSave({ type: form.type, amount, categoryId: form.categoryId, merchant: form.merchant.trim(), accountId: form.accountId, date: date.toISOString() });
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Новая операция"
      tall
      footer={
        <PrimaryButton disabled={!valid} onClick={submit}>
          {valid ? `Добавить ${expense ? 'расход' : 'доход'}` : 'Укажите сумму и категорию'}
        </PrimaryButton>
      }
    >
      <div className="grid grid-cols-2 rounded-2xl bg-gray-100 p-1">
        {['expense', 'income'].map((t) => (
          <button
            key={t}
            onClick={() => set({ type: t, categoryId: null })}
            className={`h-10 rounded-xl text-sm font-semibold transition ${form.type === t ? 'bg-white shadow-card' : 'text-ink-muted'}`}
          >
            {t === 'expense' ? 'Расход' : 'Доход'}
          </button>
        ))}
      </div>

      <label className="mt-5 block text-center">
        <span className="text-xs font-medium uppercase tracking-wider text-ink-muted">Сумма</span>
        <div className={`mt-1 flex items-baseline justify-center gap-2 ${expense ? 'text-ink' : 'text-brand-600'}`}>
          <span className="text-3xl font-bold">{expense ? '−' : '+'}</span>
          <input
            autoFocus
            inputMode="numeric"
            placeholder="0"
            value={form.amount ? groupDigits(form.amount) : ''}
            onChange={(e) => set({ amount: e.target.value.replace(/\D/g, '').slice(0, 10) })}
            style={{ width: `${Math.max(1, (form.amount ? groupDigits(form.amount) : '0').length) * 0.68}em` }}
            className="tabular min-w-0 max-w-[240px] bg-transparent text-center text-[44px] font-extrabold tracking-tight outline-none placeholder:text-gray-300"
            aria-label="Сумма в тенге"
          />
          <span className="text-3xl font-bold text-ink-muted">₸</span>
        </div>
      </label>

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Категория</p>
      <div className="grid grid-cols-4 gap-2">
        {categoryList(form.type).map((c) => {
          const on = form.categoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => set({ categoryId: c.id })}
              className={`flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 transition active:scale-95 ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-gray-50'}`}
            >
              <CategoryIcon categoryId={c.id} size={40} />
              <span className="line-clamp-1 text-[11px] font-semibold text-ink-soft">{c.short}</span>
            </button>
          );
        })}
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Описание</p>
      <input
        value={form.merchant}
        onChange={(e) => set({ merchant: e.target.value })}
        placeholder={expense ? 'Например, Magnum' : 'Например, зарплата'}
        className="h-12 w-full rounded-2xl bg-gray-100 px-4 text-[15px] outline-none ring-brand-500 placeholder:text-ink-muted focus:ring-2"
      />

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Счёт</p>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => set({ accountId: a.id })}
            className={`flex h-11 shrink-0 items-center gap-2 rounded-2xl px-3.5 text-sm font-semibold transition ${form.accountId === a.id ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}
          >
            <a.icon size={16} />
            {a.name}
          </button>
        ))}
      </div>

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Дата</p>
      <div className="flex gap-2">
        {[
          { k: today, l: 'Сегодня' },
          { k: yesterday, l: 'Вчера' },
        ].map((o) => (
          <button
            key={o.k}
            onClick={() => set({ day: o.k })}
            className={`h-11 rounded-2xl px-4 text-sm font-semibold ${form.day === o.k ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}
          >
            {o.l}
          </button>
        ))}
        <input
          type="date"
          max={today}
          value={form.day}
          onChange={(e) => e.target.value && set({ day: e.target.value })}
          className={`h-11 flex-1 rounded-2xl px-3 text-sm font-semibold outline-none ${form.day !== today && form.day !== yesterday ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}
          aria-label="Выбрать дату"
        />
      </div>
    </BottomSheet>
  );
}
