import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_STARTING_BALANCE } from '@/lib/constants';
import { generateServerSeed, hashServerSeed, generateClientSeed } from '@/lib/rng';

// GET all teams
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();
    
    const teams = db.prepare(`
      SELECT 
        u.id, u.username, u.team_name as teamName, u.balance, u.role, u.created_at as createdAt,
        COALESCE(COUNT(b.id), 0) as totalBets,
        COALESCE(SUM(CASE WHEN b.outcome = 'win' THEN b.payout ELSE 0 END), 0) as totalWon,
        COALESCE(SUM(CASE WHEN b.outcome = 'loss' THEN b.bet_amount ELSE 0 END), 0) as totalLost
      FROM users u
      LEFT JOIN bets b ON u.id = b.user_id
      GROUP BY u.id
      ORDER BY u.balance DESC
    `).all();

    return NextResponse.json({ teams });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// POST - update balance OR create new team
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    const body = await req.json();
    const db = getDb();

    // If "createTeam" flag is set, create a new team
    if (body.createTeam) {
      const { username, password, teamName } = body;

      if (!username || !password || !teamName) {
        return NextResponse.json({ error: 'Username, password, and team name are required' }, { status: 400 });
      }
      if (username.length < 3) {
        return NextResponse.json({ error: 'Username must be at least 3 characters' }, { status: 400 });
      }
      if (password.length < 4) {
        return NextResponse.json({ error: 'Password must be at least 4 characters' }, { status: 400 });
      }
      if (teamName.length < 2) {
        return NextResponse.json({ error: 'Team name must be at least 2 characters' }, { status: 400 });
      }

      const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }

      const hash = bcrypt.hashSync(password, 10);
      const serverSeed = generateServerSeed();
      const clientSeed = generateClientSeed();

      const result = db.prepare(
        'INSERT INTO users (username, password_hash, team_name, balance, role, client_seed, server_seed, server_seed_hash, nonce) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(username, hash, teamName, DEFAULT_STARTING_BALANCE, 'player', clientSeed, serverSeed, hashServerSeed(serverSeed), 0);

      return NextResponse.json({
        success: true,
        team: {
          id: Number(result.lastInsertRowid),
          username,
          teamName,
          balance: DEFAULT_STARTING_BALANCE,
          role: 'player',
        },
      });
    }

    // Otherwise, update balance (existing logic)
    const { userId, action, amount } = body;
    if (!['set', 'add', 'deduct'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
    if (amount === undefined || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }
    const safeAmount = Math.round(Number(amount) * 100) / 100;
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let newBalance = user.balance;
    if (action === 'set') {
      newBalance = safeAmount;
    } else if (action === 'add') {
      newBalance = user.balance + safeAmount;
    } else if (action === 'deduct') {
      newBalance = Math.max(0, user.balance - safeAmount);
    }

    newBalance = Math.round(newBalance * 100) / 100;
    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);

    return NextResponse.json({ success: true, newBalance });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// PUT - reset all balances
export async function PUT(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = getDb();
    db.prepare("UPDATE users SET balance = ? WHERE role = 'player'").run(DEFAULT_STARTING_BALANCE);
    return NextResponse.json({ success: true, message: `All balances reset to ${DEFAULT_STARTING_BALANCE}` });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// DELETE - delete a team
export async function DELETE(req: NextRequest) {
  try {
    requireAdmin(req);
    const { userId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = getDb();
    const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(userId) as any;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete admin accounts' }, { status: 403 });
    }

    // Delete related records first (foreign key constraints)
    db.prepare('DELETE FROM game_sessions WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM bets WHERE user_id = ?').run(userId);
    db.prepare('DELETE FROM users WHERE id = ?').run(userId);

    return NextResponse.json({ success: true, message: 'Team deleted successfully' });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
