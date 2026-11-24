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
    const playerList = await users
      .find({ role: 'player' }, { sort: { balance: -1 }, limit: 50 })
      .toArray();
    const allBets = await betsCol.find({ user_id: { $in: playerList.map((p: any) => p.id) } }).toArray();
    const statsMap = new Map<number, any>();
    for (const b of allBets as any[]) {
      const s = statsMap.get(b.user_id) || { totalBets: 0, totalWon: 0, totalLost: 0 };
      s.totalBets += 1;
      if (b.outcome === 'win') s.totalWon += b.payout; else if (b.outcome === 'loss') s.totalLost += b.bet_amount;
      statsMap.set(b.user_id, s);
    }

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

