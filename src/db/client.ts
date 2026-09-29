import * as SQLite from 'expo-sqlite';

import {
  CREATE_INDEXES,
  CREATE_TABLES,
  MIGRATE_TO_V2,
  MIGRATE_TO_V3,
  SCHEMA_VERSION,
} from './schema';
import { seedDatabase } from './seed';

const DB_NAME = 'meucaixa.db';

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = open().catch((error) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

async function open(): Promise<SQLite.SQLiteDatabase> {
  const db = await SQLite.openDatabaseAsync(DB_NAME);
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  await migrate(db);
  return db;
}

async function migrate(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(CREATE_TABLES);

  const current = await readVersion(db);

  if (current === 0) {
    await seedDatabase(db);
    await writeVersion(db, SCHEMA_VERSION);
  } else {
    if (current < 2) await runMigration(db, MIGRATE_TO_V2);
    if (current < 3) await runMigration(db, MIGRATE_TO_V3);
    if (current < SCHEMA_VERSION) await writeVersion(db, SCHEMA_VERSION);
  }

  await db.execAsync(CREATE_INDEXES);
}

const HARMLESS_MIGRATION_ERRORS = ['duplicate column name', 'already exists'];

async function runMigration(db: SQLite.SQLiteDatabase, sql: string): Promise<void> {
  for (const statement of sql.split(';').map((item) => item.trim()).filter(Boolean)) {
    try {
      await db.execAsync(statement);
    } catch (error) {
      const message = (error instanceof Error ? error.message : String(error)).toLowerCase();
      const harmless = HARMLESS_MIGRATION_ERRORS.some((known) => message.includes(known));
      if (!harmless) {
        throw new Error(`Migração falhou em "${statement.slice(0, 60)}": ${message}`);
      }
    }
  }
}

async function readVersion(db: SQLite.SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM settings WHERE key = 'schema_version'`,
  );
  return row ? Number(row.value) : 0;
}

async function writeVersion(db: SQLite.SQLiteDatabase, version: number): Promise<void> {
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES ('schema_version', ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [String(version)],
  );
}

export async function resetDatabase(): Promise<void> {
  const db = await getDb();
  await db.execAsync(`
    PRAGMA foreign_keys = OFF;
    DELETE FROM occurrences;
    DELETE FROM commitments;
    DELETE FROM categories;
    DELETE FROM profiles;
    DELETE FROM settings;
    PRAGMA foreign_keys = ON;
  `);
  await seedDatabase(db);
  await writeVersion(db, SCHEMA_VERSION);
}
