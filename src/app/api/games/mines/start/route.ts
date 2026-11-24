import { NextResponse } from 'next/server';
import { playerAction } from '@/lib/playerAction';
import { generateMinePositions, generateFloats } from '@/lib/rng';
import { checkGameActive, checkRoundActive, deductBet, incrementNonce } from '@/lib/gameHelper';
import getDb from '@/lib/db';
import crypto from 'crypto';

export const POST = playerAction(async (user, body) => {
  const { betAmount, numMines } = body;

  if (!betAmount || betAmount <= 0 || !Number.isFinite(betAmount)) {
    return NextResponse.json({ error: 'Invalid bet amount' }, { status: 400 });
  }
  if (!numMines || numMines < 1 || numMines > 24 || !Number.isInteger(numMines)) {
    return NextResponse.json({ error: 'Number of mines must be between 1 and 24' }, { status: 400 });
  }

  await checkGameActive('mines');
  await checkRoundActive(user.role);

  const db = await getDb();
  const users = db.collection('users');
  const gameSessions = db.collection('game_sessions');

  const dbUser = await users.findOne({ id: user.userId }) as any;
  if (!dbUser || dbUser.balance < betAmount) {
    return NextResponse.json({ error: 'Insufficient balance' }, { status: 400 });
  }

  // Cancel any existing active sessions
  const activeSessions = await gameSessions.find({ user_id: user.userId, game: 'mines', completed_at: null }).toArray();
  for (const s of activeSessions) {
    try {
      const st = JSON.parse(s.state as string);
      st.status = 'cancelled';
      await gameSessions.updateOne({ id: s.id }, { $set: { state: JSON.stringify(st), completed_at: new Date() } });
    } catch {
      // If state JSON is corrupt, just close the session
      await gameSessions.updateOne({ id: s.id }, { $set: { completed_at: new Date() } });
    }
  }

  // Deduct bet amount (atomic — will throw if insufficient balance)
  const newBalance = await deductBet(user.userId, betAmount);

  // Generate mine positions using provably fair RNG
  const floats = generateFloats(dbUser.server_seed, dbUser.client_seed, dbUser.nonce, 24);
  const minePositions = generateMinePositions(floats, numMines);
  const sessionId = crypto.randomUUID();

  // Store session in game_sessions collection
  const sessionState = {
    status: 'active',
    betAmount,
    numMines,
    minePositions,
    revealedPositions: [] as number[],
    currentMultiplier: 1.0,
    serverSeed: dbUser.server_seed,
    clientSeed: dbUser.client_seed,
    nonce: dbUser.nonce,
  };

  await gameSessions.insertOne({
    id: sessionId,
    user_id: user.userId,
    game: 'mines',
    state: JSON.stringify(sessionState),
    bet_amount: betAmount,
    created_at: new Date(),
    completed_at: null,
  });

  await incrementNonce(user.userId);

  return NextResponse.json({
    sessionId,
    numMines,
    betAmount,
    newBalance,
  });
});
