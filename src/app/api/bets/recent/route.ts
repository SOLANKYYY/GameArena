import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';

// GET all recent bets across all users (for live ticker)
export async function GET(req: NextRequest) {
  try {
    requireAuth(req); // Must be logged in
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const betsCol = db.collection('bets');
    const usersCol = db.collection('users');

    const latest = await betsCol.find({}, { sort: { created_at: -1 }, limit }).toArray();
    const owners = await usersCol.find({ id: { $in: [...new Set(latest.map((b: any) => b.user_id))] } }).toArray();
    const byId = new Map(owners.map((u: any) => [u.id, u]));
    const recentBets = latest.filter((b: any) => byId.has(b.user_id)).map((b: any) => ({
      id: b.id, game: b.game, betAmount: b.bet_amount, outcome: b.outcome, payout: b.payout,
      multiplier: b.multiplier, createdAt: b.created_at, teamName: byId.get(b.user_id).team_name,
    }));

    return NextResponse.json({ bets: recentBets });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
