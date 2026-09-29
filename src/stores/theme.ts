import { create } from 'zustand';

import { getSetting, setSetting } from '@/repositories/settings';
import { DEFAULT_THEME, isThemeName, type ThemeName } from '@/theme/themes';

interface ThemeState {
  name: ThemeName;
  loaded: boolean;
  load: () => Promise<void>;
  setTheme: (name: ThemeName) => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  name: DEFAULT_THEME,
  loaded: false,

  load: async () => {
    const stored = await getSetting('theme');
    set({ name: isThemeName(stored) ? stored : DEFAULT_THEME, loaded: true });
  },

  setTheme: async (name) => {
    set({ name });
    await setSetting('theme', name);
  },
}));
