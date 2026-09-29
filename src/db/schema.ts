export const SCHEMA_VERSION = 3;

export const CREATE_TABLES = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL,
  icon        TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  investment_goal INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  is_system   INTEGER NOT NULL DEFAULT 0,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS commitments (
  id            TEXT PRIMARY KEY NOT NULL,
  profile_id    TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  category_id   TEXT REFERENCES categories (id) ON DELETE SET NULL,
  kind          TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  type          TEXT NOT NULL CHECK (type IN ('single', 'installment', 'recurring')),
  description   TEXT NOT NULL,
  amount        INTEGER NOT NULL,
  installments  INTEGER,
  start_date    TEXT NOT NULL,
  end_date      TEXT,
  day_of_month  INTEGER,
  notes         TEXT,
  is_investment INTEGER NOT NULL DEFAULT 0,
  goal_id       TEXT REFERENCES goals (id) ON DELETE SET NULL,
  archived      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS occurrences (
  id                TEXT PRIMARY KEY NOT NULL,
  commitment_id     TEXT NOT NULL REFERENCES commitments (id) ON DELETE CASCADE,
  profile_id        TEXT NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('expense', 'income')),
  competence        TEXT NOT NULL,
  due_date          TEXT NOT NULL,
  amount            INTEGER NOT NULL,
  installment_index INTEGER,
  status            TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'paid', 'skipped')),
  paid_at           TEXT,
  is_overridden     INTEGER NOT NULL DEFAULT 0,
  is_investment     INTEGER NOT NULL DEFAULT 0,
  goal_id           TEXT,
  UNIQUE (commitment_id, competence)
);

CREATE TABLE IF NOT EXISTS goals (
  id                   TEXT PRIMARY KEY NOT NULL,
  profile_id           TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  icon                 TEXT NOT NULL,
  color                TEXT NOT NULL,
  target_amount        INTEGER NOT NULL DEFAULT 0,
  monthly_contribution INTEGER NOT NULL DEFAULT 0,
  annual_rate_bp       INTEGER NOT NULL DEFAULT 0,
  initial_amount       INTEGER NOT NULL DEFAULT 0,
  target_date          TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  archived             INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;

export const CREATE_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_occ_competence   ON occurrences (competence);
CREATE INDEX IF NOT EXISTS idx_occ_profile_comp ON occurrences (profile_id, competence);
CREATE INDEX IF NOT EXISTS idx_occ_commitment   ON occurrences (commitment_id);
CREATE INDEX IF NOT EXISTS idx_com_profile      ON commitments (profile_id, archived);
CREATE INDEX IF NOT EXISTS idx_occ_goal         ON occurrences (goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_profile    ON goals (profile_id, archived);
`;

export const MIGRATE_TO_V2 = `
ALTER TABLE profiles    ADD COLUMN investment_goal INTEGER NOT NULL DEFAULT 0;
ALTER TABLE commitments ADD COLUMN is_investment   INTEGER NOT NULL DEFAULT 0;
ALTER TABLE occurrences ADD COLUMN is_investment   INTEGER NOT NULL DEFAULT 0;
`;

export const MIGRATE_TO_V3 = `
CREATE TABLE IF NOT EXISTS goals (
  id                   TEXT PRIMARY KEY NOT NULL,
  profile_id           TEXT NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  name                 TEXT NOT NULL,
  icon                 TEXT NOT NULL,
  color                TEXT NOT NULL,
  target_amount        INTEGER NOT NULL DEFAULT 0,
  monthly_contribution INTEGER NOT NULL DEFAULT 0,
  annual_rate_bp       INTEGER NOT NULL DEFAULT 0,
  initial_amount       INTEGER NOT NULL DEFAULT 0,
  target_date          TEXT,
  sort_order           INTEGER NOT NULL DEFAULT 0,
  archived             INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL
);
ALTER TABLE commitments ADD COLUMN goal_id TEXT;
ALTER TABLE occurrences ADD COLUMN goal_id TEXT;
CREATE INDEX IF NOT EXISTS idx_occ_goal      ON occurrences (goal_id);
CREATE INDEX IF NOT EXISTS idx_goals_profile ON goals (profile_id, archived);
`;
