import { useMemo, useState } from 'react';
import { Fingerprint, Lock, Radar, Sparkles } from 'lucide-react';
import { useFinance } from '../../context/FinanceContext.jsx';
import { useSubscription } from '../../context/SubscriptionContext.jsx';
import { usePrivacy } from '../../hooks/usePrivacy.js';
import { analyzeBehavior } from '../../utils/userProfileAnalyzer.js';
import { formatMoney } from '../../utils/format.js';
import { Card } from '../ui.jsx';

/**
 * «Что приложение знает обо мне?» — поведенческий портрет (utils/userProfileAnalyzer.js).
 * Standard видит архетип и одну главную черту — остальное размыто и ведёт в Private.
 */
export default function BehaviorPortrait({ now }) {
  const { transactions } = useFinance();
  const { isPrivate, openPaywall } = useSubscription();
  const { text } = usePrivacy();
  const p = useMemo(() => analyzeBehavior(transactions, now), [transactions, now]);
  const [allTraits, setAllTraits] = useState(false);

  if (!p.hasData) {
    return (
      <Card className="p-4" data-testid="behavior-portrait">
        <Header />
        <p className="mt-2 text-[13px] leading-snug text-ink-muted">Нужно хотя бы 8 трат — тогда приложение увидит ваш ритм: пиковые дни, мелкие покупки, подписки.</p>
      </Card>
    );
  }

  const [first, ...rest] = p.traits;
  return (
    <Card className="overflow-hidden" data-testid="behavior-portrait">
      <div className="p-4">
        <Header days={p.windowDays} />
        <div className="mt-3 flex items-center gap-3 rounded-2xl bg-gray-50 p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface text-[26px] shadow-card" aria-hidden="true">
            {p.archetype.emoji}
          </span>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">Ваш финансовый архетип</p>
            <p className="text-[17px] font-bold leading-tight" data-testid="archetype">
              {p.archetype.title}
            </p>
          </div>
        </div>
        <p className="mt-2.5 text-[13px] leading-snug text-ink-soft">{p.archetype.text}</p>
        {first && <Trait trait={first} text={text} />}
      </div>

      {isPrivate ? (
        <>
          {rest.length > 0 && (
            <div className="space-y-0.5 border-t border-hairline px-4 py-2">
              {(allTraits ? rest : rest.slice(0, 2)).map((t) => (
                <Trait key={t.id} trait={t} text={text} />
              ))}
              {rest.length > 2 && (
                <button onClick={() => setAllTraits((v) => !v)} className="py-1.5 text-[13px] font-semibold text-brand-700" aria-expanded={allTraits}>
                  {allTraits ? 'Свернуть' : `Все черты · ещё ${rest.length - 2}`}
                </button>
              )}
            </div>
          )}
          {p.stats.recurring.length > 0 && (
            <div className="border-t border-hairline px-4 py-3" data-testid="subscription-radar">
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
                <Radar size={13} /> Радар утечек
              </p>
              <ul className="space-y-1 text-[13px]">
                {p.stats.recurring.slice(0, 5).map((r) => (
                  <li key={r.key} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-ink-soft">{r.merchant}</span>
                    <span className="tabular shrink-0 text-ink-muted">{text(`${formatMoney(Math.round(r.monthly), { decimals: false })}/мес`)}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1.5 text-[12px] text-ink-muted">{text(`В год: ${formatMoney(Math.round(p.stats.recurringMonthly * 12), { decimals: false })}`)}</p>
            </div>
          )}
          <div className="border-t border-hairline bg-gray-50/70 px-4 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
              <Sparkles size={13} /> Три действия
            </p>
            <ol className="space-y-2.5">
              {p.recommendations.map((r, i) => (
                <li key={r.id} className="flex gap-3">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ink text-[12px] font-bold text-on-ink">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold leading-snug">{text(r.title)}</p>
                    <p className="text-[13px] leading-snug text-ink-soft">{text(r.text)}</p>
                    {r.monthlyImpact > 0 && (
                      <span className="tabular mt-1 inline-block rounded-full bg-brand-50 px-2 py-0.5 text-[12px] font-semibold text-brand-700">
                        {text(`+${formatMoney(Math.round(r.monthlyImpact), { decimals: false })}/мес`)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </>
      ) : (
        <button onClick={() => openPaywall('behaviorPortrait')} className="relative block w-full border-t border-hairline text-left" data-testid="portrait-locked">
          <div className="pointer-events-none select-none space-y-2 px-4 py-3 blur-[5px]" aria-hidden="true">
            {(rest.length ? rest : p.recommendations).slice(0, 3).map((t) => (
              <p key={t.id} className="text-[13px] text-ink-soft">
                {text(t.title)} — ••••••••••••••
              </p>
            ))}
            <p className="text-[13px] text-ink-soft">Радар утечек · Три действия · ••••••</p>
          </div>
          <span className="absolute inset-0 flex items-center justify-center gap-2 bg-surface/40 text-[14px] font-semibold text-amber-700">
            <Lock size={15} /> Полный портрет — в Private
          </span>
        </button>
      )}
    </Card>
  );
}

function Header({ days }) {
  return (
    <div className="flex items-center gap-2">
      <Fingerprint size={17} className="text-brand-600" />
      <h2 className="flex-1 text-[15px] font-semibold">Что приложение знает обо мне</h2>
      {days && <span className="text-[11px] text-ink-muted">за {days} дн.</span>}
    </div>
  );
}

function Trait({ trait, text }) {
  return (
    <div className="py-1.5">
      <p className="text-[14px] font-semibold leading-snug">{text(trait.title)}</p>
      <p className="text-[13px] leading-snug text-ink-muted">{text(trait.text)}</p>
    </div>
  );
}
