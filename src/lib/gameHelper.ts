import getDb from './db';
import { generateServerSeed, hashServerSeed, generateFloats } from './rng';

/**
 * Shared helper for provably fair game transactions.
 * Handles: balance check, seed management, nonce increment, bet recording, atomic transactions.
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
export function getGameContext(userId: number, floatCount: number): GameContext {
  const db = getDb();
  const user = db.prepare('SELECT balance, server_seed, client_seed, nonce FROM users WHERE id = ?').get(userId) as any;
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
export function checkGameActive(gameName: string): void {
  const db = getDb();
  const game = db.prepare('SELECT is_active FROM game_settings WHERE game_name = ?').get(gameName) as any;
  if (!game?.is_active) throw new Error(`${gameName} is currently disabled`);
}

/** Validate bet amount against balance and game limits */
export function validateBet(betAmount: number, balance: number, gameName: string): void {
  if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
    throw new Error('Invalid bet amount');
  }
  const db = getDb();
  const settings = db.prepare('SELECT min_bet, max_bet FROM game_settings WHERE game_name = ?').get(gameName) as any;
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

/** Record a bet and update balance atomically using a transaction */
export function recordBet(
  ctx: GameContext,
  gameName: string,
  betAmount: number,
  outcome: 'win' | 'loss',
  payout: number,
  multiplier: number,
  details: object
): { newBalance: number } {
  const db = getDb();

  const balanceChange = outcome === 'win' ? payout - betAmount : -betAmount;
  const newBalance = Math.round((ctx.balance + balanceChange) * 100) / 100;

  const txn = db.transaction(() => {
    // Re-check balance inside transaction to prevent race conditions
    const currentUser = db.prepare('SELECT balance FROM users WHERE id = ?').get(ctx.userId) as any;
    if (currentUser.balance < betAmount && outcome !== 'win') {
      throw new Error('Insufficient balance (race condition)');
    }

    const finalBalance = Math.round((currentUser.balance + balanceChange) * 100) / 100;

    db.prepare('UPDATE users SET balance = ?, nonce = nonce + 1 WHERE id = ?')
      .run(finalBalance, ctx.userId);

    db.prepare(
      'INSERT INTO bets (user_id, game, bet_amount, outcome, payout, multiplier, details, server_seed, client_seed, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      ctx.userId, gameName, betAmount, outcome, payout, multiplier,
      JSON.stringify(details), ctx.serverSeed, ctx.clientSeed, ctx.nonce
    );

    return finalBalance;
  });

  const finalBalance = txn();
  return { newBalance: finalBalance };
}

/** Deduct bet from balance atomically (for session-based games like Mines) */
export function deductBet(userId: number, betAmount: number): number {
  const db = getDb();
  const txn = db.transaction(() => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as any;
    if (!user || user.balance < betAmount) throw new Error('Insufficient balance');
    const newBalance = Math.round((user.balance - betAmount) * 100) / 100;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
    return newBalance;
  });
  return txn();
}

/** Credit payout to user */
export function creditPayout(userId: number, payout: number): number {
  const db = getDb();
  const txn = db.transaction(() => {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as any;
    const newBalance = Math.round((user.balance + payout) * 100) / 100;
    db.prepare('UPDATE users SET balance = ?, nonce = nonce + 1 WHERE id = ?').run(newBalance, userId);
    return newBalance;
  });
  return txn();
}

/** Increment nonce only */
export function incrementNonce(userId: number): void {
  const db = getDb();
  db.prepare('UPDATE users SET nonce = nonce + 1 WHERE id = ?').run(userId);
}
