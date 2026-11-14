import { useState } from 'react';
import { ChevronRight, FileText, FileUp, Loader2, PencilLine, ShieldCheck } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { useBackupImport } from '../hooks/useBackupImport.js';
import { DEFAULT_CARD_NAME } from '../data/accounts.js';
import { amountToNumber, displayAmount, sanitizeAmount } from '../utils/amountInput.js';
import ImportErrorBox from './ImportErrorBox.jsx';

const field =
  'h-12 w-full rounded-2xl bg-white px-4 text-base font-semibold text-ink outline-none ring-1 ring-black/[0.06] placeholder:font-normal placeholder:text-ink-muted focus:ring-2 focus:ring-brand-500';

function Choice({ icon: Icon, title, text, onClick, busy, tone = 'white' }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={`pressable flex w-full items-center gap-3.5 rounded-3xl p-4 text-left shadow-card ring-1 ring-black/[0.04] disabled:opacity-70 ${tone === 'brand' ? 'bg-brand-600 text-white' : 'bg-white'}`}
    >
      <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${tone === 'brand' ? 'bg-white/15' : 'bg-brand-50 text-brand-700'}`}>
        {busy ? <Loader2 size={22} className="animate-spin" /> : <Icon size={22} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[16px] font-bold leading-snug">{title}</span>
        <span className={`mt-0.5 block text-[13px] leading-snug ${tone === 'brand' ? 'text-white/80' : 'text-ink-muted'}`}>{text}</span>
      </span>
      <ChevronRight size={18} className={tone === 'brand' ? 'text-white/70' : 'text-gray-300'} />
    </button>
  );
}

/**
 * Первый запуск: три понятных пути — выписка Freedom (PDF), резервная копия (JSON)
 * или ручной старт с текущим балансом. Ничего не нужно настраивать заранее.
 */
export default function Onboarding({ toast }) {
  const { completeOnboarding } = useFinance();
  // данных ещё нет — заменять нечего, поэтому импортируем без подтверждения
  const { openPicker, inputProps, error, busy } = useBackupImport({ toast, autoConfirm: true });
  const [manual, setManual] = useState(false);
  const [form, setForm] = useState({ name: '', cardName: '', balance: '' });
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const start = (e) => {
    e.preventDefault();
    completeOnboarding({ name: form.name, cardName: form.cardName, balance: amountToNumber(form.balance) });
    toast?.('Готово! Добавляйте операции кнопкой «+»');
  };

  return (
    <div className="flex min-h-[calc(100dvh-6rem)] flex-col">
      <div className="bg-gradient-to-b from-brand-800 to-brand-900 px-6 pb-16 text-white" style={{ paddingTop: 'max(28px, calc(env(safe-area-inset-top) + 12px))' }}>
        <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="h-14 w-14 rounded-2xl shadow-lg ring-1 ring-white/20" />
        <h1 className="mt-5 text-[30px] font-extrabold leading-tight tracking-tight" style={{ textWrap: 'balance' }}>
          Все деньги — под контролем
        </h1>
        <p className="mt-2 max-w-[320px] text-[15px] leading-snug text-white/75">Баланс, куда уходят деньги и сколько можно тратить до цели. Данные остаются только на вашем телефоне.</p>
      </div>

      <div className="-mt-8 flex-1 space-y-3 px-5 pb-8">
        <Choice
          icon={FileText}
          tone="brand"
          title="Загрузить выписку Freedom Bank"
          text="PDF из приложения банка — все операции за период"
          busy={busy === 'parsing-pdf'}
          onClick={() => openPicker('.pdf,application/pdf')}
        />
        <Choice
          icon={FileUp}
          title="Восстановить из резервной копии"
          text="JSON-файл из «Экспорт данных», например с операциями Kaspi"
          busy={busy === 'reading'}
          onClick={() => openPicker('.json,application/json')}
        />
        <input id="onboarding-import-file" {...inputProps} />
        <ImportErrorBox error={error} />

        {manual ? (
          <form onSubmit={start} className="space-y-3 rounded-3xl bg-white p-4 shadow-card ring-1 ring-black/[0.04]">
            <p className="text-[16px] font-bold">Начнём с нуля</p>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Сколько сейчас на карте</span>
              <span className="flex items-center rounded-2xl bg-gray-50 pr-4 ring-1 ring-black/[0.06] focus-within:ring-2 focus-within:ring-brand-500">
                <input
                  id="onboarding-balance"
                  autoFocus
                  inputMode="decimal"
                  placeholder="0"
                  value={displayAmount(form.balance)}
                  onChange={(e) => set({ balance: sanitizeAmount(e.target.value) })}
                  className="h-14 w-full bg-transparent px-4 text-2xl font-extrabold outline-none placeholder:text-gray-300"
                />
                <span className="text-xl font-bold text-ink-muted">₸</span>
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Название карты</span>
              <input id="onboarding-card" value={form.cardName} onChange={(e) => set({ cardName: e.target.value })} maxLength={40} placeholder={`${DEFAULT_CARD_NAME}, например Kaspi Gold`} className={`${field} bg-gray-50`} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[13px] font-semibold text-ink-soft">Как к вам обращаться (необязательно)</span>
              <input id="onboarding-name" value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={30} autoComplete="given-name" placeholder="Имя" className={`${field} bg-gray-50`} />
            </label>
            <button type="submit" className="pressable h-14 w-full rounded-2xl bg-ink text-[16px] font-semibold text-white">
              Начать
            </button>
          </form>
        ) : (
          <Choice icon={PencilLine} title="Начать с нуля" text="Укажите баланс и добавляйте траты вручную" onClick={() => setManual(true)} />
        )}

        <p className="flex items-start gap-2 px-1 pt-2 text-[12px] leading-snug text-ink-muted">
          <ShieldCheck size={15} className="mt-px shrink-0 text-brand-600" />
          Файлы, в том числе PDF-выписки, читаются прямо на устройстве и никуда не отправляются. Без регистрации и серверов.
        </p>
      </div>
    </div>
  );
}
