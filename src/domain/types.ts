import type { Cents } from '@/utils/money';
import type { Competence, ISODate } from '@/utils/date';

export type { Cents, Competence, ISODate };

export type Kind = 'expense' | 'income';
export type CommitmentType = 'single' | 'installment' | 'recurring';
export type OccurrenceStatus = 'pending' | 'paid' | 'skipped';

export const ALL_PROFILES = 'ALL';
export type Scope = string;

export interface Profile {
  id: string;
  name: string;
  color: string;
  icon: string;
  sortOrder: number;
  createdAt: string;
  investmentGoal: Cents;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: Kind;
  isSystem: boolean;
  sortOrder: number;
}

export interface Commitment {
  id: string;
  profileId: string;
  categoryId: string | null;
  kind: Kind;
  type: CommitmentType;
  description: string;
  amount: Cents;
  installments: number | null;
  startDate: ISODate;
  endDate: ISODate | null;
  dayOfMonth: number | null;
  notes: string | null;
  isInvestment: boolean;
  goalId: string | null;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Occurrence {
  id: string;
  commitmentId: string;
  profileId: string;
  kind: Kind;
  competence: Competence;
  dueDate: ISODate;
  amount: Cents;
  installmentIndex: number | null;
  status: OccurrenceStatus;
  paidAt: string | null;
  isOverridden: boolean;
  isInvestment: boolean;
  goalId: string | null;
}

export interface OccurrenceView extends Occurrence {
  description: string;
  commitmentType: CommitmentType;
  installmentsTotal: number | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  profileName: string;
  profileColor: string;
}

export interface MonthSummary {
  competence: Competence;
  incomePlanned: Cents;
  expensePlanned: Cents;
  balancePlanned: Cents;
  incomeActual: Cents;
  expenseActual: Cents;
  balanceActual: Cents;
  committed: Cents;
  free: Cents;
  toPay: Cents;
  toReceive: Cents;
  investmentPlanned: Cents;
  investmentActual: Cents;
  investmentGoal: Cents;
  investmentGap: Cents;
  leftAfterInvesting: Cents;
}

export interface ProjectionMonth {
  competence: Competence;
  income: Cents;
  expense: Cents;
  balance: Cents;
  accumulated: Cents;
}

export interface InstallmentPlan {
  commitment: Commitment;
  paidCount: number;
  totalCount: number;
  remainingAmount: Cents;
  totalAmount: Cents;
  lastCompetence: Competence;
  categoryIcon: string | null;
  categoryColor: string | null;
  profileName: string;
  profileColor: string;
}

export interface RecurringPlan {
  commitment: Commitment;
  categoryIcon: string | null;
  categoryColor: string | null;
  profileName: string;
  profileColor: string;
}

export interface CommitmentInput {
  profileId: string;
  categoryId: string | null;
  kind: Kind;
  type: CommitmentType;
  description: string;
  amount: Cents;
  installments: number | null;
  startDate: ISODate;
  endDate: ISODate | null;
  dayOfMonth: number | null;
  notes: string | null;
  isInvestment: boolean;
  goalId: string | null;
}
