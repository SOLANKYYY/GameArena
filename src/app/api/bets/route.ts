import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const db = await getDb();
    const betsCol = db.collection('bets');
    const bets = await betsCol
      .find({ user_id: user.userId })
      .sort({ created_at: -1 })
      .limit(20)
      .project({
        _id: 0,
        id: 1,
        game: 1,
        bet_amount: 1,
        outcome: 1,
        payout: 1,
        multiplier: 1,
        created_at: 1,
      })
      .toArray();

    // Map to camelCase for frontend compatibility
    const mapped = bets.map((b: any) => ({
      id: b.id,
      game: b.game,
      betAmount: b.bet_amount,
      outcome: b.outcome,
      payout: b.payout,
      multiplier: b.multiplier,
      createdAt: b.created_at,
    }));

    return NextResponse.json({ bets: mapped });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
