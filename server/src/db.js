import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dbPath = resolve(__dirname, '..', process.env.DB_PATH || './data/ev.sqlite')

// 确保数据目录存在
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

// 幂等建表
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at    INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS vehicles (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model      TEXT NOT NULL,
  B          REAL NOT NULL CHECK (B > 0),
  Pmax       REAL NOT NULL CHECK (Pmax > 0),
  M0         REAL NOT NULL CHECK (M0 >= 0),
  R0         REAL NOT NULL CHECK (R0 >= 0),
  color      TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vehicle_id TEXT NOT NULL REFERENCES vehicles(id) ON DELETE CASCADE,
  ts         TEXT NOT NULL,
  E          REAL NOT NULL CHECK (E >= 0),
  T          REAL NOT NULL CHECK (T >= 0),
  C          REAL NOT NULL CHECK (C >= 0),
  M          REAL,
  R_start    REAL,
  R_end      REAL,
  meter      TEXT CHECK (meter IN ('battery','grid')),
  ctype      TEXT CHECK (ctype IN ('home','fast','other')),
  note       TEXT,
  created_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user          ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_vehicle  ON sessions(user_id, vehicle_id);
CREATE INDEX IF NOT EXISTS idx_sessions_vehicle       ON sessions(vehicle_id);
`)

console.log(`[db] SQLite 已就绪: ${dbPath}`)
