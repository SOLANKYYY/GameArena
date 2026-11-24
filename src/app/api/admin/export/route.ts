import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET - export bet history as CSV
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();

    const betsCol = db.collection('bets');
    const raw = await betsCol.find({}, { sort: { created_at: -1 } }).toArray();
    const owners = await db.collection('users').find({}).toArray();
    const byId = new Map(owners.map((u: any) => [u.id, u]));
    const bets = raw.filter((b: any) => byId.has(b.user_id)).map((b: any) => ({
      ...b, team_name: byId.get(b.user_id).team_name, username: byId.get(b.user_id).username,
    }));

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
