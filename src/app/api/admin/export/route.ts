import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET - export bet history as CSV
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();

    const bets = db.prepare(`
      SELECT b.id, u.team_name, u.username, b.game, b.bet_amount, b.outcome, b.payout, b.multiplier, b.created_at
      FROM bets b
      JOIN users u ON b.user_id = u.id
      ORDER BY b.created_at DESC
    `).all() as any[];

    // Build CSV
    const headers = ['ID', 'Team', 'Username', 'Game', 'Bet Amount', 'Outcome', 'Payout', 'Multiplier', 'Time'];
    const rows = bets.map((b: any) =>
      [b.id, b.team_name, b.username, b.game, b.bet_amount, b.outcome, b.payout, b.multiplier, b.created_at].join(',')
    );
    const csv = [headers.join(','), ...rows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="bet_history.csv"',
      },
    });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
