import type { Commitment, Occurrence } from './types';
import {
  addMonths,
  competenceOf,
  currentCompetence,
  dueDateIn,
  minCompetence,
  monthsBetween,
  parseISODate,
  type Competence,
} from '@/utils/date';
import { createId } from '@/utils/id';

export const DEFAULT_HORIZON_MONTHS = 36;

export type PlannedOccurrence = Omit<Occurrence, 'id'>;

export interface MaterializeOptions {
  horizon?: Competence;
}

export function materialize(
  commitment: Commitment,
  options: MaterializeOptions = {},
): PlannedOccurrence[] {
  switch (commitment.type) {
    case 'single':
      return materializeSingle(commitment);
    case 'installment':
      return materializeInstallment(commitment);
    case 'recurring':
      return materializeRecurring(commitment, options);
  }
}

function sharedFields(commitment: Commitment) {
  return {
    commitmentId: commitment.id,
    profileId: commitment.profileId,
    kind: commitment.kind,
    amount: commitment.amount,
    isInvestment: commitment.isInvestment,
    goalId: commitment.goalId,
    status: 'pending' as const,
    paidAt: null,
    isOverridden: false,
  };
}

function materializeSingle(commitment: Commitment): PlannedOccurrence[] {
  return [
    {
      ...sharedFields(commitment),
      competence: competenceOf(commitment.startDate),
      dueDate: commitment.startDate,
      installmentIndex: null,
    },
  ];
}

function materializeInstallment(commitment: Commitment): PlannedOccurrence[] {
  const count = commitment.installments ?? 1;
  const first = competenceOf(commitment.startDate);
  const { day } = parseISODate(commitment.startDate);

  return Array.from({ length: count }, (_, index) => {
    const competence = addMonths(first, index);
    return {
      ...sharedFields(commitment),
      competence,
      dueDate: dueDateIn(competence, day),
      installmentIndex: index + 1,
    };
  });
}

function materializeRecurring(
  commitment: Commitment,
  options: MaterializeOptions,
): PlannedOccurrence[] {
  const first = competenceOf(commitment.startDate);
  const day = commitment.dayOfMonth ?? parseISODate(commitment.startDate).day;

  const horizon = options.horizon ?? addMonths(currentCompetence(), DEFAULT_HORIZON_MONTHS);
  const last = commitment.endDate
    ? minCompetence(competenceOf(commitment.endDate), horizon)
    : horizon;

  const span = monthsBetween(first, last);
  if (span < 0) return [];

  return Array.from({ length: span + 1 }, (_, index) => {
    const competence = addMonths(first, index);
    return {
      ...sharedFields(commitment),
      competence,
      dueDate: dueDateIn(competence, day),
      installmentIndex: null,
    };
  });
}

export interface ReconcileResult {
  toInsert: PlannedOccurrence[];
  toUpdate: Array<{ id: string; dueDate: string; amount: number }>;
  toDeleteIds: string[];
}

export function reconcile(
  commitment: Commitment,
  existing: Occurrence[],
  options: MaterializeOptions & { from?: Competence } = {},
): ReconcileResult {
  const from = options.from ?? currentCompetence();
  const planned = materialize(commitment, options);
  const plannedByCompetence = new Map(planned.map((plan) => [plan.competence, plan]));

  const toInsert: PlannedOccurrence[] = [];
  const toUpdate: ReconcileResult['toUpdate'] = [];
  const toDeleteIds: string[] = [];
  const kept = new Set<string>();

  for (const occurrence of existing) {
    const isProtected = occurrence.status === 'paid' || occurrence.competence < from;

    if (isProtected) {
      kept.add(occurrence.competence);
      continue;
    }

    const plan = plannedByCompetence.get(occurrence.competence);

    if (!plan) {
      toDeleteIds.push(occurrence.id);
      continue;
    }

    kept.add(occurrence.competence);
    toUpdate.push({
      id: occurrence.id,
      dueDate: plan.dueDate,
      amount: occurrence.isOverridden ? occurrence.amount : plan.amount,
    });
  }

  for (const plan of planned) {
    if (!kept.has(plan.competence)) toInsert.push(plan);
  }

  return { toInsert, toUpdate, toDeleteIds };
}

export function withIds(planned: PlannedOccurrence[]): Occurrence[] {
  return planned.map((plan) => ({ ...plan, id: createId() }));
}
