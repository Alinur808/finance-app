import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { dayKey } from '../../utils/dates.js';
import { groupDigits } from '../../utils/format.js';
import BottomSheet from '../BottomSheet.jsx';
import { PrimaryButton } from '../ui.jsx';

const EMOJIS = ['🛟', '✈️', '🏠', '🚗', '💻', '🎓', '💍', '🎁'];

function MoneyField({ label, value, onChange }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-ink-soft">{label}</span>
      <div className="flex h-12 items-center rounded-2xl bg-gray-100 px-4 focus-within:ring-2 focus-within:ring-brand-500">
        <input
          inputMode="numeric"
          value={value ? groupDigits(value) : ''}
          placeholder="0"
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, '').slice(0, 10)))}
          className="w-full bg-transparent text-base font-semibold outline-none"
        />
        <span className="font-semibold text-ink-muted">₸</span>
      </div>
    </label>
  );
}

export default function GoalFormSheet({ open, goal, template, onClose, onSave, onDelete }) {
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!open) return;
    const d = new Date();
    d.setMonth(d.getMonth() + 3);
    setForm(
      goal
        ? { ...goal, deadline: dayKey(goal.deadline) }
        : { id: null, name: template?.name ?? '', emoji: template?.emoji ?? '🛟', target: template?.target ?? 300000, saved: 0, deadline: dayKey(d) },
    );
  }, [open, goal, template]);
  if (!open || !form) return null;

  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const valid = form.name.trim() && form.target > 0 && form.saved <= form.target && form.deadline;

  const save = () => {
    const [y, m, d] = form.deadline.split('-').map(Number);
    onSave({ ...form, id: form.id ?? `goal-${Date.now()}`, name: form.name.trim(), deadline: new Date(y, m - 1, d).toISOString() });
  };

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={goal ? 'Изменить цель' : 'Новая цель'}
      footer={
        <PrimaryButton disabled={!valid} onClick={save}>
          {goal ? 'Сохранить' : 'Создать цель'}
        </PrimaryButton>
      }
    >
      <div className="space-y-5 pt-1">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {EMOJIS.map((e) => (
            <button
              key={e}
              onClick={() => set({ emoji: e })}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-2xl ${form.emoji === e ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-gray-100'}`}
              aria-label={`Значок ${e}`}
            >
              {e}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink-soft">Название</span>
          <input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            placeholder="Например, новый ноутбук"
            className="h-12 w-full rounded-2xl bg-gray-100 px-4 text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink-muted focus:ring-2 focus:ring-brand-500"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {[300000, 500000, 1000000, 2000000].map((v) => (
            <button key={v} onClick={() => set({ target: v })} className={`h-9 rounded-full px-3.5 text-sm font-semibold ${form.target === v ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}>
              {groupDigits(v)} ₸
            </button>
          ))}
        </div>
        <MoneyField label="Сколько нужно" value={form.target} onChange={(v) => set({ target: v })} />
        <MoneyField label="Уже накоплено" value={form.saved} onChange={(v) => set({ saved: v })} />
        {form.saved > form.target && <p className="-mt-3 text-[12px] text-red-600">Накоплено не может быть больше цели.</p>}
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-ink-soft">Срок</span>
          <input
            type="date"
            min={dayKey(new Date())}
            value={form.deadline}
            onChange={(e) => set({ deadline: e.target.value })}
            className="h-12 w-full rounded-2xl bg-gray-100 px-4 text-base font-semibold outline-none focus:ring-2 focus:ring-brand-500"
          />
        </label>
        {goal && (
          <button onClick={() => onDelete(goal.id)} className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 font-semibold text-red-600">
            <Trash2 size={17} /> Удалить цель
          </button>
        )}
      </div>
    </BottomSheet>
  );
}
