import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';

// GET all recent bets across all users (for live ticker)
export async function GET(req: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const recentBets = db.prepare(`
      SELECT b.id, b.game, b.bet_amount as betAmount, b.outcome, b.payout, b.multiplier,
             b.created_at as createdAt, u.team_name as teamName
      FROM bets b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
      LIMIT ?
    `).all(limit);

    return NextResponse.json({ bets: recentBets });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
