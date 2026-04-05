import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateMinePositions, generateFloats } from '@/lib/rng';
import { checkGameActive, deductBet, incrementNonce } from '@/lib/gameHelper';
import getDb from '@/lib/db';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { betAmount, numMines } = await req.json();

    if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
      return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
    }
    if (!numMines || numMines < 1 || numMines > 24 || !Number.isInteger(numMines)) {
      return NextResponse.json({ error: 'Number of mines must be between 1 and 24' }, { status: 400 });
    }

    checkGameActive('mines');

    const db = getDb();
    const dbUser = db.prepare('SELECT balance, server_seed, client_seed, nonce FROM users WHERE id = ?').get(user.userId) as any;
    if (!dbUser || dbUser.balance < betAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Cancel any existing active sessions
    db.prepare("UPDATE game_sessions SET completed_at = datetime('now'), state = json_set(state, '$.status', 'cancelled') WHERE user_id = ? AND game = 'mines' AND completed_at IS NULL")
      .run(user.userId);

    // Deduct bet amount
    const newBalance = deductBet(user.userId, betAmount);

    // Generate mine positions using provably fair RNG
    const floats = generateFloats(dbUser.server_seed, dbUser.client_seed, dbUser.nonce, 24);
    const minePositions = generateMinePositions(floats, numMines);
    const sessionId = crypto.randomUUID();

    // Store session in game_sessions table
    const sessionState = {
      status: 'active',
      betAmount,
      numMines,
      minePositions,
      revealedPositions: [],
      currentMultiplier: 1.0,
      serverSeed: dbUser.server_seed,
      clientSeed: dbUser.client_seed,
      nonce: dbUser.nonce,
    };

    db.prepare(
      'INSERT INTO game_sessions (id, user_id, game, state, bet_amount) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, user.userId, 'mines', JSON.stringify(sessionState), betAmount);

    incrementNonce(user.userId);

    return NextResponse.json({
      sessionId,
      numMines,
      betAmount,
      newBalance,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
