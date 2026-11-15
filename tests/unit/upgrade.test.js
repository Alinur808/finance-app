/**
 * Юнит-тесты обновления: шифрование и миграция, очистка входных данных,
 * голосовой ввод, «Стоит ли оно того?», портрет привычек, неделя, темп трат,
 * месяц к месяцу, проверка WebAuthn.   npm run test:unit
 */
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { describe, test } from 'node:test';
import { decryptJSON, deriveKey, encryptJSON, LEGACY_KEY, memorySecretStore, openVault, PBKDF2_ITERATIONS, VAULT_KEY } from '../../src/utils/vault.js';
import { parseQuickAdd, parseSafeAmount, sanitizePlan, sanitizeSettings, sanitizeText, sanitizeTransaction, stripQuickAddParams } from '../../src/utils/sanitize.js';
import { extractNumbers, parseVoiceTransaction } from '../../src/utils/voiceParser.js';
import { describeWorkTime, estimateHourlyRate, worthIt } from '../../src/utils/worthIt.js';
import { analyzeBehavior, detectRecurring } from '../../src/utils/userProfileAnalyzer.js';
import { buildWeeklyRecap, recapWeekOffset, weekStart, weeklyLimitState } from '../../src/utils/weekly.js';
import { buildSafeToSpend } from '../../src/utils/pace.js';
import { buildAdvice, buildLLMPayload, detectAnomalies, monthOverMonth } from '../../src/utils/advisor.js';
import { b64url, derToRaw, verifyAssertion } from '../../src/utils/webauthn.js';
import { formatShare } from '../../src/utils/format.js';
import { makeState, makeTransactions } from '../fixtures/state.js';

const memoryStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), dump: () => Object.fromEntries(m) };
};
const FAST = 1000; // меньше итераций — быстрее тесты; в приложении PBKDF2_ITERATIONS

describe('шифрование данных (vault)', () => {
  test('параметры: PBKDF2-SHA-256 120 000 итераций, AES-GCM 256', () => {
    assert.equal(PBKDF2_ITERATIONS, 120_000);
  });

  test('шифрование и расшифровка, новый IV на каждую запись, подмена ломает расшифровку', async () => {
    const key = await deriveKey(webcrypto.getRandomValues(new Uint8Array(32)), webcrypto.getRandomValues(new Uint8Array(16)), { iterations: FAST });
    const a = await encryptJSON(key, { x: 1 });
    const b = await encryptJSON(key, { x: 1 });
    assert.notEqual(a.iv, b.iv);
    assert.deepEqual(await decryptJSON(key, a), { x: 1 });
    const bytes = Buffer.from(a.ct, 'base64');
    bytes[0] ^= 1;
    await assert.rejects(decryptJSON(key, { iv: a.iv, ct: bytes.toString('base64') }));
  });

  test('миграция открытых данных: ни одной потерянной операции, открытая копия удалена', async () => {
    const storage = memoryStorage();
    const legacy = makeState();
    storage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    const store = memorySecretStore('idb');
    const vault = await openVault({ storage, secretStore: store, iterations: FAST });
    assert.equal(vault.status, 'migrated');
    assert.equal(vault.state.transactions.length, legacy.transactions.length);
    assert.equal(storage.getItem(LEGACY_KEY), null);
    const raw = storage.getItem(VAULT_KEY);
    assert.ok(raw);
    assert.ok(!raw.includes('Magnum') && !raw.includes('Алекс'), 'в хранилище нет открытого текста');
    const rec = JSON.parse(raw);
    assert.equal(rec.ks, 'idb');
    assert.equal(rec.kdf.iterations, FAST);

    // повторный запуск: читаем зашифрованное
    const again = await openVault({ storage, secretStore: store, iterations: FAST });
    assert.equal(again.status, 'encrypted');
    assert.deepEqual(again.state, legacy);

    // сохранение — новое значение, последнее побеждает
    again.save({ ...legacy, goals: [] });
    again.save({ ...legacy, goals: [], activeGoalId: 'z' });
    await again.flush();
    const third = await openVault({ storage, secretStore: store, iterations: FAST });
    assert.equal(third.state.activeGoalId, 'z');
  });

  test('ключ потерян — сейф не перезаписывается', async () => {
    const storage = memoryStorage();
    storage.setItem(LEGACY_KEY, JSON.stringify(makeState()));
    await openVault({ storage, secretStore: memorySecretStore('idb'), iterations: FAST });
    const before = storage.getItem(VAULT_KEY);
    const lost = await openVault({ storage, secretStore: memorySecretStore('idb'), iterations: FAST });
    assert.equal(lost.status, 'unreadable');
    await lost.save({ transactions: [] });
    assert.equal(storage.getItem(VAULT_KEY), before);
  });

  test('запасное хранение секрета, если IndexedDB недоступна', async () => {
    const storage = memoryStorage();
    const broken = { id: 'idb', get: async () => null, set: async () => Promise.reject(new Error('no idb')) };
    const fallback = memorySecretStore('ls');
    const vault = await openVault({ storage, secretStore: broken, fallbackStore: fallback, iterations: FAST });
    assert.equal(JSON.parse(storage.getItem(VAULT_KEY) ?? 'null'), null); // нечего было мигрировать
    vault.save({ transactions: [] });
    await vault.flush();
    assert.equal(JSON.parse(storage.getItem(VAULT_KEY)).ks, 'ls');
  });
});

describe('очистка входных данных', () => {
  test('строки: управляющие, невидимые и bidi-символы, угловые скобки', () => {
    assert.equal(sanitizeText('  <img src=x onerror=alert(1)>Mag‮num​\u0007  '), 'img src=x onerror=alert(1)Magnum');
    assert.equal(sanitizeText('a'.repeat(500)).length, 120);
  });

  test('суммы', () => {
    assert.equal(parseSafeAmount('4 500,50 ₸'), 4500.5);
    assert.equal(parseSafeAmount('₸1 800,00'), 1800);
    assert.equal(parseSafeAmount('1,234.56'), 1234.56);
    assert.equal(parseSafeAmount('1,800'), 1800);
    assert.equal(parseSafeAmount('18,5'), 18.5);
    assert.equal(parseSafeAmount('-500'), null);
    assert.equal(parseSafeAmount('1e400'), null);
    assert.equal(parseSafeAmount('12abc34'), null);
    assert.equal(parseSafeAmount('KZT 1800'), 1800);
    assert.equal(parseSafeAmount('abc'), null);
    assert.equal(parseSafeAmount(Infinity), null);
  });

  test('?quickAdd= — черновик без автосохранения, вредные значения отброшены', () => {
    const known = (id, type) => (type === 'expense' ? ['cafe', 'taxi'] : ['salary']).includes(id);
    const d = parseQuickAdd('?quickAdd=1&amount=1%20800%2C00&merchant=%3Cscript%3Ealert(1)%3C%2Fscript%3EStarbucks&type=expense&category=cafe', { knownCategory: known });
    assert.deepEqual(d, { type: 'expense', amount: 1800, merchant: 'scriptalert(1)/scriptStarbucks', categoryId: 'cafe', source: 'shortcut' });
    assert.equal(parseQuickAdd('?amount=100'), null);
    assert.equal(parseQuickAdd('?quickAdd=1&amount=-5&type=hack&category=__proto__', { knownCategory: known }).amount, null);
    assert.equal(parseQuickAdd('?quickAdd=1&type=hack').type, 'expense');
    assert.equal(parseQuickAdd('?quickAdd=1&category=__proto__', { knownCategory: known }).categoryId, null);
    assert.equal(stripQuickAddParams('https://x.io/app/?quickAdd=1&amount=5&tab=a#h'), '/app/?tab=a#h');
  });

  test('операции и настройки из JSON: белый список полей, без загрязнения прототипа', () => {
    const tx = JSON.parse('{"id":"t-1","type":"expense","amount":100,"categoryId":"cafe","date":"2026-11-01T10:00:00.000Z","merchant":"A\\u202eB","__proto__":{"polluted":true},"evil":"x","accountId":"bank"}');
    const clean = sanitizeTransaction(tx, { knownCategory: (id) => id === 'cafe' });
    assert.deepEqual(Object.keys(clean).sort(), ['accountId', 'amount', 'categoryId', 'date', 'id', 'merchant', 'note', 'type']);
    assert.equal(clean.accountId, 'kaspi');
    assert.equal(clean.merchant, 'AB');
    assert.equal({}.polluted, undefined);
    assert.equal(sanitizeTransaction({ ...tx, amount: 'NaN' }), null);
    const settings = sanitizeSettings(JSON.parse('{"aiApiKey":"sk-ant-secret","name":"<b>Ли</b>","monthlyBudget":-5,"weeklyLimit":50000,"openings":{"kaspi":10,"x":5},"__proto__":{"a":1}}'));
    assert.equal(settings.aiApiKey, undefined);
    assert.equal(settings.name, 'bЛи/b');
    assert.equal(settings.monthlyBudget, 0);
    assert.equal(settings.weeklyLimit, 50000);
    assert.deepEqual(settings.openings, { kaspi: 10 });
  });

  test('план дневника: только известные формы правил', () => {
    const plan = sanitizePlan({ deadline: '2026-12-31', items: [{ id: 'i', name: 'Подарки', amount: 50000, paidOn: null }], incomes: [{ id: 'z', name: 'ЗП', amount: 1, rule: { type: 'weekly', weekday: 9 } }, { id: 'y', name: 'ЗП', amount: 100, rule: { type: 'monthly', day: 5, x: 'y' } }] });
    assert.equal(plan.items.length, 1);
    assert.deepEqual(plan.incomes.map((i) => i.rule), [{ type: 'monthly', day: 5 }]);
    assert.equal(sanitizePlan({ deadline: 'bad', items: [], incomes: [] }), undefined);
  });
});

describe('голосовой ввод', () => {
  const cases = [
    ['Такси две пятьсот', 2500, 'expense', 'taxi'],
    ['Кофе 1800', 1800, 'expense', 'cafe'],
    ['Зарплата 300 тысяч', 300000, 'income', 'salary'],
    ['Продукты полторы тысячи', 1500, 'expense', 'groceries'],
    ['Аренда двести пятьдесят тысяч', 250000, 'expense', 'housing'],
    ['обед 3 200 тенге', 3200, 'expense', 'cafe'],
    ['300к на ремонт', 300000, 'expense', 'housing'],
    ['две с половиной тысячи такси', 2500, 'expense', 'taxi'],
    ['Магнум пять тысяч триста', 5300, 'expense', 'groceries'],
    ['кэшбэк 1 250', 1250, 'income', 'refunds'],
    ['зарплата 1,5 млн', 1500000, 'income', 'salary'],
    ['такси три двести', 3200, 'expense', 'taxi'],
  ];
  for (const [phrase, amount, type, categoryId] of cases) {
    test(phrase, () => {
      const r = parseVoiceTransaction(phrase);
      assert.equal(r.amount, amount);
      assert.equal(r.type, type);
      assert.equal(r.categoryId, categoryId);
    });
  }
  test('без суммы — null; описание без служебных слов', () => {
    assert.equal(parseVoiceTransaction('кофе'), null);
    assert.equal(parseVoiceTransaction('потратил на такси 900 тенге').merchant, 'Такси');
    assert.deepEqual(extractNumbers(['сто', 'двадцать', 'пять']).numbers, [125]);
  });
});

describe('«Стоит ли оно того?»', () => {
  test('ставка по зарплате / 168 часов, своя ставка важнее', () => {
    const tx = makeTransactions(new Date(), 60);
    const auto = estimateHourlyRate(tx);
    assert.equal(auto.source, 'salary');
    assert.ok(Math.abs(auto.rate - auto.monthlyIncome / 168) < 1e-6);
    assert.deepEqual(estimateHourlyRate(tx, { manualRate: 5000 }).rate, 5000);
    assert.equal(estimateHourlyRate([]).source, 'none');
  });
  test('часы работы и дни до цели', () => {
    const r = worthIt({ amount: 9000, rate: 2000, monthlySavings: 30440, goal: { target: 1e6, saved: 0 } });
    assert.equal(r.workLabel, '4,5 часа работы');
    assert.equal(Math.round(r.goalDelayDays), 9);
    assert.equal(r.delayLabel, '+9\u00a0дней');
    assert.equal(worthIt({ amount: 9000, rate: 2000, monthlySavings: -1, goal: { target: 10, saved: 0 } }).goalBlocked, true);
    const weekly = worthIt({ amount: 1000, rate: 1000, monthlySavings: 100000, goal: { target: 1e6, saved: 0 }, frequency: 'weekly' });
    assert.ok(Math.abs(weekly.yearly - 52000) < 1);
    assert.ok(weekly.goalDelayDays > 0);
    assert.equal(describeWorkTime(0.25), '15 минут работы');
    assert.equal(describeWorkTime(30), '3,8 рабочего дня');
  });
});

describe('портрет привычек', () => {
  const now = new Date(2026, 10, 15, 20, 0);
  const at = (daysAgo, h, amount, categoryId, merchant, extra = {}) => ({
    id: `x${daysAgo}-${h}-${merchant}`,
    type: 'expense',
    amount,
    categoryId,
    merchant,
    accountId: 'kaspi',
    date: new Date(2026, 10, 15 - daysAgo, h, 10).toISOString(),
    ...extra,
  });
  const txs = [];
  for (let d = 0; d < 40; d += 1) txs.push(at(d, 23, 4500, 'delivery', 'Wolt'), at(d, 13, 1200, 'cafe', 'Coffee'));
  for (const d of [3, 33]) txs.push(at(d, 9, 3490, 'subscriptions', 'Netflix'));
  for (const d of [5, 35]) txs.push(at(d, 9, 1990, 'shopping', 'Яндекс Плюс'));

  test('ночной гурман: поздние заказы, регулярные списания, три действия', () => {
    const p = analyzeBehavior(txs, now);
    assert.equal(p.hasData, true);
    assert.equal(p.archetype.id, 'night-owl');
    assert.equal(p.stats.lateCount, 39); // заказ «сегодня в 23:10» ещё не наступил
    assert.ok(p.stats.recurring.some((r) => r.merchant === 'Netflix'));
    assert.ok(p.stats.recurring.some((r) => r.merchant === 'Яндекс Плюс'));
    assert.equal(p.recommendations.length, 3);
    assert.ok(p.recommendations.some((r) => r.id === 'kitchen-closed'));
  });
  test('строки PDF без времени не считаются поздними', () => {
    const p = analyzeBehavior(txs.map((t) => ({ ...t, noTime: true })), now);
    assert.equal(p.stats.lateCount, 0);
  });
  test('мало данных', () => {
    assert.equal(analyzeBehavior(txs.slice(0, 3), now).hasData, false);
    assert.deepEqual(detectRecurring([]), []);
  });
});

describe('неделя и темп трат', () => {
  const sunday = new Date(2026, 10, 15, 18, 0); // воскресенье
  const wednesday = new Date(2026, 10, 11, 18, 0);
  const tx = (day, amount, type = 'expense', categoryId = 'cafe') => ({ id: `w${day}${amount}`, type, amount, categoryId, merchant: '', accountId: 'kaspi', date: new Date(2026, 10, day, 12).toISOString() });
  const txs = [tx(10, 5000), tx(12, 7000, 'expense', 'taxi'), tx(13, 1000, 'expense', 'own'), tx(11, 100000, 'income', 'salary'), tx(4, 4000)];

  test('неделя с понедельника, итоги в воскресенье — текущая неделя', () => {
    assert.equal(weekStart(sunday).getDate(), 9);
    assert.equal(recapWeekOffset(sunday), 0);
    assert.equal(recapWeekOffset(wednesday), -1);
    const r = buildWeeklyRecap(txs, sunday);
    assert.equal(r.expense, 12000); // перевод между своими счетами — не трата
    assert.equal(r.income, 100000);
    assert.equal(r.prevExpense, 4000);
    assert.equal(r.change, 2);
    assert.equal(r.top.categoryId, 'taxi');
  });
  test('недельный лимит', () => {
    const s = weeklyLimitState(txs, 10000, sunday);
    assert.equal(s.exhausted, true);
    assert.equal(s.wouldExceed(1), true);
    assert.equal(weeklyLimitState(txs, 0, sunday), null);
    assert.equal(weeklyLimitState(txs, 50000, sunday).wouldExceed(1000), false);
  });
  test('«Сегодня можно потратить»: от месяца и из дневника', () => {
    const now = new Date();
    const all = makeTransactions(now, 60);
    const state = makeState({ transactions: all });
    const advice = buildAdvice(all, state.goals[0], now);
    const month = buildSafeToSpend({ transactions: all, balance: 1e6, plan: state.plan, advice, now });
    assert.equal(month.source, 'month');
    assert.ok(Number.isFinite(month.allowance));
    const y = now.getFullYear() + 1;
    const diary = buildSafeToSpend({ transactions: all, balance: 1e6, plan: { deadline: `${y}-01-31`, items: [{ id: 'a', name: 'Подарки', amount: 100000, paidOn: null }], incomes: [] }, advice, now });
    assert.equal(diary.source, 'diary');
    assert.equal(buildSafeToSpend({ transactions: [], balance: 0, plan: state.plan, advice: null, now }), null);
  });
});

describe('ИИ-аналитик: месяц к месяцу и аномалии', () => {
  test('сравнение тех же дней прошлого месяца и необычная трата', () => {
    const now = new Date(2026, 10, 15, 12);
    const tx = (m, d, amount, categoryId = 'cafe', merchant = 'Coffee') => ({ id: `m${m}${d}${amount}`, type: 'expense', amount, categoryId, merchant, accountId: 'kaspi', date: new Date(2026, m, d, 12).toISOString() });
    const txs = [tx(9, 1, 1000), tx(9, 10, 1000), tx(9, 20, 9000), tx(10, 2, 3000), tx(10, 3, 3000), tx(10, 5, 2500), tx(10, 6, 2800), tx(10, 14, 40000, 'cafe', 'Банкет'), tx(8, 3, 2500)];
    const m = monthOverMonth(txs, now);
    assert.equal(m.comparable, true);
    assert.equal(m.previous, 2000); // 20 октября — после 15-го, в сравнение не входит
    const a = detectAnomalies(txs, now);
    assert.equal(a[0].merchant, 'Банкет');
    const payload = buildLLMPayload(makeTransactions(now, 70), makeState().goals[0], now);
    assert.ok('monthOverMonth' in payload && 'anomalies' in payload && 'persona' in payload);
  });
});

describe('доли категорий', () => {
  test('один знак после запятой до 10%', () => {
    assert.equal(formatShare(0.045), '4,5%');
    assert.equal(formatShare(0.42), '42%');
    assert.equal(formatShare(0.0004), '<0,1%');
    assert.equal(formatShare(0), '0%');
  });
});

describe('WebAuthn: проверка подписи без сервера', () => {
  test('ES256: верная подпись и флаг UV принимаются, без UV — нет', async () => {
    const subtle = webcrypto.subtle;
    const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const spki = new Uint8Array(await subtle.exportKey('spki', pair.publicKey));
    const rawId = new Uint8Array([1, 2, 3, 4]);
    const stored = { id: b64url.encode(rawId), publicKey: b64url.encode(spki), alg: -7 };
    const challenge = new Uint8Array(32).fill(7);
    const make = async (flags) => {
      const auth = new Uint8Array(37);
      auth[32] = flags;
      const clientDataJSON = new TextEncoder().encode(JSON.stringify({ type: 'webauthn.get', challenge: b64url.encode(challenge), origin: 'https://example.app' }));
      const hash = new Uint8Array(await subtle.digest('SHA-256', clientDataJSON));
      const data = new Uint8Array([...auth, ...hash]);
      const rawSig = new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, data));
      // raw r‖s → DER, как отдаёт аутентификатор
      const int = (b) => {
        let x = [...b];
        while (x.length > 1 && x[0] === 0) x.shift();
        if (x[0] & 0x80) x = [0, ...x];
        return [0x02, x.length, ...x];
      };
      const body = [...int(rawSig.slice(0, 32)), ...int(rawSig.slice(32))];
      const der = new Uint8Array([0x30, body.length, ...body]);
      assert.deepEqual(derToRaw(der), rawSig);
      return { rawId, response: { authenticatorData: auth.buffer, clientDataJSON: clientDataJSON.buffer, signature: der.buffer } };
    };
    const ok = await verifyAssertion({ credential: await make(0x05), expectedChallenge: challenge, origin: 'https://example.app', stored });
    assert.equal(ok, true);
    const noUv = await verifyAssertion({ credential: await make(0x01), expectedChallenge: challenge, origin: 'https://example.app', stored });
    assert.equal(noUv, false);
    const wrongOrigin = await verifyAssertion({ credential: await make(0x05), expectedChallenge: challenge, origin: 'https://evil.app', stored });
    assert.equal(wrongOrigin, false);
  });
});
