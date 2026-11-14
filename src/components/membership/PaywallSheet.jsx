import { useEffect, useState } from 'react';
import { Check, Loader2, Minus } from 'lucide-react';
import { useSubscription } from '../../context/SubscriptionContext.jsx';
import { FEATURES, STANDARD_LIMITS } from '../../data/membership.js';
import { loadStorePrices, PLANS } from '../../native/billing.js';
import { groupDigits } from '../../utils/format.js';
import { haptic } from '../../utils/haptics.js';
import BottomSheet from '../BottomSheet.jsx';

const ROWS = [
  ['Учёт, аналитика, доходы и расходы', true, true],
  ['Импорт первой выписки Freedom (PDF)', true, true],
  ['Stealth Mode', true, true],
  ['Советы стратега', String(STANDARD_LIMITS.insights), '∞'],
  ['ИИ-разбор капитала', false, true],
  ['История выписок', '1 период', '∞'],
  ['Цели дневника', String(STANDARD_LIMITS.diaryItems), '∞'],
  ['Код-пароль', false, true],
];

const price = (plan, store) => store?.[plan.id] ?? `${groupDigits(plan.price)} ₸`;

/**
 * «Private Membership» — сдержанный лист покупки в стиле Apple:
 * тарифы, сравнение возможностей, «Восстановить покупки» и условия подписки.
 */
export default function PaywallSheet({ open, feature, onClose }) {
  const { isPrivate, plan: currentPlan, source, hasStore, purchase, restore } = useSubscription();
  const [selected, setSelected] = useState('annual');
  const [busy, setBusy] = useState(null); // 'buy' | 'restore'
  const [message, setMessage] = useState('');
  const [storePrices, setStorePrices] = useState(null);

  useEffect(() => {
    if (!open) return;
    setMessage('');
    setBusy(null);
    if (hasStore) loadStorePrices().then(setStorePrices);
  }, [open, hasStore]);

  const focus = feature ? FEATURES[feature] : null;
  const plan = PLANS[selected];

  const buy = async () => {
    setBusy('buy');
    setMessage('');
    const result = await purchase(selected);
    setBusy(null);
    if (result.status === 'error') setMessage(result.message);
    if (result.status === 'purchased' || result.status === 'preview') onClose();
  };

  const onRestore = async () => {
    setBusy('restore');
    const result = await restore();
    setBusy(null);
    setMessage(
      result.status === 'restored'
        ? 'Покупка восстановлена — Private активен.'
        : result.status === 'none'
          ? 'Активных покупок для этого аккаунта не найдено.'
          : result.status === 'preview'
            ? 'Восстановление работает в приложении из App Store / Google Play. В веб-версии тариф включается переключателем «Режим подписки» в Профиле.'
            : result.message,
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Private Membership"
      tall
      testId="paywall"
      footer={
        isPrivate ? (
          <button onClick={onClose} className="pressable h-14 w-full rounded-2xl bg-ink text-[16px] font-semibold text-on-ink">
            Готово
          </button>
        ) : (
          <>
            <button
              onClick={buy}
              disabled={Boolean(busy)}
              className="pressable flex h-14 w-full items-center justify-center gap-2 rounded-2xl text-[16px] font-semibold text-[#1d1608] disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, #f3e3bd 0%, #d8b56e 55%, #b98f45 100%)' }}
            >
              {busy === 'buy' && <Loader2 size={18} className="animate-spin" />}
              {plan.period ? `Продолжить · ${price(plan, storePrices)} / ${plan.period}` : `Купить навсегда · ${price(plan, storePrices)}`}
            </button>
            <button onClick={onRestore} disabled={Boolean(busy)} className="mt-1 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold text-ink-soft">
              {busy === 'restore' && <Loader2 size={15} className="animate-spin" />}
              Восстановить покупки
            </button>
          </>
        )
      }
    >
      <div className="flex flex-col items-center pb-2 text-center">
        <div
          className="grid h-16 w-16 place-items-center rounded-[22px] text-[26px] font-semibold tracking-tight text-[#1d1608] shadow-[0_12px_30px_-10px_rgba(185,143,69,0.7)]"
          style={{ background: 'linear-gradient(135deg, #f6e9c9 0%, #d8b56e 55%, #a87c34 100%)' }}
          aria-hidden="true"
        >
          P
        </div>
        <p className="mt-4 text-[22px] font-semibold leading-tight tracking-[-0.02em]">Капитал под личным контролем</p>
        <p className="mt-1.5 max-w-[300px] text-[14px] leading-snug text-ink-soft">
          Инструменты private-банкинга для личного капитала. Данные по-прежнему остаются только на устройстве.
        </p>
      </div>

      {focus && !isPrivate && (
        <div className="mt-3 rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-500/25">
          <p className="text-[13px] font-semibold text-amber-800">{focus.title}</p>
          <p className="mt-0.5 text-[13px] leading-snug text-amber-700">{focus.text}</p>
        </div>
      )}

      {isPrivate ? (
        <div className="mt-5 rounded-2xl bg-gray-50 p-4 text-center">
          <p className="text-[15px] font-semibold">Вы — участник Private</p>
          <p className="mt-1 text-[13px] text-ink-muted">
            {PLANS[currentPlan]?.label ?? 'Тариф'} · {source === 'preview' ? 'Preview-режим на этом устройстве' : 'оформлено в магазине приложений'}
          </p>
        </div>
      ) : (
        <div className="mt-5 grid gap-2.5" role="radiogroup" aria-label="Тариф">
          {Object.values(PLANS).map((p) => {
            const on = selected === p.id;
            return (
              <button
                key={p.id}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  haptic('selection');
                  setSelected(p.id);
                }}
                className={`pressable flex items-center gap-3 rounded-2xl px-4 py-3.5 text-left transition-shadow ${on ? 'bg-surface-raised ring-2 ring-amber-500/70' : 'bg-gray-50 ring-1 ring-hairline'}`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${on ? 'border-amber-500 bg-amber-500' : 'border-gray-300'}`}>
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-canvas" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-[15px] font-semibold">{p.label}</span>
                    {p.badge && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700">{p.badge}</span>}
                  </span>
                  <span className="block text-[12px] text-ink-muted">{p.note}</span>
                </span>
                <span className="tabular shrink-0 text-right text-[15px] font-semibold">
                  {price(p, storePrices)}
                  {p.period && <span className="block text-[11px] font-medium text-ink-muted">в {p.period === 'мес' ? 'месяц' : 'год'}</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-hairline">
        <div className="grid grid-cols-[1fr_76px_76px] bg-gray-50 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
          <span>Возможности</span>
          <span className="text-center">Standard</span>
          <span className="text-center text-amber-700">Private</span>
        </div>
        {ROWS.map(([label, free, pro]) => (
          <div key={label} className="grid grid-cols-[1fr_76px_76px] items-center border-t border-hairline px-4 py-2.5 text-[13px]">
            <span className="pr-2 leading-snug text-ink-soft">{label}</span>
            <Cell value={free} />
            <Cell value={pro} gold />
          </div>
        ))}
      </div>

      {message && <p className="mt-4 rounded-2xl bg-gray-50 px-4 py-3 text-[13px] leading-snug text-ink-soft">{message}</p>}

      {!hasStore && !isPrivate && (
        <p className="mt-4 text-center text-[12px] font-medium text-amber-700">Preview: оплата не списывается — тариф включается только на этом устройстве.</p>
      )}
      <p className="mt-3 pb-2 text-center text-[11px] leading-relaxed text-ink-muted">
        Подписка продлевается автоматически, если не отменить её минимум за 24 часа до конца периода. Управлять подпиской можно в настройках Apple ID или Google Play. «Навсегда» —
        разовая покупка.
      </p>
    </BottomSheet>
  );
}

function Cell({ value, gold = false }) {
  if (value === true) return <Check size={16} strokeWidth={2.6} className={`mx-auto ${gold ? 'text-amber-600' : 'text-ink-soft'}`} aria-label="есть" />;
  if (value === false) return <Minus size={16} className="mx-auto text-gray-300" aria-label="нет" />;
  return <span className={`tabular text-center font-semibold ${gold ? 'text-amber-700' : 'text-ink-soft'}`}>{value}</span>;
}
