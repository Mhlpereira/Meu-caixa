import { useEffect, useMemo, useState } from 'react';

import {
  projectGoal,
  totalMonthlyContribution,
  type GoalBalance,
  type GoalProjectionMonth,
} from '@/domain/goals';
import type { Cents, Competence } from '@/domain/types';
import { listGoalBalances } from '@/repositories/goals';
import { useAppStore } from '@/stores/app';
import { currentCompetence } from '@/utils/date';

export interface WealthMonth {
  competence: Competence;
  contributed: Cents;
  yield: Cents;
  invested: Cents;
  freeCash: Cents;
  total: Cents;
}

export interface WealthProjection {
  months: WealthMonth[];
  balances: GoalBalance[];
  startingInvested: Cents;
  monthlyContribution: Cents;
  totalContributed: Cents;
  totalYield: Cents;
  finalInvested: Cents;
  finalFreeCash: Cents;
  loading: boolean;
}

export function useGoalProjection(
  months: number,
  monthlyBalances: Cents[],
): WealthProjection {
  const scope = useAppStore((state) => state.scope);
  const revision = useAppStore((state) => state.revision);

  const [balances, setBalances] = useState<GoalBalance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);

    listGoalBalances(scope).then((rows) => {
      if (!active) return;
      setBalances(rows);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [scope, revision]);

  return useMemo(() => {
    const goals = balances.map((item) => item.goal);
    const startingInvested = balances.reduce((total, item) => total + item.balance, 0);
    const monthlyContribution = totalMonthlyContribution(goals);
    const start = currentCompetence();

    const perGoal: GoalProjectionMonth[][] = balances.map((item) =>
      projectGoal(
        item.balance,
        item.goal.monthlyContribution,
        item.goal.annualRateBp,
        item.goal.targetAmount,
        months,
        start,
      ),
    );

    let freeCash = 0;
    const result: WealthMonth[] = [];

    for (let index = 0; index < months; index++) {
      const invested = perGoal.reduce((total, series) => total + (series[index]?.balance ?? 0), 0);
      const contributed = perGoal.reduce(
        (total, series) => total + (series[index]?.contributed ?? 0),
        0,
      );
      const earned = perGoal.reduce((total, series) => total + (series[index]?.yield ?? 0), 0);

      freeCash += (monthlyBalances[index] ?? 0) - contributed;

      result.push({
        competence: perGoal[0]?.[index]?.competence ?? start,
        contributed,
        yield: earned,
        invested,
        freeCash,
        total: invested + freeCash,
      });
    }

    const last = result[result.length - 1];

    return {
      months: result,
      balances,
      startingInvested,
      monthlyContribution,
      totalContributed: result.reduce((total, month) => total + month.contributed, 0),
      totalYield: result.reduce((total, month) => total + month.yield, 0),
      finalInvested: last?.invested ?? startingInvested,
      finalFreeCash: last?.freeCash ?? 0,
      loading,
    };
  }, [balances, months, monthlyBalances, loading]);
}
