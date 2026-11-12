import { AlertTriangle, FileText } from 'lucide-react';
import { formatFullDate } from '../utils/dates.js';
import { formatMoney, plural } from '../utils/format.js';

const TX_WORDS = ['операция', 'операции', 'операций'];
const day = (ymd) => formatFullDate(`${ymd}T12:00`);

/** Подтверждение импорта: JSON-копия заменяет всё, выписка — только свой период по карте. */
export default function ImportConfirm({ pending, onConfirm, onCancel }) {
  const statement = pending.kind === 'statement';
  const foreign = statement ? pending.transactions.filter((t) => t.original).length : 0;
  const rates = statement && pending.rates?.length ? pending.rates.map((r) => r.rate) : [];

  return (
    <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
      {statement ? (
        <div className="space-y-1.5 text-[13px] leading-snug text-amber-900">
          <p className="flex items-center gap-1.5 font-semibold">
            <FileText size={15} /> {pending.cardName}
          </p>
          <p>
            Выписка за {day(pending.period.from)} – {day(pending.period.to)}: {plural(pending.transactions.length, TX_WORDS)}. Баланс карты станет{' '}
            <b>{formatMoney(pending.closingBalance)}</b>.
          </p>
          <p>Операции по карте за этот период будут заменены выпиской. Наличные, другие месяцы, цели и план останутся.</p>
          {foreign > 0 && (
            <p>
              {plural(foreign, TX_WORDS)} в AED/USD пересчитаны в тенге
              {rates.length ? ` по курсу из выписки (${[...new Set(rates)].map((r) => String(r).replace('.', ',')).join(' и ')} ₸ за 1 AED)` : ''} — суммы могут немного отличаться от банковских.
            </p>
          )}
          {pending.warnings?.map((w) => (
            <p key={w} className="flex gap-1.5">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> {w}
            </p>
          ))}
        </div>
      ) : (
        <p className="text-[13px] leading-snug text-amber-900">
          В файле {plural(pending.transactions.length, TX_WORDS)}
          {pending.goals ? ` и ${plural(pending.goals.length, ['цель', 'цели', 'целей'])}` : ''}
          {pending.exportedAt ? ` от ${formatFullDate(pending.exportedAt)}` : ''}. Текущие данные будут заменены.
        </p>
      )}
      <div className="mt-2.5 flex gap-2">
        <button onClick={onConfirm} className="h-10 flex-1 rounded-xl bg-amber-500 text-sm font-semibold text-white active:bg-amber-600">
          {statement ? 'Загрузить выписку' : 'Заменить данные'}
        </button>
        <button onClick={onCancel} className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-ink-soft">
          Отмена
        </button>
      </div>
    </div>
  );
}
