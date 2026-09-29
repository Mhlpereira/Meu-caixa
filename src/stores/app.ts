import { create } from 'zustand';

import type { Goal } from '@/domain/goals';
import type { Category, Profile, Scope } from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import { listCategories } from '@/repositories/categories';
import { extendRecurringHorizon } from '@/repositories/commitments';
import { listGoals } from '@/repositories/goals';
import { listProfiles } from '@/repositories/profiles';
import { getSetting, setSetting } from '@/repositories/settings';
import { runAutoBackup } from '@/services/autoBackup';
import { currentCompetence, type Competence } from '@/utils/date';

interface AppState {
  ready: boolean;
  profiles: Profile[];
  categories: Category[];
  goals: Goal[];
  scope: Scope;
  competence: Competence;
  revision: number;
  onboardingDone: boolean;

  bootstrap: () => Promise<void>;
  refreshProfiles: () => Promise<void>;
  refreshCategories: () => Promise<void>;
  refreshGoals: () => Promise<void>;
  setScope: (scope: Scope) => Promise<void>;
  setCompetence: (competence: Competence) => void;
  bumpRevision: () => void;
  setOnboardingDone: (done: boolean) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  profiles: [],
  categories: [],
  goals: [],
  scope: ALL_PROFILES,
  competence: currentCompetence(),
  revision: 0,
  onboardingDone: false,

  bootstrap: async () => {
    const [profiles, categories, goals, storedScope, onboarding] = await Promise.all([
      listProfiles(),
      listCategories(),
      listGoals(ALL_PROFILES),
      getSetting('active_profile_id'),
      getSetting('onboarding_done'),
    ]);

    await extendRecurringHorizon();

    const scopeIsValid =
      storedScope === ALL_PROFILES ||
      (storedScope !== null && profiles.some((profile) => profile.id === storedScope));

    set({
      ready: true,
      profiles,
      categories,
      goals,
      scope: scopeIsValid && storedScope ? storedScope : (profiles[0]?.id ?? ALL_PROFILES),
      onboardingDone: onboarding === '1',
      revision: get().revision + 1,
    });

    runAutoBackup();
  },

  refreshProfiles: async () => {
    const profiles = await listProfiles();
    const { scope } = get();
    const stillExists = scope === ALL_PROFILES || profiles.some((p) => p.id === scope);
    set({
      profiles,
      scope: stillExists ? scope : (profiles[0]?.id ?? ALL_PROFILES),
    });
  },

  refreshCategories: async () => {
    set({ categories: await listCategories() });
  },

  refreshGoals: async () => {
    set({ goals: await listGoals(ALL_PROFILES) });
  },

  setScope: async (scope) => {
    set({ scope });
    await setSetting('active_profile_id', scope);
  },

  setCompetence: (competence) => set({ competence }),

  bumpRevision: () => set((state) => ({ revision: state.revision + 1 })),

  setOnboardingDone: async (done) => {
    set({ onboardingDone: done });
    await setSetting('onboarding_done', done ? '1' : '0');
  },
}));

export function useActiveProfile(): Profile | null {
  return useAppStore((state) =>
    state.scope === ALL_PROFILES
      ? null
      : (state.profiles.find((profile) => profile.id === state.scope) ?? null),
  );
}

export function useIsAllScope(): boolean {
  return useAppStore((state) => state.scope === ALL_PROFILES);
}
