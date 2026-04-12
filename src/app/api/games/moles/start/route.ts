import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { generateFloats, generateMolePositions } from '@/lib/rng';
import { checkGameActive, checkRoundActive, deductBet, incrementNonce, refundBet } from '@/lib/gameHelper';
import getDb from '@/lib/db';
import crypto from 'crypto';
import { MOLES_HOLES, MOLES_MAX_ROUNDS_1_MOLE, MOLES_MAX_ROUNDS_2_6_MOLES } from '@/lib/constants';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { betAmount, moleCount } = body;

    if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
      return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
    }
    if (!moleCount || moleCount < 1 || moleCount > 6 || !Number.isInteger(moleCount)) {
      return NextResponse.json({ error: 'Mole count must be between 1 and 6' }, { status: 400 });
    }

    await checkGameActive('moles');
    await checkRoundActive(user.role);

    const db = await getDb();
    const users = db.collection('users');
    const gameSessions = db.collection('game_sessions');

    const dbUser = await users.findOne({ id: user.userId }) as any;
    if (!dbUser || dbUser.balance < betAmount) {
      return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
    }

    // Cancel existing active sessions
    const activeSessions = await gameSessions.find({ user_id: user.userId, game: 'moles', completed_at: null }).toArray();
    for (const s of activeSessions) {
      try {
        const st = JSON.parse(s.state as string);
        st.status = 'cancelled';
        await gameSessions.updateOne({ id: s.id }, { $set: { state: JSON.stringify(st), completed_at: new Date() } });
      } catch {
        await gameSessions.updateOne({ id: s.id }, { $set: { completed_at: new Date() } });
      }
    }

    const newBalance = await deductBet(user.userId, betAmount);

    const maxRounds = moleCount === 1 ? MOLES_MAX_ROUNDS_1_MOLE : MOLES_MAX_ROUNDS_2_6_MOLES;
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
      rounds,
      currentRound: 0,
      hits: 0,
      misses: 0,
      totalMoles: 0,
      serverSeed: dbUser.server_seed,
      clientSeed: dbUser.client_seed,
      nonce: dbUser.nonce,
    };

    // FIX #3: If session insert fails, refund the deducted bet
    try {
      await gameSessions.insertOne({
        id: sessionId,
        user_id: user.userId,
        game: 'moles',
        state: JSON.stringify(sessionState),
        bet_amount: betAmount,
        created_at: new Date(),
        completed_at: null,
      });
    } catch (insertErr) {
      await refundBet(user.userId, betAmount);
      throw new Error('Failed to create game session. Bet has been refunded.');
    }

    await incrementNonce(user.userId);

    return NextResponse.json({
      sessionId,
      betAmount,
      moleCount,
      maxRounds,
      newBalance,
      currentRound: 0,
      molePositions: rounds[0],
      totalHoles: MOLES_HOLES,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
