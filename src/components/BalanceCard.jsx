import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, UserRound } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { groupDigits, MONEY_MASK } from '../utils/format.js';
import { PERIODS } from '../utils/dates.js';
import FitText from './FitText.jsx';

/**
 * Главная карта баланса. Obsidian — «титановая» карта с изумрудным отсветом,
 * Alabaster — шампань. Сумма любого размера (0 ₸ … 999 999 999 999 ₸)
 * подстраивает кегль под ширину карты (FitText). Кнопка-глаз — Stealth Mode.
 */
export default function BalanceCard({ balance, income, expense, accountName, accountKind, onOpenProfile }) {
  const { settings, filters } = useFinance();
  const { hidden, toggle, money } = usePrivacy();
  const { isPrivate } = useSubscription();
  const periodLabel = PERIODS.find((p) => p.id === filters.period)?.label ?? '';
  const [whole, kopecks] = groupDigits(balance, { decimals: true }).split(',');
  const name = settings.name.trim();

  return (
    <section className="px-5" style={{ paddingTop: 'max(16px, calc(env(safe-area-inset-top) + 8px))' }}>
      <div className="flex items-center justify-between pb-4 pt-1">
        <button onClick={onOpenProfile} className="pressable flex min-w-0 items-center gap-3 text-left" aria-label="Открыть профиль">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-sm font-semibold text-ink shadow-card">
            {name ? name.slice(0, 1).toUpperCase() : <UserRound size={18} />}
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block text-[12px] text-ink-muted">{greeting()}</span>
            <span className="block truncate text-[15px] font-semibold text-ink">{name || 'Мой капитал'}</span>
          </span>
        </button>
        {isPrivate && <span className="rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700 ring-1 ring-amber-500/40">Private</span>}
      </div>

      <div
        className="relative overflow-hidden rounded-[28px] p-5 shadow-[0_24px_48px_-24px_rgba(0,0,0,0.7)]"
        style={{ background: 'var(--card-bg)', color: 'rgb(var(--card-ink))', boxShadow: 'inset 0 0 0 1px var(--card-edge), 0 24px 48px -28px rgba(0,0,0,0.55)' }}
        data-testid="balance-card"
      >
        {/* зеркальный блик по верхней кромке */}
        <div className="pointer-events-none absolute inset-x-6 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, var(--card-sheen), transparent)' }} />
        <div className="pointer-events-none absolute -right-20 -top-24 h-56 w-56 rounded-full blur-3xl" style={{ background: 'var(--card-sheen)' }} />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold tracking-tight">{accountName}</p>
            <p className="text-[12px] font-medium opacity-60">{accountKind}</p>
          </div>
          <button
            onClick={toggle}
            className="pressable grid h-10 w-10 shrink-0 place-items-center rounded-full backdrop-blur active:opacity-70"
            style={{ background: 'var(--card-sheen)', boxShadow: 'inset 0 0 0 1px var(--card-edge)' }}
            aria-label={hidden ? 'Показать суммы' : 'Скрыть суммы'}
            aria-pressed={hidden}
            data-testid="stealth-toggle"
          >
            {hidden ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <p className="relative mt-7 text-[12px] font-medium uppercase tracking-[0.12em] opacity-60">Текущий баланс</p>
        <div className="relative mt-1.5 w-full">
          <FitText max={40} min={18} className="font-semibold leading-none tracking-[-0.03em]" data-testid="balance-amount">
            {hidden ? (
              <span key="mask" className="money-mask animate-unveil">
                {MONEY_MASK}
              </span>
            ) : (
              <span key="value" className="animate-unveil">
                {whole}
                <span className="text-[0.62em] font-medium opacity-60">,{kopecks}</span>
                <span className="ml-[0.18em] text-[0.7em] font-medium opacity-70">₸</span>
              </span>
            )}
          </FitText>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <Stat icon={ArrowDownLeft} label="Доходы" value={money(income, { sign: income > 0 })} tone="income" caption={periodLabel} />
        <Stat icon={ArrowUpRight} label="Расходы" value={money(-expense)} tone="expense" caption={periodLabel} />
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone, caption }) {
  const income = tone === 'income';
  return (
    <div className="min-w-0 rounded-3xl bg-surface px-4 py-3.5 shadow-card">
      <div className="flex items-center gap-2">
        <span className={`grid h-6 w-6 place-items-center rounded-full ${income ? 'bg-brand-50 text-brand-600' : 'bg-red-50 text-red-600'}`}>
          <Icon size={14} strokeWidth={2.5} />
        </span>
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
      </div>
      <div className="mt-2 w-full">
        <FitText max={17} min={11} className={`font-semibold ${income ? 'text-brand-600' : 'text-ink'}`}>
          {value}
        </FitText>
      </div>
      <p className="truncate text-[11px] text-ink-muted">{caption}</p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}
