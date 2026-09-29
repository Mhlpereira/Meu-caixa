import { useEffect, useMemo, useState } from 'react';

import { groupByDueDate, summarizeMonth, totalsByCategory } from '@/domain/calc';
import { totalMonthlyContribution } from '@/domain/goals';
import type { MonthSummary, OccurrenceView } from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import { listMonth } from '@/repositories/occurrences';
import { useAppStore } from '@/stores/app';

export type MonthFilter = 'all' | 'pending' | 'paid';

export function useMonth(filter: MonthFilter = 'all') {
  const competence = useAppStore((state) => state.competence);
  const scope = useAppStore((state) => state.scope);
  const revision = useAppStore((state) => state.revision);
  const profiles = useAppStore((state) => state.profiles);
  const goals = useAppStore((state) => state.goals);

  const [occurrences, setOccurrences] = useState<OccurrenceView[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listMonth(competence, scope).then((rows) => {
      if (!active) return;
      setOccurrences(rows);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [competence, scope, revision]);

  const investmentGoal = useMemo(() => {
    const scopedGoals =
      scope === ALL_PROFILES ? goals : goals.filter((goal) => goal.profileId === scope);

    const fromGoals = totalMonthlyContribution(scopedGoals);
    if (fromGoals > 0) return fromGoals;

    return scope === ALL_PROFILES
      ? profiles.reduce((total, profile) => total + profile.investmentGoal, 0)
      : (profiles.find((profile) => profile.id === scope)?.investmentGoal ?? 0);
  }, [goals, profiles, scope]);

  const summary: MonthSummary = useMemo(
    () => summarizeMonth(competence, occurrences, investmentGoal),
    [competence, occurrences, investmentGoal],
  );

  const filtered = useMemo(() => {
    if (filter === 'pending') return occurrences.filter((item) => item.status === 'pending');
    if (filter === 'paid') return occurrences.filter((item) => item.status === 'paid');
    return occurrences;
  }, [occurrences, filter]);

  const groups = useMemo(() => groupByDueDate(filtered), [filtered]);

  const expenseByCategory = useMemo(
    () => totalsByCategory(occurrences.filter((item) => item.kind === 'expense')),
    [occurrences],
  );

  return { occurrences, filtered, groups, summary, expenseByCategory, loading };
}
