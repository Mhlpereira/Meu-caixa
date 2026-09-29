import type {
  Cents,
  Commitment,
  Competence,
  MonthSummary,
  Occurrence,
  OccurrenceView,
  ProjectionMonth,
} from './types';
import { addMonths } from '@/utils/date';

const sum = (values: Cents[]): Cents => values.reduce((acc, value) => acc + value, 0);

const isCounted = (occurrence: Pick<Occurrence, 'status'>) => occurrence.status !== 'skipped';

const isCommitted = (occurrence: OccurrenceView) =>
  occurrence.commitmentType === 'installment' || occurrence.commitmentType === 'recurring';

export function summarizeMonth(
  competence: Competence,
  occurrences: OccurrenceView[],
  investmentGoal: Cents = 0,
): MonthSummary {
  const counted = occurrences.filter(isCounted);
  const income = counted.filter((occurrence) => occurrence.kind === 'income');
  const outflow = counted.filter((occurrence) => occurrence.kind === 'expense');
  const expense = outflow.filter((occurrence) => !occurrence.isInvestment);
  const investment = outflow.filter((occurrence) => occurrence.isInvestment);
  const paid = (list: OccurrenceView[]) => list.filter((item) => item.status === 'paid');

  const incomePlanned = sum(income.map((item) => item.amount));
  const expensePlanned = sum(expense.map((item) => item.amount));
  const incomeActual = sum(paid(income).map((item) => item.amount));
  const expenseActual = sum(paid(expense).map((item) => item.amount));
  const committed = sum(outflow.filter(isCommitted).map((item) => item.amount));

  const investmentPlanned = sum(investment.map((item) => item.amount));
  const investmentActual = sum(paid(investment).map((item) => item.amount));
  const balancePlanned = incomePlanned - expensePlanned;

  return {
    competence,
    incomePlanned,
    expensePlanned,
    balancePlanned,
    incomeActual,
    expenseActual,
    balanceActual: incomeActual - expenseActual,
    committed,
    free: incomePlanned - committed,
    toPay: expensePlanned - expenseActual,
    toReceive: incomePlanned - incomeActual,
    investmentPlanned,
    investmentActual,
    investmentGoal,
    investmentGap: investmentGoal - investmentActual,
    leftAfterInvesting: balancePlanned - investmentActual,
  };
}

export function investmentProgress(summary: MonthSummary): number | null {
  if (summary.investmentGoal <= 0) return null;
  return Math.min(summary.investmentActual / summary.investmentGoal, 1);
}

export function canAffordGoal(summary: MonthSummary): boolean {
  return summary.balancePlanned >= summary.investmentGoal;
}

export function spentRatio(summary: MonthSummary): number {
  if (summary.incomePlanned <= 0) return summary.expensePlanned > 0 ? 1 : 0;
  return Math.min(summary.expensePlanned / summary.incomePlanned, 1);
}

export function savingsRate(summary: MonthSummary): number | null {
  if (summary.incomePlanned <= 0) return null;
  return summary.balancePlanned / summary.incomePlanned;
}

export interface MonthTotalsRow {
  competence: Competence;
  income: Cents;
  expense: Cents;
}

export function buildProjection(
  start: Competence,
  months: number,
  totals: MonthTotalsRow[],
): ProjectionMonth[] {
  const byCompetence = new Map(totals.map((row) => [row.competence, row]));
  const result: ProjectionMonth[] = [];
  let accumulated = 0;

  for (let index = 0; index < months; index++) {
    const competence = addMonths(start, index);
    const row = byCompetence.get(competence);
    const income = row?.income ?? 0;
    const expense = row?.expense ?? 0;
    const balance = income - expense;
    accumulated += balance;
    result.push({ competence, income, expense, balance, accumulated });
  }

  return result;
}

export function summarizeInstallments(
  commitment: Commitment,
  occurrences: Occurrence[],
): {
  paidCount: number;
  totalCount: number;
  remainingAmount: Cents;
  totalAmount: Cents;
  lastCompetence: Competence;
} {
  const ordered = [...occurrences].sort((a, b) => (a.competence < b.competence ? -1 : 1));
  const paid = ordered.filter((occurrence) => occurrence.status === 'paid');
  const pending = ordered.filter((occurrence) => occurrence.status === 'pending');

  return {
    paidCount: paid.length,
    totalCount: ordered.length,
    remainingAmount: sum(pending.map((occurrence) => occurrence.amount)),
    totalAmount: sum(ordered.map((occurrence) => occurrence.amount)),
    lastCompetence: ordered[ordered.length - 1]?.competence ?? commitment.startDate.slice(0, 7),
  };
}

export interface DayGroup {
  dueDate: string;
  items: OccurrenceView[];
}

export function groupByDueDate(occurrences: OccurrenceView[]): DayGroup[] {
  const groups = new Map<string, OccurrenceView[]>();

  for (const occurrence of occurrences) {
    const existing = groups.get(occurrence.dueDate);
    if (existing) existing.push(occurrence);
    else groups.set(occurrence.dueDate, [occurrence]);
  }

  return [...groups.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([dueDate, items]) => ({ dueDate, items }));
}

export interface CategoryTotal {
  categoryId: string | null;
  name: string;
  color: string;
  total: Cents;
}

export function totalsByCategory(occurrences: OccurrenceView[]): CategoryTotal[] {
  const groups = new Map<string, { name: string; color: string; total: Cents }>();

  for (const occurrence of occurrences.filter(isCounted)) {
    const key = occurrence.categoryId ?? 'none';
    const existing = groups.get(key);
    if (existing) {
      existing.total += occurrence.amount;
    } else {
      groups.set(key, {
        name: occurrence.categoryName ?? 'Sem categoria',
        color: occurrence.categoryColor ?? '#8A9AAD',
        total: occurrence.amount,
      });
    }
  }

  return [...groups.entries()]
    .map(([categoryId, group]) => ({
      categoryId: categoryId === 'none' ? null : categoryId,
      ...group,
    }))
    .sort((a, b) => b.total - a.total);
}
