import { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Lock, Mic, Settings2, ShieldAlert, Smartphone, Square } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { useSecurity } from '../context/SecurityContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { useAccounts } from '../hooks/useAccounts.js';
import { usePrivacy } from '../hooks/usePrivacy.js';
import { useSpeech } from '../hooks/useSpeech.js';
import { categoryList, getCategory } from '../data/categories.js';
import { addDays, dayKey } from '../utils/dates.js';
import { amountToNumber, displayAmount, numberToRaw, sanitizeAmount } from '../utils/amountInput.js';
import { monthlyProfile } from '../utils/advisor.js';
import { categorizeTransaction } from '../utils/categorizer.js';
import { sanitizeText } from '../utils/sanitize.js';
import { parseVoiceTransaction } from '../utils/voiceParser.js';
import { countVoiceUse, voiceUsedToday } from '../utils/voiceQuota.js';
import { weeklyLimitState } from '../utils/weekly.js';
import { estimateHourlyRate, worthIt } from '../utils/worthIt.js';
import BottomSheet from './BottomSheet.jsx';
import CategoryIcon from './CategoryIcon.jsx';
import { PrimaryButton } from './ui.jsx';

const blank = () => ({ type: 'expense', amount: '', categoryId: null, merchant: '', accountId: 'kaspi', day: dayKey(new Date()) });
const chip = (on) => `pressable h-11 shrink-0 rounded-2xl px-4 text-[15px] font-semibold ${on ? 'bg-ink text-on-ink' : 'bg-gray-100 text-ink-soft'}`;

/** Категория для черновика: своя из ссылки, иначе — угадываем по описанию. */
function guessCategory(draft) {
  if (draft.categoryId && getCategory(draft.categoryId).id === draft.categoryId) return draft.categoryId;
  if (!draft.merchant) return null;
  const id = categorizeTransaction({ text: draft.merchant, sign: draft.type === 'income' ? '+' : '-' });
  const c = getCategory(id);
  return c.system || c.type !== draft.type ? null : id;
}

/**
 * Быстрый ввод операции: сумма (цифровая клавиатура с запятой) → категория
 * (часто используемые — первыми) → при желании описание, счёт и дата.
 *
 * Дополнительно:
 *  - «Голосовой ввод»: «Такси две пятьсот» заполняет сумму, категорию и описание;
 *  - `draft` — черновик из ссылки Команд iOS (?quickAdd=…): поля заполнены,
 *    сохраняется только после нажатия «Добавить»;
 *  - «Стоит ли оно того?»: цена покупки в часах работы и в днях до цели;
 *  - недельный лимит: при превышении — подтверждение «траты остановлены».
 */
export default function AddTransactionSheet({ open, onClose, onSave, draft = null }) {
  const { transactions, settings, updateSettings, goals, activeGoalId } = useFinance();
  const { accounts } = useAccounts();
  const { isPrivate, limits, openPaywall } = useSubscription();
  const { pauseAutoLock } = useSecurity();
  const privacy = usePrivacy();
  const [form, setForm] = useState(blank);
  const [confirmOver, setConfirmOver] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const [rateRaw, setRateRaw] = useState('');
  const [voiceNote, setVoiceNote] = useState('');
  const amountRef = useRef(null);
  const set = (patch) => {
    setConfirmOver(false);
    setForm((f) => ({ ...f, ...patch }));
  };

  const speech = useSpeech({
    onStart: () => pauseAutoLock(60_000), // запрос доступа к микрофону уводит страницу в фон
    onFinal: (text) => {
      const parsed = parseVoiceTransaction(text);
      if (!parsed) {
        setVoiceNote(`«${sanitizeText(text, 60)}» — не нашёл сумму. Скажите, например: «Кофе 1800»`);
        return;
      }
      countVoiceUse();
      const draftFromVoice = { ...parsed, merchant: sanitizeText(parsed.merchant) };
      setForm((f) => ({
        ...f,
        type: parsed.type,
        amount: numberToRaw(parsed.amount),
        merchant: draftFromVoice.merchant,
        categoryId: guessCategory(draftFromVoice),
      }));
      setVoiceNote(`Распознано: «${sanitizeText(text, 60)}»`);
    },
  });

  useEffect(() => {
    if (!open) return undefined;
    setConfirmOver(false);
    setRateOpen(false);
    setVoiceNote('');
    speech.setError('');
    if (draft) {
      setForm({
        ...blank(),
        type: draft.type === 'income' ? 'income' : 'expense',
        amount: draft.amount ? numberToRaw(draft.amount) : '',
        merchant: draft.merchant ?? '',
        categoryId: guessCategory(draft),
      });
    } else setForm(blank());
    // фокус после анимации листа — iOS иначе может не показать клавиатуру
    const t = setTimeout(() => {
      if (!draft?.amount) amountRef.current?.focus({ preventScroll: true });
    }, 60);
    return () => clearTimeout(t);
  }, [open, draft]); // eslint-disable-line react-hooks/exhaustive-deps

  // категории, которыми пользуются чаще, — в начале сетки
  const usage = useMemo(() => {
    const counts = new Map();
    for (const t of transactions.slice(0, 500)) counts.set(t.categoryId, (counts.get(t.categoryId) ?? 0) + 1);
    return counts;
  }, [transactions]);
  const categories = useMemo(() => categoryList(form.type).sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0)), [form.type, usage]);

  // «Стоит ли оно того?» — ставка часа и темп накоплений считаются только когда лист открыт
  const profile = useMemo(() => (open ? monthlyProfile(transactions) : null), [open, transactions]);
  const rate = useMemo(() => (profile ? estimateHourlyRate(transactions, { manualRate: settings.hourlyRate, profile }) : null), [profile, transactions, settings.hourlyRate]);
  const goal = goals.find((g) => g.id === activeGoalId) ?? goals[0] ?? null;
  const weekly = useMemo(() => weeklyLimitState(transactions, settings.weeklyLimit), [transactions, settings.weeklyLimit]);

  const amount = amountToNumber(form.amount);
  const valid = amount > 0 && form.categoryId;
  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  const expense = form.type === 'expense';
  const worth = expense && amount > 0 && rate?.rate > 0 ? worthIt({ amount, rate: rate.rate, monthlySavings: profile?.savings ?? 0, goal }) : null;
  const overLimit = expense && weekly && weekly.wouldExceed(amount);
  const voiceLeft = Math.max(0, limits.voicePerDay - (open ? voiceUsedToday() : 0));

  const save = () => {
    setConfirmOver(false);
    const now = new Date();
    const [y, m, d] = form.day.split('-').map(Number);
    const date = new Date(y, m - 1, d, now.getHours(), now.getMinutes());
    onSave({
      type: form.type,
      amount: Math.round(amount * 100) / 100,
      categoryId: form.categoryId,
      merchant: sanitizeText(form.merchant),
      accountId: form.accountId,
      date: date.toISOString(),
      ...(draft?.source === 'shortcut' ? { source: 'shortcut' } : {}),
    });
  };

  const submit = () => {
    if (!valid) return;
    if (overLimit && !confirmOver) {
      setConfirmOver(true);
      return;
    }
    save();
  };

  const onMic = () => {
    if (speech.listening) return speech.stop();
    if (!speech.supported) {
      setVoiceNote('Голосовой ввод не поддерживается в этом браузере. Откройте приложение в Safari или Chrome.');
      return undefined;
    }
    if (!isPrivate && voiceLeft <= 0) {
      openPaywall('voice');
      return undefined;
    }
    setVoiceNote('');
    speech.start();
    return undefined;
  };

  const saveRate = (e) => {
    e.preventDefault();
    updateSettings({ hourlyRate: Math.round(amountToNumber(rateRaw)) });
    setRateOpen(false);
  };

  return (
    <BottomSheet
      open={open}
      onClose={() => {
        speech.stop();
        onClose();
      }}
      title="Новая операция"
      tall
      testId="add-sheet"
      footer={
        confirmOver && weekly ? (
          <div className="animate-rise-in" data-testid="weekly-limit-confirm">
            <p className="flex items-center gap-2 text-[15px] font-bold text-red-600">
              <ShieldAlert size={18} /> Лимит недели исчерпан — траты остановлены
            </p>
            <p className="mt-1 text-[13px] text-ink-muted">
              {privacy.text(`Потрачено ${privacy.money(weekly.spent, { decimals: false })} из ${privacy.money(weekly.limit, { decimals: false })}. Эта трата выйдет за лимит.`)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button onClick={() => setConfirmOver(false)} className="pressable h-12 rounded-2xl bg-gray-100 text-[15px] font-semibold text-ink-soft">
                Отмена
              </button>
              <button onClick={save} className="pressable h-12 rounded-2xl bg-red-600 text-[15px] font-semibold text-white">
                Всё равно добавить
              </button>
            </div>
          </div>
        ) : (
          <PrimaryButton disabled={!valid} onClick={submit}>
            {valid ? `Добавить ${expense ? 'расход' : 'доход'}` : amount > 0 ? 'Выберите категорию' : 'Введите сумму'}
          </PrimaryButton>
        )
      }
    >
      {draft?.source === 'shortcut' && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-brand-50 px-3 py-2.5 text-[13px] leading-snug text-brand-800" data-testid="shortcut-banner">
          <Smartphone size={16} className="mt-px shrink-0" />
          Из Команд iOS. Проверьте сумму и категорию — операция сохранится только после нажатия «Добавить».
        </p>
      )}

      <div className="flex gap-2">
        <div className="grid flex-1 grid-cols-2 rounded-2xl bg-gray-100 p-1">
          {['expense', 'income'].map((t) => (
            <button
              key={t}
              onClick={() => set({ type: t, categoryId: null })}
              className={`h-10 rounded-xl text-[15px] font-semibold transition-colors ${form.type === t ? 'bg-surface shadow-card' : 'text-ink-muted'}`}
            >
              {t === 'expense' ? 'Расход' : 'Доход'}
            </button>
          ))}
        </div>
        <button
          onClick={onMic}
          className={`pressable grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${speech.listening ? 'animate-mic bg-red-600 text-white' : 'bg-gray-100 text-ink'}`}
          aria-label={speech.listening ? 'Остановить запись' : 'Голосовой ввод'}
          aria-pressed={speech.listening}
          data-testid="voice-button"
        >
          {speech.listening ? <Square size={18} fill="currentColor" /> : <Mic size={21} />}
        </button>
      </div>
      {(speech.listening || speech.interim || speech.error || voiceNote) && (
        <p className={`mt-2 text-center text-[13px] ${speech.error ? 'text-red-600' : 'text-ink-muted'}`} aria-live="polite" data-testid="voice-status">
          {speech.error || (speech.listening ? speech.interim || 'Слушаю… например: «Такси две пятьсот»' : voiceNote)}
          {!isPrivate && !speech.listening && !speech.error && voiceNote && voiceNote.startsWith('Распознано') && <span className="block text-[11px]">Осталось сегодня: {voiceLeft}</span>}
        </p>
      )}

      <label className="mt-4 block text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">Сумма</span>
        <div className={`mt-1 flex items-baseline justify-center gap-2 ${expense ? 'text-ink' : 'text-brand-600'}`}>
          <span className="text-3xl font-bold">{expense ? '−' : '+'}</span>
          <input
            ref={amountRef}
            id="tx-amount"
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            placeholder="0"
            value={displayAmount(form.amount)}
            onChange={(e) => set({ amount: sanitizeAmount(e.target.value) })}
            style={{ width: `${Math.max(1, displayAmount(form.amount).length || 1) * 0.6 + 0.2}em` }}
            className="min-w-0 max-w-[260px] bg-transparent text-center text-[44px] font-extrabold tracking-tight outline-none placeholder:text-gray-300"
            aria-label="Сумма в тенге"
          />
          <span className="text-3xl font-bold text-ink-muted">₸</span>
        </div>
      </label>

      {/* «Стоит ли оно того?» — прямо под суммой, без похода в настройки */}
      {expense && amount > 0 && (
        <div className="mt-1" data-testid="worth-it-line">
          <div className="flex items-center justify-center gap-1.5 text-[13px]">
            {worth ? (
              <>
                <Clock3 size={14} className="shrink-0 text-amber-700" />
                <span className="font-semibold text-ink-soft">≈ {worth.workLabel}</span>
                {goal && worth.delayLabel && isPrivate && <span className="text-ink-muted">· отложит цель на {worth.delayLabel}</span>}
                {goal && worth.goalBlocked && isPrivate && <span className="text-ink-muted">· цель пока без темпа</span>}
                {goal && !isPrivate && (
                  <button onClick={() => openPaywall('worthIt')} className="flex items-center gap-1 text-ink-muted" aria-label="Прогноз цели — Private">
                    · <Lock size={11} /> цель
                  </button>
                )}
              </>
            ) : (
              <span className="text-ink-muted">Сколько часов работы стоит покупка?</span>
            )}
            <button
              onClick={() => {
                setRateRaw(numberToRaw(Math.round(settings.hourlyRate || rate?.rate || 0)));
                setRateOpen((v) => !v);
              }}
              className="ml-0.5 grid h-7 w-7 place-items-center rounded-full bg-gray-100 text-ink-muted active:bg-gray-200"
              aria-label="Ставка за час работы"
              aria-expanded={rateOpen}
              data-testid="hourly-rate-button"
            >
              <Settings2 size={13} />
            </button>
          </div>
          {rateOpen && (
            <form onSubmit={saveRate} className="mx-auto mt-2 max-w-[320px] animate-rise-in rounded-2xl bg-gray-50 p-3 ring-1 ring-hairline" data-testid="hourly-rate-popover">
              <label htmlFor="hourly-rate" className="block text-[12px] font-semibold text-ink-soft">
                Сколько вы зарабатываете за час
              </label>
              <div className="mt-1.5 flex items-center gap-2">
                <input
                  id="hourly-rate"
                  inputMode="numeric"
                  autoFocus
                  value={displayAmount(rateRaw)}
                  onChange={(e) => setRateRaw(sanitizeAmount(e.target.value.split(',')[0]))}
                  className="h-10 min-w-0 flex-1 rounded-xl bg-surface px-3 text-right text-base font-semibold outline-none ring-1 ring-hairline focus:ring-2 focus:ring-brand-500"
                />
                <span className="text-[13px] text-ink-muted">₸/час</span>
                <button type="submit" className="pressable h-10 rounded-xl bg-ink px-3 text-sm font-semibold text-on-ink">
                  OK
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-ink-muted">
                {settings.hourlyRate > 0 ? (
                  <button
                    type="button"
                    className="font-semibold text-brand-700"
                    onClick={() => {
                      updateSettings({ hourlyRate: 0 });
                      setRateOpen(false);
                    }}
                  >
                    Считать автоматически по доходам
                  </button>
                ) : rate?.source === 'none' ? (
                  'Доходов в приложении пока нет — укажите ставку вручную.'
                ) : (
                  privacy.text(`Авто: ${privacy.money(Math.round(rate?.rate ?? 0), { decimals: false })}/час — ${rate?.source === 'salary' ? 'зарплата' : 'доход'} в месяц / 168 рабочих часов.`)
                )}
              </p>
            </form>
          )}
        </div>
      )}

      {weekly && expense && (
        <p className={`mt-2 text-center text-[12px] ${weekly.exhausted || overLimit ? 'font-semibold text-red-600' : 'text-ink-muted'}`} data-testid="weekly-limit-hint">
          {weekly.exhausted
            ? 'Лимит недели исчерпан — траты остановлены'
            : privacy.text(`Недельный лимит: осталось ${privacy.money(Math.max(0, weekly.left), { decimals: false })}`)}
        </p>
      )}

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Категория</p>
      <div className="grid grid-cols-4 gap-2">
        {categories.map((c) => {
          const on = form.categoryId === c.id;
          return (
            <button
              key={c.id}
              onClick={() => set({ categoryId: c.id })}
              aria-pressed={on}
              className={`pressable flex flex-col items-center gap-1.5 rounded-2xl px-1 py-2.5 ${on ? 'bg-brand-50 ring-2 ring-brand-500' : 'bg-gray-50'}`}
            >
              <CategoryIcon categoryId={c.id} size={40} />
              <span className="line-clamp-1 text-[11px] font-semibold text-ink-soft">{c.short}</span>
            </button>
          );
        })}
      </div>

      <label htmlFor="tx-merchant" className="mb-2 mt-5 block text-sm font-semibold text-ink-soft">
        Описание
      </label>
      <input
        id="tx-merchant"
        value={form.merchant}
        onChange={(e) => set({ merchant: e.target.value })}
        maxLength={80}
        enterKeyHint="done"
        placeholder={expense ? 'Например, Magnum' : 'Например, зарплата'}
        className="h-12 w-full rounded-2xl bg-gray-100 px-4 text-base outline-none placeholder:text-ink-muted focus:ring-2 focus:ring-brand-500"
      />

      {accounts.length > 1 && (
        <>
          <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Счёт</p>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            {accounts.map((a) => (
              <button key={a.id} onClick={() => set({ accountId: a.id })} className={`${chip(form.accountId === a.id)} flex items-center gap-2`}>
                <a.icon size={16} />
                {a.name}
              </button>
            ))}
          </div>
        </>
      )}

      <p className="mb-2 mt-5 text-sm font-semibold text-ink-soft">Дата</p>
      <div className="flex gap-2">
        <button onClick={() => set({ day: today })} className={chip(form.day === today)}>
          Сегодня
        </button>
        <button onClick={() => set({ day: yesterday })} className={chip(form.day === yesterday)}>
          Вчера
        </button>
        <input
          id="tx-date"
          type="date"
          max={today}
          value={form.day}
          onChange={(e) => e.target.value && set({ day: e.target.value })}
          className={`h-11 min-w-0 flex-1 rounded-2xl px-3 text-base font-semibold outline-none ${form.day !== today && form.day !== yesterday ? 'bg-ink text-on-ink' : 'bg-gray-100 text-ink-soft'}`}
          aria-label="Выбрать дату"
        />
      </div>
    </BottomSheet>
  );
}
