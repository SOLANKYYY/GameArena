import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET leaderboard - accessible to all authenticated users
export async function GET(req: NextRequest) {
  try {
    requireAuth(req);
    const db = await getDb();
    const leaderboard = await db.leaderboard();
    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

