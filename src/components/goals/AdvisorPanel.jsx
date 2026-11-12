import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, BadgeCheck, Bot, CalendarClock, Lightbulb, Loader2, PartyPopper, PenLine, Repeat, Scale, Sparkles, TrendingDown, Zap } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { describeWeeks, getAIAdvice } from '../../utils/advisor.js';
import { formatFullDate } from '../../utils/dates.js';
import { formatMoney, formatPercent } from '../../utils/format.js';
import CategoryIcon from '../CategoryIcon.jsx';
import { Card } from '../ui.jsx';
import WhatIfSimulator from './WhatIfSimulator.jsx';

/** Расчётные суммы показываем без тиынов. */
const money = (v, opts = {}) => formatMoney(v, { decimals: false, ...opts });

const STATUS = {
  'on-track': { icon: BadgeCheck, label: 'Успеваете', cls: 'bg-brand-50 text-brand-700 ring-brand-100' },
  behind: { icon: AlertTriangle, label: 'Отстаёте от графика', cls: 'bg-amber-50 text-amber-800 ring-amber-100' },
  negative: { icon: TrendingDown, label: 'Расходы больше доходов', cls: 'bg-red-50 text-red-700 ring-red-100' },
  done: { icon: PartyPopper, label: 'Цель достигнута', cls: 'bg-brand-50 text-brand-700 ring-brand-100' },
  'no-data': { icon: PenLine, label: 'Мало данных', cls: 'bg-gray-100 text-ink-soft ring-gray-200' },
};

export const NO_DATA_MESSAGE =
  'Пока недостаточно данных для анализа. Добавьте свои первые доходы и расходы, чтобы я мог дать финансовый совет!';

const TIP_ICON = { habit: Repeat, rule: Scale, action: Zap };

function statusSentence(a, goal) {
  const pace = money(a.profile.savings);
  switch (a.status) {
    case 'no-data':
      return NO_DATA_MESSAGE;
    case 'done':
      return `Вы накопили все ${money(goal.target)}. Пора поставить следующую цель!`;
    case 'negative':
      return `Сейчас вы тратите на ${money(-a.profile.savings)} в месяц больше, чем получаете, поэтому цель не растёт. Чтобы успеть к ${formatFullDate(goal.deadline)}, нужно освобождать ${money(a.requiredMonthly)} в месяц.`;
    case 'on-track':
      return `При текущем темпе ${pace} в месяц вы накопите за ${describeWeeks(a.baseWeeks)} (к ${formatFullDate(a.eta)}) — на ${describeWeeks(a.weeksLeft - a.baseWeeks)} раньше срока.`;
    default:
      return `При темпе ${pace} в месяц цель будет достигнута примерно к ${formatFullDate(a.eta)} — позже срока (${formatFullDate(goal.deadline)}). Нужно откладывать ещё ${money(a.shortfall)} в месяц.`;
  }
}

/** Советник: статус цели, денежный поток, советы, симулятор и (если есть ключ) ИИ-совет. */
export default function AdvisorPanel({ advice, goal }) {
  const s = STATUS[advice.status];
  const p = advice.profile;
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white">
          <Sparkles size={17} />
        </span>
        <div>
          <h2 className="text-[17px] font-bold leading-tight tracking-tight">Умный советник</h2>
          <p className="text-[12px] text-ink-muted">По вашим операциям за последние {p.windowDays} дн.</p>
        </div>
      </div>

      <Card className="p-4">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ring-1 ${s.cls}`}>
          <s.icon size={14} /> {s.label}
        </span>
        <p className="mt-2.5 text-[15px] leading-snug text-ink">{statusSentence(advice, goal)}</p>

        {/* Без данных цифры (0 ₸ / 0 ₸ / 0 ₸) только путают — показываем одно сообщение. */}
        {advice.status !== 'no-data' && (
          <>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              {[
                ['Доходы', money(p.income, { compact: true }), 'text-brand-600'],
                ['Расходы', money(p.expense, { compact: true }), 'text-ink'],
                ['Остаётся', money(p.savings, { compact: true, sign: true }), p.savings >= 0 ? 'text-brand-600' : 'text-red-600'],
              ].map(([k, v, cls]) => (
                <div key={k} className="rounded-2xl bg-gray-50 px-1 py-2.5">
                  <p className="text-[11px] font-medium text-ink-muted">{k} / мес</p>
                  <p className={`tabular text-[14px] font-bold ${cls}`}>{v}</p>
                </div>
              ))}
            </div>
            {advice.status !== 'done' && (
              <div className="mt-3 flex items-center gap-2.5 rounded-2xl border border-dashed border-gray-200 px-3 py-2.5">
                <CalendarClock size={18} className="shrink-0 text-ink-muted" />
                <p className="text-[13px] leading-snug text-ink-soft">
                  Чтобы успеть к сроку, откладывайте <span className="tabular font-bold text-ink">{money(advice.requiredMonthly)} в месяц</span>
                  {p.income > 0 && <span className="text-ink-muted"> · {formatPercent(advice.requiredMonthly / p.income)} дохода</span>}
                </p>
              </div>
            )}
          </>
        )}
      </Card>

      {advice.status !== 'done' && advice.status !== 'no-data' && <AIAdviceCard goal={goal} />}

      {advice.tips.length > 0 && advice.status !== 'done' && (
        <div className="space-y-3">
          {advice.tips.map((tip, i) => {
            const Icon = TIP_ICON[tip.kind] ?? Lightbulb;
            const headline = i === 0;
            return (
              <Card key={tip.id} className={`animate-rise-in p-4 ${headline ? 'ring-2 ring-brand-500/30' : ''}`} style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex gap-3">
                  {tip.categoryId ? (
                    <CategoryIcon categoryId={tip.categoryId} size={40} />
                  ) : (
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gray-100 text-ink-soft">
                      <Icon size={19} />
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    {headline && <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">Главный совет</p>}
                    <p className="text-[15px] font-bold leading-snug">{tip.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{tip.text}</p>
                    {(tip.monthlyImpact > 0 || tip.impactLabel) && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {tip.monthlyImpact > 0 && (
                          <span className="tabular rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-semibold text-brand-700">
                            +{money(tip.monthlyImpact)}/мес
                          </span>
                        )}
                        {tip.impactLabel && <span className="rounded-full bg-gray-100 px-2.5 py-1 text-[12px] font-semibold text-ink-soft">⏱ {tip.impactLabel}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {advice.status !== 'done' && advice.discretionary.length > 0 && <WhatIfSimulator advice={advice} goal={goal} />}
    </section>
  );
}

/** Появляется, только если в Профиле указан ключ API. */
function AIAdviceCard({ goal }) {
  const { settings, transactions } = useFinance();
  const [state, setState] = useState({ status: 'idle', text: '', error: '' });
  const abortRef = useRef(null);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => setState({ status: 'idle', text: '', error: '' }), [goal.id]);

  if (!settings.aiApiKey) return null;

  const ask = async () => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setState({ status: 'loading', text: '', error: '' });
    try {
      const text = await getAIAdvice({ apiKey: settings.aiApiKey, provider: settings.aiProvider, transactions, goal, signal: ctrl.signal });
      setState({ status: 'done', text, error: '' });
    } catch (e) {
      if (ctrl.signal.aborted) return;
      setState({ status: 'error', text: '', error: e?.message || 'Не удалось получить ответ.' });
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2">
        <Bot size={18} className="text-brand-600" />
        <h3 className="flex-1 text-[15px] font-bold">Совет от ИИ</h3>
        <button
          onClick={ask}
          disabled={state.status === 'loading'}
          className="flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {state.status === 'loading' && <Loader2 size={14} className="animate-spin" />}
          {state.status === 'done' ? 'Обновить' : state.status === 'loading' ? 'Анализирую…' : 'Спросить'}
        </button>
      </div>
      {state.status === 'idle' && <p className="mt-2 text-[13px] text-ink-muted">Операции за последние 60 дней будут отправлены модели для персонального разбора.</p>}
      {state.status === 'error' && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{state.error}</p>}
      {state.text && <div className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">{state.text}</div>}
    </Card>
  );
}
