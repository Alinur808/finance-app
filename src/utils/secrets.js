import { useCallback, useSyncExternalStore } from 'react';

/**
 * Ключ API для бета-функции «ИИ-разбор» — отдельно от финансовых данных.
 *
 * Хранится только в sessionStorage этой вкладки/запуска приложения: не попадает
 * в зашифрованный сейф, в резервную копию и в localStorage, исчезает при
 * закрытии приложения. Старые версии клали ключ в settings.aiApiKey —
 * FinanceContext переносит его сюда при первом запуске и удаляет из данных.
 */
const KEY = 'tenge-finance.ai-key';
const listeners = new Set();
let memory = ''; // если sessionStorage недоступен

function read() {
  try {
    return window.sessionStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

export function getAiKey() {
  return typeof window === 'undefined' ? '' : read();
}

export function setAiKey(value) {
  const key = String(value ?? '')
    .trim()
    .replace(/[^\x21-\x7e]/g, '')
    .slice(0, 256);
  memory = key;
  try {
    if (key) window.sessionStorage.setItem(KEY, key);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* приватный режим: ключ живёт в памяти */
  }
  listeners.forEach((l) => l());
}

const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** const [aiKey, setKey] = useAiKey(); */
export function useAiKey() {
  const key = useSyncExternalStore(subscribe, getAiKey, () => '');
  return [key, useCallback((v) => setAiKey(v), [])];
}
