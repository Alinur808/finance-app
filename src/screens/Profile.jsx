import { useMemo, useState } from 'react';
import { ChevronRight, Download, Eye, FileUp, KeyRound, Loader2, PencilLine, RotateCcw, ShieldAlert, ShieldCheck, Sparkles, UserRound, Wallet } from 'lucide-react';
import { useFinance } from '../context/FinanceContext.jsx';
import { ACCOUNTS, DEFAULT_CARD_NAME } from '../data/accounts.js';
import { useAccounts } from '../hooks/useAccounts.js';
import { useBackupImport } from '../hooks/useBackupImport.js';
import ImportConfirm from '../components/ImportConfirm.jsx';
import ImportErrorBox from '../components/ImportErrorBox.jsx';
import { accountBalances } from '../utils/analytics.js';
import { AI_PROVIDERS, detectProvider } from '../utils/advisor.js';
import { downloadBackup } from '../utils/backup.js';
import { amountToNumber, displayAmount, numberToRaw, sanitizeAmount } from '../utils/amountInput.js';
import { formatMoney, plural } from '../utils/format.js';
import { Card, ScreenHeader, SectionHeader } from '../components/ui.jsx';

const TX_WORDS = ['операция', 'операции', 'операций'];
const row = 'flex items-center gap-3 px-4 py-3.5';
const fieldCls = 'h-10 rounded-xl bg-gray-100 px-3 text-right text-base font-semibold outline-none placeholder:font-normal placeholder:text-ink-muted focus:ring-2 focus:ring-brand-500';

function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? 'bg-brand-600' : 'bg-gray-200'}`}
    >
      <span className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : ''}`} />
    </button>
  );
}

export default function Profile({ toast }) {
  const state = useFinance();
  const { transactions, settings, updateSettings, setAccountBalance, resetAll, goals } = state;
  const { accounts } = useAccounts();
  const balances = useMemo(() => accountBalances(transactions, ACCOUNTS, settings.openings), [transactions, settings.openings]);
  const backupImport = useBackupImport({ toast });

  const [editBalance, setEditBalance] = useState(null); // { accountId, raw }
  const [aiOpen, setAiOpen] = useState(Boolean(settings.aiApiKey));
  const [showKey, setShowKey] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const hidden = settings.hideBalance;

  const onExport = async () => {
    try {
      const result = await downloadBackup(state);
      if (result !== 'cancelled') toast('Резервная копия сохранена');
    } catch {
      toast('Не удалось сохранить файл');
    }
  };

  const saveBalance = (e) => {
    e.preventDefault();
    setAccountBalance(editBalance.accountId, amountToNumber(editBalance.raw));
    setEditBalance(null);
    toast('Баланс обновлён');
  };

  return (
    <div className="pb-4">
      <ScreenHeader title="Профиль" />
      <div className="space-y-6 px-5">
        <Card className="flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-800 text-xl font-bold text-white">
            {settings.name.trim() ? settings.name.trim().slice(0, 1).toUpperCase() : <UserRound size={24} />}
          </div>
          <div className="min-w-0 flex-1">
            <input
              id="profile-name"
              value={settings.name}
              maxLength={30}
              placeholder="Ваше имя"
              autoComplete="given-name"
              onChange={(e) => updateSettings({ name: e.target.value })}
              className="w-full bg-transparent text-lg font-bold outline-none placeholder:text-ink-muted"
              aria-label="Ваше имя"
            />
            <p className="text-sm text-ink-muted">
              {plural(transactions.length, TX_WORDS)} · {plural(goals.length, ['цель', 'цели', 'целей'])}
            </p>
          </div>
        </Card>

        <section>
          <SectionHeader title="Счета" action={hidden ? '••••' : formatMoney(Object.values(balances).reduce((a, b) => a + b, 0))} />
          <Card className="divide-y divide-gray-100 overflow-hidden">
            {accounts.map((a) => (
              <div key={a.id}>
                <button
                  onClick={() => setEditBalance(editBalance?.accountId === a.id ? null : { accountId: a.id, raw: numberToRaw(balances[a.id]) })}
                  className={`${row} w-full text-left transition-colors active:bg-gray-50`}
                  aria-expanded={editBalance?.accountId === a.id}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full" style={{ backgroundColor: `${a.color}26`, color: a.color }}>
                    <a.icon size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{a.name}</span>
                    <span className="block text-[13px] text-ink-muted">{a.kind}</span>
                  </span>
                  <span className="font-bold">{hidden ? '••••' : formatMoney(balances[a.id], { decimals: true })}</span>
                  <PencilLine size={15} className="shrink-0 text-gray-300" aria-label="Исправить баланс" />
                </button>
                {editBalance?.accountId === a.id && (
                  <form onSubmit={saveBalance} className="flex animate-rise-in items-center gap-2 bg-gray-50 px-4 py-3">
                    <PencilLine size={16} className="shrink-0 text-ink-muted" />
                    <label htmlFor={`balance-${a.id}`} className="flex-1 text-[13px] text-ink-soft">
                      Сколько сейчас на счёте
                    </label>
                    <input
                      id={`balance-${a.id}`}
                      autoFocus
                      inputMode="decimal"
                      value={displayAmount(editBalance.raw)}
                      onChange={(e) => setEditBalance({ accountId: a.id, raw: sanitizeAmount(e.target.value) })}
                      className={`${fieldCls} w-32 bg-white`}
                    />
                    <button type="submit" className="pressable h-10 rounded-xl bg-ink px-3 text-sm font-semibold text-white">
                      OK
                    </button>
                  </form>
                )}
              </div>
            ))}
            <label htmlFor="card-name" className={row}>
              <span className="flex-1 text-[15px] font-medium text-ink-soft">Название карты</span>
              <input
                id="card-name"
                value={settings.cardName}
                maxLength={40}
                autoComplete="off"
                placeholder={DEFAULT_CARD_NAME}
                onChange={(e) => updateSettings({ cardName: e.target.value })}
                className={`${fieldCls} w-44`}
              />
            </label>
          </Card>
        </section>

        <section>
          <SectionHeader title="Данные" />
          <Card className="space-y-3 p-4">
            <div className="grid gap-2">
              <button onClick={onExport} className="pressable flex h-12 items-center justify-center gap-2 rounded-2xl bg-brand-600 text-[15px] font-semibold text-white">
                <Download size={17} /> Экспорт данных в JSON
              </button>
              <button
                onClick={() => backupImport.openPicker()}
                disabled={Boolean(backupImport.busy)}
                className="pressable flex h-12 items-center justify-center gap-2 rounded-2xl bg-gray-100 text-[15px] font-semibold text-ink disabled:opacity-70"
              >
                {backupImport.busy ? <Loader2 size={17} className="animate-spin" /> : <FileUp size={17} />}
                {backupImport.busy === 'parsing-pdf' ? 'Читаю выписку…' : 'Импорт: JSON или PDF Freedom'}
              </button>
            </div>
            <input id="import-file" {...backupImport.inputProps} />
            <ImportErrorBox error={backupImport.error} />
            {backupImport.pending && <ImportConfirm pending={backupImport.pending} onConfirm={backupImport.confirm} onCancel={backupImport.cancel} />}
            <p className="flex gap-2 text-[12px] leading-snug text-ink-muted">
              <ShieldCheck size={15} className="mt-0.5 shrink-0 text-brand-600" />
              Данные хранятся только в этом браузере, а PDF читается прямо на устройстве. Сохраняйте копию — она пригодится при смене телефона.
            </p>
          </Card>
        </section>

        <section>
          <SectionHeader title="Настройки" />
          <Card className="divide-y divide-gray-100 overflow-hidden">
            <label htmlFor="budget" className={row}>
              <Wallet size={20} className="shrink-0 text-ink-soft" />
              <span className="flex-1 text-[15px] font-medium">Бюджет в месяц</span>
              <span className="flex items-center gap-1">
                <input
                  id="budget"
                  inputMode="numeric"
                  value={settings.monthlyBudget ? displayAmount(String(settings.monthlyBudget)) : ''}
                  placeholder="не задан"
                  onChange={(e) => updateSettings({ monthlyBudget: Math.floor(amountToNumber(sanitizeAmount(e.target.value.split(',')[0]))) })}
                  className={`${fieldCls} w-32`}
                />
                <span className="text-ink-muted">₸</span>
              </span>
            </label>
            <div className={row}>
              <Eye size={20} className="shrink-0 text-ink-soft" />
              <span className="flex-1 text-[15px] font-medium">Скрывать суммы</span>
              <Toggle on={hidden} onChange={(v) => updateSettings({ hideBalance: v })} label="Скрывать суммы" />
            </div>
            <button onClick={() => setAiOpen((v) => !v)} className={`${row} w-full text-left active:bg-gray-50`} aria-expanded={aiOpen}>
              <Sparkles size={20} className="shrink-0 text-ink-soft" />
              <span className="flex-1 text-[15px] font-medium">
                ИИ-советник <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-ink-muted">бета</span>
              </span>
              <span className="text-[13px] text-ink-muted">{settings.aiApiKey ? 'включён' : 'выключен'}</span>
              <ChevronRight size={18} className={`shrink-0 text-gray-300 transition-transform ${aiOpen ? 'rotate-90' : ''}`} />
            </button>
            {aiOpen && (
              <div className="animate-rise-in space-y-3 px-4 pb-4 pt-1">
                <label htmlFor="ai-key" className="flex items-center gap-2 text-sm font-semibold text-ink-soft">
                  <KeyRound size={16} /> Ключ API (Anthropic)
                </label>
                <div className="flex h-12 items-center rounded-2xl bg-gray-100 px-3 focus-within:ring-2 focus-within:ring-brand-500">
                  <input
                    id="ai-key"
                    type={showKey ? 'text' : 'password'}
                    autoComplete="off"
                    spellCheck={false}
                    value={settings.aiApiKey}
                    onChange={(e) => {
                      const key = e.target.value.trim();
                      updateSettings({ aiApiKey: key, ...(key ? { aiProvider: detectProvider(key) } : {}) });
                    }}
                    placeholder="sk-ant-…"
                    className="min-w-0 flex-1 bg-transparent font-mono text-base outline-none placeholder:font-sans placeholder:text-ink-muted"
                  />
                  <button onClick={() => setShowKey((v) => !v)} className="px-2 text-[13px] font-semibold text-ink-muted">
                    {showKey ? 'Скрыть' : 'Показать'}
                  </button>
                </div>
                {settings.aiApiKey && settings.aiProvider !== 'anthropic' && (
                  <p className="text-[12px] text-amber-700">{AI_PROVIDERS[settings.aiProvider]?.label ?? 'Этот провайдер'} пока не подключён — нужен ключ Anthropic.</p>
                )}
                <p className="flex gap-2 text-[12px] leading-snug text-ink-muted">
                  <ShieldAlert size={15} className="mt-0.5 shrink-0" />
                  С ключом на вкладке «Планы» появится «Совет от ИИ»: он отправит операции за 60 дней выбранному провайдеру. Ключ хранится только на этом устройстве и не
                  попадает в экспорт.
                </p>
              </div>
            )}
          </Card>
        </section>

        {confirmReset ? (
          <div className="animate-rise-in rounded-3xl bg-white p-4 shadow-card ring-1 ring-red-100">
            <p className="text-[15px] font-semibold">Удалить все данные на этом устройстве?</p>
            <p className="mt-1 text-sm text-ink-muted">Операции, цели и настройки пропадут, приложение откроется как в первый раз. Сначала сохраните резервную копию.</p>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  resetAll();
                  setConfirmReset(false);
                }}
                className="pressable h-11 flex-1 rounded-xl bg-red-600 text-sm font-semibold text-white"
              >
                Удалить всё
              </button>
              <button onClick={() => setConfirmReset(false)} className="pressable h-11 flex-1 rounded-xl bg-gray-100 text-sm font-semibold text-ink-soft">
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmReset(true)} className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold text-red-600">
            <RotateCcw size={17} /> Начать заново
          </button>
        )}
      </div>
    </div>
  );
}
