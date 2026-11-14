/**
 * Юнит-тесты движка выписок: node --test tests/unit/  (npm run test:unit)
 * PDF-фикстуры создаёт npm run fixtures (нужен python3 + reportlab); без них
 * соответствующие тесты пропускаются, а тесты на синтетических страницах идут всегда.
 */
import { existsSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractPdfPages } from '../../src/utils/freedomParser.js';
import { detectBank, parseStatement, SCANNED_PDF_MESSAGE } from '../../src/utils/statementParser.js';
import { parseAmount, parseDate } from '../../src/utils/universalStatementParser.js';
import { CATEGORY_ALIASES, categorizeTransaction } from '../../src/utils/categorizer.js';
import { kaspiDay } from '../../src/utils/kaspiParser.js';

const FIX = 'tests/fixtures';
const pdf = async (name) => extractPdfPages(new Uint8Array(readFileSync(`${FIX}/${name}`)), pdfjs);
const has = (name) => existsSync(`${FIX}/${name}`);

/** Синтетическая страница: [[y, [[x, 'текст'], …]], …] → формат extractPdfPages. */
const page = (lines) => ({ items: lines.flatMap(([y, cells]) => cells.map(([x, str]) => ({ str, x, y, w: str.length * 4.5 }))) });

describe('числа и даты', () => {
  test('суммы: знаки, скобки, CR/DR, разделители, валюты', () => {
    const cases = [
      ['- 12 450,00 ₸', 12450, -1, 'KZT'],
      ['+ 50 000,00 ₸', 50000, 1, 'KZT'],
      ['(250.00)', 250, -1, null],
      ['1,234.56 CR', 1234.56, 1, null],
      ['1,234.56 DR', 1234.56, -1, null],
      ['AED 1,234.56', 1234.56, 0, 'AED'],
      ['-€12.50', 12.5, -1, 'EUR'],
      ['£9.99', 9.99, 0, 'GBP'],
      ['1.234,56', 1234.56, 0, null],
      ['12 450,00-', 12450, -1, null],
      ['15 000 тг', 15000, 0, 'KZT'],
      ['999 999 999 999,99 ₸', 999999999999.99, 0, 'KZT'],
    ];
    for (const [raw, value, sign, currency] of cases) {
      const a = parseAmount(raw);
      assert.ok(a, raw);
      assert.equal(a.value, value, raw);
      assert.equal(a.sign, sign, raw);
      assert.equal(a.currency, currency, raw);
    }
    for (const notMoney of ['14.11.26', '2026', '14:32', 'KZ00722S0000', '4400 43** **** 7788']) assert.equal(parseAmount(notMoney), null, notMoney);
  });

  test('даты: все форматы и короткий год Kaspi', () => {
    for (const s of ['14.11.26', '14.11.2026', '2026-11-14', '14/11/2026', '14 Nov 2026', '14-Nov-26', 'Nov 14, 2026', '14 ноября 2026'])
      assert.equal(parseDate(s)?.day, '2026-11-14', s);
    assert.equal(parseDate('11/14/2026', 'MDY')?.day, '2026-11-14');
    assert.equal(kaspiDay('14', '11', '26'), '2026-11-14');
    assert.equal(parseDate('31.02.2026'), null); // несуществующая дата — не дата
  });
});

describe('классификатор', () => {
  test('синонимы из ТЗ указывают на существующие категории', () => {
    assert.deepEqual(
      ['food', 'transport', 'internal', 'other'].map((k) => CATEGORY_ALIASES[k]),
      ['groceries', 'taxi', 'own', 'shopping'],
    );
  });
  test('русские и английские описания', () => {
    const c = (text, sign = '-', kind = null) => categorizeTransaction({ text, sign, kind });
    assert.equal(c('На Kaspi Депозит'), 'own');
    assert.equal(c('С Kaspi Депозита', '+'), 'own');
    assert.equal(c('Пополнение Kaspi Депозита'), 'own');
    assert.equal(c('OWN ACCOUNT TRANSFER TO SAVINGS'), 'own');
    assert.equal(c('Magnum Cash&Carry'), 'groceries');
    assert.equal(c('CARREFOUR CITY CENTRE'), 'groceries');
    assert.equal(c('Яндекс Go'), 'taxi');
    assert.equal(c('YANDEX.GO'), 'taxi');
    assert.equal(c('NETFLIX.COM'), 'subscriptions');
    assert.equal(c('Аптека Europharma'), 'health');
    assert.equal(c('DEWA BILL PAYMENT'), 'housing');
    assert.equal(c('SALARY TRANSFER ACME LLC', '+'), 'salary');
    assert.equal(c('Возврат покупки', '+'), 'refunds');
    assert.equal(c('ATM CASH WITHDRAWAL'), 'cash');
    assert.equal(c('Комиссия за перевод'), 'fees');
    assert.equal(c('Комиссия банка · Снятие наличных', '-', 'fee'), 'fees');
    assert.equal(c('Айгерим А.', '-', 'transfer'), 'transfers');
    assert.equal(c('Неизвестный магазин'), 'shopping');
  });
});

describe('универсальный разбор (синтетические страницы)', () => {
  test('Revolut-подобная: Money out / Money in / Balance, € и DD Mon YYYY', () => {
    const r = parseStatement([
      page([
        [800, [[40, 'Revolut Ltd']]],
        [785, [[40, 'EUR Statement · Card ending in 4321']]],
        [770, [[40, 'Period: 01 Nov 2026 – 14 Nov 2026']]],
        [
          740,
          [
            [40, 'Date'],
            [130, 'Description'],
            [330, 'Money out'],
            [410, 'Money in'],
            [490, 'Balance'],
          ],
        ],
        [
          720,
          [
            [40, '02 Nov 2026'],
            [130, 'Card payment to Lidl'],
            [330, '€42.10'],
            [490, '€957.90'],
          ],
        ],
        [
          705,
          [
            [40, '03 Nov 2026'],
            [130, 'Top-up by *1234'],
            [410, '€200.00'],
            [490, '€1,157.90'],
          ],
        ],
        [
          690,
          [
            [40, '04 Nov 2026'],
            [130, 'Exchanged to USD'],
            [330, '€100.00'],
            [490, '€1,057.90'],
          ],
        ],
        [
          675,
          [
            [40, '05 Nov 2026'],
            [130, 'Spotify'],
            [330, '€9.99'],
            [490, '€1,047.91'],
          ],
        ],
        [40, [[260, 'Page 1 of 1']]],
      ]),
    ]);
    assert.equal(r.bank, 'universal');
    assert.equal(r.cardName, 'Revolut *4321');
    assert.equal(r.transactions.length, 4);
    assert.deepEqual(r.period, { from: '2026-11-01', to: '2026-11-14' });
    const lidl = r.transactions.find((t) => /Lidl/.test(t.merchant));
    assert.equal(lidl.type, 'expense');
    assert.equal(lidl.categoryId, 'groceries');
    assert.deepEqual(lidl.original, { amount: 42.1, currency: 'EUR' });
    assert.equal(lidl.amount, Math.round(42.1 * 540 * 100) / 100);
    assert.equal(r.transactions.find((t) => /Top-up/.test(t.merchant)).type, 'income');
    assert.equal(r.transactions.find((t) => /Exchanged/.test(t.merchant)).categoryId, 'own');
    assert.equal(r.closingBalance, Math.round(1047.91 * 540 * 100) / 100);
    assert.deepEqual(
      r.conversions.map((c) => [c.currency, c.rate]),
      [['EUR', 540]],
    );
  });

  test('казахстанский банк: одна колонка суммы со знаком, валюта, перенос описания, итоги', () => {
    const r = parseStatement([
      page([
        [800, [[40, 'АО «ForteBank»']]],
        [785, [[40, 'Выписка по карте **** 5566 за период с 01.11.2026 по 14.11.2026']]],
        [
          750,
          [
            [40, 'Дата операции'],
            [130, 'Описание'],
            [360, 'Сумма'],
            [450, 'Валюта'],
          ],
        ],
        [
          730,
          [
            [40, '14.11.2026'],
            [130, 'Small супермаркет'],
            [360, '-3 450,00'],
            [450, 'KZT'],
          ],
        ],
        [718, [[130, 'г. Астана, пр. Республики']]],
        [
          700,
          [
            [40, '12.11.2026'],
            [130, 'Зачисление заработной платы'],
            [360, '+450 000,00'],
            [450, 'KZT'],
          ],
        ],
        [
          685,
          [
            [40, '11.11.2026'],
            [130, 'Перевод Айгерим А.'],
            [360, '-15 000,00'],
            [450, 'KZT'],
          ],
        ],
        [
          660,
          [
            [130, 'Итого:'],
            [360, '431 550,00'],
          ],
        ],
        [40, [[40, 'Подлинность выписки можно проверить по QR-коду']]],
      ]),
    ]);
    assert.equal(r.cardName, 'ForteBank *5566');
    assert.equal(r.transactions.length, 3);
    const small = r.transactions.find((t) => /Small/.test(t.merchant));
    assert.equal(small.amount, 3450);
    assert.equal(small.categoryId, 'groceries');
    assert.match(small.note, /пр\. Республики/); // перенос описания
    assert.equal(r.transactions.find((t) => /заработной/.test(t.merchant)).categoryId, 'salary');
    assert.equal(r.closingBalance, null); // остатка нет — баланс сдвинется на сумму операций
  });

  test('MM/DD/YYYY, скобки и CR/DR', () => {
    const r = parseStatement([
      page([
        [800, [[40, 'Chase Bank · Account ending 0042']]],
        [
          760,
          [
            [40, 'Date'],
            [120, 'Description'],
            [400, 'Amount'],
          ],
        ],
        [
          740,
          [
            [40, '11/13/2026'],
            [120, 'STARBUCKS #123'],
            [400, '(6.40)'],
          ],
        ],
        [
          725,
          [
            [40, '11/14/2026'],
            [120, 'PAYROLL DEPOSIT'],
            [400, '2,500.00 CR'],
          ],
        ],
        [
          710,
          [
            [40, '11/14/2026'],
            [120, 'UBER TRIP'],
            [400, '18.20 DR'],
          ],
        ],
      ]),
    ]);
    assert.equal(r.transactions.length, 3);
    assert.ok(r.transactions.every((t) => t.date.startsWith('2026-11-1')));
    assert.equal(r.transactions.find((t) => /STARBUCKS/.test(t.merchant)).type, 'expense');
    assert.equal(r.transactions.find((t) => /PAYROLL/.test(t.merchant)).type, 'income');
    assert.equal(r.transactions.find((t) => /UBER/.test(t.merchant)).categoryId, 'taxi');
  });

  test('без шапки и без знаков: направление по изменению остатка', () => {
    const r = parseStatement([
      page([
        [800, [[40, 'Wio Bank P.J.S.C.']]],
        [
          740,
          [
            [40, '01/11/2026'],
            [120, 'Coffee'],
            [380, '20.00'],
            [480, '980.00'],
          ],
        ],
        [
          725,
          [
            [40, '02/11/2026'],
            [120, 'Incoming payment'],
            [380, '500.00'],
            [480, '1,480.00'],
          ],
        ],
        [
          710,
          [
            [40, '03/11/2026'],
            [120, 'Groceries'],
            [380, '80.00'],
            [480, '1,400.00'],
          ],
        ],
      ]),
    ]);
    assert.deepEqual(r.transactions.map((t) => t.type).sort(), ['expense', 'expense', 'income']);
    assert.equal(r.cardName, 'Wio');
  });

  test('слово «Kaspi» в операциях чужой выписки не включает разборщик Kaspi', () => {
    const pages = [
      page([
        [800, [[40, 'Jusan Bank']]],
        [
          760,
          [
            [40, 'Дата'],
            [120, 'Описание'],
            [400, 'Сумма'],
          ],
        ],
        [
          740,
          [
            [40, '14.11.2026'],
            [120, 'Перевод на карту Kaspi Gold'],
            [400, '-5 000,00 ₸'],
          ],
        ],
      ]),
    ];
    assert.equal(detectBank(pages), 'universal');
    assert.equal(parseStatement(pages).cardName, 'Jusan Bank');
  });

  test('пустой PDF (скан) — понятная ошибка', () => {
    assert.throws(
      () => parseStatement([{ items: [] }]),
      (e) => e.name === 'StatementFormatError' && e.message === SCANNED_PDF_MESSAGE,
    );
  });
});

describe('PDF-фикстуры', () => {
  test('Freedom Bank — без изменений: 208 строк, 14 234,77 ₸', { skip: !has('freedom-synthetic.pdf') }, async () => {
    const pages = await pdf('freedom-synthetic.pdf');
    assert.equal(detectBank(pages), 'freedom');
    const r = parseStatement(pages);
    assert.equal(r.transactions.length, 208);
    assert.equal(r.closingBalance, 14234.77);
  });

  test('Kaspi Gold: 120 строк, остаток, карта, депозит, валюта, переносы', { skip: !has('kaspi-synthetic.pdf') }, async () => {
    const pages = await pdf('kaspi-synthetic.pdf');
    assert.equal(detectBank(pages), 'kaspi');
    const r = parseStatement(pages);
    assert.equal(r.bank, 'kaspi');
    assert.equal(r.transactions.length, 120);
    assert.equal(r.closingBalance, 87412.35);
    assert.equal(r.cardName, 'Kaspi Gold *4242');
    assert.deepEqual(r.period, { from: '2026-10-01', to: '2026-10-31' });
    assert.deepEqual(r.warnings, []); // операции сходятся с «Доступно на …»
    assert.ok(r.transactions.every((t) => t.source === 'kaspi-pdf' && t.accountId === 'kaspi'));
    const own = r.transactions.filter((t) => t.categoryId === 'own');
    assert.equal(own.length, 17);
    assert.ok(own.some((t) => t.merchant === 'На Kaspi Депозит' && t.type === 'expense'));
    assert.ok(own.some((t) => t.merchant === 'С Kaspi Депозита' && t.type === 'income'));
    const apple = r.transactions.find((t) => /APPLE/.test(t.merchant));
    assert.deepEqual(apple.original, { amount: 9.99, currency: 'USD' });
    assert.equal(apple.amount, 4590);
    assert.ok(r.transactions.some((t) => /бытовой техники, г\. Алматы/.test(t.note)));
    assert.equal(r.transactions.filter((t) => t.categoryId === 'cash').length, 8);
  });

  test('Halyk Bank: две даты, приход/расход, валюта, комиссии', { skip: !has('halyk-synthetic.pdf') }, async () => {
    const pages = await pdf('halyk-synthetic.pdf');
    assert.equal(detectBank(pages), 'halyk');
    const r = parseStatement(pages);
    assert.equal(r.transactions.length, 64 + 16);
    assert.equal(r.closingBalance, 152300.4);
    assert.equal(r.cardName, 'Halyk Bank *7788');
    assert.deepEqual(r.warnings, []);
    const netflix = r.transactions.find((t) => /NETFLIX/.test(t.merchant));
    assert.deepEqual(netflix.original, { amount: 9.99, currency: 'USD' });
    assert.equal(netflix.amount, 4585.41);
    assert.equal(netflix.categoryId, 'subscriptions');
    assert.equal(r.transactions.filter((t) => t.categoryId === 'fees').length, 16);
    assert.equal(r.transactions.filter((t) => t.categoryId === 'salary').length, 8);
  });

  test('Emirates NBD (универсальный): AED → ₸, без Opening Balance и колонтитулов', { skip: !has('enbd-synthetic.pdf') }, async () => {
    const pages = await pdf('enbd-synthetic.pdf');
    assert.equal(detectBank(pages), 'universal');
    const r = parseStatement(pages);
    assert.equal(r.transactions.length, 58);
    assert.equal(r.cardName, 'Emirates NBD *9876');
    assert.equal(r.accountCurrency, 'AED');
    assert.equal(r.closingBalance, Math.round(12345.67 * 125 * 100) / 100);
    assert.deepEqual(r.conversions, [{ currency: 'AED', rate: 125, source: 'reference', count: 58 }]);
    assert.ok(!r.transactions.some((t) => /Opening|Closing|Page \d|computer generated/i.test(t.note)));
    assert.ok(r.transactions.some((t) => /MALL OF THE EMIRATES/.test(t.note))); // перенос описания
    assert.ok(r.transactions.every((t) => /ориентировочный курс/.test(t.note)));
  });

  test('скан без текста — сообщение про скан', { skip: !has('scanned-synthetic.pdf') }, async () => {
    const pages = await pdf('scanned-synthetic.pdf');
    assert.throws(
      () => parseStatement(pages),
      (e) => e.message === SCANNED_PDF_MESSAGE,
    );
  });
});
