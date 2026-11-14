import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, UserRound } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { formatMoney, groupDigits } from '../utils/format.js';
import { PERIODS } from '../utils/dates.js';

/**
 * Тёмно-зелёная шапка + золотая карта (название — из Профиля), которая наезжает на её край,
 * и под ней — доходы/расходы за выбранный период.
 */
export default function BalanceCard({ balance, income, expense, accountName, accountKind, onOpenProfile }) {
  const { settings, updateSettings, filters } = useFinance();
  const hidden = settings.hideBalance;
  const periodLabel = PERIODS.find((p) => p.id === filters.period)?.label ?? '';
  const mask = (s) => (hidden ? '••••••' : s);
  const [whole, kopecks] = groupDigits(balance, { decimals: true }).split(',');

  return (
    <section>
      <div className="bg-gradient-to-b from-brand-800 to-brand-900 px-5 pb-28 text-white" style={{ paddingTop: 'max(20px, env(safe-area-inset-top))' }}>
        <div className="flex items-center justify-between pt-1">
          <button onClick={onOpenProfile} className="pressable flex items-center gap-3 text-left" aria-label="Открыть профиль">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-white/15 text-sm font-bold ring-1 ring-white/25">
              {settings.name.trim() ? settings.name.trim().slice(0, 1).toUpperCase() : <UserRound size={18} />}
            </span>
            <div className="leading-tight">
              {settings.name.trim() ? (
                <>
                  <p className="text-xs text-white/70">{greeting()},</p>
                  <p className="font-semibold">{settings.name}</p>
                </>
              ) : (
                <p className="font-semibold">{greeting()}!</p>
              )}
            </div>
          </button>
        </div>
      </div>

      <div className="relative -mt-24 px-5">
        <div
          className="relative overflow-hidden rounded-[26px] p-5 text-[#3b2f17] shadow-[0_14px_34px_rgba(70,52,16,0.28)]"
          style={{ background: 'linear-gradient(135deg, #f7e9c6 0%, #e9cf95 42%, #d6b16a 100%)' }}
        >
          {/* мягкий блик, как на металлической карте */}
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/35 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 left-10 h-40 w-72 rounded-full bg-[#b8904a]/25 blur-2xl" />

          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-[19px] font-extrabold tracking-tight">{accountName}</p>
              <p className="text-[12px] font-medium text-[#3b2f17]/65">{accountKind}</p>
            </div>
            <button
              onClick={() => updateSettings({ hideBalance: !hidden })}
              className="grid h-9 w-9 place-items-center rounded-full bg-white/35 active:bg-white/50"
              aria-label={hidden ? 'Показать баланс' : 'Скрыть баланс'}
            >
              {hidden ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>

          <p className="relative mt-6 text-[13px] font-medium text-[#3b2f17]/70">Текущий баланс</p>
          <p className="relative mt-0.5 text-[36px] font-extrabold leading-none tracking-tight">
            {hidden ? (
              '••••••'
            ) : (
              <>
                {whole}
                <span className="text-[24px] font-bold text-[#3b2f17]/70">,{kopecks}</span>
              </>
            )}
            <span className="ml-1.5 text-[26px] font-bold text-[#3b2f17]/75">₸</span>
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-gray-100 shadow-card">
          <Stat icon={ArrowDownLeft} label="Доходы" value={mask(formatMoney(income, { sign: income > 0 }))} tone="income" caption={periodLabel} />
          <Stat icon={ArrowUpRight} label="Расходы" value={mask(formatMoney(-expense))} tone="expense" caption={periodLabel} />
        </div>
      </div>
    </section>
  );
}

function Stat({ icon: Icon, label, value, tone, caption }) {
  const income = tone === 'income';
  return (
    <div className="bg-white px-4 py-3.5">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 place-items-center rounded-full ${income ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-ink-soft'}`}>
          <Icon size={15} strokeWidth={2.5} />
        </span>
        <span className="text-[13px] font-medium text-ink-soft">{label}</span>
      </div>
      <p className={`tabular mt-1.5 truncate text-[16px] font-bold ${income ? 'text-brand-600' : 'text-ink'}`}>{value}</p>
      <p className="text-[11px] text-ink-muted">{caption}</p>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Доброй ночи' : h < 12 ? 'Доброе утро' : h < 18 ? 'Добрый день' : 'Добрый вечер';
}
