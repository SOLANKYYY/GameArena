import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET - admin stats + live sessions
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'stats';

    if (type === 'sessions') {
      // Live active sessions for Mines/Moles
      const gameSessions = db.collection('game_sessions');
      const open = await gameSessions.find({ completed_at: null }).toArray();
      const owners = await db.collection('users').find({ id: { $in: [...new Set(open.map((s: any) => s.user_id))] } }).toArray();
      const byId = new Map(owners.map((u: any) => [u.id, u]));
      const sessions = open
        .filter((s: any) => byId.has(s.user_id))
        .map((s: any) => ({
          id: s.id, game: s.game, betAmount: s.bet_amount, createdAt: s.created_at,
          username: byId.get(s.user_id).username, teamName: byId.get(s.user_id).team_name,
        }))
        .sort((a: any, b: any) => String(b.createdAt).localeCompare(String(a.createdAt)));
      return NextResponse.json({ sessions });
    }

    // Stats: today's totals
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const betsCol = db.collection('bets');

    const todays = await betsCol.find({ created_at: { $gte: todayStart } }).toArray();
    const stats: any = { totalBets: 0, totalWagered: 0, totalPaidOut: 0 };
    const games = new Map<string, any>();
    for (const b of todays as any[]) {
      stats.totalBets += 1; stats.totalWagered += b.bet_amount; stats.totalPaidOut += b.payout;
      const g = games.get(b.game) || { game: b.game, bets: 0, wagered: 0, paidOut: 0 };
      g.bets += 1; g.wagered += b.bet_amount; g.paidOut += b.payout;
      games.set(b.game, g);
    }
    stats.houseProfit = stats.totalWagered - stats.totalPaidOut;
    const perGame = [...games.values()];

    return NextResponse.json({ stats, perGame });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
