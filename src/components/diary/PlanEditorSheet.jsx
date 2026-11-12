import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { dayKey } from '../../utils/dates.js';
import { groupDigits } from '../../utils/format.js';
import { WEEKDAY_OPTIONS } from '../../utils/schedule.js';
import BottomSheet from '../BottomSheet.jsx';
import { PrimaryButton } from '../ui.jsx';

const inputCls = 'h-11 rounded-xl bg-gray-100 px-3 text-[14px] outline-none focus:ring-2 focus:ring-brand-500';
const digits = (v) => Number(String(v).replace(/\D/g, '').slice(0, 10));

/** Редактор плана дневника: дедлайн, цели-покупки и регулярные поступления. */
export default function PlanEditorSheet({ open, plan, onClose, onSave }) {
  const [draft, setDraft] = useState(plan);
  useEffect(() => {
    if (open) setDraft(structuredClone(plan));
  }, [open, plan]);
  if (!open) return null;

  const setItem = (id, patch) => setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));
  const setIncome = (id, patch) => setDraft((d) => ({ ...d, incomes: d.incomes.map((i) => (i.id === id ? { ...i, ...patch } : i)) }));

  const errors = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.deadline)) errors.push('Укажите дату дедлайна');
  if (draft.items.some((i) => !i.name.trim() || !(i.amount > 0))) errors.push('У каждой цели должны быть название и сумма');
  if (draft.incomes.some((i) => !i.name.trim() || !(i.amount > 0))) errors.push('У каждого поступления должны быть название и сумма');
  if (draft.incomes.some((i) => i.rule.type === 'monthly' && !(i.rule.day >= 1 && i.rule.day <= 31))) errors.push('Число месяца — от 1 до 31');

  const save = () =>
    onSave({
      ...draft,
      items: draft.items.map((i) => ({ ...i, name: i.name.trim() })),
      incomes: draft.incomes.map((i) => ({ ...i, name: i.name.trim() })),
    });

  return (
    <BottomSheet
      open
      onClose={onClose}
      title="План до дедлайна"
      tall
      footer={
        <>
          {errors[0] && <p className="mb-2 text-center text-[13px] text-red-600">{errors[0]}</p>}
          <PrimaryButton disabled={errors.length > 0} onClick={save}>
            Сохранить план
          </PrimaryButton>
        </>
      }
    >
      <label htmlFor="plan-deadline" className="mb-2 mt-1 block text-sm font-semibold text-ink-soft">
        Дедлайн
      </label>
      <input id="plan-deadline" type="date" min={dayKey(new Date())} value={draft.deadline} onChange={(e) => setDraft((d) => ({ ...d, deadline: e.target.value }))} className={`${inputCls} w-full font-semibold`} />

      <p className="mb-2 mt-6 text-sm font-semibold text-ink-soft">Цели к дедлайну</p>
      <div className="space-y-2">
        {draft.items.map((item) => (
          <div key={item.id} className="flex gap-2">
            <input aria-label="Название цели" value={item.name} onChange={(e) => setItem(item.id, { name: e.target.value })} className={`${inputCls} min-w-0 flex-1`} />
            <input
              aria-label="Сумма цели, тенге"
              inputMode="numeric"
              value={item.amount ? groupDigits(item.amount) : ''}
              placeholder="0"
              onChange={(e) => setItem(item.id, { amount: digits(e.target.value) })}
              className={`${inputCls} tabular w-28 text-right font-semibold`}
            />
            <button onClick={() => setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== item.id) }))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-muted active:bg-red-50 active:text-red-600" aria-label={`Удалить «${item.name}»`}>
              <Trash2 size={17} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={() => setDraft((d) => ({ ...d, items: [...d.items, { id: `item-${Date.now()}`, name: '', amount: 0, paidOn: null }] }))}
        className="mt-2 flex h-10 items-center gap-1.5 text-[14px] font-semibold text-brand-700"
      >
        <Plus size={16} /> Добавить цель
      </button>

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Регулярные поступления</p>
      <div className="space-y-3">
        {draft.incomes.map((inc) => (
          <div key={inc.id} className="space-y-2 rounded-2xl bg-gray-50 p-3">
            <div className="flex gap-2">
              <input aria-label="Название поступления" value={inc.name} onChange={(e) => setIncome(inc.id, { name: e.target.value })} className={`${inputCls} min-w-0 flex-1 bg-white`} />
              <input
                aria-label="Сумма поступления, тенге"
                inputMode="numeric"
                value={inc.amount ? groupDigits(inc.amount) : ''}
                placeholder="0"
                onChange={(e) => setIncome(inc.id, { amount: digits(e.target.value) })}
                className={`${inputCls} tabular w-28 bg-white text-right font-semibold`}
              />
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Как часто"
                value={inc.rule.type}
                onChange={(e) => setIncome(inc.id, { rule: e.target.value === 'weekly' ? { type: 'weekly', weekday: 0 } : { type: 'monthly', day: 5 } })}
                className={`${inputCls} flex-1 bg-white`}
              >
                <option value="weekly">Каждую неделю</option>
                <option value="monthly">Каждый месяц</option>
              </select>
              {inc.rule.type === 'weekly' ? (
                <select aria-label="День недели" value={inc.rule.weekday} onChange={(e) => setIncome(inc.id, { rule: { type: 'weekly', weekday: Number(e.target.value) } })} className={`${inputCls} flex-1 bg-white`}>
                  {WEEKDAY_OPTIONS.map((w) => (
                    <option key={w.value} value={w.value}>
                      {w.label}
                    </option>
                  ))}
                </select>
              ) : (
                <label className="flex flex-1 items-center gap-2 text-[14px] text-ink-soft">
                  <input
                    aria-label="Число месяца"
                    inputMode="numeric"
                    value={inc.rule.day || ''}
                    onChange={(e) => setIncome(inc.id, { rule: { type: 'monthly', day: Math.min(31, digits(e.target.value)) } })}
                    className={`${inputCls} tabular w-16 bg-white text-center font-semibold`}
                  />
                  числа
                </label>
              )}
              <button onClick={() => setDraft((d) => ({ ...d, incomes: d.incomes.filter((i) => i.id !== inc.id) }))} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-ink-muted active:bg-red-50 active:text-red-600" aria-label={`Удалить «${inc.name}»`}>
                <Trash2 size={17} />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={() => setDraft((d) => ({ ...d, incomes: [...d.incomes, { id: `inc-${Date.now()}`, name: '', amount: 0, rule: { type: 'weekly', weekday: 0 } }] }))}
        className="mt-2 flex h-10 items-center gap-1.5 text-[14px] font-semibold text-brand-700"
      >
        <Plus size={16} /> Добавить поступление
      </button>
    </BottomSheet>
  );
}
