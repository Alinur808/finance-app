/**
 * Выписка Halyk Bank (Homebank / «Народный банк Казахстана»).
 *
 * Таблица Halyk: Дата проведения | Дата обработки | Описание операции |
 * Сумма операции | Валюта операции | Приход в валюте счёта | Расход в валюте счёта |
 * Комиссия | Карта. Суммы для баланса берём из колонок «Приход/Расход в валюте
 * счёта» (уже в тенге), а «Сумма операции» в другой валюте сохраняем как
 * исходную сумму. Комиссия — отдельной операцией «Комиссия банка».
 * Движок таблиц — общий (universalStatementParser.js); здесь — профиль Halyk.
 */
import { StatementFormatError } from './freedomParser.js';
import { buildStatement, headerLines } from './universalStatementParser.js';

/** Шапка первой страницы упоминает Halyk / Народный банк. */
export function isHalykStatement(pages) {
  if (!pages[0]) return false;
  const head = headerLines(pages[0])
    .map((l) => l.text)
    .join(' ');
  return /Halyk|Народн\S*\s+банк/i.test(head);
}

export function parseHalykStatement(pages) {
  if (!isHalykStatement(pages)) throw new StatementFormatError('Это не похоже на выписку Halyk Bank.');
  return buildStatement(pages, {
    profile: { bankName: 'Halyk Bank', originalFromAmount: true },
    bank: 'halyk',
    source: 'halyk-pdf',
    idPrefix: 'hpdf',
    defaultName: 'Halyk Bank',
  });
}
