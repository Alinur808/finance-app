import { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Clock3, Lock, Repeat } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { useSubscription } from '../../context/SubscriptionContext.jsx';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { monthlyProfile } from '../../utils/advisor.js';
import { amountToNumber, displayAmount, numberToRaw, sanitizeAmount } from '../../utils/amountInput.js';
import { addDays, formatFullDate } from '../../utils/dates.js';
import { estimateHourlyRate, worthIt } from '../../utils/worthIt.js';
import BottomSheet from '../BottomSheet.jsx';
import { Segmented } from '../ui.jsx';

/**
 * «Стоит ли оно того?» — проверка покупки до того, как она случилась.
 *   Standard: сколько часов работы стоит покупка.
 *   Private:  на сколько дней она отодвинет активную цель, во что обойдётся
 *             привычка за год (раз в неделю / месяц) и новая дата цели.
 * Ставка часа — автоматически по доходам (или своя, задаётся здесь же).
 */
export default function WorthItSheet({ open, onClose, goal, advice }) {
  const { transactions, settings, updateSettings } = useFinance();
  const { isPrivate, openPaywall } = useSubscription();
  const privacy = usePrivacy();
  const m = (v) => privacy.money(Math.round(v), { decimals: false });
  const [raw, setRaw] = useState('');
  const [frequency, setFrequency] = useState('once');
  const [rateRaw, setRateRaw] = useState('');
  const [editRate, setEditRate] = useState(false);

  useEffect(() => {
    if (open) {
      setRaw('');
      setFrequency('once');
      setEditRate(false);
    }
  }, [open]);

  const profile = useMemo(() => (open ? (advice?.profile ?? monthlyProfile(transactions)) : null), [open, advice, transactions]);
  const rate = useMemo(() => (profile ? estimateHourlyRate(transactions, { manualRate: settings.hourlyRate, profile }) : null), [profile, transactions, settings.hourlyRate]);
  const amount = amountToNumber(raw);
  const r = amount > 0 && rate ? worthIt({ amount, rate: rate.rate, monthlySavings: profile?.savings ?? 0, goal, frequency }) : null;
  const newEta = r?.goalDelayDays != null && advice?.eta ? addDays(advice.eta, Math.ceil(r.goalDelayDays)) : null;

  return (
    <BottomSheet open={open} onClose={onClose} title="Стоит ли оно того?" testId="worth-it-sheet">
      <p className="text-[13px] leading-snug text-ink-muted">Введите цену покупки — посчитаем её в часах вашей работы{goal ? ' и в днях до цели' : ''}.</p>
      <label className="mt-3 flex items-center rounded-2xl bg-gray-100 pr-4 focus-within:ring-2 focus-within:ring-brand-500">
        <input
          id="worth-amount"
          inputMode="decimal"
          autoFocus
          placeholder="Цена, например 45 000"
          value={displayAmount(raw)}
          onChange={(e) => setRaw(sanitizeAmount(e.target.value))}
          className="h-14 w-full bg-transparent px-4 text-[22px] font-bold outline-none placeholder:text-base placeholder:font-normal placeholder:text-ink-muted"
          aria-label="Цена покупки"
        />
        <span className="text-xl font-bold text-ink-muted">₸</span>
      </label>
      <Segmented
        className="mt-3"
        size="sm"
        value={frequency}
        onChange={(f) => (f === 'once' || isPrivate ? setFrequency(f) : openPaywall('worthIt'))}
        items={[
          ['once', 'Разово'],
          ['weekly', 'Каждую неделю'],
          ['monthly', 'Каждый месяц'],
        ]}
      />

      {rate?.source === 'none' && !editRate && (
        <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-[13px] text-amber-800">Доходов в приложении пока нет — укажите, сколько вы зарабатываете за час.</p>
      )}

      {r && rate.rate > 0 && (
        <div className="mt-4 space-y-2.5" data-testid="worth-it-result">
          <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <Clock3 size={20} className="shrink-0 text-amber-700" />
            <div className="min-w-0">
              <p className="text-[17px] font-bold">≈ {frequency === 'once' ? r.workLabel : r.yearlyWorkLabel}</p>
              <p className="text-[12px] text-ink-muted">{frequency === 'once' ? 'столько вы работаете ради этой покупки' : 'столько работы в год уходит на эту привычку'}</p>
            </div>
          </div>

          {frequency !== 'once' && (
            <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
              <Repeat size={20} className="shrink-0 text-ink-soft" />
              <p className="text-[14px]">
                <span className="tabular font-bold">{m(r.yearly)}</span> в год · {m(r.perMonth)} в месяц
              </p>
            </div>
          )}

          {goal &&
            (isPrivate ? (
              <div className="flex items-center gap-3 rounded-2xl bg-brand-50 px-4 py-3 text-brand-800" data-testid="worth-it-goal">
                <CalendarClock size={20} className="shrink-0" />
                <p className="text-[14px] leading-snug">
                  {r.goalBlocked ? (
                    <>С такой тратой на «{goal.name}» не будет оставаться денег — цель не наступит.</>
                  ) : (
                    <>
                      Отложит «{goal.name}» на <b>{r.delayLabel}</b>
                      {newEta && <span className="block text-[12px] opacity-80">Новая дата: {formatFullDate(newEta)}</span>}
                    </>
                  )}
                </p>
              </div>
            ) : (
              <button onClick={() => openPaywall('worthIt')} className="pressable flex w-full items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 text-left" data-testid="worth-it-goal-locked">
                <Lock size={18} className="shrink-0 text-amber-700" />
                <span className="text-[14px]">
                  На сколько дней это отодвинет «{goal.name}»? <span className="font-semibold text-amber-700">Private</span>
                </span>
              </button>
            ))}
        </div>
      )}

      <div className="mt-4 border-t border-hairline pt-3">
        {editRate ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              updateSettings({ hourlyRate: Math.round(amountToNumber(rateRaw)) });
              setEditRate(false);
            }}
            className="flex items-center gap-2"
          >
            <label htmlFor="worth-rate" className="flex-1 text-[13px] text-ink-soft">
              Ваш час работы
            </label>
            <input
              id="worth-rate"
              inputMode="numeric"
              value={displayAmount(rateRaw)}
              onChange={(e) => setRateRaw(sanitizeAmount(e.target.value.split(',')[0]))}
              className="h-10 w-28 rounded-xl bg-gray-100 px-3 text-right text-base font-semibold outline-none focus:ring-2 focus:ring-brand-500"
            />
            <button type="submit" className="pressable h-10 rounded-xl bg-ink px-3 text-sm font-semibold text-on-ink">
              OK
            </button>
          </form>
        ) : (
          <p className="flex items-center justify-between gap-2 text-[12px] text-ink-muted">
            <span>
              {rate?.rate > 0
                ? privacy.text(`Час работы: ${m(rate.rate)} · ${rate.source === 'manual' ? 'своя ставка' : 'по доходам / 168 ч'}`)
                : 'Ставка часа не задана'}
            </span>
            <button
              className="font-semibold text-brand-700"
              onClick={() => {
                setRateRaw(numberToRaw(Math.round(settings.hourlyRate || rate?.rate || 0)));
                setEditRate(true);
              }}
            >
              Изменить
            </button>
          </p>
        )}
      </div>
    </BottomSheet>
  );
}
