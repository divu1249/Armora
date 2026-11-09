import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyTheme, initialTheme, THEME_STORAGE_KEY, ThemeName } from '../brand.ts';

interface ThemeCtx {
  theme: ThemeName;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
}

const Ctx = createContext<ThemeCtx>({ theme: 'dark', setTheme: () => undefined, toggle: () => undefined });
export const useTheme = () => useContext(Ctx);

export const ThemeProvider: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);
  const value = useMemo(() => ({ theme, setTheme, toggle }), [theme, setTheme, toggle]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
