import { useCallback, useRef, useState } from 'react';
import { useFinance } from '../context/FinanceContext.jsx';
import { readBackup } from '../utils/backup.js';
import { plural } from '../utils/format.js';

const TX_WORDS = ['операция', 'операции', 'операций'];

/**
 * Общая логика «Импорт данных» для Профиля и пустого дашборда.
 *
 * - openPicker()  открывает системный выбор файла
 * - inputProps    раздайте скрытому <input type="file" {...inputProps} />
 * - pending       проверенный файл, ждёт подтверждения (если autoConfirm = false)
 * - error         текст ошибки чтения/проверки
 *
 * autoConfirm: true — импортировать сразу, без вопроса «заменить данные?»
 * (используется, когда данных ещё нет и заменять нечего).
 */
export function useBackupImport({ toast, autoConfirm = false } = {}) {
  const { importData } = useFinance();
  const inputRef = useRef(null);
  const [pending, setPending] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const apply = useCallback(
    (data) => {
      importData(data);
      setPending(null);
      toast?.(`Импортировано: ${plural(data.transactions.length, TX_WORDS)}`);
    },
    [importData, toast],
  );

  const onChange = useCallback(
    async (e) => {
      const file = e.target.files?.[0];
      e.target.value = ''; // чтобы можно было выбрать тот же файл ещё раз
      if (!file) return;
      setError('');
      setBusy(true);
      try {
        const data = await readBackup(file);
        if (autoConfirm) apply(data);
        else setPending(data);
      } catch (err) {
        setPending(null);
        setError(err.message);
      } finally {
        setBusy(false);
      }
    },
    [autoConfirm, apply],
  );

  return {
    openPicker: () => inputRef.current?.click(),
    inputProps: { ref: inputRef, type: 'file', accept: 'application/json,.json', className: 'hidden', onChange },
    pending,
    error,
    busy,
    confirm: () => pending && apply(pending),
    cancel: () => setPending(null),
  };
}
