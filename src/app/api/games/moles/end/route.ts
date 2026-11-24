import { NextResponse } from 'next/server';
import { playerAction } from '@/lib/playerAction';
import getDb, { getNextSequence } from '@/lib/db';
import { MOLES_HOLES } from '@/lib/constants';

// POST - report round result and get next round, or end game
export const POST = playerAction(async (user, body) => {
  const { sessionId, action } = body;
  const roundHits = Number.isInteger(body.roundHits) && body.roundHits >= 0 ? body.roundHits : 0;
  const roundMisses = Number.isInteger(body.roundMisses) && body.roundMisses >= 0 ? body.roundMisses : 0;
  void roundMisses; // derived server-side anyway

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 });
  }

  const db = await getDb();
  const gameSessions = db.collection('game_sessions');

  const session = await gameSessions.findOne({
    id: sessionId,
    user_id: user.userId,
    game: 'moles',
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

  if (action === 'round_complete') {
    // Record round results
    const hits = Math.min(roundHits || 0, state.moleCount);
    const misses = Math.max(0, state.moleCount - hits);

    state.hits += hits;
    state.misses += misses;
    state.totalMoles += state.moleCount;
    state.currentRound++;

    // Check if game is over
    if (state.currentRound >= state.maxRounds) {
      return await finalizeGame(db, session, state, user.userId);
    }

    // Save state and send next round
    await gameSessions.updateOne(
      { id: sessionId },
      { $set: { state: JSON.stringify(state) } }
    );

    return NextResponse.json({
      action: 'next_round',
      currentRound: state.currentRound,
      molePositions: state.rounds[state.currentRound],
      hits: state.hits,
      misses: state.misses,
      totalMoles: state.totalMoles,
      roundsLeft: state.maxRounds - state.currentRound,
      totalHoles: MOLES_HOLES,
    });
  }

  if (action === 'end') {
    return await finalizeGame(db, session, state, user.userId);
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
});

async function finalizeGame(db: any, session: any, state: any, userId: number) {
  const gameSessions = db.collection('game_sessions');
  const users = db.collection('users');
  const betsCol = db.collection('bets');

  const hitRate = state.totalMoles > 0 ? (state.hits / state.totalMoles) * 100 : 0;

  let multiplier = 0;
  let outcome: 'win' | 'loss' = 'loss';

  if (hitRate >= 90) {
    multiplier = 3.0;
    outcome = 'win';
  } else if (hitRate >= 70) {
    multiplier = 2.0;
    outcome = 'win';
  } else if (hitRate >= 50) {
    multiplier = 1.5;
    outcome = 'win';
  }

  const payout = outcome === 'win' ? Math.round(state.betAmount * multiplier * 100) / 100 : 0;
  state.status = 'finished';

  // FIX #4: Credit payout BEFORE closing session (if it's a win)
  if (payout > 0) {
    await users.findOneAndUpdate(
      { id: userId },
      { $inc: { balance: Math.round(payout * 100) / 100 } },
    );
  }

  // Close session only after payout is secured
  await gameSessions.updateOne(
    { id: session.id },
    { $set: { state: JSON.stringify(state), completed_at: new Date() } }
  );

  const betId = await getNextSequence(db, 'betId');
  await betsCol.insertOne({
    id: betId,
    user_id: userId,
    game: 'moles',
    bet_amount: state.betAmount,
    outcome,
    payout,
    multiplier,
    details: JSON.stringify({ hits: state.hits, misses: state.misses, totalMoles: state.totalMoles, hitRate: Math.round(hitRate * 10) / 10, moleCount: state.moleCount }),
    server_seed: state.serverSeed,
    client_seed: state.clientSeed,
    nonce: state.nonce,
    created_at: new Date(),
  });

  // FIX #5: Null-safe balance fetch
  const result = await users.findOne({ id: userId }) as any;
  const finalBalance = result?.balance ?? 0;

  return NextResponse.json({
    action: 'game_over',
    outcome,
    hitRate: Math.round(hitRate * 10) / 10,
    multiplier,
    payout,
    newBalance: finalBalance,
    totalMoles: state.totalMoles,
    hits: state.hits,
    misses: state.misses,
  });
}
