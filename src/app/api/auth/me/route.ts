import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const db = getDb();
    const dbUser = db.prepare('SELECT id, username, team_name, balance, role FROM users WHERE id = ?').get(user.userId) as any;
    
    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      user: {
        id: dbUser.id,
        username: dbUser.username,
        teamName: dbUser.team_name,
        balance: dbUser.balance,
        role: dbUser.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
