import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';

// GET all recent bets across all users (for live ticker)
export async function GET(req: NextRequest) {
  try {
    requireAuth(req); // Must be logged in
    const db = await getDb();
    const { searchParams } = new URL(req.url);
    const requested = Number.parseInt(searchParams.get('limit') ?? '', 10);
    const limit = Number.isFinite(requested) ? Math.min(50, Math.max(1, requested)) : 10;
    return NextResponse.json({ bets: await db.recentBets(limit) });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
