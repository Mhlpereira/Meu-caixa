import { getDb } from '@/db/client';
import { SCHEMA_VERSION } from '@/db/schema';

import type {
  CategoryRow,
  CommitmentRow,
  OccurrenceRow,
  ProfileRow,
} from './mappers';

export interface BackupFile {
  app: 'meu-caixa';
  schemaVersion: number;
  exportedAt: string;
  profiles: ProfileRow[];
  categories: CategoryRow[];
  commitments: CommitmentRow[];
  occurrences: OccurrenceRow[];
  settings: Array<{ key: string; value: string }>;
}

export async function exportBackup(): Promise<BackupFile> {
  const db = await getDb();

  const [profiles, categories, commitments, occurrences, settings] = await Promise.all([
    db.getAllAsync<ProfileRow>('SELECT * FROM profiles'),
    db.getAllAsync<CategoryRow>('SELECT * FROM categories'),
    db.getAllAsync<CommitmentRow>('SELECT * FROM commitments'),
    db.getAllAsync<OccurrenceRow>('SELECT * FROM occurrences'),
    db.getAllAsync<{ key: string; value: string }>(
      `SELECT key, value FROM settings WHERE key != 'schema_version'`,
    ),
  ]);

  return {
    app: 'meu-caixa',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    profiles,
    categories,
    commitments,
    occurrences,
    settings,
  };
}

export class BackupFormatError extends Error {}

export function parseBackup(raw: string): BackupFile {
  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new BackupFormatError('Esse arquivo não é um backup válido.');
  }

  if (!isBackupFile(parsed)) {
    throw new BackupFormatError('Esse arquivo não é um backup do Meu Caixa.');
  }

  if (parsed.schemaVersion > SCHEMA_VERSION) {
    throw new BackupFormatError(
      'Esse backup foi feito numa versão mais nova do app. Atualize antes de importar.',
    );
  }

  return parsed;
}

function isBackupFile(value: unknown): value is BackupFile {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    candidate.app === 'meu-caixa' &&
    typeof candidate.schemaVersion === 'number' &&
    Array.isArray(candidate.profiles) &&
    Array.isArray(candidate.categories) &&
    Array.isArray(candidate.commitments) &&
    Array.isArray(candidate.occurrences)
  );
}

export async function importBackup(backup: BackupFile): Promise<void> {
  const db = await getDb();

  await db.execAsync('PRAGMA foreign_keys = OFF;');

  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM occurrences');
      await db.runAsync('DELETE FROM commitments');
      await db.runAsync('DELETE FROM categories');
      await db.runAsync('DELETE FROM profiles');
      await db.runAsync(`DELETE FROM settings WHERE key != 'schema_version'`);

      for (const profile of backup.profiles) {
        await db.runAsync(
          `INSERT INTO profiles (id, name, color, icon, sort_order, created_at, investment_goal)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            profile.id,
            profile.name,
            profile.color,
            profile.icon,
            profile.sort_order,
            profile.created_at,
            profile.investment_goal ?? 0,
          ],
        );
      }

      for (const category of backup.categories) {
        await db.runAsync(
          `INSERT INTO categories (id, name, icon, color, kind, is_system, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            category.id,
            category.name,
            category.icon,
            category.color,
            category.kind,
            category.is_system,
            category.sort_order,
          ],
        );
      }

      for (const commitment of backup.commitments) {
        await db.runAsync(
          `INSERT INTO commitments
             (id, profile_id, category_id, kind, type, description, amount, installments,
              start_date, end_date, day_of_month, notes, is_investment, goal_id, archived, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            commitment.id,
            commitment.profile_id,
            commitment.category_id,
            commitment.kind,
            commitment.type,
            commitment.description,
            commitment.amount,
            commitment.installments,
            commitment.start_date,
            commitment.end_date,
            commitment.day_of_month,
            commitment.notes,
            commitment.is_investment ?? 0,
            commitment.goal_id ?? null,
            commitment.archived,
            commitment.created_at,
            commitment.updated_at,
          ],
        );
      }

      for (const occurrence of backup.occurrences) {
        await db.runAsync(
          `INSERT INTO occurrences
             (id, commitment_id, profile_id, kind, competence, due_date, amount,
              installment_index, status, paid_at, is_overridden, is_investment, goal_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            occurrence.id,
            occurrence.commitment_id,
            occurrence.profile_id,
            occurrence.kind,
            occurrence.competence,
            occurrence.due_date,
            occurrence.amount,
            occurrence.installment_index,
            occurrence.status,
            occurrence.paid_at,
            occurrence.is_overridden,
            occurrence.is_investment ?? 0,
            occurrence.goal_id ?? null,
          ],
        );
      }

      for (const setting of backup.settings ?? []) {
        await db.runAsync(
          `INSERT INTO settings (key, value) VALUES (?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
          [setting.key, setting.value],
        );
      }
    });
  } finally {
    await db.execAsync('PRAGMA foreign_keys = ON;');
  }
}
