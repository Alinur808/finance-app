/**
 * Face ID / Touch ID прямо в браузере — через WebAuthn (passkey-механизм).
 *
 * Работает в Safari на iPhone (в том числе в PWA с экрана «Домой») и в Chrome
 * на Android без App Store и Xcode: встроенный аутентификатор устройства
 * (authenticatorAttachment: 'platform') проверяет лицо или палец
 * (userVerification: 'required'). Сервер не нужен: при включении мы создаём
 * ключ на устройстве и запоминаем его id и открытый ключ; при разблокировке
 * просим подпись случайного вызова и проверяем её здесь же:
 *   - challenge совпадает с нашим, type = webauthn.get, origin — наш;
 *   - в authenticatorData стоит флаг UV (личность подтверждена биометрией/кодом устройства);
 *   - подпись ES256/RS256 верна для сохранённого открытого ключа (если браузер его отдал).
 * Код-пароль остаётся запасным способом.
 */

export const b64url = {
  encode(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 1) s += String.fromCharCode(bytes[i]);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  decode(str) {
    const s = atob(str.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((str.length + 3) % 4));
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i += 1) out[i] = s.charCodeAt(i);
    return out;
  },
};

const random = (n) => crypto.getRandomValues(new Uint8Array(n));

/** Есть ли Face ID / Touch ID / отпечаток для WebAuthn на этом устройстве. */
export async function platformAuthenticatorAvailable() {
  try {
    if (typeof window === 'undefined' || !window.isSecureContext || !window.PublicKeyCredential) return false;
    return Boolean(await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable?.());
  } catch {
    return false;
  }
}

/** Понятный текст ошибки WebAuthn. */
export function describeWebAuthnError(error) {
  const name = error?.name ?? '';
  if (name === 'NotAllowedError' || name === 'AbortError') return 'Отменено или время вышло';
  if (name === 'InvalidStateError') return 'Ключ для этого устройства уже создан';
  if (name === 'NotSupportedError') return 'Это устройство не поддерживает Face ID в браузере';
  if (name === 'SecurityError') return 'Face ID работает только по защищённому адресу (https)';
  return error?.message || 'Не удалось проверить Face ID';
}

/**
 * Регистрация: создаёт ключ на устройстве (появится запрос Face ID / Touch ID).
 * Возвращает { id, publicKey, alg } для хранения в записи безопасности.
 * Вызывать из обработчика нажатия (Safari требует жест пользователя).
 */
export async function registerBiometric() {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: random(32),
      rp: { name: 'Финансы' }, // id по умолчанию — текущий домен
      user: { id: random(16), name: 'finance-app', displayName: 'Финансы' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 }, // ES256 — iPhone, Android
        { type: 'public-key', alg: -257 }, // RS256 — Windows Hello
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      timeout: 60_000,
      attestation: 'none',
    },
  });
  if (!credential) throw new Error('Ключ не создан');
  const response = credential.response;
  let publicKey = null;
  let alg = null;
  try {
    const spki = response.getPublicKey?.();
    alg = response.getPublicKeyAlgorithm?.() ?? null;
    if (spki && (alg === -7 || alg === -257)) publicKey = b64url.encode(spki);
  } catch {
    publicKey = null;
  }
  return { id: b64url.encode(credential.rawId), publicKey, alg, createdAt: new Date().toISOString() };
}

/** DER-подпись ECDSA → «сырые» r‖s по 32 байта (формат Web Crypto). */
export function derToRaw(der) {
  if (der[0] !== 0x30) throw new Error('bad DER');
  let offset = der[1] & 0x80 ? 2 + (der[1] & 0x7f) : 2;
  const readInt = () => {
    if (der[offset] !== 0x02) throw new Error('bad DER int');
    const len = der[offset + 1];
    let int = der.slice(offset + 2, offset + 2 + len);
    offset += 2 + len;
    while (int.length > 32 && int[0] === 0) int = int.slice(1);
    const out = new Uint8Array(32);
    out.set(int, 32 - int.length);
    return out;
  };
  const r = readInt();
  const s = readInt();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

const UV_FLAG = 0x04;
const UP_FLAG = 0x01;

/**
 * Проверка ответа аутентификатора (без сети). Экспортируется для тестов.
 * @returns {Promise<boolean>}
 */
export async function verifyAssertion({ credential, expectedChallenge, origin, stored }) {
  if (!credential || b64url.encode(credential.rawId) !== stored.id) return false;
  const { authenticatorData, clientDataJSON, signature } = credential.response;
  const client = JSON.parse(new TextDecoder().decode(clientDataJSON));
  if (client.type !== 'webauthn.get') return false;
  if (client.challenge !== b64url.encode(expectedChallenge)) return false;
  if (origin && client.origin !== origin) return false;
  const auth = new Uint8Array(authenticatorData);
  const flags = auth[32];
  if (!(flags & UP_FLAG) || !(flags & UV_FLAG)) return false; // нужна именно проверка личности

  if (!stored.publicKey) return true; // браузер не отдал открытый ключ: проверили вызов и флаги
  const clientHash = new Uint8Array(await crypto.subtle.digest('SHA-256', clientDataJSON));
  const signed = new Uint8Array(auth.length + clientHash.length);
  signed.set(auth, 0);
  signed.set(clientHash, auth.length);
  const spki = b64url.decode(stored.publicKey);
  if (stored.alg === -7) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(new Uint8Array(signature)), signed);
  }
  if (stored.alg === -257) {
    const key = await crypto.subtle.importKey('spki', spki, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    return crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, signature, signed);
  }
  return false;
}

/**
 * Разблокировка: запрос Face ID / Touch ID для сохранённого ключа.
 * true — личность подтверждена; false — не совпало. Отмена → исключение (NotAllowedError).
 */
export async function authenticateWithPasskey(stored) {
  const challenge = random(32);
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{ type: 'public-key', id: b64url.decode(stored.id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  return verifyAssertion({ credential, expectedChallenge: challenge, origin: window.location.origin, stored });
}
