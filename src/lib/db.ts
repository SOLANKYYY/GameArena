import { MongoClient, Db } from 'mongodb';
import bcrypt from 'bcryptjs';
import { DEFAULT_STARTING_BALANCE, ALL_GAMES } from './constants';
import { generateServerSeed, hashServerSeed, generateClientSeed } from './rng';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://hacktozite_db_user:WhatDaDogDoin%4001@gamearenainfinity.pxnwxf4.mongodb.net/?appName=GameArenaInfinity';
const DB_NAME = process.env.DB_NAME || 'GameArenaInfinity';

let client: MongoClient | null = null;
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

// Counter collection for auto-increment IDs
interface CounterDoc {
  _id: string;
  seq: number;
}

async function getNextSequence(database: Db, name: string): Promise<number> {
  const counters = database.collection<CounterDoc>('counters');
  const result = await counters.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  if (!result || typeof result.seq !== 'number') {
    throw new Error(`Failed to generate sequence for ${name}`);
  }
  return result.seq;
}

async function connectAndInit(): Promise<Db> {
  const newClient = new MongoClient(MONGODB_URI, {
    maxPoolSize: 50,
    minPoolSize: 5,
    maxIdleTimeMS: 60000,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
    retryWrites: true,
    retryReads: true,
    tls: true,
    tlsAllowInvalidCertificates: true,
  });

  // Monitor connection drops → reset cached state
  newClient.on('close', () => {
    console.warn('[MongoDB] Connection closed. Will reconnect on next request.');
    db = null;
    client = null;
    initPromise = null;
  });

  newClient.on('error', (err) => {
    console.error('[MongoDB] Connection error:', err.message);
    db = null;
    client = null;
    initPromise = null;
  });

  await newClient.connect();
  client = newClient;
  const newDb = newClient.db(DB_NAME);

  // Create indexes (idempotent)
  const users = newDb.collection<UserDoc>('users');
  const bets = newDb.collection<BetDoc>('bets');
  const gameSessions = newDb.collection<GameSessionDoc>('game_sessions');
  const gameSettings = newDb.collection<GameSettingDoc>('game_settings');

  await Promise.all([
    users.createIndex({ username: 1 }, { unique: true }),
    users.createIndex({ id: 1 }, { unique: true }),
    bets.createIndex({ user_id: 1, created_at: -1 }),
    bets.createIndex({ created_at: -1 }),
    bets.createIndex({ id: 1 }, { unique: true }),
    gameSessions.createIndex({ user_id: 1, game: 1 }),
    gameSessions.createIndex({ id: 1 }, { unique: true }),
    gameSettings.createIndex({ game_name: 1 }, { unique: true }),
  ]);

  // Seed admin account if not exists
  const adminExists = await users.findOne({ username: 'admin' });
  if (!adminExists) {
    const hash = bcrypt.hashSync('admin123', 10);
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();
    const adminId = await getNextSequence(newDb, 'userId');
    await users.insertOne({
      id: adminId,
      username: 'admin',
      password_hash: hash,
      team_name: 'Admin Team',
      balance: DEFAULT_STARTING_BALANCE,
      role: 'admin',
      client_seed: clientSeed,
      server_seed: serverSeed,
      server_seed_hash: hashServerSeed(serverSeed),
      nonce: 0,
      created_at: new Date(),
    });
  }

  // Ensure existing users have seeds
  const usersWithoutSeeds = await users.find({ server_seed: { $exists: false } }).toArray();
  for (const u of usersWithoutSeeds) {
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();
    await users.updateOne(
      { id: u.id },
      {
        $set: {
          client_seed: clientSeed,
          server_seed: serverSeed,
          server_seed_hash: hashServerSeed(serverSeed),
          nonce: 0,
        },
      }
    );
  }

  // Seed game settings for all 7 games
  for (const game of ALL_GAMES) {
    await gameSettings.updateOne(
      { game_name: game },
      {
        $setOnInsert: {
          game_name: game,
          is_active: true,
          min_bet: 1,
          max_bet: 1000000,
        },
      },
      { upsert: true }
    );
  }

  db = newDb;
  console.log(`[MongoDB] Connected to ${DB_NAME}`);
  return newDb;
}

export async function getDb(): Promise<Db> {
  // Fast path: return cached db if connection is alive
  if (db && client) {
    return db;
  }

  if (initPromise) return initPromise;

  // Reset initPromise on failure so future calls don't get a rejected promise forever
  initPromise = connectAndInit().catch((err) => {
    console.error('[MongoDB] Init failed:', err.message);
    db = null;
    client = null;
    initPromise = null;
    throw err;
  });

  return initPromise;
}

// Helper to get auto-increment ID
export { getNextSequence };

export default getDb;
