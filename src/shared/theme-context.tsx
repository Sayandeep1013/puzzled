import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { type ReactNode } from 'react';

import { getSettingsRepository } from '@/data';

import { DEFAULT_THEME_ID, MEADOW, themeById, type Theme, type ThemeId } from './themes';

/**
 * The active theme, and the only way to change it.
 *
 * Every screen reads its palette from here rather than importing `colors`
 * straight from `tokens.ts`. That import is a *build-time* binding: a
 * module-level `StyleSheet.create` captures the hex it saw when the file was
 * first evaluated, which is why the app had exactly one theme however many
 * palettes were declared. Nothing short of routing colours through React fixes
 * that — remounting does not re-run module initialisation.
 */

interface ThemeContextValue {
  theme: Theme;
  /** Persisted, and applied immediately. */
  setThemeId: (id: ThemeId) => void;
  /** False until the stored choice has been read; used to hold the first paint. */
  ready: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: MEADOW,
  setThemeId: () => {},
  ready: true,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<ThemeId>(DEFAULT_THEME_ID);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const settings = await (await getSettingsRepository()).get();
        // `themeById` falls back rather than throwing, so a row written by a
        // build that shipped a theme this one does not know about is survivable.
        if (active) setId(themeById(settings.themeId).id);
      } catch {
        // Unreadable settings mean the default theme, not a broken app.
      }
      if (active) setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const setThemeId = useCallback((next: ThemeId) => {
    setId(next);
    void (async () => {
      try {
        await (await getSettingsRepository()).set({ themeId: next });
      } catch {
        // Best-effort persistence; the live switch already took effect.
      }
    })();
  }, []);

  const value = useMemo(
    () => ({ theme: themeById(id), setThemeId, ready }),
    [id, setThemeId, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme. Screens build their `StyleSheet` from this, not from imports. */
export function useTheme(): Theme {
  return useContext(ThemeContext).theme;
}

/** For the picker, which needs to write as well as read. */
export function useThemeControl(): ThemeContextValue {
  return useContext(ThemeContext);
}
