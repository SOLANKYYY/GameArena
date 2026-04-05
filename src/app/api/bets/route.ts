import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const db = getDb();
    const bets = db.prepare(
      'SELECT b.id, b.game, b.bet_amount as betAmount, b.outcome, b.payout, b.multiplier, b.created_at as createdAt FROM bets b WHERE b.user_id = ? ORDER BY b.created_at DESC LIMIT 20'
    ).all(user.userId);

    return NextResponse.json({ bets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
