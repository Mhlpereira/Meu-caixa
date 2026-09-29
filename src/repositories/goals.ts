import { getDb } from '@/db/client';
import { goalBalance, type Goal, type GoalBalance, type GoalInput } from '@/domain/goals';
import type { Cents, Scope } from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import { createId } from '@/utils/id';

export interface GoalRow {
  id: string;
  profile_id: string;
  name: string;
  icon: string;
  color: string;
  target_amount: number;
  monthly_contribution: number;
  annual_rate_bp: number;
  initial_amount: number;
  target_date: string | null;
  sort_order: number;
  archived: number;
  created_at: string;
}

const toGoal = (row: GoalRow): Goal => ({
  id: row.id,
  profileId: row.profile_id,
  name: row.name,
  icon: row.icon,
  color: row.color,
  targetAmount: row.target_amount,
  monthlyContribution: row.monthly_contribution,
  annualRateBp: row.annual_rate_bp,
  initialAmount: row.initial_amount,
  targetDate: row.target_date,
  sortOrder: row.sort_order,
  archived: row.archived === 1,
  createdAt: row.created_at,
});

function scopeFilter(scope: Scope): { clause: string; params: string[] } {
  return scope === ALL_PROFILES
    ? { clause: '', params: [] }
    : { clause: 'AND g.profile_id = ?', params: [scope] };
}

export async function listGoals(scope: Scope, includeArchived = false): Promise<Goal[]> {
  const db = await getDb();
  const { clause, params } = scopeFilter(scope);
  const archivedClause = includeArchived ? '' : 'AND g.archived = 0';

  const rows = await db.getAllAsync<GoalRow>(
    `SELECT g.* FROM goals g WHERE 1 = 1 ${archivedClause} ${clause}
     ORDER BY g.sort_order ASC, g.created_at ASC`,
    params,
  );

  return rows.map(toGoal);
}

export async function getGoal(id: string): Promise<Goal | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<GoalRow>('SELECT * FROM goals WHERE id = ?', [id]);
  return row ? toGoal(row) : null;
}

export async function depositedInto(goalId: string): Promise<Cents> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(amount), 0) AS total FROM occurrences
     WHERE goal_id = ? AND status = 'paid'`,
    [goalId],
  );
  return row?.total ?? 0;
}

export async function listGoalBalances(scope: Scope): Promise<GoalBalance[]> {
  const db = await getDb();
  const goals = await listGoals(scope);

  if (goals.length === 0) return [];

  const rows = await db.getAllAsync<{ goal_id: string; total: number }>(
    `SELECT goal_id, COALESCE(SUM(amount), 0) AS total FROM occurrences
     WHERE goal_id IS NOT NULL AND status = 'paid'
     GROUP BY goal_id`,
  );

  const deposits = new Map(rows.map((row) => [row.goal_id, row.total]));

  return goals.map((goal) => goalBalance(goal, deposits.get(goal.id) ?? 0));
}

export async function createGoal(input: GoalInput): Promise<Goal> {
  const db = await getDb();
  const id = createId();
  const createdAt = new Date().toISOString();

  const row = await db.getFirstAsync<{ next: number }>(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next FROM goals WHERE profile_id = ?',
    [input.profileId],
  );
  const sortOrder = row?.next ?? 0;

  await db.runAsync(
    `INSERT INTO goals
       (id, profile_id, name, icon, color, target_amount, monthly_contribution,
        annual_rate_bp, initial_amount, target_date, sort_order, archived, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
    [
      id,
      input.profileId,
      input.name.trim(),
      input.icon,
      input.color,
      input.targetAmount,
      input.monthlyContribution,
      input.annualRateBp,
      input.initialAmount,
      input.targetDate,
      sortOrder,
      createdAt,
    ],
  );

  return {
    ...input,
    id,
    name: input.name.trim(),
    sortOrder,
    archived: false,
    createdAt,
  };
}

export async function updateGoal(id: string, input: GoalInput): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `UPDATE goals SET
       profile_id = ?, name = ?, icon = ?, color = ?, target_amount = ?,
       monthly_contribution = ?, annual_rate_bp = ?, initial_amount = ?, target_date = ?
     WHERE id = ?`,
    [
      input.profileId,
      input.name.trim(),
      input.icon,
      input.color,
      input.targetAmount,
      input.monthlyContribution,
      input.annualRateBp,
      input.initialAmount,
      input.targetDate,
      id,
    ],
  );
}

export async function archiveGoal(id: string, archived: boolean): Promise<void> {
  const db = await getDb();
  await db.runAsync('UPDATE goals SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
}

export async function deleteGoal(id: string): Promise<void> {
  const db = await getDb();
  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE occurrences SET goal_id = NULL WHERE goal_id = ?', [id]);
    await db.runAsync('UPDATE commitments SET goal_id = NULL WHERE goal_id = ?', [id]);
    await db.runAsync('DELETE FROM goals WHERE id = ?', [id]);
  });
}

export async function countDepositsInto(goalId: string): Promise<number> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ total: number }>(
    'SELECT COUNT(*) AS total FROM occurrences WHERE goal_id = ?',
    [goalId],
  );
  return row?.total ?? 0;
}
