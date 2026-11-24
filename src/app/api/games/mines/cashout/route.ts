import { NextResponse } from 'next/server';
import { playerAction } from '@/lib/playerAction';
import { creditPayout } from '@/lib/gameHelper';
import getDb, { getNextSequence } from '@/lib/db';

export const POST = playerAction(async (user, body) => {
  const { sessionId } = body;

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const db = await getDb();
  const gameSessions = db.collection('game_sessions');
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

  // FIX #6: try-catch on JSON.parse
  let state: any;
  try {
    state = JSON.parse(session.state);
  } catch {
    return NextResponse.json({ error: 'Corrupted session state' }, { status: 500 });
  }

  const revealedSafe = state.revealedPositions.filter((p: number) => !state.minePositions.includes(p));

  if (revealedSafe.length === 0) {
    return NextResponse.json({ error: 'Must reveal at least one tile before cashing out' }, { status: 400 });
  }

  const payout = Math.round(state.betAmount * state.currentMultiplier * 100) / 100;

  // FIX #4: Credit payout BEFORE closing the session.
  // If credit fails, the session stays open and user can retry.
  const newBalance = await creditPayout(user.userId, payout);

  // Only close session after payout is confirmed
  state.status = 'cashed_out';
  await gameSessions.updateOne(
    { id: sessionId },
    { $set: { state: JSON.stringify(state), completed_at: new Date() } }
  );

  // Record bet as win
  const betId = await getNextSequence(db, 'betId');
  await betsCol.insertOne({
    id: betId,
    user_id: user.userId,
    game: 'mines',
    bet_amount: state.betAmount,
    outcome: 'win',
    payout,
    multiplier: state.currentMultiplier,
    details: JSON.stringify({ numMines: state.numMines, revealedCount: revealedSafe.length }),
    server_seed: state.serverSeed,
    client_seed: state.clientSeed,
    nonce: state.nonce,
    created_at: new Date(),
  });

  return NextResponse.json({
    payout,
    multiplier: state.currentMultiplier,
    newBalance,
    minePositions: state.minePositions,
  });
});
