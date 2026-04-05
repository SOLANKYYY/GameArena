import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET - admin stats + live sessions
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') || 'stats';

    if (type === 'sessions') {
      // Live active sessions for Mines/Moles
      const sessions = db.prepare(`
        SELECT gs.id, gs.game, gs.bet_amount as betAmount, gs.created_at as createdAt,
               u.username, u.team_name as teamName
        FROM game_sessions gs
        JOIN users u ON gs.user_id = u.id
        WHERE gs.completed_at IS NULL
        ORDER BY gs.created_at DESC
      `).all();
      return NextResponse.json({ sessions });
    }

    // Stats: today's totals
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const stats = db.prepare(`
      SELECT
        COUNT(*) as totalBets,
        COALESCE(SUM(bet_amount), 0) as totalWagered,
        COALESCE(SUM(payout), 0) as totalPaidOut,
        COALESCE(SUM(bet_amount) - SUM(payout), 0) as houseProfit
      FROM bets
      WHERE created_at >= ?
    `).get(todayStr) as any;

    // Per-game breakdown
    const perGame = db.prepare(`
      SELECT game,
        COUNT(*) as bets,
        COALESCE(SUM(bet_amount), 0) as wagered,
        COALESCE(SUM(payout), 0) as paidOut
      FROM bets
      WHERE created_at >= ?
      GROUP BY game
    `).all(todayStr);

    return NextResponse.json({ stats, perGame });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
