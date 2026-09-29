import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useMemo } from 'react';

import { useThemeStore } from '@/stores/theme';

import { THEMES, type Theme, type ThemeColors, type ThemeName } from './themes';

export { THEMES, THEME_ORDER, DEFAULT_THEME, isThemeName } from './themes';
export type { Theme, ThemeColors, ThemeName } from './themes';

export const palette = [
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
  '#F97316',
  '#D97706',
  '#65A30D',
  '#059669',
  '#0D9488',
  '#0891B2',
  '#2563EB',
  '#64748B',
] as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const typography = {
  display: { fontSize: 40, fontWeight: '700' as const, letterSpacing: -1 },
  title: { fontSize: 24, fontWeight: '700' as const, letterSpacing: -0.4 },
  heading: { fontSize: 18, fontWeight: '600' as const, letterSpacing: -0.2 },
  body: { fontSize: 15, fontWeight: '500' as const },
  label: { fontSize: 13, fontWeight: '600' as const },
  caption: { fontSize: 12, fontWeight: '500' as const },
  micro: { fontSize: 11, fontWeight: '600' as const, letterSpacing: 0.4 },
} as const;

export function useTheme(): Theme {
  const name = useThemeStore((state) => state.name);
  return THEMES[name];
}

export function useColors(): ThemeColors {
  return useTheme().colors;
}

export function useShadows() {
  const theme = useTheme();

  return useMemo(
    () => ({
      card: {
        shadowColor: '#000',
        shadowOpacity: theme.shadowOpacity,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
        elevation: 4,
      },
      floating: {
        shadowColor: '#000',
        shadowOpacity: theme.shadowOpacity + 0.1,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 8,
      },
    }),
    [theme],
  );
}

type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

export function makeStyles<T extends NamedStyles<T>>(factory: (colors: ThemeColors) => T) {
  const cache = new Map<ThemeName, T>();

  return function useStyles(): T {
    const name = useThemeStore((state) => state.name);

    let cached = cache.get(name);
    if (!cached) {
      cached = StyleSheet.create(factory(THEMES[name].colors));
      cache.set(name, cached);
    }

    return cached;
  };
}

export function useTint(): (color: string) => string {
  const theme = useTheme();

  return useMemo(
    () => (color: string) => `${color}${theme.dark ? '22' : '1F'}`,
    [theme],
  );
}

export function balanceColor(cents: number, colors: ThemeColors): string {
  if (cents > 0) return colors.positive;
  if (cents < 0) return colors.negative;
  return colors.textMuted;
}

export function kindColor(kind: 'income' | 'expense', colors: ThemeColors): string {
  return kind === 'income' ? colors.positive : colors.negative;
}
