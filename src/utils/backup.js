import { dayKey } from './dates.js';

const APP_ID = 'tenge-finance';
const VERSION = 1;

/** Собирает резервную копию. Ключ ИИ намеренно не экспортируется. */
export function buildBackup({ transactions, goals, settings, plan }) {
  const { aiApiKey, ...safeSettings } = settings;
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

/** Читает и проверяет файл. Бросает Error с понятным текстом на русском. */
export async function readBackup(file) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('Файл не похож на JSON. Выберите файл, сохранённый через «Экспорт данных».');
  }
  if (!Array.isArray(data?.transactions)) throw new Error('В файле нет списка операций.');
  const bad = data.transactions.filter((t) => !isTx(t)).length;
  if (bad) throw new Error(`В файле ${bad} повреждённых операций — импорт отменён.`);
  if (data.goals && !Array.isArray(data.goals)) throw new Error('Раздел целей в файле повреждён.');
  const planOk = data.plan && typeof data.plan.deadline === 'string' && Array.isArray(data.plan.items) && Array.isArray(data.plan.incomes);
  return {
    transactions: data.transactions.map((t) => ({ note: '', accountId: 'kaspi', ...t })),
    goals: data.goals,
    settings: data.settings,
    plan: planOk ? data.plan : undefined, // старые копии без дневника — оставляем текущий план
    exportedAt: data.exportedAt,
  };
}
