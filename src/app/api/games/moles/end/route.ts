import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';
import { MOLES_HOLES } from '@/lib/constants';

// POST - report round result and get next round, or end game
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const body = await req.json();
    const { sessionId, action } = body;
    const roundHits = Number.isInteger(body.roundHits) && body.roundHits >= 0 ? body.roundHits : 0;
    const roundMisses = Number.isInteger(body.roundMisses) && body.roundMisses >= 0 ? body.roundMisses : 0;
    void roundMisses; // derived server-side anyway

    const db = getDb();
    const session = db.prepare(
      "SELECT * FROM game_sessions WHERE id = ? AND user_id = ? AND game = 'moles' AND completed_at IS NULL"
    ).get(sessionId, user.userId) as any;

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
        return finalizeGame(db, session, state, user.userId);
      }

      // Save state and send next round
      db.prepare('UPDATE game_sessions SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), sessionId);

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
      // Player ends early or time ran out
      return finalizeGame(db, session, state, user.userId);
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

function finalizeGame(db: any, session: any, state: any, userId: number) {
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

  const txn = db.transaction(() => {
    db.prepare("UPDATE game_sessions SET state = ?, completed_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(state), session.id);

    if (payout > 0) {
      const dbUser = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as any;
      const newBalance = Math.round((dbUser.balance + payout) * 100) / 100;
      db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);
    }

    db.prepare(
      'INSERT INTO bets (user_id, game, bet_amount, outcome, payout, multiplier, details, server_seed, client_seed, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(userId, 'moles', state.betAmount, outcome, payout, multiplier,
      JSON.stringify({ hits: state.hits, misses: state.misses, totalMoles: state.totalMoles, hitRate: Math.round(hitRate * 10) / 10, moleCount: state.moleCount }),
      state.serverSeed, state.clientSeed, state.nonce);

    return db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as any;
  });

  const result = txn();

  return NextResponse.json({
    action: 'game_over',
    outcome,
    hitRate: Math.round(hitRate * 10) / 10,
    multiplier,
    payout,
    newBalance: result.balance,
    totalMoles: state.totalMoles,
    hits: state.hits,
    misses: state.misses,
  });
}
