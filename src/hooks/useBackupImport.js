import { useCallback, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import { useSecurity } from '../context/SecurityContext.jsx';
import { useSubscription } from '../context/SubscriptionContext.jsx';
import { readImportFile } from '../utils/backup.js';
import { dayKey } from '../utils/dates.js';
import { plural } from '../utils/format.js';
import { haptic } from '../utils/haptics.js';

const TX_WORDS = ['операция', 'операции', 'операций'];
const DEFAULT_ACCEPT = '.json,.pdf,application/json,application/pdf';

/**
 * Нужна ли «история выписок» (Private): на устройстве уже есть операции из
 * выписки Freedom за другой период, и новая выписка добавит ещё один.
 * Первая выписка и повторная загрузка того же периода — бесплатно.
 */
export function needsStatementHistory(transactions, statement) {
  const { from, to } = statement.period ?? {};
  if (!from || !to) return false;
  return transactions.some((t) => t.source === 'freedom-pdf' && (dayKey(t.date) < from || dayKey(t.date) > to));
}

/**
 * Общая логика «Импорт данных» для Профиля и пустого дашборда.
 * Принимает JSON-копию приложения и PDF-выписку Freedom Bank.
 *
 * - openPicker()  открывает системный выбор файла
 * - inputProps    раздайте скрытому <input type="file" {...inputProps} />
 * - pending       проверенный файл, ждёт подтверждения (если autoConfirm = false):
 *                 { kind: 'backup' | 'statement', transactions, … }
 * - busy          'reading' | 'parsing-pdf' | null — для индикатора
 * - error         ошибка чтения/проверки: строка или { message, details }
 *                 (details — точная причина для разработчика, см. ImportErrorBox)
 *
 * autoConfirm: true — импортировать сразу, без вопроса «заменить данные?»
 * (используется, когда данных ещё нет и заменять нечего).
 */
export function useBackupImport({ toast, autoConfirm = false } = {}) {
  const { importData, importStatement, transactions } = useFinance();
  const { isPrivate, openPaywall } = useSubscription();
  const { pauseAutoLock } = useSecurity();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(null);

  const apply = useCallback(
    (data) => {
      if (data.kind === 'statement') {
        importStatement(data);
        toast?.(`Выписка загружена: ${plural(data.transactions.length, TX_WORDS)}`);
      } else {
        importData(data);
        toast?.(`Импортировано: ${plural(data.transactions.length, TX_WORDS)}`);
      }
      haptic('success');
      setPending(null);
    },
    [importData, importStatement, toast],
  );

  const onChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // чтобы можно было выбрать тот же файл ещё раз
      if (!file) return;
      setError('');
      setBusy(/\.pdf$/i.test(file.name) || file.type === 'application/pdf' ? 'parsing-pdf' : 'reading');
      try {
        const data = await readImportFile(file);
        if (data.kind === 'statement' && !isPrivate && needsStatementHistory(transactions, data)) {
          setPending(null);
          setError('На устройстве уже есть выписка за другой период. Хранить выписки за несколько месяцев можно в Private Membership — или загрузите выписку за тот же период.');
          openPaywall('statementHistory');
          return;
        }
        if (autoConfirm) apply(data);
        else setPending(data);
      } catch (err) {
        setPending(null);
        // и понятный текст, и точная причина — консоли на телефоне не видно
        setError({ message: err?.message || String(err), details: err?.details || (err?.name && err.name !== 'Error' ? `${err.name}: ${err.message}` : '') });
      } finally {
        setBusy(null);
      }
    },
    [autoConfirm, apply, isPrivate, transactions, openPaywall],
  );

  return {
    // accept — какие файлы показать в системном выборе (например, только PDF)
    openPicker: (accept = DEFAULT_ACCEPT) => {
      if (!inputRef.current) return;
      inputRef.current.accept = typeof accept === 'string' ? accept : DEFAULT_ACCEPT; // onClick передаёт событие
      pauseAutoLock(); // системный выбор файла уводит страницу в фон — не блокируемся
      inputRef.current.click();
    },
    inputProps: {
      ref: inputRef,
      type: 'file',
      accept: DEFAULT_ACCEPT,
      className: 'hidden',
      onChange,
    },
    pending,
    error,
    busy,
    confirm: () => pending && apply(pending),
    cancel: () => setPending(null),
  };
}
