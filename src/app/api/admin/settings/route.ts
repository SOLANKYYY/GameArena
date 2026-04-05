import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET game settings (all 7 games)
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();
    const settings = db.prepare('SELECT * FROM game_settings ORDER BY game_name').all();
    return NextResponse.json({ settings });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// POST - toggle game or update limits
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const { gameName, isActive, minBet, maxBet } = await req.json();

    const db = getDb();

    if (isActive !== undefined) {
      db.prepare('UPDATE game_settings SET is_active = ? WHERE game_name = ?').run(isActive ? 1 : 0, gameName);
    }
    if (minBet !== undefined) {
      db.prepare('UPDATE game_settings SET min_bet = ? WHERE game_name = ?').run(minBet, gameName);
    }
    if (maxBet !== undefined) {
      db.prepare('UPDATE game_settings SET max_bet = ? WHERE game_name = ?').run(maxBet, gameName);
    }

    return NextResponse.json({ success: true, gameName, isActive });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
