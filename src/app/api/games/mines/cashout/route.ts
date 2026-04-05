import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { creditPayout } from '@/lib/gameHelper';
import getDb from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { sessionId } = await req.json();

    const db = getDb();
    const session = db.prepare(
      "SELECT * FROM game_sessions WHERE id = ? AND user_id = ? AND game = 'mines' AND completed_at IS NULL"
    ).get(sessionId, user.userId) as any;

    if (!session) {
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    const state = JSON.parse(session.state);
    const revealedSafe = state.revealedPositions.filter((p: number) => !state.minePositions.includes(p));

    if (revealedSafe.length === 0) {
      return NextResponse.json({ error: 'Must reveal at least one tile before cashing out' }, { status: 400 });
    }

    const payout = Math.round(state.betAmount * state.currentMultiplier * 100) / 100;

    // Cash out
    state.status = 'cashed_out';

    db.prepare("UPDATE game_sessions SET state = ?, completed_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(state), sessionId);

    const newBalance = creditPayout(user.userId, payout);

    // Record bet as win
    db.prepare(
      'INSERT INTO bets (user_id, game, bet_amount, outcome, payout, multiplier, details, server_seed, client_seed, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(user.userId, 'mines', state.betAmount, 'win', payout, state.currentMultiplier,
      JSON.stringify({ numMines: state.numMines, revealedCount: revealedSafe.length }),
      state.serverSeed, state.clientSeed, state.nonce);

    return NextResponse.json({
      payout,
      multiplier: state.currentMultiplier,
      newBalance,
      minePositions: state.minePositions,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
