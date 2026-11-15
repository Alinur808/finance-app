import { readJSON, writeJSON } from './storage.js';
import { dayKey } from './dates.js';

/**
 * Счётчик голосовых фраз за день (лимит Standard — STANDARD_LIMITS.voicePerDay).
 * Хранится отдельно от данных: tenge-finance.voice-usage = { day, count }.
 */
const KEY = 'tenge-finance.voice-usage';

export function voiceUsedToday(now = new Date()) {
  const saved = readJSON(KEY, null);
  return saved?.day === dayKey(now) ? Number(saved.count) || 0 : 0;
}

export function countVoiceUse(now = new Date()) {
  const count = voiceUsedToday(now) + 1;
  writeJSON(KEY, { day: dayKey(now), count });
  return count;
}
