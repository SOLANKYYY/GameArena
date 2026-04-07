import Database from 'better-sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';
import { DEFAULT_STARTING_BALANCE, ALL_GAMES } from './constants';
import { generateServerSeed, hashServerSeed, generateClientSeed } from './rng';

const dbPath = path.join(process.cwd(), 'game-arena.db');

let db: Database.Database;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.pragma('busy_timeout = 10000');  // 10s – enough for burst concurrency
    db.pragma('synchronous = NORMAL');  // Safe with WAL; faster than FULL
    db.pragma('cache_size = -32000');   // 32 MB page cache
    db.pragma('temp_store = MEMORY');   // Temp tables in RAM
    db.pragma('mmap_size = 268435456'); // 256 MB memory-mapped I/O
    initializeDb(db);
  }
  return db;
}

function initializeDb(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      team_name TEXT NOT NULL,
      balance REAL DEFAULT ${DEFAULT_STARTING_BALANCE},
      role TEXT DEFAULT 'player' CHECK(role IN ('player', 'admin')),
      client_seed TEXT,
      server_seed TEXT,
      server_seed_hash TEXT,
      nonce INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

    CREATE TABLE IF NOT EXISTS bets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      game TEXT NOT NULL,
      bet_amount REAL NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('win', 'loss')),
      payout REAL DEFAULT 0,
      multiplier REAL DEFAULT 0,
      details TEXT,
      server_seed TEXT,
      client_seed TEXT,
      nonce INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_bets_user_created ON bets(user_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_bets_created ON bets(created_at);

    CREATE TABLE IF NOT EXISTS game_settings (
      game_name TEXT PRIMARY KEY,
      is_active INTEGER DEFAULT 1,
      min_bet REAL DEFAULT 1,
      max_bet REAL DEFAULT 1000000
    );

    CREATE TABLE IF NOT EXISTS game_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      game TEXT NOT NULL,
      state TEXT NOT NULL,
      bet_amount REAL NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      completed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user_game ON game_sessions(user_id, game);
  `);

  // Add columns if they don't exist (migration-safe)
  try { database.exec('ALTER TABLE users ADD COLUMN client_seed TEXT'); } catch {}
  try { database.exec('ALTER TABLE users ADD COLUMN server_seed TEXT'); } catch {}
  try { database.exec('ALTER TABLE users ADD COLUMN server_seed_hash TEXT'); } catch {}
  try { database.exec('ALTER TABLE users ADD COLUMN nonce INTEGER DEFAULT 0'); } catch {}
  try { database.exec('ALTER TABLE bets ADD COLUMN server_seed TEXT'); } catch {}
  try { database.exec('ALTER TABLE bets ADD COLUMN client_seed TEXT'); } catch {}
  try { database.exec('ALTER TABLE bets ADD COLUMN nonce INTEGER'); } catch {}

  // Seed admin account if not exists
  const adminExists = database.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();
    database.prepare(
      'INSERT INTO users (username, password_hash, team_name, balance, role, client_seed, server_seed, server_seed_hash, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run('admin', hash, 'Admin Team', DEFAULT_STARTING_BALANCE, 'admin', clientSeed, serverSeed, hashServerSeed(serverSeed), 0);
  }

  // Ensure existing users have seeds
  const usersWithoutSeeds = database.prepare('SELECT id FROM users WHERE server_seed IS NULL').all() as any[];
  for (const u of usersWithoutSeeds) {
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();
    database.prepare('UPDATE users SET client_seed = ?, server_seed = ?, server_seed_hash = ?, nonce = 0 WHERE id = ?')
      .run(clientSeed, serverSeed, hashServerSeed(serverSeed), u.id);
  }

  // Seed game settings for all 7 games
  const insertGame = database.prepare(
    'INSERT OR IGNORE INTO game_settings (game_name, is_active, min_bet, max_bet) VALUES (?, 1, 1, 1000000)'
  );
  for (const game of ALL_GAMES) {
    insertGame.run(game);
  }
}

export default getDb;
