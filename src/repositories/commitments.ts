import { getDb } from '@/db/client';
import { summarizeInstallments } from '@/domain/calc';
import {
  DEFAULT_HORIZON_MONTHS,
  materialize,
  reconcile,
  withIds,
  type PlannedOccurrence,
} from '@/domain/materialize';
import type {
  Commitment,
  CommitmentInput,
  InstallmentPlan,
  Occurrence,
  RecurringPlan,
  Scope,
} from '@/domain/types';
import { ALL_PROFILES } from '@/domain/types';
import { addMonths, currentCompetence } from '@/utils/date';
import { createId } from '@/utils/id';

import {
  toCommitment,
  toOccurrence,
  type CommitmentRow,
  type OccurrenceRow,
} from './mappers';
import { getNumberSetting } from './settings';

async function horizonCompetence(): Promise<string> {
  const months = await getNumberSetting('horizon_months', DEFAULT_HORIZON_MONTHS);
  return addMonths(currentCompetence(), months);
}

export async function getCommitment(id: string): Promise<Commitment | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<CommitmentRow>('SELECT * FROM commitments WHERE id = ?', [id]);
  return row ? toCommitment(row) : null;
}

export async function listOccurrencesOf(commitmentId: string): Promise<Occurrence[]> {
  const db = await getDb();
  const rows = await db.getAllAsync<OccurrenceRow>(
    'SELECT * FROM occurrences WHERE commitment_id = ? ORDER BY competence ASC',
    [commitmentId],
  );
  return rows.map(toOccurrence);
}

export async function createCommitment(input: CommitmentInput): Promise<Commitment> {
  const db = await getDb();
  const timestamp = new Date().toISOString();

  const commitment: Commitment = {
    ...input,
    id: createId(),
    description: input.description.trim(),
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const planned = withIds(materialize(commitment, { horizon: await horizonCompetence() }));

  await db.withTransactionAsync(async () => {
    await insertCommitmentRow(db, commitment);
    for (const occurrence of planned) await insertOccurrenceRow(db, occurrence);
  });

  return commitment;
}

export async function updateCommitment(id: string, input: CommitmentInput): Promise<void> {
  const db = await getDb();
  const previous = await getCommitment(id);
  if (!previous) return;

  const commitment: Commitment = {
    ...previous,
    ...input,
    id,
    description: input.description.trim(),
    updatedAt: new Date().toISOString(),
  };

  const existing = await listOccurrencesOf(id);
  const plan = reconcile(commitment, existing, { horizon: await horizonCompetence() });

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE commitments SET
         profile_id = ?, category_id = ?, kind = ?, type = ?, description = ?,
         amount = ?, installments = ?, start_date = ?, end_date = ?,
         day_of_month = ?, notes = ?, is_investment = ?, goal_id = ?, updated_at = ?
       WHERE id = ?`,
      [
        commitment.profileId,
        commitment.categoryId,
        commitment.kind,
        commitment.type,
        commitment.description,
        commitment.amount,
        commitment.installments,
        commitment.startDate,
        commitment.endDate,
        commitment.dayOfMonth,
        commitment.notes,
        commitment.isInvestment ? 1 : 0,
        commitment.goalId,
        commitment.updatedAt,
        id,
      ],
    );

    for (const occurrenceId of plan.toDeleteIds) {
      await db.runAsync('DELETE FROM occurrences WHERE id = ?', [occurrenceId]);
    }

    for (const change of plan.toUpdate) {
      await db.runAsync(
        `UPDATE occurrences SET due_date = ?, amount = ?, profile_id = ?, kind = ?,
                is_investment = ?, goal_id = ? WHERE id = ?`,
        [
          change.dueDate,
          change.amount,
          commitment.profileId,
          commitment.kind,
          commitment.isInvestment ? 1 : 0,
          commitment.goalId,
          change.id,
        ],
      );
    }

    for (const occurrence of withIds(plan.toInsert)) {
      await insertOccurrenceRow(db, occurrence);
    }
  });
}

export async function deleteCommitment(id: string): Promise<void> {
  const db = await getDb();
  await db.runAsync('DELETE FROM commitments WHERE id = ?', [id]);
}

export async function archiveCommitment(id: string): Promise<void> {
  const db = await getDb();
  const competence = currentCompetence();

  await db.withTransactionAsync(async () => {
    await db.runAsync('UPDATE commitments SET archived = 1, updated_at = ? WHERE id = ?', [
      new Date().toISOString(),
      id,
    ]);
    await db.runAsync(
      `DELETE FROM occurrences
       WHERE commitment_id = ? AND status = 'pending' AND competence >= ?`,
      [id, competence],
    );
  });
}

export async function extendRecurringHorizon(): Promise<number> {
  const db = await getDb();
  const horizon = await horizonCompetence();

  const rows = await db.getAllAsync<CommitmentRow>(
    `SELECT * FROM commitments
     WHERE type = 'recurring' AND archived = 0 AND end_date IS NULL`,
  );

  let created = 0;

  for (const row of rows) {
    const commitment = toCommitment(row);
    const last = await db.getFirstAsync<{ last: string | null }>(
      'SELECT MAX(competence) AS last FROM occurrences WHERE commitment_id = ?',
      [commitment.id],
    );

    if (last?.last && last.last >= horizon) continue;

    const planned = materialize(commitment, { horizon });
    const missing = last?.last
      ? planned.filter((occurrence) => occurrence.competence > (last.last as string))
      : planned;

    if (missing.length === 0) continue;

    await db.withTransactionAsync(async () => {
      for (const occurrence of withIds(missing)) {
        await insertOccurrenceRow(db, occurrence);
      }
    });

    created += missing.length;
  }

  return created;
}

function scopeClause(scope: Scope): { clause: string; params: string[] } {
  return scope === ALL_PROFILES
    ? { clause: '', params: [] }
    : { clause: 'AND c.profile_id = ?', params: [scope] };
}

export async function listOpenInstallments(scope: Scope): Promise<InstallmentPlan[]> {
  const db = await getDb();
  const { clause, params } = scopeClause(scope);

  const rows = await db.getAllAsync<
    CommitmentRow & {
      category_icon: string | null;
      category_color: string | null;
      profile_name: string;
      profile_color: string;
    }
  >(
    `SELECT c.*, cat.icon AS category_icon, cat.color AS category_color,
            p.name AS profile_name, p.color AS profile_color
     FROM commitments c
     JOIN profiles p ON p.id = c.profile_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.type = 'installment' AND c.archived = 0 ${clause}
       AND EXISTS (
         SELECT 1 FROM occurrences o
         WHERE o.commitment_id = c.id AND o.status = 'pending'
       )
     ORDER BY c.created_at DESC`,
    params,
  );

  const plans: InstallmentPlan[] = [];

  for (const row of rows) {
    const commitment = toCommitment(row);
    const occurrences = await listOccurrencesOf(commitment.id);
    plans.push({
      commitment,
      ...summarizeInstallments(commitment, occurrences),
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
      profileName: row.profile_name,
      profileColor: row.profile_color,
    });
  }

  return plans;
}

export async function listRecurring(scope: Scope, kind: 'expense' | 'income'): Promise<RecurringPlan[]> {
  const db = await getDb();
  const { clause, params } = scopeClause(scope);

  const rows = await db.getAllAsync<
    CommitmentRow & {
      category_icon: string | null;
      category_color: string | null;
      profile_name: string;
      profile_color: string;
    }
  >(
    `SELECT c.*, cat.icon AS category_icon, cat.color AS category_color,
            p.name AS profile_name, p.color AS profile_color
     FROM commitments c
     JOIN profiles p ON p.id = c.profile_id
     LEFT JOIN categories cat ON cat.id = c.category_id
     WHERE c.type = 'recurring' AND c.archived = 0 AND c.kind = ? ${clause}
     ORDER BY c.day_of_month ASC, c.amount DESC`,
    [kind, ...params],
  );

  return rows.map((row) => ({
    commitment: toCommitment(row),
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    profileName: row.profile_name,
    profileColor: row.profile_color,
  }));
}

async function insertCommitmentRow(
  db: Awaited<ReturnType<typeof getDb>>,
  commitment: Commitment,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO commitments
       (id, profile_id, category_id, kind, type, description, amount, installments,
        start_date, end_date, day_of_month, notes, is_investment, goal_id, archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      commitment.id,
      commitment.profileId,
      commitment.categoryId,
      commitment.kind,
      commitment.type,
      commitment.description,
      commitment.amount,
      commitment.installments,
      commitment.startDate,
      commitment.endDate,
      commitment.dayOfMonth,
      commitment.notes,
      commitment.isInvestment ? 1 : 0,
      commitment.goalId,
      commitment.archived ? 1 : 0,
      commitment.createdAt,
      commitment.updatedAt,
    ],
  );
}

async function insertOccurrenceRow(
  db: Awaited<ReturnType<typeof getDb>>,
  occurrence: Occurrence,
): Promise<void> {
  await db.runAsync(
    `INSERT OR IGNORE INTO occurrences
       (id, commitment_id, profile_id, kind, competence, due_date, amount,
        installment_index, status, paid_at, is_overridden, is_investment, goal_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      occurrence.id,
      occurrence.commitmentId,
      occurrence.profileId,
      occurrence.kind,
      occurrence.competence,
      occurrence.dueDate,
      occurrence.amount,
      occurrence.installmentIndex,
      occurrence.status,
      occurrence.paidAt,
      occurrence.isOverridden ? 1 : 0,
      occurrence.isInvestment ? 1 : 0,
      occurrence.goalId,
    ],
  );
}

export type { PlannedOccurrence };
