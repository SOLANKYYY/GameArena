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
      const sessions = await gameSessions
        .aggregate([
          { $match: { completed_at: null } },
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
              game: 1,
              betAmount: '$bet_amount',
              createdAt: '$created_at',
              username: '$user.username',
              teamName: '$user.team_name',
            },
          },
          { $sort: { createdAt: -1 } },
        ])
        .toArray();
      return NextResponse.json({ sessions });
    }

    // Stats: today's totals
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const betsCol = db.collection('bets');

    const statsResult = await betsCol
      .aggregate([
        { $match: { created_at: { $gte: todayStart } } },
        {
          $group: {
            _id: null,
            totalBets: { $sum: 1 },
            totalWagered: { $sum: '$bet_amount' },
            totalPaidOut: { $sum: '$payout' },
          },
        },
      ])
      .toArray();

    const stats = statsResult[0] || { totalBets: 0, totalWagered: 0, totalPaidOut: 0 };
    stats.houseProfit = (stats.totalWagered || 0) - (stats.totalPaidOut || 0);

    // Per-game breakdown
    const perGame = await betsCol
      .aggregate([
        { $match: { created_at: { $gte: todayStart } } },
        {
          $group: {
            _id: '$game',
            bets: { $sum: 1 },
            wagered: { $sum: '$bet_amount' },
            paidOut: { $sum: '$payout' },
          },
        },
        {
          $project: {
            _id: 0,
            game: '$_id',
            bets: 1,
            wagered: 1,
            paidOut: 1,
          },
        },
      ])
      .toArray();

    return NextResponse.json({ stats, perGame });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
