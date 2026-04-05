import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateFloats, generateMolePositions } from '@/lib/rng';
import { checkGameActive, deductBet, incrementNonce } from '@/lib/gameHelper';
import getDb from '@/lib/db';
import crypto from 'crypto';
import { MOLES_HOLES, MOLES_MAX_ROUNDS_1_MOLE, MOLES_MAX_ROUNDS_2_6_MOLES } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { betAmount, moleCount } = await req.json();

    if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
      return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
    }
    if (!moleCount || moleCount < 1 || moleCount > 6 || !Number.isInteger(moleCount)) {
      return NextResponse.json({ error: 'Mole count must be between 1 and 6' }, { status: 400 });
    }

    checkGameActive('moles');

    const db = getDb();
    const dbUser = db.prepare('SELECT balance, server_seed, client_seed, nonce FROM users WHERE id = ?').get(user.userId) as any;
    if (!dbUser || dbUser.balance < betAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Cancel existing active sessions
    db.prepare("UPDATE game_sessions SET completed_at = datetime('now'), state = json_set(state, '$.status', 'cancelled') WHERE user_id = ? AND game = 'moles' AND completed_at IS NULL")
      .run(user.userId);

    const newBalance = deductBet(user.userId, betAmount);

    const maxRounds = moleCount === 1 ? MOLES_MAX_ROUNDS_1_MOLE : MOLES_MAX_ROUNDS_2_6_MOLES;
    // Pre-generate all rounds' mole positions
    const totalFloatsNeeded = maxRounds * moleCount;
    const floats = generateFloats(dbUser.server_seed, dbUser.client_seed, dbUser.nonce, totalFloatsNeeded);

    const rounds: number[][] = [];
    for (let r = 0; r < maxRounds; r++) {
      const roundFloats = floats.slice(r * moleCount, (r + 1) * moleCount);
      rounds.push(generateMolePositions(roundFloats, moleCount));
    }

    const sessionId = crypto.randomUUID();
    const sessionState = {
      status: 'active',
      betAmount,
      moleCount,
      maxRounds,
      rounds, // Pre-generated mole positions per round
      currentRound: 0,
      hits: 0,
      misses: 0,
      totalMoles: 0,
      serverSeed: dbUser.server_seed,
      clientSeed: dbUser.client_seed,
      nonce: dbUser.nonce,
    };

    db.prepare(
      'INSERT INTO game_sessions (id, user_id, game, state, bet_amount) VALUES (?, ?, ?, ?, ?)'
    ).run(sessionId, user.userId, 'moles', JSON.stringify(sessionState), betAmount);

    incrementNonce(user.userId);

    return NextResponse.json({
      sessionId,
      betAmount,
      moleCount,
      maxRounds,
      newBalance,
      // Send first round's mole positions
      currentRound: 0,
      molePositions: rounds[0],
      totalHoles: MOLES_HOLES,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
