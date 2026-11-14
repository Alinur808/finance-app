import { useEffect, useState } from 'react';
import { ChevronRight, Trash2 } from 'lucide-react';
import { useAccounts } from '../hooks/useAccounts.js';
import { categoryList, getCategory } from '../data/categories.js';
import { formatShortDate, formatTime } from '../utils/dates.js';
import { formatOriginal, formatTxAmount, maskMoneyInText, MONEY_MASK } from '../utils/format.js';
import { usePrivacy } from '../hooks/usePrivacy.js';
import BottomSheet from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';

/** Детали операции: можно поменять категорию (импорт иногда ошибается) или удалить. */
export default function TransactionDetailSheet({ tx, onClose, onDelete, onChangeCategory }) {
  const { getAccount } = useAccounts();
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { hidden } = usePrivacy();
  useEffect(() => {
    setPicking(false);
    setConfirmDelete(false);
  }, [tx?.id]);
  if (!tx) return null;

  const cat = getCategory(tx.categoryId);
  const acc = getAccount(tx.accountId);
  const rows = [
    ['Описание', tx.merchant || '—'],
    ...(tx.original ? [['Сумма в валюте', hidden ? `•••• ${tx.original.currency}` : formatOriginal(tx.original)]] : []),
    ['Счёт', acc.name],
    ['Дата', tx.noTime ? formatShortDate(tx.date) : `${formatShortDate(tx.date)}, ${formatTime(tx.date)}`],
    ...(tx.pending ? [['Статус', 'В обработке']] : []),
  ];
  // для переводов между своими счетами и курсовых разниц категорию не меняем — это служебные записи
  const editable = !cat.system;
  const options = categoryList(tx.type);

  return (
    <BottomSheet open onClose={onClose} title={tx.type === 'income' ? 'Доход' : 'Расход'}>
      <div className="flex flex-col items-center py-3">
        <CategoryIcon categoryId={tx.categoryId} size={64} />
        <p className={`mt-3 text-[32px] font-extrabold tracking-tight ${tx.type === 'income' ? 'text-brand-600' : ''}`}>{hidden ? MONEY_MASK : formatTxAmount(tx)}</p>
        <p className="max-w-full truncate text-center text-sm text-ink-muted">{tx.merchant || cat.name}</p>
      </div>

      <button
        onClick={() => editable && setPicking((v) => !v)}
        disabled={!editable}
        className="pressable mt-2 flex w-full items-center justify-between rounded-2xl bg-gray-50 px-4 py-3 text-left text-sm disabled:active:transform-none"
        aria-expanded={picking}
      >
        <span className="text-ink-muted">Категория</span>
        <span className="flex items-center gap-1 font-semibold">
          {cat.name}
          {editable && <ChevronRight size={16} className={`text-ink-muted transition-transform ${picking ? 'rotate-90' : ''}`} />}
        </span>
      </button>
      {picking && (
        <div className="mt-2 grid animate-rise-in grid-cols-4 gap-2">
          {options.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                onChangeCategory(tx.id, c.id);
                setPicking(false);
              }}
              className={`pressable flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 ${c.id === tx.categoryId ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-gray-50'}`}
            >
              <CategoryIcon categoryId={c.id} size={36} />
              <span className="line-clamp-1 text-[11px] font-semibold text-ink-soft">{c.short}</span>
            </button>
          ))}
        </div>
      )}

      <dl className="mt-2 divide-y divide-hairline rounded-2xl bg-gray-50">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm">
            <dt className="shrink-0 text-ink-muted">{k}</dt>
            <dd className="min-w-0 text-right font-semibold">{v}</dd>
          </div>
        ))}
      </dl>
      {tx.note && tx.source === 'freedom-pdf' && (
        <p className="mt-3 rounded-2xl bg-gray-50 px-4 py-3 text-[13px] leading-snug text-ink-soft">
          {hidden ? maskMoneyInText(tx.note).replace(/[\d.,]+\s(AED|USD|EUR|RUB)/g, '•••• $1') : tx.note}
        </p>
      )}
      {tx.noTime && <p className="mt-3 px-1 text-[12px] text-ink-muted">Из банковской выписки — время операции в ней не указано.</p>}

      <button
        onClick={() => (confirmDelete ? onDelete(tx.id) : setConfirmDelete(true))}
        className={`pressable mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl font-semibold ${confirmDelete ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600'}`}
      >
        <Trash2 size={18} /> {confirmDelete ? 'Нажмите ещё раз, чтобы удалить' : 'Удалить операцию'}
      </button>
    </BottomSheet>
  );
}
