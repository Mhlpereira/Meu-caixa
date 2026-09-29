import { getDb } from '@/db/client';

export type SettingKey =
  | 'active_profile_id'
  | 'biometrics_enabled'
  | 'lock_timeout_seconds'
  | 'horizon_months'
  | 'onboarding_done'
  | 'schema_version'
  | 'backup_folder_uri'
  | 'backup_last_at'
  | 'theme';

export async function getSetting(key: SettingKey): Promise<string | null> {
  const db = await getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key],
  );
  return row?.value ?? null;
}

export async function setSetting(key: SettingKey, value: string): Promise<void> {
  const db = await getDb();
  await db.runAsync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const db = await getDb();
  const rows = await db.getAllAsync<{ key: string; value: string }>(
    'SELECT key, value FROM settings',
  );
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getBooleanSetting(key: SettingKey, fallback = false): Promise<boolean> {
  const value = await getSetting(key);
  return value === null ? fallback : value === '1';
}

export async function setBooleanSetting(key: SettingKey, value: boolean): Promise<void> {
  await setSetting(key, value ? '1' : '0');
}

export async function getNumberSetting(key: SettingKey, fallback: number): Promise<number> {
  const value = await getSetting(key);
  if (value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
