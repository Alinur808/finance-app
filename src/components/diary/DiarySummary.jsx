import { ChevronRight, NotebookPen } from 'lucide-react';
import { formatFullDate } from '../../utils/dates.js';
import { formatMoney } from '../../utils/format.js';

const money = (v) => formatMoney(v >= 0 ? Math.floor(v) : Math.ceil(v), { decimals: false });

/**
 * Одна строка «Финансового дневника» для главного экрана: сколько ещё можно
 * потратить сегодня. Полный дневник — на вкладке «Цели».
 */
export default function DiarySummary({ forecast: f, hidden, onOpen }) {
  const over = f.leftToday < 0;
  const short = f.safe < 0;
  const headline = short ? `Не хватает ${money(-f.safe)}` : over ? `Перерасход сегодня ${money(-f.leftToday)}` : `Сегодня можно ещё ${money(f.leftToday)}`;
  return (
    <button onClick={onOpen} className="pressable flex w-full items-center gap-3 rounded-3xl bg-white p-3.5 text-left shadow-card ring-1 ring-black/[0.03]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f6ecdc] text-[#a8732b]">
        <NotebookPen size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-bold ${short || over ? 'text-red-600' : 'text-ink'}`}>{hidden ? 'Финансовый дневник' : headline}</span>
        <span className="block truncate text-[12px] text-ink-muted">
          До {formatFullDate(f.deadline).replace(/ \d{4}$/, '')}
          {!hidden && !short && ` · свободно ${money(f.safe)}`}
        </span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-gray-300" />
    </button>
  );
}
