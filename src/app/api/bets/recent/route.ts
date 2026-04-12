import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';

// GET all recent bets across all users (for live ticker)
export async function GET(req: NextRequest) {
  try {
    requireAuth(req); // Must be logged in
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50);

    const betsCol = db.collection('bets');
    const usersCol = db.collection('users');

    const recentBets = await betsCol
      .aggregate([
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
            teamName: '$user.team_name',
          },
        },
      ])
      .toArray();

    return NextResponse.json({ bets: recentBets });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
