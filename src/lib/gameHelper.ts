import getDb, { getNextSequence } from './db';
import { generateFloats } from './rng';

/**
 * Shared helper for provably fair game transactions.
 * Handles: balance check, seed management, nonce increment, bet recording, atomic transactions.
 * All operations are async for MongoDB compatibility.
 *
 * HARDENED: Uses atomic findOneAndUpdate with balance floor guards to prevent
 * race conditions that could allow negative balances.
 */

export interface GameContext {
  userId: number;
  balance: number;
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  floats: number[];
}

/** Get user's current game context (balance + seeds), generate floats */
export async function getGameContext(userId: number, floatCount: number): Promise<GameContext> {
  const db = await getDb();
  const users = db.collection('users');
  const user = await users.findOne({ id: userId });
  if (!user) throw new Error('User not found');

  const floats = generateFloats(user.server_seed, user.client_seed, user.nonce, floatCount);

  return {
    userId,
    balance: user.balance,
    serverSeed: user.server_seed,
    clientSeed: user.client_seed,
    nonce: user.nonce,
    floats,
  };
}

/** Check if a game is enabled */
export async function checkGameActive(gameName: string): Promise<void> {
  const db = await getDb();
  const gameSettings = db.collection('game_settings');
  const game = await gameSettings.findOne({ game_name: gameName });
  if (!game?.is_active) throw new Error(`${gameName} is currently disabled`);
}

/** Check if a round is currently active (admin must start a timer). Admin users bypass this check. */
export async function checkRoundActive(userRole?: string): Promise<void> {
  if (userRole === 'admin') return; // Admin can always play
  const db = await getDb();
  const roundConfig = db.collection('round_config');
  const current = await roundConfig.findOne({ _id: 'current_round' as any });
  if (!current || !current.is_active) {
    throw new Error('No active round. Please wait for the admin to start a round.');
  }
  // Check if timer has expired
  if (current.ends_at && new Date(current.ends_at).getTime() < Date.now()) {
    throw new Error('The current round has ended. Please wait for the next round.');
  }
}

/** Validate bet amount against balance and game limits */
export async function validateBet(betAmount: number, balance: number, gameName: string): Promise<void> {
  if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
    throw new Error('Invalid bet amount');
  }
  const db = await getDb();
  const gameSettings = db.collection('game_settings');
  const settings = await gameSettings.findOne({ game_name: gameName });
  if (settings) {
    if (betAmount < settings.min_bet) throw new Error(`Minimum bet is ${settings.min_bet}`);
    if (betAmount > settings.max_bet) throw new Error(`Maximum bet is ${settings.max_bet}`);
  }
  if (betAmount > balance) throw new Error('Insufficient balance');
}

export interface BetResult {
  outcome: 'win' | 'loss';
  payout: number;
  multiplier: number;
  details: string;
  newBalance: number;
}

/**
 * Record a bet and update balance atomically.
 * Uses findOneAndUpdate with balance floor guard to prevent race conditions.
 */
export async function recordBet(
  ctx: GameContext,
  gameName: string,
  betAmount: number,
  outcome: 'win' | 'loss',
  payout: number,
  multiplier: number,
  details: object
): Promise<{ newBalance: number }> {
  const db = await getDb();
  const users = db.collection('users');
  const bets = db.collection('bets');

  const balanceChange = outcome === 'win' ? payout - betAmount : -betAmount;

  // FIX #2: Atomic balance update with floor guard — prevents concurrent bets
  // from both passing the balance check and going negative.
  const updateResult = await users.findOneAndUpdate(
    {
      id: ctx.userId,
      // Only allow update if balance can cover the bet (or if it's a win that adds funds)
      ...(balanceChange < 0 ? { balance: { $gte: betAmount } } : {}),
    },
    {
      $inc: { balance: Math.round(balanceChange * 100) / 100, nonce: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!updateResult) {
    throw new Error('Insufficient balance');
  }

  // Round the final balance to avoid floating point drift
  const finalBalance = Math.round(updateResult.balance * 100) / 100;
  if (finalBalance !== updateResult.balance) {
    await users.updateOne({ id: ctx.userId }, { $set: { balance: finalBalance } });
  }

  const betId = await getNextSequence(db, 'betId');

  await bets.insertOne({
    id: betId,
    user_id: ctx.userId,
    game: gameName,
    bet_amount: betAmount,
    outcome,
    payout,
    multiplier,
    details: JSON.stringify(details),
    server_seed: ctx.serverSeed,
    client_seed: ctx.clientSeed,
    nonce: ctx.nonce,
    created_at: new Date(),
  });

  return { newBalance: finalBalance };
}

/**
 * Deduct bet from balance atomically (for session-based games like Mines).
 * FIX #2: Uses findOneAndUpdate with balance floor guard.
 */
export async function deductBet(userId: number, betAmount: number): Promise<number> {
  const db = await getDb();
  const users = db.collection('users');

  const result = await users.findOneAndUpdate(
    { id: userId, balance: { $gte: betAmount } },
    { $inc: { balance: -Math.round(betAmount * 100) / 100 } },
    { returnDocument: 'after' }
  );

  if (!result) {
    throw new Error('Insufficient balance');
  }

  const newBalance = Math.round(result.balance * 100) / 100;
  if (newBalance !== result.balance) {
    await users.updateOne({ id: userId }, { $set: { balance: newBalance } });
  }
  return newBalance;
}

/** Credit payout to user — atomic increment, safe even if called concurrently */
export async function creditPayout(userId: number, payout: number): Promise<number> {
  const db = await getDb();
  const users = db.collection('users');

  const result = await users.findOneAndUpdate(
    { id: userId },
    { $inc: { balance: Math.round(payout * 100) / 100, nonce: 1 } },
    { returnDocument: 'after' }
  );

  if (!result) throw new Error('User not found');
  const newBalance = Math.round(result.balance * 100) / 100;
  if (newBalance !== result.balance) {
    await users.updateOne({ id: userId }, { $set: { balance: newBalance } });
  }
  return newBalance;
}

/** Increment nonce only */
export async function incrementNonce(userId: number): Promise<void> {
  const db = await getDb();
  const users = db.collection('users');
  await users.updateOne({ id: userId }, { $inc: { nonce: 1 } });
}
