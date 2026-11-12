import { Trash2 } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts.js';
import { getCategory } from '../data/categories.js';
import { formatShortDate, formatTime } from '../utils/dates.js';
import { formatOriginal, formatTxAmount } from '../utils/format.js';
import BottomSheet from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';

export default function TransactionDetailSheet({ tx, onClose, onDelete }) {
  const { getAccount } = useAccounts();
  if (!tx) return null;
  const cat = getCategory(tx.categoryId);
  const acc = getAccount(tx.accountId);
  const rows = [
    ['Категория', cat.name],
    ['Описание', tx.merchant || '—'],
    ...(tx.original ? [['Сумма в валюте', formatOriginal(tx.original)]] : []),
    ['Счёт', `${acc.name} · ${acc.kind}`],
    ['Дата', tx.noTime ? formatShortDate(tx.date) : `${formatShortDate(tx.date)}, ${formatTime(tx.date)}`],
    ['Тип', tx.type === 'income' ? 'Доход' : 'Расход'],
  ];
  return (
    <BottomSheet open onClose={onClose} title="Операция">
      <div className="flex flex-col items-center py-3">
        <CategoryIcon categoryId={tx.categoryId} size={64} />
        <p className={`tabular mt-3 text-[32px] font-extrabold tracking-tight ${tx.type === 'income' ? 'text-brand-600' : ''}`}>{formatTxAmount(tx)}</p>
        <p className="text-center text-sm text-ink-muted">{tx.merchant}</p>
      </div>
      <dl className="mt-2 divide-y divide-gray-100 rounded-3xl bg-gray-50">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="shrink-0 text-ink-muted">{k}</dt>
            <dd className="text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {tx.note && tx.source === 'freedom-pdf' && <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[13px] leading-snug text-ink-soft">{tx.note}</p>}
      {tx.noTime && <p className="mt-3 px-1 text-[12px] text-ink-muted">Операция из банковской выписки — время в выписке не указано.</p>}
      <button
        onClick={() => onDelete(tx.id)}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-red-50 font-semibold text-red-600 active:bg-red-100"
      >
        <Trash2 size={18} /> Удалить операцию
      </button>
    </BottomSheet>
  );
}
