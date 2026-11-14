import { useCallback, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import { readImportFile } from '../utils/backup.js';
import { plural } from '../utils/format.js';

const TX_WORDS = ['операция', 'операции', 'операций'];
const DEFAULT_ACCEPT = '.json,.pdf,application/json,application/pdf';

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
  const { importData, importStatement } = useFinance();
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
    [autoConfirm, apply],
  );

  return {
    // accept — какие файлы показать в системном выборе (например, только PDF)
    openPicker: (accept = DEFAULT_ACCEPT) => {
      if (!inputRef.current) return;
      inputRef.current.accept = typeof accept === 'string' ? accept : DEFAULT_ACCEPT; // onClick передаёт событие
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
