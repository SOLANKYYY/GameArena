import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();
    const leaderboard = db.prepare(
      "SELECT id, username, team_name as teamName, balance FROM users WHERE role = 'player' ORDER BY balance DESC LIMIT 20"
    ).all();

    return NextResponse.json({ leaderboard });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
