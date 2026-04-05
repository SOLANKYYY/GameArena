import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { calculateMinesMultiplier } from '@/lib/constants';
import getDb from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { sessionId, position } = await req.json();

    if (position === undefined || position < 0 || position > 24 || !Number.isInteger(position)) {
      return NextResponse.json({ error: 'Invalid position (must be 0-24)' }, { status: 400 });
    }

    const db = getDb();
    const session = db.prepare(
      "SELECT * FROM game_sessions WHERE id = ? AND user_id = ? AND game = 'mines' AND completed_at IS NULL"
    ).get(sessionId, user.userId) as any;

    if (!session) {
      return NextResponse.json({ error: 'No active session found' }, { status: 404 });
    }

    const state = JSON.parse(session.state);
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

      db.prepare("UPDATE game_sessions SET state = ?, completed_at = datetime('now') WHERE id = ?")
        .run(JSON.stringify(state), sessionId);

      // Record bet as loss
      db.prepare(
        'INSERT INTO bets (user_id, game, bet_amount, outcome, payout, multiplier, details, server_seed, client_seed, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(user.userId, 'mines', state.betAmount, 'loss', 0, 0,
        JSON.stringify({ numMines: state.numMines, revealedCount: revealedPositions.length - 1 }),
        state.serverSeed, state.clientSeed, state.nonce);

      const dbUser = db.prepare('SELECT balance FROM users WHERE id = ?').get(user.userId) as any;

      return NextResponse.json({
        isMine: true,
        minePositions,
        revealedPositions,
        newBalance: dbUser.balance,
        payout: 0,
      });
    } else {
      // Safe tile
      const safeRevealed = revealedPositions.filter(p => !minePositions.includes(p));
      const newMultiplier = calculateMinesMultiplier(state.numMines, safeRevealed.length);

      state.revealedPositions = revealedPositions;
      state.currentMultiplier = newMultiplier;

      db.prepare('UPDATE game_sessions SET state = ? WHERE id = ?')
        .run(JSON.stringify(state), sessionId);

      const dbUser = db.prepare('SELECT balance FROM users WHERE id = ?').get(user.userId) as any;
      const safeTilesLeft = 25 - state.numMines - safeRevealed.length;

      return NextResponse.json({
        isMine: false,
        position,
        revealedPositions,
        currentMultiplier: newMultiplier,
        potentialPayout: Math.round(state.betAmount * newMultiplier * 100) / 100,
        safeTilesLeft,
        newBalance: dbUser.balance,
      });
    }
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
