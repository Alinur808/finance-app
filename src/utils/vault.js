/**
 * Шифрование данных на устройстве (Web Crypto API).
 *
 *   Ключ   = PBKDF2-SHA-256(секрет устройства, соль, 120 000 итераций) → AES-GCM 256 бит
 *   Запись = localStorage['tenge-finance.vault'] = { v, ks, kdf, alg, iv, ct }
 *
 * Секрет устройства — 32 случайных байта. Хранится ОТДЕЛЬНО от зашифрованных
 * данных: в IndexedDB (база tenge-finance-keys). Только если IndexedDB
 * недоступна (старый приватный режим Safari), секрет кладётся в localStorage —
 * поле `ks` записи говорит, где искать ключ.
 * Ключ AES неизвлекаемый (extractable: false) и живёт только в памяти вкладки.
 * Каждое сохранение — новый случайный IV (12 байт), к шифротексту привязан
 * контекст (additionalData), поэтому запись нельзя подменить незаметно.
 *
 * От чего защищает: данные в localStorage не читаются как текст — ни при
 * просмотре хранилища, ни в выгрузке профиля браузера, ни в резервной копии
 * устройства без IndexedDB. От чего НЕ защищает: от кода, который уже
 * выполняется на странице, и от владельца разблокированного устройства с
 * отладчиком. Поэтому есть ещё код-пароль/Face ID и шторка приватности.
 *
 * Миграция: старые открытые данные (tenge-finance.v2) шифруются при первом
 * запуске, запись перечитывается и сверяется, и только потом открытая копия
 * удаляется — ни одной операции не теряется.
 * Без Web Crypto (страница по http в локальной сети) приложение работает
 * как раньше, без шифрования.
 *
 * Модуль не зависит от React; зависимости передаются явно — для юнит-тестов.
 */

export const VAULT_KEY = 'tenge-finance.vault';
export const LEGACY_KEY = 'tenge-finance.v2';
export const SECRET_FALLBACK_KEY = 'tenge-finance.vault-secret';
export const PBKDF2_ITERATIONS = 120_000;
const VERSION = 1;
const AAD = new TextEncoder().encode('tenge-finance.vault.v1');
const IDB_NAME = 'tenge-finance-keys';
const IDB_STORE = 'keys';
const SECRET_ID = 'device-secret';

/* ------------------------------------------------------------------ */
/* base64 без переполнения стека на больших массивах                   */
/* ------------------------------------------------------------------ */

export function toBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
  return out;
}

/* ------------------------------------------------------------------ */
/* Криптография                                                        */
/* ------------------------------------------------------------------ */

const getCrypto = () => (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);

/** Web Crypto доступен (https, localhost, Capacitor). По http в LAN — нет. */
export function cryptoAvailable(c = getCrypto()) {
  const secure = typeof globalThis.isSecureContext === 'boolean' ? globalThis.isSecureContext : true;
  return Boolean(secure && c?.subtle && c.getRandomValues);
}

export async function deriveKey(secret, salt, { iterations = PBKDF2_ITERATIONS, crypto: c = getCrypto() } = {}) {
  const material = await c.subtle.importKey('raw', secret, 'PBKDF2', false, ['deriveKey']);
  return c.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptJSON(key, value, { crypto: c = getCrypto() } = {}) {
  const iv = c.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(value));
  const ct = await c.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: AAD, tagLength: 128 }, key, data);
  return { iv: toBase64(iv), ct: toBase64(new Uint8Array(ct)) };
}

export async function decryptJSON(key, { iv, ct }, { crypto: c = getCrypto() } = {}) {
  const plain = await c.subtle.decrypt({ name: 'AES-GCM', iv: fromBase64(iv), additionalData: AAD, tagLength: 128 }, key, fromBase64(ct));
  return JSON.parse(new TextDecoder().decode(plain));
}

/* ------------------------------------------------------------------ */
/* Хранилища секрета                                                   */
/* ------------------------------------------------------------------ */

function idbRequest(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Секрет в IndexedDB. Возвращает null, если IndexedDB недоступна. */
export function indexedDBSecretStore(idb = typeof indexedDB !== 'undefined' ? indexedDB : null) {
  if (!idb) return null;
  let dbPromise = null;
  const open = () => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = idb.open(IDB_NAME, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB blocked'));
      });
      dbPromise.catch(() => {
        dbPromise = null;
      });
    }
    return dbPromise;
  };
  return {
    id: 'idb',
    async get() {
      const db = await open();
      const value = await idbRequest(db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(SECRET_ID));
      return value ? new Uint8Array(value) : null;
    },
    async set(bytes) {
      const db = await open();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, SECRET_ID);
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
    },
  };
}

/** Запасной вариант: секрет в localStorage (слабее — рядом с данными). */
export function localSecretStore(storage) {
  return {
    id: 'ls',
    async get() {
      const v = storage.getItem(SECRET_FALLBACK_KEY);
      return v ? fromBase64(v) : null;
    },
    async set(bytes) {
      storage.setItem(SECRET_FALLBACK_KEY, toBase64(bytes));
    },
  };
}

/** Память — для юнит-тестов. */
export function memorySecretStore(id = 'idb') {
  let value = null;
  return {
    id,
    async get() {
      return value;
    },
    async set(bytes) {
      value = new Uint8Array(bytes);
    },
  };
}

/* ------------------------------------------------------------------ */
/* Сейф                                                                */
/* ------------------------------------------------------------------ */

const readJSONSafe = (storage, key) => {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const isVaultRecord = (r) => r && r.v === VERSION && typeof r.iv === 'string' && typeof r.ct === 'string' && r.kdf && typeof r.kdf.salt === 'string';

/**
 * Открывает сейф при запуске.
 *
 * Возвращает {
 *   state,          // расшифрованное состояние или null (первый запуск)
 *   status,         // 'encrypted' | 'migrated' | 'new' | 'plain' | 'unreadable'
 *   save(value),    // зашифровать и записать (очередь: последнее значение побеждает)
 *   flush(),        // дождаться записи (перед перезагрузкой приложения)
 *   discard(),      // для status 'unreadable': удалить нечитаемую запись и начать заново
 * }
 *
 * Нечитаемый сейф (ключ потерян или IndexedDB временно недоступна) никогда
 * не перезаписывается: сохранение отключено, пока пользователь сам не решит
 * начать заново.
 */
export async function openVault({ storage, secretStore, fallbackStore, crypto: c = getCrypto(), iterations = PBKDF2_ITERATIONS } = {}) {
  const legacy = readJSONSafe(storage, LEGACY_KEY);

  // Без Web Crypto — как в прошлых версиях: открытый JSON.
  if (!cryptoAvailable(c)) {
    return plainVault(storage, legacy, readJSONSafe(storage, VAULT_KEY) ? 'unreadable' : 'plain');
  }

  const record = readJSONSafe(storage, VAULT_KEY);
  const stores = [secretStore, fallbackStore].filter(Boolean);
  const storeFor = (id) => stores.find((s) => s.id === id) ?? null;

  if (isVaultRecord(record)) {
    const store = storeFor(record.ks);
    let key = null;
    let state = null;
    try {
      const secret = store ? await store.get() : null;
      if (secret) {
        key = await deriveKey(secret, fromBase64(record.kdf.salt), { iterations: record.kdf.iterations ?? iterations, crypto: c });
        state = await decryptJSON(key, record, { crypto: c });
      }
    } catch {
      key = null;
    }
    if (!key) return unreadableVault(storage);
    // открытая копия от старой вкладки/версии: сейф главнее, открытый текст удаляем
    if (legacy) storage.removeItem(LEGACY_KEY);
    return activeVault({ storage, key, record, crypto: c, state, status: 'encrypted' });
  }

  // Первое шифрование: новый секрет и соль.
  const secret = c.getRandomValues(new Uint8Array(32));
  const salt = c.getRandomValues(new Uint8Array(16));
  let ks = null;
  for (const store of stores) {
    try {
      await store.set(secret);
      const check = await store.get();
      if (check && toBase64(check) === toBase64(secret)) {
        ks = store.id;
        break;
      }
    } catch {
      /* следующий вариант хранения */
    }
  }
  if (!ks) return plainVault(storage, legacy, 'plain');

  const key = await deriveKey(secret, salt, { iterations, crypto: c });
  const base = { v: VERSION, ks, alg: 'AES-GCM-256', kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations, salt: toBase64(salt) } };
  const vault = activeVault({ storage, key, record: base, crypto: c, state: legacy, status: legacy ? 'migrated' : 'new' });

  if (legacy) {
    // шифруем → перечитываем → сверяем → только потом удаляем открытую копию
    await vault.save(legacy);
    await vault.flush();
    const written = readJSONSafe(storage, VAULT_KEY);
    let ok = false;
    try {
      ok = isVaultRecord(written) && JSON.stringify(await decryptJSON(key, written, { crypto: c })) === JSON.stringify(legacy);
    } catch {
      ok = false;
    }
    if (!ok) {
      storage.removeItem(VAULT_KEY);
      return plainVault(storage, legacy, 'plain');
    }
    storage.removeItem(LEGACY_KEY);
  }
  return vault;
}

function activeVault({ storage, key, record, crypto: c, state, status }) {
  let chain = Promise.resolve();
  let pending;
  let hasPending = false;
  const header = { v: record.v, ks: record.ks, alg: record.alg ?? 'AES-GCM-256', kdf: record.kdf };
  return {
    state,
    status,
    encrypted: true,
    save(value) {
      pending = value;
      if (hasPending) return chain;
      hasPending = true;
      chain = chain
        .then(async () => {
          hasPending = false;
          const payload = await encryptJSON(key, pending, { crypto: c });
          storage.setItem(VAULT_KEY, JSON.stringify({ ...header, ...payload }));
        })
        .catch(() => {
          hasPending = false; // переполнено хранилище — следующая запись попробует снова
        });
      return chain;
    },
    flush: () => chain,
    discard() {},
  };
}

function plainVault(storage, state, status) {
  return {
    state,
    status,
    encrypted: false,
    save(value) {
      try {
        storage.setItem(LEGACY_KEY, JSON.stringify(value));
      } catch {
        /* приватный режим / переполнено */
      }
      return Promise.resolve();
    },
    flush: () => Promise.resolve(),
    discard() {},
  };
}

function unreadableVault(storage) {
  let enabled = false;
  return {
    state: null,
    status: 'unreadable',
    encrypted: false,
    save(value) {
      // пока пользователь не решил «начать заново», ничего не перезаписываем
      if (enabled) storage.setItem(LEGACY_KEY, JSON.stringify(value));
      return Promise.resolve();
    },
    flush: () => Promise.resolve(),
    discard() {
      storage.removeItem(VAULT_KEY);
      storage.removeItem(SECRET_FALLBACK_KEY);
      enabled = true;
    },
  };
}

/** Сейф браузера: IndexedDB + запасной localStorage. Никогда не бросает исключений. */
export async function openBrowserVault() {
  let storage;
  try {
    storage = window.localStorage;
    storage.getItem('probe');
  } catch {
    // хранилище отключено — работаем в памяти
    const mem = new Map();
    storage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  }
  try {
    return await openVault({ storage, secretStore: indexedDBSecretStore(), fallbackStore: localSecretStore(storage) });
  } catch {
    return plainVault(storage, readJSONSafe(storage, LEGACY_KEY), 'plain');
  }
}
