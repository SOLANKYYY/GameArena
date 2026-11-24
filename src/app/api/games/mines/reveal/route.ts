import { NextResponse } from 'next/server';
import { playerAction } from '@/lib/playerAction';
import { calculateMinesMultiplier } from '@/lib/constants';
import getDb, { getNextSequence } from '@/lib/db';

export const POST = playerAction(async (user, body) => {
  const { sessionId, position } = body;

  if (position === undefined || position < 0 || position > 24 || !Number.isInteger(position)) {
    return NextResponse.json({ error: 'Invalid position (must be 0-24)' }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const db = await getDb();
  const gameSessions = db.collection('game_sessions');
  const users = db.collection('users');
  const betsCol = db.collection('bets');

  const session = await gameSessions.findOne({
    id: sessionId,
    user_id: user.userId,
    game: 'mines',
    completed_at: null,
  }) as any;

  if (!session) {
    return NextResponse.json({ error: 'No active session found' }, { status: 404 });
  }

  let state: any;
  try {
    state = JSON.parse(session.state);
  } catch {
    return NextResponse.json({ error: 'Corrupted session state' }, { status: 500 });
  }
  const minePositions: number[] = state.minePositions;
  const revealedPositions: number[] = state.revealedPositions;

  if (revealedPositions.includes(position)) {
    return NextResponse.json({ error: 'Tile already revealed' }, { status: 400 });
  }

  const isMine = minePositions.includes(position);
  revealedPositions.push(position);

  if (isMine) {
    // Busted!
    state.status = 'busted';
    state.revealedPositions = revealedPositions;

    await gameSessions.updateOne(
      { id: sessionId },
      { $set: { state: JSON.stringify(state), completed_at: new Date() } }
    );

    // Record bet as loss
    const betId = await getNextSequence(db, 'betId');
    await betsCol.insertOne({
      id: betId,
      user_id: user.userId,
      game: 'mines',
      bet_amount: state.betAmount,
      outcome: 'loss',
      payout: 0,
      multiplier: 0,
      details: JSON.stringify({ numMines: state.numMines, revealedCount: revealedPositions.length - 1 }),
      server_seed: state.serverSeed,
      client_seed: state.clientSeed,
      nonce: state.nonce,
      created_at: new Date(),
    });

    // FIX #5: Null guard on user lookup
    const dbUser = await users.findOne({ id: user.userId }) as any;
    const currentBalance = dbUser?.balance ?? 0;

    return NextResponse.json({
      isMine: true,
      minePositions,
      revealedPositions,
      newBalance: currentBalance,
      payout: 0,
    });
  } else {
    // Safe tile
    const safeRevealed = revealedPositions.filter(p => !minePositions.includes(p));
    const newMultiplier = calculateMinesMultiplier(state.numMines, safeRevealed.length);

    state.revealedPositions = revealedPositions;
    state.currentMultiplier = newMultiplier;

    await gameSessions.updateOne(
      { id: sessionId },
      { $set: { state: JSON.stringify(state) } }
    );

    // FIX #5: Null guard on user lookup
    const dbUser = await users.findOne({ id: user.userId }) as any;
    const currentBalance = dbUser?.balance ?? 0;
    const safeTilesLeft = 25 - state.numMines - safeRevealed.length;

    return NextResponse.json({
      isMine: false,
      position,
      revealedPositions,
      currentMultiplier: newMultiplier,
      potentialPayout: Math.round(state.betAmount * newMultiplier * 100) / 100,
      safeTilesLeft,
      newBalance: currentBalance,
    });
  }
});
