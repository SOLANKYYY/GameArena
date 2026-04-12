import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET leaderboard - accessible to all authenticated users
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const db = await getDb();
    const users = db.collection('users');
    const betsCol = db.collection('bets');

    // Run two fast queries in parallel instead of one expensive $lookup
    const [playerList, betStats] = await Promise.all([
      // 1. Fast indexed query — just get players sorted by balance
      users
        .find({ role: 'player' }, {
          projection: { _id: 0, id: 1, username: 1, team_name: 1, balance: 1 },
          sort: { balance: -1 },
          limit: 50,
        })
        .toArray(),

      // 2. Single aggregation on bets — group by user_id (uses user_id index)
      betsCol
        .aggregate([
          {
            $group: {
              _id: '$user_id',
              totalBets: { $sum: 1 },
              totalWon: { $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, '$payout', 0] } },
              totalLost: { $sum: { $cond: [{ $eq: ['$outcome', 'loss'] }, '$bet_amount', 0] } },
            },
          },
        ])
        .toArray(),
    ]);

    // Merge in JS (O(n) with Map — faster than per-user $lookup)
    const statsMap = new Map(betStats.map((s: any) => [s._id, s]));

    const leaderboard = playerList.map((p: any) => {
      const s = statsMap.get(p.id);
      return {
        id: p.id,
        username: p.username,
        teamName: p.team_name,
        balance: p.balance,
        totalBets: s?.totalBets || 0,
        totalWon: s?.totalWon || 0,
        totalLost: s?.totalLost || 0,
      };
    });

    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

