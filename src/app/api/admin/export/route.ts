import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET - export bet history as CSV
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();

    const betsCol = db.collection('bets');
    const bets = await betsCol
      .aggregate([
        { $sort: { created_at: -1 } },
        {
          $lookup: {
            from: 'users',
            localField: 'user_id',
            foreignField: 'id',
            as: 'user',
          },
        },
        { $unwind: '$user' },
        {
          $project: {
            _id: 0,
            id: 1,
            team_name: '$user.team_name',
            username: '$user.username',
            game: 1,
            bet_amount: 1,
            outcome: 1,
            payout: 1,
            multiplier: 1,
            created_at: 1,
          },
        },
      ])
      .toArray();

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
