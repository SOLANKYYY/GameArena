import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();
    const leaderboard = db.prepare(
      "SELECT id, username, team_name as teamName, balance FROM users WHERE role = 'player' ORDER BY balance DESC LIMIT 20"
    ).all();

    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
