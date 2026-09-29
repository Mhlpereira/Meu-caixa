import type { Category, Commitment, Occurrence, OccurrenceView, Profile } from '@/domain/types';

export interface ProfileRow {
  id: string;
  name: string;
  color: string;
  icon: string;
  sort_order: number;
  created_at: string;
  investment_goal: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  icon: string;
  color: string;
  kind: 'expense' | 'income';
  is_system: number;
  sort_order: number;
}

export interface CommitmentRow {
  id: string;
  profile_id: string;
  category_id: string | null;
  kind: 'expense' | 'income';
  type: 'single' | 'installment' | 'recurring';
  description: string;
  amount: number;
  installments: number | null;
  start_date: string;
  end_date: string | null;
  day_of_month: number | null;
  notes: string | null;
  is_investment: number;
  goal_id: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
}

export interface OccurrenceRow {
  id: string;
  commitment_id: string;
  profile_id: string;
  kind: 'expense' | 'income';
  competence: string;
  due_date: string;
  amount: number;
  installment_index: number | null;
  status: 'pending' | 'paid' | 'skipped';
  paid_at: string | null;
  is_overridden: number;
  is_investment: number;
  goal_id: string | null;
}

export interface OccurrenceViewRow extends OccurrenceRow {
  description: string;
  commitment_type: 'single' | 'installment' | 'recurring';
  installments_total: number | null;
  category_id: string | null;
  category_name: string | null;
  category_icon: string | null;
  category_color: string | null;
  profile_name: string;
  profile_color: string;
}

export const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  name: row.name,
  color: row.color,
  icon: row.icon,
  sortOrder: row.sort_order,
  createdAt: row.created_at,
  investmentGoal: row.investment_goal ?? 0,
});

export const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  kind: row.kind,
  isSystem: row.is_system === 1,
  sortOrder: row.sort_order,
});

export const toCommitment = (row: CommitmentRow): Commitment => ({
  id: row.id,
  profileId: row.profile_id,
  categoryId: row.category_id,
  kind: row.kind,
  type: row.type,
  description: row.description,
  amount: row.amount,
  installments: row.installments,
  startDate: row.start_date,
  endDate: row.end_date,
  dayOfMonth: row.day_of_month,
  notes: row.notes,
  isInvestment: row.is_investment === 1,
  goalId: row.goal_id,
  archived: row.archived === 1,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const toOccurrence = (row: OccurrenceRow): Occurrence => ({
  id: row.id,
  commitmentId: row.commitment_id,
  profileId: row.profile_id,
  kind: row.kind,
  competence: row.competence,
  dueDate: row.due_date,
  amount: row.amount,
  installmentIndex: row.installment_index,
  status: row.status,
  paidAt: row.paid_at,
  isOverridden: row.is_overridden === 1,
  isInvestment: row.is_investment === 1,
  goalId: row.goal_id,
});

export const toOccurrenceView = (row: OccurrenceViewRow): OccurrenceView => ({
  ...toOccurrence(row),
  description: row.description,
  commitmentType: row.commitment_type,
  installmentsTotal: row.installments_total,
  categoryId: row.category_id,
  categoryName: row.category_name,
  categoryIcon: row.category_icon,
  categoryColor: row.category_color,
  profileName: row.profile_name,
  profileColor: row.profile_color,
});

export const OCCURRENCE_VIEW_SELECT = `
  SELECT
    o.*,
    c.description        AS description,
    c.type               AS commitment_type,
    c.installments       AS installments_total,
    c.category_id        AS category_id,
    cat.name             AS category_name,
    cat.icon             AS category_icon,
    cat.color            AS category_color,
    p.name               AS profile_name,
    p.color              AS profile_color
  FROM occurrences o
  JOIN commitments c ON c.id = o.commitment_id
  JOIN profiles    p ON p.id = o.profile_id
  LEFT JOIN categories cat ON cat.id = c.category_id
`;
