import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { PERIODS } from '../utils/dates.js';
import { categoryList, getCategory } from '../data/categories.js';
import { useAccounts } from '../hooks/useAccounts.js';
import BottomSheet, { SheetOption } from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';

// короткие подписи для чипа; полные — в листе выбора
const SHORT = { month: 'Месяц', today: 'Сегодня', week: 'Неделя', '30days': '30 дней', 'last-month': 'Прошлый месяц', all: 'Всё время' };

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`pressable flex h-9 max-w-[60vw] shrink-0 items-center gap-1 rounded-full px-3.5 text-sm font-semibold ${
        active ? 'bg-ink text-on-ink' : 'bg-surface text-ink-soft shadow-card'
      }`}
    >
      <span className="truncate">{children}</span>
      <ChevronDown size={15} className="-mr-1 shrink-0 opacity-70" />
    </button>
  );
}

/**
 * Три понятных фильтра вместо ленты из семи чипов: период, счёт, категория.
 * Каждый открывает лист с вариантами; активный фильтр выделен тёмным.
 */
export default function FilterChips({ showCategory = true }) {
  const { filters, setFilters } = useFinance();
  const { accounts, getAccount } = useAccounts();
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);
  const period = PERIODS.find((p) => p.id === filters.period) ?? PERIODS[0];
  const account = filters.accountId === 'all' ? null : getAccount(filters.accountId);
  const category = filters.categoryId ? getCategory(filters.categoryId) : null;
  const pick = (patch) => {
    setFilters(patch);
    close();
  };

  return (
    <>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-0.5">
        <Chip active={filters.period !== 'month'} onClick={() => setSheet('period')}>
          {SHORT[period.id] ?? period.label}
        </Chip>
        <Chip active={!!account} onClick={() => setSheet('account')}>
          {account ? account.name : 'Все счета'}
        </Chip>
        {showCategory && (
          <Chip active={!!category} onClick={() => setSheet('category')}>
            {category ? category.short : 'Категории'}
          </Chip>
        )}
      </div>

      <BottomSheet open={sheet === 'period'} onClose={close} title="Период">
        {PERIODS.map((p) => (
          <SheetOption key={p.id} selected={filters.period === p.id} onClick={() => pick({ period: p.id })}>
            {p.label}
          </SheetOption>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'account'} onClose={close} title="Счёт">
        <SheetOption selected={filters.accountId === 'all'} onClick={() => pick({ accountId: 'all' })}>
          Все счета
        </SheetOption>
        {accounts.map((a) => (
          <SheetOption
            key={a.id}
            selected={filters.accountId === a.id}
            onClick={() => pick({ accountId: a.id })}
            leading={
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ backgroundColor: `${a.color}26`, color: a.color }}>
                <a.icon size={19} />
              </span>
            }
          >
            {a.name}
            <span className="block text-xs font-normal text-ink-muted">{a.kind}</span>
          </SheetOption>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'category'} onClose={close} title="Категория" tall>
        <SheetOption selected={!filters.categoryId} onClick={() => pick({ categoryId: null })}>
          Все категории
        </SheetOption>
        {['expense', 'income'].map((type) => (
          <div key={type}>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">{type === 'expense' ? 'Расходы' : 'Доходы'}</p>
            {[...categoryList(type), ...(type === 'expense' ? [getCategory('own'), getCategory('fx')] : [])].map((c) => (
              <SheetOption key={c.id} selected={filters.categoryId === c.id} onClick={() => pick({ categoryId: c.id })} leading={<CategoryIcon categoryId={c.id} size={40} />}>
                {c.name}
              </SheetOption>
            ))}
          </div>
        ))}
      </BottomSheet>
    </>
  );
}
