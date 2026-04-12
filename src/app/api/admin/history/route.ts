import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET all bets (admin)
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();
    
    const { searchParams } = new URL(req.url);
    const game = searchParams.get('game');
    const limitRaw = parseInt(searchParams.get('limit') || '100');
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 100 : limitRaw), 200);
    const validGames = ['limbo', 'dice', 'mines', 'moles', 'wheel', 'plinko', 'keno'];
    const safeGame = game && validGames.includes(game) ? game : null;

    const matchStage: any = {};
    if (safeGame) {
      matchStage.game = safeGame;
    }

    const betsCol = db.collection('bets');
    const history = await betsCol
      .aggregate([
        { $match: matchStage },
        { $sort: { created_at: -1 } },
        { $limit: limit },
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
            outcome: 1,
            payout: 1,
            multiplier: 1,
            createdAt: '$created_at',
            username: '$user.username',
            teamName: '$user.team_name',
          },
        },
      ])
      .toArray();

    return NextResponse.json({ history });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
