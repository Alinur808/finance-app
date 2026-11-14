/**
 * Движок выписок: определяет банк и выбирает разборщик.
 *   1. Точные разборщики: Freedom Bank, Kaspi Gold, Halyk Bank.
 *   2. Универсальный разборщик таблиц — для любого другого банка
 *      (Forte, Jusan, BCC, Revolut, Wise, Emirates NBD, Wio…).
 *   3. Общие классификатор категорий и пересчёт валют.
 * Если точный разборщик не нашёл операций, пробуем универсальный.
 * PDF без текстового слоя (скан, фото) — понятная ошибка.
 */
import { isFreedomStatement, parseFreedomStatement, StatementFormatError } from './freedomParser.js';
import { isHalykStatement, parseHalykStatement } from './halykParser.js';
import { isKaspiStatement, parseKaspiStatement } from './kaspiParser.js';
import { parseUniversalStatement } from './universalStatementParser.js';

export const SCANNED_PDF_MESSAGE =
  'Похоже, это скан или фото выписки: в PDF нет текста, который можно прочитать. Скачайте официальную PDF-выписку прямо в приложении банка (Kaspi, Freedom, Halyk и др.) — такой файл читается сразу.';

const PRECISE = [
  { id: 'freedom', detect: isFreedomStatement, parse: parseFreedomStatement },
  { id: 'kaspi', detect: isKaspiStatement, parse: parseKaspiStatement },
  { id: 'halyk', detect: isHalykStatement, parse: parseHalykStatement },
];

/** Сколько читаемых символов в PDF. */
const textLength = (pages) => pages.reduce((n, p) => n + p.items.reduce((m, i) => m + (i.str ?? '').replace(/\s/g, '').length, 0), 0);

export const isScannedPdf = (pages) => textLength(pages) < 30;

/** 'freedom' | 'kaspi' | 'halyk' | 'universal' */
export function detectBank(pages) {
  return PRECISE.find((p) => p.detect(pages))?.id ?? 'universal';
}

export function parseStatement(pages) {
  if (isScannedPdf(pages)) throw new StatementFormatError(SCANNED_PDF_MESSAGE);
  const precise = PRECISE.find((p) => p.detect(pages));
  if (precise) {
    try {
      return precise.parse(pages);
    } catch (error) {
      if (error?.name !== 'StatementFormatError') throw error;
      // шапка узнана, но раскладка другая (новая версия выписки) — пробуем универсальный разбор
      try {
        return { ...parseUniversalStatement(pages), bank: precise.id };
      } catch {
        throw error;
      }
    }
  }
  return parseUniversalStatement(pages);
}
