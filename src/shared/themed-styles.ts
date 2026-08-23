import { useTheme } from './theme-context';
import { THEMES, type Theme, type ThemeId } from './themes';

/**
 * Turns a stylesheet that depends on the palette into a hook.
 *
 * Screens declare their styles exactly as before — one `StyleSheet.create` at
 * module scope — but as a function of the theme:
 *
 * ```ts
 * const useStyles = createThemedStyles((theme) =>
 *   StyleSheet.create({ root: { backgroundColor: theme.colors.paper } }),
 * );
 * ```
 *
 * Two things this buys over calling `StyleSheet.create` inside the component.
 *
 * First, **cost**. A themed stylesheet built in the component body is rebuilt
 * per instance, and half the styles in this app belong to list rows — a
 * twenty-row Library would build twenty copies of the same sheet on every
 * render. Here every theme's sheet is built once, at import, and handed out by
 * reference.
 *
 * Second, **purity**. Building eagerly for all themes rather than caching on
 * first use means the hook only ever reads: no module-level map is mutated
 * during render, which is what React Compiler objects to and is a real hazard
 * under concurrent rendering.
 *
 * Eager is affordable precisely because themes are bundled and few — see
 * `themes.ts`. If that ever stops being true, this becomes a cache keyed on
 * `theme.id` and the comment above stops being accurate.
 */
export function createThemedStyles<T>(factory: (theme: Theme) => T): () => T {
  const byTheme = new Map<ThemeId, T>(THEMES.map((theme) => [theme.id, factory(theme)]));

  return function useStyles(): T {
    const theme = useTheme();
    // Every theme in `THEMES` was built above, and `useTheme` can only return
    // one of them, so this is total — the fallback is for an id that somehow
    // escaped the registry rather than a case worth handling.
    return byTheme.get(theme.id) ?? factory(theme);
  };
}
