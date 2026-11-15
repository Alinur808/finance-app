import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authenticateBiometric as nativeAuthenticate, biometricAvailable } from '../native/biometrics.js';
import { hashPasscode, newSalt } from '../utils/passcode.js';
import { readJSON, writeJSON } from '../utils/storage.js';
import { authenticateWithPasskey, describeWebAuthnError, platformAuthenticatorAvailable, registerBiometric } from '../utils/webauthn.js';

/**
 * Код-пароль (4 цифры). Блокирует приложение:
 *   - при холодном запуске;
 *   - когда приложение уходит в фон (visibilitychange → hidden) — заодно
 *     в переключателе приложений iOS не видно сумм.
 * Системные окна (выбор файла, «Поделиться») тоже уводят страницу в фон —
 * на время их показа автоблокировка ставится на паузу (pauseAutoLock).
 *
 * Хранится отдельно от данных (tenge-finance.security) и никогда не попадает
 * в резервную копию. Хранятся соль и хеш, а не сам код.
 *
 * Face ID / Touch ID:
 *   - в Capacitor — нативный плагин (native/biometrics.js);
 *   - в браузере и PWA — WebAuthn (utils/webauthn.js): id и открытый ключ
 *     passkey хранятся в этой же записи (passkey), секрет остаётся в Secure Enclave.
 */
const KEY = 'tenge-finance.security';
const MAX_ATTEMPTS = 5;
const COOLDOWN_MS = 30_000;
const DEFAULT = { enabled: false, salt: '', hash: '', biometrics: true, passkey: null, failures: 0, lockedUntil: 0 };

const SecurityContext = createContext(null);
const readRecord = () => ({ ...DEFAULT, ...readJSON(KEY, {}) });

export function SecurityProvider({ children }) {
  const [record, setRecord] = useState(readRecord);
  const [locked, setLocked] = useState(() => readRecord().enabled);
  // 'native' — плагин Capacitor, 'webauthn' — браузер, null — нет биометрии
  const [biometricKind, setBiometricKind] = useState(null);
  const pausedUntil = useRef(0);
  const enabledRef = useRef(record.enabled);
  enabledRef.current = record.enabled;

  useEffect(() => {
    writeJSON(KEY, record);
  }, [record]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const kind = (await biometricAvailable()) ? 'native' : (await platformAuthenticatorAvailable()) ? 'webauthn' : null;
      if (alive) setBiometricKind(kind);
    })();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden' && enabledRef.current && Date.now() > pausedUntil.current) setLocked(true);
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const pauseAutoLock = useCallback((ms = 90_000) => {
    pausedUntil.current = Date.now() + ms;
  }, []);

  /** Проверка кода. Возвращает 'ok' | 'wrong' | 'cooldown'. */
  const unlock = useCallback(
    (code) => {
      if (Date.now() < record.lockedUntil) return 'cooldown';
      if (hashPasscode(code, record.salt) === record.hash) {
        setRecord((r) => ({ ...r, failures: 0, lockedUntil: 0 }));
        setLocked(false);
        return 'ok';
      }
      const failures = record.failures + 1;
      const cooldown = failures % MAX_ATTEMPTS === 0;
      setRecord((r) => ({ ...r, failures, lockedUntil: cooldown ? Date.now() + COOLDOWN_MS : r.lockedUntil }));
      return cooldown ? 'cooldown' : 'wrong';
    },
    [record],
  );

  /** Разблокировка после Face ID / Touch ID. */
  const unlockWithBiometrics = useCallback(() => {
    setRecord((r) => ({ ...r, failures: 0, lockedUntil: 0 }));
    setLocked(false);
  }, []);

  const verify = useCallback((code) => record.enabled && hashPasscode(code, record.salt) === record.hash, [record]);

  const setPasscode = useCallback((code) => {
    const salt = newSalt();
    setRecord((r) => ({ ...r, enabled: true, salt, hash: hashPasscode(code, salt), failures: 0, lockedUntil: 0 }));
  }, []);

  const disablePasscode = useCallback(() => {
    setRecord((r) => ({ ...DEFAULT, biometrics: r.biometrics }));
    setLocked(false);
  }, []);

  /**
   * Включить/выключить Face ID. Для WebAuthn включение создаёт passkey
   * (системный запрос Face ID) — вызывать из нажатия. → { ok, error? }
   */
  const setBiometrics = useCallback(
    async (on) => {
      if (!on) {
        setRecord((r) => ({ ...r, biometrics: false, passkey: null }));
        return { ok: true };
      }
      if (biometricKind === 'webauthn') {
        pausedUntil.current = Date.now() + 90_000; // системное окно Face ID не должно блокировать приложение
        try {
          const passkey = await registerBiometric();
          setRecord((r) => ({ ...r, biometrics: true, passkey }));
          return { ok: true };
        } catch (e) {
          return { ok: false, error: describeWebAuthnError(e) };
        } finally {
          pausedUntil.current = Date.now() + 1500;
        }
      }
      setRecord((r) => ({ ...r, biometrics: true }));
      return { ok: true };
    },
    [biometricKind],
  );

  /** Проверка Face ID / Touch ID. → 'ok' | 'cancelled' | 'failed' */
  const authenticateBiometric = useCallback(async () => {
    pausedUntil.current = Date.now() + 60_000;
    try {
      if (biometricKind === 'native') return (await nativeAuthenticate()) ? 'ok' : 'cancelled';
      if (biometricKind === 'webauthn' && record.passkey) return (await authenticateWithPasskey(record.passkey)) ? 'ok' : 'failed';
      return 'failed';
    } catch {
      return 'cancelled'; // отмена, тайм-аут или Safari требует нажатия — остаётся код-пароль
    } finally {
      pausedUntil.current = Date.now() + 1500;
    }
  }, [biometricKind, record.passkey]);

  const biometricsReady = biometricKind === 'native' ? record.biometrics : biometricKind === 'webauthn' ? record.biometrics && Boolean(record.passkey) : false;

  const value = useMemo(
    () => ({
      enabled: record.enabled,
      locked: record.enabled && locked,
      lockedUntil: record.lockedUntil,
      biometricsEnabled: biometricsReady,
      canBiometric: Boolean(biometricKind),
      biometricKind,
      unlock,
      unlockWithBiometrics,
      authenticateBiometric,
      verify,
      setPasscode,
      disablePasscode,
      setBiometrics,
      pauseAutoLock,
      lockNow: () => record.enabled && setLocked(true),
    }),
    [record, locked, biometricKind, biometricsReady, unlock, unlockWithBiometrics, authenticateBiometric, verify, setPasscode, disablePasscode, setBiometrics, pauseAutoLock],
  );
  return <SecurityContext.Provider value={value}>{children}</SecurityContext.Provider>;
}

export function useSecurity() {
  const ctx = useContext(SecurityContext);
  if (!ctx) throw new Error('useSecurity must be used inside <SecurityProvider>');
  return ctx;
}
