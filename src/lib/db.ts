import { AsyncLocalStorage } from 'node:async_hooks';
import { Pool, PoolClient } from 'pg';
import bcrypt from 'bcrypt';
import { DEFAULT_STARTING_BALANCE, ALL_GAMES } from './constants';
import { generateServerSeed, hashServerSeed, generateClientSeed } from './rng';

const DATABASE_URL = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'admin321');

let db: Db | null = null;
let initPromise: Promise<Db> | null = null;

export interface UserDoc {
  _id?: any;
  id: number;
  username: string;
  password_hash: string;
  team_name: string;
  balance: number;
  role: 'player' | 'admin';
  client_seed: string;
  server_seed: string;
  server_seed_hash: string;
  nonce: number;
  created_at: Date;
}

export interface BetDoc {
  _id?: any;
  id: number;
  user_id: number;
  game: string;
  bet_amount: number;
  outcome: 'win' | 'loss';
  payout: number;
  multiplier: number;
  details: string;
  server_seed: string;
  client_seed: string;
  nonce: number;
  created_at: Date;
}

export interface GameSessionDoc {
  _id?: any;
  id: string;
  user_id: number;
  game: string;
  state: string;
  bet_amount: number;
  created_at: Date;
  completed_at: Date | null;
}

export interface GameSettingDoc {
  _id?: any;
  game_name: string;
  is_active: boolean;
  min_bet: number;
  max_bet: number;
}

// ───────────────────────────────────────────────────────────────
// Postgres (Supabase) document store with a small MongoDB-style API.
// Each collection is a table: (_id text PK, doc jsonb).
// ───────────────────────────────────────────────────────────────
const COLLECTIONS = ['users', 'bets', 'game_sessions', 'game_settings', 'round_config'] as const;

let pool: Pool | null = null;
function getPool(): Pool {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Add your Supabase connection string in your hosting environment variables and redeploy.');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: /localhost|127\.0\.0\.1/.test(DATABASE_URL) ? undefined : { rejectUnauthorized: false },
      max: Number(process.env.DB_POOL_MAX || 5),
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
    });
    pool.on('error', (e) => console.error('[Postgres] pool error:', e.message));
  }
  return pool;
}

const transaction = new AsyncLocalStorage<PoolClient>();

function connection() {
  return transaction.getStore() ?? getPool();
}

async function inTransaction<T>(work: (client: PoolClient) => Promise<T>, commit = (_result: T) => true): Promise<T> {
  const active = transaction.getStore();
  if (active) return work(active);
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await transaction.run(client, () => work(client));
    await client.query(commit(result) ? 'COMMIT' : 'ROLLBACK');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export async function runPlayerAction(userId: number, action: () => Promise<Response>) {
  await getDb();
  return inTransaction(async client => {
    // All games take the same player lock before reading balance, nonce or session state.
    const player = await client.query("SELECT 1 FROM users WHERE (doc->>'id')::bigint = $1 FOR UPDATE", [userId]);
    if (!player.rowCount) throw new Error('User not found');
    return action();
  }, response => response.ok);
}

type Filter = Record<string, any>;
type Sort = Record<string, 1 | -1>;

const norm = (v: any): any => (v instanceof Date ? v.toISOString() : v);

/** Translate a Mongo-style filter to SQL over the jsonb column `doc`. */
function buildWhere(filter: Filter, params: any[]): string {
  const conds: string[] = [];
  const add = (v: any) => { params.push(JSON.stringify(norm(v))); return `$${params.length}::jsonb`; };
  for (const [key, cond] of Object.entries(filter || {})) {
    if (key === '_id') {
      params.push(String(cond)); conds.push(`_id = $${params.length}`); continue;
    }
    if (!/^[A-Za-z0-9_]+$/.test(key)) throw new Error(`Invalid field: ${key}`);
    const f = `(doc->'${key}')`;
    const isOps = cond && typeof cond === 'object' && !(cond instanceof Date) && !Array.isArray(cond)
      && Object.keys(cond).every((k) => k.startsWith('$'));
    if (!isOps) {
      if (cond === null) conds.push(`(${f} IS NULL OR ${f} = 'null'::jsonb)`);
      else conds.push(`${f} = ${add(cond)}`);
      continue;
    }
    for (const [op, val] of Object.entries(cond)) {
      switch (op) {
        case '$gte': conds.push(`${f} >= ${add(val)}`); break;
        case '$gt': conds.push(`${f} > ${add(val)}`); break;
        case '$lte': conds.push(`${f} <= ${add(val)}`); break;
        case '$lt': conds.push(`${f} < ${add(val)}`); break;
        case '$ne':
          if (val === null) conds.push(`(${f} IS NOT NULL AND ${f} <> 'null'::jsonb)`);
          else conds.push(`(${f} IS NULL OR ${f} <> ${add(val)})`);
          break;
        case '$in': {
          const arr = (val as any[]).map(add);
          conds.push(arr.length ? `${f} IN (${arr.join(',')})` : 'FALSE');
          break;
        }
        case '$exists': conds.push(val ? `${f} IS NOT NULL` : `${f} IS NULL`); break;
        default: throw new Error(`Unsupported filter operator ${op}`);
      }
    }
  }
  return conds.length ? conds.join(' AND ') : 'TRUE';
}

function buildOrder(sort?: Sort): string {
  const parts = Object.entries(sort || {}).map(([k, d]) => {
    if (!/^[A-Za-z0-9_]+$/.test(k)) throw new Error(`Invalid sort field: ${k}`);
    return `doc->'${k}' ${d === -1 ? 'DESC' : 'ASC'} NULLS LAST`;
  });
  return parts.length ? `ORDER BY ${parts.join(', ')}` : '';
}

function applyUpdate(doc: any, update: any, inserting: boolean): any {
  const out = { ...doc };
  for (const [k, v] of Object.entries(update.$set || {})) out[k] = norm(v);
  for (const [k, v] of Object.entries(update.$inc || {})) out[k] = (Number(out[k]) || 0) + Number(v);
  if (inserting) for (const [k, v] of Object.entries(update.$setOnInsert || {})) out[k] = norm(v);
  return out;
}

function project(row: any, projection?: Record<string, 0 | 1>): any {
  const d = { _id: row._id, ...row.doc };
  if (!projection) return d;
  const keys = Object.keys(projection).filter((k) => k !== '_id');
  const include = keys.some((k) => projection[k] === 1);
  const out: any = {};
  if (include) { for (const k of keys) if (projection[k] === 1) out[k] = d[k]; if (projection._id !== 0) out._id = d._id; }
  else { Object.assign(out, d); for (const k of keys) delete out[k]; if (projection._id === 0) delete out._id; }
  return out;
}

class Cursor {
  private _sort?: Sort; private _limit?: number; private _skip?: number; private _proj?: any;
  constructor(private table: string, private filter: Filter, opts: any = {}) {
    this._sort = opts.sort; this._limit = opts.limit; this._skip = opts.skip; this._proj = opts.projection;
  }
  sort(s: Sort) { this._sort = s; return this; }
  limit(n: number) { this._limit = n; return this; }
  skip(n: number) { this._skip = n; return this; }
  project(p: any) { this._proj = p; return this; }
  async toArray(): Promise<any[]> {
    const params: any[] = [];
    const where = buildWhere(this.filter, params);
    let sql = `SELECT _id, doc FROM ${this.table} WHERE ${where} ${buildOrder(this._sort)}`;
    if (this._limit) sql += ` LIMIT ${Math.floor(this._limit)}`;
    if (this._skip) sql += ` OFFSET ${Math.floor(this._skip)}`;
    const res = await connection().query(sql, params);
    return res.rows.map((r) => project(r, this._proj));
  }
}

class Collection {
  constructor(private name: string) {
    if (!(COLLECTIONS as readonly string[]).includes(name)) throw new Error(`Unknown collection: ${name}`);
  }
  find(filter: Filter = {}, opts: any = {}) { return new Cursor(this.name, filter, opts); }
  async findOne(filter: Filter = {}, opts: any = {}) {
    const rows = await new Cursor(this.name, filter, { ...opts, limit: 1 }).toArray();
    return rows[0] || null;
  }
  async countDocuments(filter: Filter = {}) {
    const params: any[] = [];
    const res = await connection().query(`SELECT count(*)::int AS n FROM ${this.name} WHERE ${buildWhere(filter, params)}`, params);
    return res.rows[0].n as number;
  }
  async insertOne(docIn: any) {
    const { _id, ...rest } = docIn;
    const id = String(_id ?? (rest.id ?? crypto.randomUUID()));
    const doc = JSON.parse(JSON.stringify(rest));
    await connection().query(`INSERT INTO ${this.name} (_id, doc) VALUES ($1, $2::jsonb)`, [id, JSON.stringify(doc)]);
    return { insertedId: id };
  }
  /** Atomic find + update using a row lock. Returns the updated doc (or null). */
  async findOneAndUpdate(filter: Filter, update: any, opts: any = {}) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await inTransaction(async client => {
          const params: any[] = [];
          const where = buildWhere(filter, params);
          const sel = await client.query(`SELECT _id, doc FROM ${this.name} WHERE ${where} LIMIT 1 FOR UPDATE`, params);
          let result: any = null;
          if (sel.rows[0]) {
            const next = applyUpdate(sel.rows[0].doc, update, false);
            await client.query(`UPDATE ${this.name} SET doc = $2::jsonb WHERE _id = $1`, [sel.rows[0]._id, JSON.stringify(next)]);
            result = { _id: sel.rows[0]._id, ...(opts.returnDocument === 'before' ? sel.rows[0].doc : next) };
          } else if (opts.upsert) {
            const base: any = {};
            for (const [k, v] of Object.entries(filter)) if (k !== '_id' && (v === null || typeof v !== 'object' || v instanceof Date)) base[k] = norm(v);
            const next = applyUpdate(base, update, true);
            const id = String((filter as any)._id ?? next.id ?? crypto.randomUUID());
            await client.query(`INSERT INTO ${this.name} (_id, doc) VALUES ($1, $2::jsonb)`, [id, JSON.stringify(next)]);
            result = { _id: id, ...next };
          }
          return result;
        });
      } catch (error: any) {
        if (!transaction.getStore() && error.code === '23505' && attempt < 2) continue;
        throw error;
      }
    }
    return null;
  }
  async updateOne(filter: Filter, update: any, opts: any = {}) {
    const r = await this.findOneAndUpdate(filter, update, opts);
    return { matchedCount: r ? 1 : 0, modifiedCount: r ? 1 : 0 };
  }
  async updateMany(filter: Filter, update: any) {
    return inTransaction(async client => {
      const params: any[] = [];
      const sel = await client.query(`SELECT _id, doc FROM ${this.name} WHERE ${buildWhere(filter, params)} FOR UPDATE`, params);
      for (const row of sel.rows) {
        await client.query(`UPDATE ${this.name} SET doc = $2::jsonb WHERE _id = $1`, [row._id, JSON.stringify(applyUpdate(row.doc, update, false))]);
      }
      return { modifiedCount: sel.rows.length };
    });
  }
  async deleteOne(filter: Filter) {
    const params: any[] = [];
    const res = await connection().query(
      `DELETE FROM ${this.name} WHERE _id = (SELECT _id FROM ${this.name} WHERE ${buildWhere(filter, params)} LIMIT 1)`, params);
    return { deletedCount: res.rowCount || 0 };
  }
  async deleteMany(filter: Filter) {
    const params: any[] = [];
    const res = await connection().query(`DELETE FROM ${this.name} WHERE ${buildWhere(filter, params)}`, params);
    return { deletedCount: res.rowCount || 0 };
  }
}

export class Db {
  async adjustBalance(userId: number, action: 'set' | 'add' | 'deduct', amount: number) {
    const result = await connection().query(`
      UPDATE users SET doc = jsonb_set(doc, '{balance}', to_jsonb(round(
        CASE $2 WHEN 'set' THEN $3::numeric
                WHEN 'add' THEN (doc->>'balance')::numeric + $3::numeric
                ELSE greatest(0, (doc->>'balance')::numeric - $3::numeric)
        END, 2)))
      WHERE (doc->>'id')::bigint = $1 RETURNING doc->'balance' AS balance
    `, [userId, action, amount]);
    return result.rows[0]?.balance as number | undefined;
  }

  async leaderboard() {
    const result = await connection().query(`
      WITH players AS (
        SELECT doc FROM users WHERE doc->>'role' = 'player'
        ORDER BY (doc->>'balance')::numeric DESC, (doc->>'id')::bigint LIMIT 50
      )
      SELECT p.doc->'id' AS id, p.doc->>'username' AS username, p.doc->>'team_name' AS "teamName",
             p.doc->'balance' AS balance, totals.*
      FROM players p
      CROSS JOIN LATERAL (
        SELECT count(*)::int AS "totalBets",
               coalesce(sum((doc->>'payout')::numeric) FILTER (WHERE doc->>'outcome' = 'win'), 0)::float8 AS "totalWon",
               coalesce(sum((doc->>'bet_amount')::numeric) FILTER (WHERE doc->>'outcome' = 'loss'), 0)::float8 AS "totalLost"
        FROM bets WHERE (doc->>'user_id')::bigint = (p.doc->>'id')::bigint
      ) totals
      ORDER BY (p.doc->>'balance')::numeric DESC, (p.doc->>'id')::bigint
    `);
    return result.rows;
  }

  async recentBets(limit: number) {
    const result = await connection().query(`
      SELECT b.doc->'id' AS id, b.doc->>'game' AS game, b.doc->'bet_amount' AS "betAmount",
             b.doc->>'outcome' AS outcome, b.doc->'payout' AS payout, b.doc->'multiplier' AS multiplier,
             b.doc->>'created_at' AS "createdAt", u.doc->>'team_name' AS "teamName"
      FROM (SELECT doc FROM bets ORDER BY doc->>'created_at' DESC LIMIT $1) b
      JOIN users u ON (u.doc->>'id')::bigint = (b.doc->>'user_id')::bigint
      ORDER BY b.doc->>'created_at' DESC
    `, [limit]);
    return result.rows;
  }

  collection<T = any>(name: string): Collection { return new Collection(name); }
}

async function getNextSequence(_database: Db, name: string): Promise<number> {
  const res = await connection().query(
    `INSERT INTO counters (name, seq) VALUES ($1, 1)
     ON CONFLICT (name) DO UPDATE SET seq = counters.seq + 1 RETURNING seq`, [name]);
  return Number(res.rows[0].seq);
}

async function connectAndInit(): Promise<Db> {
  if (!ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD must be configured before database initialization.');
  const p = getPool();
  const tables = ['counters', ...COLLECTIONS];
  const indexes = ['users_username_uq', 'users_id_uq', 'bets_user_idx', 'bets_created_idx', 'sessions_user_idx', 'settings_game_uq'];
  const schema = await p.query(`
    SELECT (SELECT count(*) FROM pg_class WHERE oid IN (SELECT to_regclass(name) FROM unnest($1::text[]) name)
            AND relrowsecurity) = cardinality($1::text[]) AND
           NOT EXISTS (SELECT 1 FROM unnest($2::text[]) name WHERE to_regclass(name) IS NULL) AS ready
  `, [tables, indexes]);
  if (!schema.rows[0].ready) {
    await inTransaction(async client => {
      // Serialize first-time setup across serverless instances.
      await client.query("SELECT pg_advisory_xact_lock(hashtext('gamearena-schema-init'))");
      await client.query('CREATE TABLE IF NOT EXISTS counters (name text PRIMARY KEY, seq bigint NOT NULL)');
      await client.query('ALTER TABLE counters ENABLE ROW LEVEL SECURITY');
      for (const c of COLLECTIONS) {
        await client.query(`CREATE TABLE IF NOT EXISTS ${c} (_id text PRIMARY KEY, doc jsonb NOT NULL)`);
        // Only the trusted server database role accesses these tables.
        // No browser Data API policies are granted.
        await client.query(`ALTER TABLE ${c} ENABLE ROW LEVEL SECURITY`);
      }
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq ON users ((doc->>'username'))`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_id_uq ON users (((doc->>'id')::bigint))`);
      await client.query(`CREATE INDEX IF NOT EXISTS bets_user_idx ON bets (((doc->>'user_id')::bigint))`);
      await client.query(`CREATE INDEX IF NOT EXISTS bets_created_idx ON bets ((doc->>'created_at'))`);
      await client.query(`CREATE INDEX IF NOT EXISTS sessions_user_idx ON game_sessions (((doc->>'user_id')::bigint))`);
      await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS settings_game_uq ON game_settings ((doc->>'game_name'))`);
    });
  }

  const newDb = new Db();
  const users = newDb.collection('users');

  // Seed admin account / keep password synced with ADMIN_PASSWORD
  const adminExists = await users.findOne({ username: 'admin' }) as any;
  if (adminExists && !(await bcrypt.compare(ADMIN_PASSWORD, adminExists.password_hash))) {
    await users.updateOne({ username: 'admin' }, { $set: { password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10) } });
  }
  if (!adminExists) {
    const serverSeed = generateServerSeed();
    const adminId = await getNextSequence(newDb, 'userId');
    try {
      await users.insertOne({
        id: adminId,
        username: 'admin',
        password_hash: await bcrypt.hash(ADMIN_PASSWORD, 10),
        team_name: 'Admin Team',
        balance: DEFAULT_STARTING_BALANCE,
        role: 'admin',
        client_seed: generateClientSeed(),
        server_seed: serverSeed,
        server_seed_hash: hashServerSeed(serverSeed),
        nonce: 0,
        created_at: new Date(),
      });
    } catch (e: any) {
      if (e.code !== '23505') throw e; // another instance created it first
    }
  }

  // Existing settings are read-only during cold starts.
  await p.query(`
    INSERT INTO game_settings (_id, doc)
    SELECT game, jsonb_build_object('game_name', game, 'is_active', true, 'min_bet', 1, 'max_bet', 1000000)
    FROM unnest($1::text[]) game
    WHERE NOT EXISTS (SELECT 1 FROM game_settings WHERE doc->>'game_name' = game)
    ON CONFLICT DO NOTHING
  `, [ALL_GAMES]);

  db = newDb;
  console.log('[Postgres] Connected and initialised');
  return newDb;
}

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (initPromise) return initPromise;
  initPromise = connectAndInit().catch((err) => {
    console.error('[Postgres] Init failed:', err.message);
    db = null;
    initPromise = null;
    throw err;
  });
  return initPromise;
}

export { getNextSequence };
export default getDb;
