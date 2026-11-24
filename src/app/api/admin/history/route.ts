import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET all bets (admin)
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();
    
    const { searchParams } = new URL(req.url);
    const game = searchParams.get('game');
    const limitRaw = parseInt(searchParams.get('limit') || '100');
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 100 : limitRaw), 200);
    const validGames = ['limbo', 'dice', 'mines', 'moles', 'wheel', 'plinko', 'keno'];
    const safeGame = game && validGames.includes(game) ? game : null;

    const matchStage: any = {};
    if (safeGame) {
      matchStage.game = safeGame;
    }

    const betsCol = db.collection('bets');
    const latest = await betsCol.find(matchStage, { sort: { created_at: -1 }, limit }).toArray();
    const owners = await db.collection('users').find({ id: { $in: [...new Set(latest.map((b: any) => b.user_id))] } }).toArray();
    const byId = new Map(owners.map((u: any) => [u.id, u]));
    const history = latest.filter((b: any) => byId.has(b.user_id)).map((b: any) => ({
      id: b.id, game: b.game, betAmount: b.bet_amount, outcome: b.outcome, payout: b.payout,
      multiplier: b.multiplier, createdAt: b.created_at,
      username: byId.get(b.user_id).username, teamName: byId.get(b.user_id).team_name,
    }));

    return NextResponse.json({ history });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
