import { useEffect, useState } from 'react';
import { formatMoney, groupDigits } from '../../utils/format.js';
import BottomSheet from '../BottomSheet.jsx';
import { PrimaryButton } from '../ui.jsx';

export default function ContributeSheet({ goal, open, onClose, onConfirm }) {
  const [amount, setAmount] = useState(0);
  useEffect(() => {
    if (open) setAmount(0);
  }, [open]);
  if (!open || !goal) return null;
  const left = goal.target - goal.saved;
  const quick = [10000, 25000, 50000, 100000].filter((v) => v <= left);

  return (
    <BottomSheet
      open
      onClose={onClose}
      title={`Пополнить «${goal.name}»`}
      footer={
        <PrimaryButton disabled={!amount} onClick={() => onConfirm(Math.min(amount, left))}>
          {amount ? `Отложить ${formatMoney(Math.min(amount, left))}` : 'Выберите сумму'}
        </PrimaryButton>
      }
    >
      <p className="text-sm text-ink-muted">Осталось {formatMoney(left)}</p>
      <div className="mt-3 flex h-16 items-center rounded-2xl bg-gray-100 px-4 focus-within:ring-2 focus-within:ring-brand-500">
        <input
          autoFocus
          inputMode="numeric"
          placeholder="0"
          value={amount ? groupDigits(amount) : ''}
          onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '').slice(0, 10)))}
          className="tabular w-full bg-transparent text-3xl font-extrabold outline-none placeholder:text-gray-300"
        />
        <span className="text-2xl font-bold text-ink-muted">₸</span>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {quick.map((v) => (
          <button key={v} onClick={() => setAmount(v)} className={`h-10 rounded-full px-4 text-sm font-semibold ${amount === v ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}>
            +{groupDigits(v)} ₸
          </button>
        ))}
        <button onClick={() => setAmount(left)} className={`h-10 rounded-full px-4 text-sm font-semibold ${amount === left ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}>
          Всю сумму
        </button>
      </div>
    </BottomSheet>
  );
}
