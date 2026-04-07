import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET all bets (admin)
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();
    
    const { searchParams } = new URL(req.url);
    const game = searchParams.get('game');
    const limitRaw = parseInt(searchParams.get('limit') || '100');
    const limit = Math.min(Math.max(1, isNaN(limitRaw) ? 100 : limitRaw), 200);
    const validGames = ['limbo', 'dice', 'mines', 'moles', 'wheel', 'plinko', 'keno'];
    const safeGame = game && validGames.includes(game) ? game : null;
    
    let query = `
      SELECT b.id, b.game, b.bet_amount as betAmount, b.outcome, b.payout, b.multiplier, 
             b.created_at as createdAt, u.username, u.team_name as teamName
      FROM bets b
      JOIN users u ON b.user_id = u.id
    `;
    const params: any[] = [];
    
    if (safeGame) {
      query += ' WHERE b.game = ?';
      params.push(safeGame);
    }
    
    query += ' ORDER BY b.created_at DESC LIMIT ?';
    params.push(limit);

    const history = db.prepare(query).all(...params);

    return NextResponse.json({ history });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
