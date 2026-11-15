import { dayKey } from './dates.js';
import { CATEGORIES } from '../data/categories.js';
import { sanitizeGoals, sanitizePlan, sanitizeSettings, sanitizeText, sanitizeTransaction } from './sanitize.js';

const knownCategory = (id) => Object.hasOwn(CATEGORIES, id);
const MAX_IMPORT_BYTES = 25 * 1024 * 1024; // JSON больше 25 МБ — точно не копия этого приложения

const APP_ID = 'tenge-finance';
const VERSION = 1;

/** Собирает резервную копию. Ключ ИИ намеренно не экспортируется. */
export function buildBackup({ transactions, goals, settings, plan }) {
  const { aiApiKey, ...safeSettings } = settings; // eslint-disable-line no-unused-vars
  return { app: APP_ID, version: VERSION, exportedAt: new Date().toISOString(), transactions, goals, settings: safeSettings, plan };
}

/**
 * Сохраняет JSON-файл. На iPhone сначала пробуем системное меню «Поделиться»
 * (там есть «Сохранить в Файлы»), иначе — обычная загрузка.
 */
export async function downloadBackup(state) {
  const json = JSON.stringify(buildBackup(state), null, 2);
  const name = `finance-backup-${dayKey(new Date())}.json`;
  const file = new File([json], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Резервная копия финансов' });
      return 'shared';
    } catch (e) {
      if (e?.name === 'AbortError') return 'cancelled';
      // иначе пробуем обычную загрузку
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

const isTx = (t) =>
  t &&
  typeof t.id === 'string' &&
  (t.type === 'income' || t.type === 'expense') &&
  typeof t.amount === 'number' &&
  Number.isFinite(t.amount) &&
  typeof t.categoryId === 'string' &&
  !Number.isNaN(new Date(t.date).getTime());

/** Операции из выписки: те же правила очистки, что и для JSON (названия продавцов из PDF — внешние данные). */
export function sanitizeStatement(statement) {
  const transactions = statement.transactions.map((t) => sanitizeTransaction(t, { knownCategory })).filter(Boolean);
  return { ...statement, transactions, cardName: sanitizeText(statement.cardName, 40) };
}

const isPdf = async (file) => file.type === 'application/pdf' || /\.pdf$/i.test(file.name) || (await file.slice(0, 5).text()) === '%PDF-';

/**
 * Любой поддерживаемый файл: JSON-копия → { kind: 'backup', … },
 * PDF-выписка любого банка → { kind: 'statement', … } (разбор в браузере, см. statementParser.js).
 */
export async function readImportFile(file) {
  if (await isPdf(file)) {
    const { readStatementPdf } = await import('./pdfImport.js');
    return { kind: 'statement', ...sanitizeStatement(await readStatementPdf(file)) };
  }
  return { kind: 'backup', ...(await readBackup(file)) };
}

/** Читает и проверяет файл. Бросает Error с понятным текстом на русском. */
export async function readBackup(file) {
  let data;
  if (file.size > MAX_IMPORT_BYTES) throw new Error('Файл слишком большой для резервной копии.');
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Файл не похож ни на JSON-копию, ни на PDF-выписку. Выберите файл из «Экспорт данных» или PDF-выписку банка (Kaspi, Freedom, Halyk и др.).');
  }
  if (!Array.isArray(data?.transactions)) throw new Error('В файле нет списка операций.');
  const bad = data.transactions.filter((t) => !isTx(t)).length;
  if (bad) throw new Error(`В файле ${bad} повреждённых операций — импорт отменён.`);
  if (data.goals && !Array.isArray(data.goals)) throw new Error('Раздел целей в файле повреждён.');
  // только известные поля и чистые строки (utils/sanitize.js)
  const transactions = data.transactions.map((t) => sanitizeTransaction(t, { knownCategory }));
  const broken = transactions.filter((t) => !t).length;
  if (broken) throw new Error(`В файле ${broken} повреждённых операций — импорт отменён.`);
  return {
    transactions,
    goals: sanitizeGoals(data.goals),
    settings: sanitizeSettings(data.settings),
    plan: sanitizePlan(data.plan), // старые копии без дневника — оставляем текущий план
    exportedAt: typeof data.exportedAt === 'string' ? data.exportedAt.slice(0, 40) : undefined,
  };
}
