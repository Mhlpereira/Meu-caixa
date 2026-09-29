import type { Cents, Competence, ISODate } from './types';
import { addMonths } from '@/utils/date';

export interface Goal {
  id: string;
  profileId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: Cents;
  monthlyContribution: Cents;
  annualRateBp: number;
  initialAmount: Cents;
  targetDate: ISODate | null;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
}

export interface GoalInput {
  profileId: string;
  name: string;
  icon: string;
  color: string;
  targetAmount: Cents;
  monthlyContribution: Cents;
  annualRateBp: number;
  initialAmount: Cents;
  targetDate: ISODate | null;
}

export interface GoalBalance {
  goal: Goal;
  deposited: Cents;
  balance: Cents;
  progress: number | null;
  remaining: Cents;
}

export interface GoalProjectionMonth {
  competence: Competence;
  contributed: Cents;
  yield: Cents;
  balance: Cents;
  reachedTarget: boolean;
}

export const MAX_PROJECTION_MONTHS = 600;

export function monthlyRateFrom(annualRateBp: number): number {
  if (annualRateBp === 0) return 0;
  return Math.pow(1 + annualRateBp / 10_000, 1 / 12) - 1;
}

export function formatRate(annualRateBp: number): string {
  return `${(annualRateBp / 100).toFixed(2).replace('.', ',')}% a.a.`;
}

export function goalBalance(goal: Goal, depositedCents: Cents): GoalBalance {
  const balance = goal.initialAmount + depositedCents;
  const remaining = Math.max(goal.targetAmount - balance, 0);

  return {
    goal,
    deposited: depositedCents,
    balance,
    progress: goal.targetAmount > 0 ? Math.min(balance / goal.targetAmount, 1) : null,
    remaining,
  };
}

export function projectGoal(
  startingBalance: Cents,
  monthlyContribution: Cents,
  annualRateBp: number,
  targetAmount: Cents,
  months: number,
  startCompetence: Competence,
): GoalProjectionMonth[] {
  const rate = monthlyRateFrom(annualRateBp);
  const result: GoalProjectionMonth[] = [];

  let balance = startingBalance;

  for (let index = 0; index < months; index++) {
    const earned = Math.round(balance * rate);
    balance = balance + earned + monthlyContribution;

    result.push({
      competence: addMonths(startCompetence, index),
      contributed: monthlyContribution,
      yield: earned,
      balance,
      reachedTarget: targetAmount > 0 && balance >= targetAmount,
    });
  }

  return result;
}

export function monthsToTarget(
  startingBalance: Cents,
  monthlyContribution: Cents,
  annualRateBp: number,
  targetAmount: Cents,
): number | null {
  if (targetAmount <= 0) return null;
  if (startingBalance >= targetAmount) return 0;

  const rate = monthlyRateFrom(annualRateBp);
  if (monthlyContribution <= 0 && rate <= 0) return null;

  let balance = startingBalance;

  for (let month = 1; month <= MAX_PROJECTION_MONTHS; month++) {
    balance = balance + Math.round(balance * rate) + monthlyContribution;
    if (balance >= targetAmount) return month;
  }

  return null;
}

export function contributionNeededFor(
  startingBalance: Cents,
  annualRateBp: number,
  targetAmount: Cents,
  months: number,
): Cents | null {
  if (targetAmount <= 0 || months <= 0) return null;

  const rate = monthlyRateFrom(annualRateBp);
  const growth = Math.pow(1 + rate, months);
  const futureFromBalance = startingBalance * growth;
  const missing = targetAmount - futureFromBalance;

  if (missing <= 0) return 0;

  const annuityFactor = rate === 0 ? months : (growth - 1) / rate;
  return Math.ceil(missing / annuityFactor);
}

export function totalMonthlyContribution(goals: Goal[]): Cents {
  return goals
    .filter((goal) => !goal.archived)
    .reduce((total, goal) => total + goal.monthlyContribution, 0);
}
