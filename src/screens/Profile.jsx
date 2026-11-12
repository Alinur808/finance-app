import { useMemo, useState } from 'react';
import { Download, Eye, EyeOff, FileUp, KeyRound, RotateCcw, ShieldAlert, Wallet } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { ACCOUNTS } from '../data/accounts.js';
import { STATEMENT_PERIOD } from '../data/seed.js';
import { accountBalances } from '../utils/analytics.js';
import { AI_PROVIDERS, detectProvider } from '../utils/advisor.js';
import { downloadBackup } from '../utils/backup.js';
import { useBackupImport } from '../hooks/useBackupImport.js';
import { formatFullDate } from '../utils/dates.js';
import { formatMoney, groupDigits, plural } from '../utils/format.js';
import { Card, ScreenHeader, SectionHeader } from '../components/ui.jsx';

const TX_WORDS = ['операция', 'операции', 'операций'];

function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition ${on ? 'bg-brand-600' : 'bg-gray-200'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? 'left-6' : 'left-1'}`} />
    </button>
  );
}

export default function Profile({ toast }) {
  const state = useFinance();
  const { transactions, settings, updateSettings, reset, goals } = state;
  const balances = useMemo(() => accountBalances(transactions, ACCOUNTS, settings.openings), [transactions, settings.openings]);
  const total = Object.values(balances).reduce((a, b) => a + b, 0);

  const backupImport = useBackupImport({ toast });
  const [confirmReset, setConfirmReset] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const onExport = async () => {
    try {
      const result = await downloadBackup(state);
      if (result !== 'cancelled') toast('Резервная копия сохранена');
    } catch {
      toast('Не удалось сохранить файл');
    }
  };

  const onKeyChange = (value) => {
    const key = value.trim();
    updateSettings({ aiApiKey: key, ...(key ? { aiProvider: detectProvider(key) } : {}) });
  };

  return (
    <div className="pb-4">
      <ScreenHeader title="Профиль" />
      <div className="space-y-6 px-5">
        <Card className="flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-xl font-bold text-white">
            {settings.name.trim().slice(0, 1).toUpperCase() || '•'}
          </div>
          <div className="min-w-0 flex-1">
            <input
              id="profile-name"
              value={settings.name}
              onChange={(e) => updateSettings({ name: e.target.value })}
              className="w-full bg-transparent text-lg font-bold outline-none"
              aria-label="Ваше имя"
            />
            <p className="text-sm text-ink-muted">
              {plural(transactions.length, TX_WORDS)} · {plural(goals.length, ['цель', 'цели', 'целей'])}
            </p>
          </div>
        </Card>

        <section>
          <SectionHeader title="Счета" action={settings.hideBalance ? '••••' : formatMoney(total)} />
          <Card className="divide-y divide-gray-100 overflow-hidden">
            {ACCOUNTS.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="grid h-11 w-11 place-items-center rounded-full" style={{ backgroundColor: `${a.color}26`, color: a.color }}>
                  <a.icon size={20} />
                </span>
                <div className="flex-1">
                  <p className="font-semibold">{a.name}</p>
                  <p className="text-[13px] text-ink-muted">{a.kind}</p>
                </div>
                <p className="tabular font-bold">{settings.hideBalance ? '••••' : formatMoney(balances[a.id], { decimals: true })}</p>
              </div>
            ))}
          </Card>
          {STATEMENT_PERIOD && (
          <p className="mt-2 px-1 text-[12px] text-ink-muted">
            Операции Kaspi Gold загружены из выписки за {formatFullDate(`${STATEMENT_PERIOD.from}T12:00`)} – {formatFullDate(`${STATEMENT_PERIOD.to}T12:00`)}.
          </p>
          )}
        </section>

        <section>
          <SectionHeader title="Резервная копия" />
          <Card className="space-y-3 p-4">
            <p className="text-[13px] leading-snug text-ink-muted">
              Данные хранятся только в этом браузере. Сохраняйте копию, чтобы не потерять операции при очистке хранилища.
            </p>
            <div className="grid gap-2">
              <button onClick={onExport} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-sm font-semibold text-white active:bg-brand-700">
                <Download size={17} /> Экспорт данных в JSON
              </button>
              <button
                onClick={backupImport.openPicker}
                className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gray-100 text-sm font-semibold text-ink active:bg-gray-200"
              >
                <FileUp size={17} /> Импорт данных
              </button>
            </div>
            <input id="import-file" {...backupImport.inputProps} />
            {backupImport.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-[13px] text-red-700">{backupImport.error}</p>}
            {backupImport.pending && (
              <div className="rounded-2xl bg-amber-50 p-3 ring-1 ring-amber-100">
                <p className="text-[13px] leading-snug text-amber-900">
                  В файле {plural(backupImport.pending.transactions.length, TX_WORDS)}
                  {backupImport.pending.goals ? ` и ${plural(backupImport.pending.goals.length, ['цель', 'цели', 'целей'])}` : ''}
                  {backupImport.pending.exportedAt ? ` от ${formatFullDate(backupImport.pending.exportedAt)}` : ''}. Текущие данные будут заменены.
                </p>
                <div className="mt-2.5 flex gap-2">
                  <button onClick={backupImport.confirm} className="h-10 flex-1 rounded-xl bg-amber-500 text-sm font-semibold text-white active:bg-amber-600">
                    Заменить данные
                  </button>
                  <button onClick={backupImport.cancel} className="h-10 flex-1 rounded-xl bg-white text-sm font-semibold text-ink-soft">
                    Отмена
                  </button>
                </div>
              </div>
            )}
          </Card>
        </section>

        <section>
          <SectionHeader title="ИИ-советник" />
          <Card className="space-y-3 p-4">
            <label htmlFor="ai-key" className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
              <KeyRound size={16} /> Ключ API (Anthropic или OpenAI)
            </label>
            <div className="flex h-12 items-center rounded-2xl bg-gray-100 px-3 focus-within:ring-2 focus-within:ring-brand-500">
              <input
                id="ai-key"
                type={showKey ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                value={settings.aiApiKey}
                onChange={(e) => onKeyChange(e.target.value)}
                placeholder="sk-ant-…"
                className="min-w-0 flex-1 bg-transparent font-mono text-[14px] outline-none placeholder:font-sans placeholder:text-ink-muted"
              />
              <button onClick={() => setShowKey((v) => !v)} className="grid h-9 w-9 place-items-center text-ink-muted" aria-label={showKey ? 'Скрыть ключ' : 'Показать ключ'}>
                {showKey ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            {settings.aiApiKey && (
              <div className="flex gap-2">
                {Object.entries(AI_PROVIDERS).map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => updateSettings({ aiProvider: id })}
                    className={`h-9 rounded-full px-3.5 text-[13px] font-semibold ${settings.aiProvider === id ? 'bg-ink text-white' : 'bg-gray-100 text-ink-soft'}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
            <p className="flex gap-2 text-[12px] leading-snug text-ink-muted">
              <ShieldAlert size={15} className="mt-0.5 shrink-0" />
              Ключ хранится только на этом устройстве и не попадает в экспорт. С ключом на экране «Цели» появится кнопка «Совет от ИИ» — она отправит операции за 60 дней (суммы, категории, описания) выбранному провайдеру. Используйте отдельный ключ с лимитом расходов.
            </p>
          </Card>
        </section>

        <section>
          <SectionHeader title="Настройки" />
          <Card className="divide-y divide-gray-100 overflow-hidden">
            <label htmlFor="budget" className="flex items-center gap-3 px-4 py-3.5">
              <Wallet size={20} className="text-ink-soft" />
              <span className="flex-1 font-medium">Бюджет на месяц</span>
              <span className="flex items-center rounded-xl bg-gray-100 px-3 py-1.5">
                <input
                  id="budget"
                  inputMode="numeric"
                  value={settings.monthlyBudget ? groupDigits(settings.monthlyBudget) : ''}
                  onChange={(e) => updateSettings({ monthlyBudget: Number(e.target.value.replace(/\D/g, '').slice(0, 9)) })}
                  className="tabular w-24 bg-transparent text-right font-semibold outline-none"
                  placeholder="0"
                />
                <span className="ml-1 text-ink-muted">₸</span>
              </span>
            </label>
            <div className="flex items-center gap-3 px-4 py-3.5">
              <Eye size={20} className="text-ink-soft" />
              <span className="flex-1 font-medium">Скрывать балансы</span>
              <Toggle on={settings.hideBalance} onChange={(v) => updateSettings({ hideBalance: v })} label="Скрывать балансы" />
            </div>
          </Card>
        </section>

        {confirmReset ? (
          <div className="rounded-2xl bg-white p-4 shadow-card">
            <p className="text-sm text-ink-soft">Вернуть операции из выписки и цели по умолчанию? Добавленные вручную операции пропадут.</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  reset();
                  setConfirmReset(false);
                  toast('Данные выписки восстановлены');
                }}
                className="h-11 flex-1 rounded-xl bg-red-500 text-sm font-semibold text-white"
              >
                Сбросить
              </button>
              <button onClick={() => setConfirmReset(false)} className="h-11 flex-1 rounded-xl bg-gray-100 text-sm font-semibold text-ink-soft">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setConfirmReset(true)}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-white font-semibold text-ink-soft shadow-card active:bg-gray-50"
          >
            <RotateCcw size={17} /> Восстановить данные выписки
          </button>
        )}
      </div>
    </div>
  );
}
