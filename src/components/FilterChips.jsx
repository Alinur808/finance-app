import { useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { PERIODS } from '../utils/dates.js';
import { useAccounts } from '../hooks/useAccounts.js';
import { categoryList, getCategory } from '../data/categories.js';
import BottomSheet, { SheetOption } from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';

function Chip({ active, onClick, children, dropdown, onClear }) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition active:scale-95 ${
        active ? 'bg-ink text-white' : 'bg-white text-ink-soft shadow-card'
      }`}
    >
      {children}
      {onClear ? (
        <span
          role="button"
          aria-label="Сбросить фильтр"
          onClick={(e) => {
            e.stopPropagation();
            onClear();
          }}
          className="-mr-1.5 grid h-5 w-5 place-items-center rounded-full bg-white/20"
        >
          <X size={12} />
        </span>
      ) : (
        dropdown && <ChevronDown size={15} className="-mr-1 opacity-70" />
      )}
    </button>
  );
}

/**
 * Horizontally scrolling filters shared by Overview and Analytics.
 * Period chips are single-select; account & category open bottom sheets.
 */
export default function FilterChips({ showCategory = true }) {
  const { filters, setFilters } = useFinance();
  const { accounts, getAccount } = useAccounts();
  const [sheet, setSheet] = useState(null);
  const close = () => setSheet(null);
  const account = filters.accountId === 'all' ? null : getAccount(filters.accountId);
  const category = filters.categoryId ? getCategory(filters.categoryId) : null;
  const [first, second, ...restPeriods] = PERIODS;

  const periodChip = (p) => (
    <Chip key={p.id} active={filters.period === p.id} onClick={() => setFilters({ period: p.id })}>
      {p.label}
    </Chip>
  );

  return (
    <>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 py-1">
        {periodChip(first)}
        {periodChip(second)}
        <Chip dropdown active={!!account} onClick={() => setSheet('account')} onClear={account ? () => setFilters({ accountId: 'all' }) : null}>
          {account ? account.name : 'Все счета'}
        </Chip>
        {showCategory && (
          <Chip dropdown active={!!category} onClick={() => setSheet('category')} onClear={category ? () => setFilters({ categoryId: null }) : null}>
            {category ? category.short : 'Категория'}
          </Chip>
        )}
        {restPeriods.map(periodChip)}
      </div>

      <BottomSheet open={sheet === 'account'} onClose={close} title="Счёт">
        <SheetOption selected={filters.accountId === 'all'} onClick={() => { setFilters({ accountId: 'all' }); close(); }}>
          Все счета
        </SheetOption>
        {accounts.map((a) => (
          <SheetOption
            key={a.id}
            selected={filters.accountId === a.id}
            onClick={() => { setFilters({ accountId: a.id }); close(); }}
            leading={
              <span className="grid h-10 w-10 place-items-center rounded-2xl" style={{ backgroundColor: `${a.color}1f`, color: a.color }}>
                <a.icon size={19} />
              </span>
            }
          >
            {a.name}
            <span className="block text-xs font-normal text-ink-muted">{a.kind}</span>
          </SheetOption>
        ))}
      </BottomSheet>

      <BottomSheet open={sheet === 'category'} onClose={close} title="Категория">
        <SheetOption selected={!filters.categoryId} onClick={() => { setFilters({ categoryId: null }); close(); }}>
          Все категории
        </SheetOption>
        {['expense', 'income'].map((type) => (
          <div key={type}>
            <p className="px-3 pb-1 pt-4 text-xs font-semibold uppercase tracking-wider text-ink-muted">{type === 'expense' ? 'Расходы' : 'Доходы'}</p>
            {[...categoryList(type), ...(type === 'expense' ? [getCategory('own'), getCategory('fx')] : [])].map((c) => (
              <SheetOption
                key={c.id}
                selected={filters.categoryId === c.id}
                onClick={() => { setFilters({ categoryId: c.id }); close(); }}
                leading={<CategoryIcon categoryId={c.id} size={40} />}
              >
                {c.name}
              </SheetOption>
            ))}
          </div>
        ))}
      </BottomSheet>
    </>
  );
}
