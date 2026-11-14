import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readJSON, writeJSON } from '../utils/storage.js';

/**
 * Тема: Obsidian (тёмная, по умолчанию) или Alabaster (дневная).
 * Хранится отдельно от данных (ключ tenge-finance.theme): это настройка
 * устройства, она не попадает в резервную копию. Скрипт в index.html читает
 * тот же ключ до загрузки React, чтобы не было вспышки другой темы.
 */
export const THEME_KEY = 'tenge-finance.theme';
export const THEMES = {
  obsidian: { id: 'obsidian', label: 'Obsidian', hint: 'Тёмная · OLED', meta: '#050507' },
  alabaster: { id: 'alabaster', label: 'Alabaster', hint: 'Дневная', meta: '#f5f4f0' },
};

const ThemeContext = createContext({ theme: 'obsidian', setTheme: () => {} });

const readTheme = () => {
  const saved = readJSON(THEME_KEY, 'obsidian');
  return THEMES[saved] ? saved : 'obsidian';
};

export function applyTheme(theme) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEMES[theme].meta);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readTheme);
  useEffect(() => applyTheme(theme), [theme]);
  const setTheme = useCallback((next) => {
    if (!THEMES[next]) return;
    writeJSON(THEME_KEY, next);
    setThemeState(next);
  }, []);
  const value = useMemo(() => ({ theme, setTheme }), [theme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
