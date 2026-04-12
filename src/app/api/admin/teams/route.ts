import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import getDb, { getNextSequence } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { DEFAULT_STARTING_BALANCE } from '@/lib/constants';
import { generateServerSeed, hashServerSeed, generateClientSeed } from '@/lib/rng';

// GET all teams
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();
    const users = db.collection('users');

    const teams = await users
      .aggregate([
        {
          $lookup: {
            from: 'bets',
            let: { userId: '$id' },
            pipeline: [
              { $match: { $expr: { $eq: ['$user_id', '$$userId'] } } },
              {
                $group: {
                  _id: null,
                  totalBets: { $sum: 1 },
                  totalWon: {
                    $sum: { $cond: [{ $eq: ['$outcome', 'win'] }, '$payout', 0] }
                  },
                  totalLost: {
                    $sum: { $cond: [{ $eq: ['$outcome', 'loss'] }, '$bet_amount', 0] }
                  }
                }
              }
            ],
            as: 'betStats',
          },
        },
        {
          $project: {
            _id: 0,
            id: 1,
            username: 1,
            teamName: '$team_name',
            balance: 1,
            role: 1,
            createdAt: '$created_at',
            totalBets: { $ifNull: [{ $arrayElemAt: ['$betStats.totalBets', 0] }, 0] },
            totalWon: { $ifNull: [{ $arrayElemAt: ['$betStats.totalWon', 0] }, 0] },
            totalLost: { $ifNull: [{ $arrayElemAt: ['$betStats.totalLost', 0] }, 0] },
          },
        },
        { $sort: { balance: -1 } },
      ])
      .toArray();

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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const db = await getDb();
    const users = db.collection('users');

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

      const existing = await users.findOne({ username });
      if (existing) {
        return NextResponse.json({ error: 'Username already taken' }, { status: 409 });
      }

      const hash = bcrypt.hashSync(password, 10);
      const serverSeed = generateServerSeed();
      const clientSeed = generateClientSeed();
      const newId = await getNextSequence(db, 'userId');

      await users.insertOne({
        id: newId,
        username,
        password_hash: hash,
        team_name: teamName,
        balance: DEFAULT_STARTING_BALANCE,
        role: 'player',
        client_seed: clientSeed,
        server_seed: serverSeed,
        server_seed_hash: hashServerSeed(serverSeed),
        nonce: 0,
        created_at: new Date(),
      });

      return NextResponse.json({
        success: true,
        team: {
          id: newId,
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
    const user = await users.findOne({ id: userId }) as any;
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
    await users.updateOne({ id: userId }, { $set: { balance: newBalance } });

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
    const db = await getDb();
    const users = db.collection('users');
    await users.updateMany({ role: 'player' }, { $set: { balance: DEFAULT_STARTING_BALANCE } });
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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const user = await users.findOne({ id: userId }) as any;
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (user.role === 'admin') {
      return NextResponse.json({ error: 'Cannot delete admin accounts' }, { status: 403 });
    }

    // Delete related records first
    const gameSessions = db.collection('game_sessions');
    const bets = db.collection('bets');
    await gameSessions.deleteMany({ user_id: userId });
    await bets.deleteMany({ user_id: userId });
    await users.deleteOne({ id: userId });

    return NextResponse.json({ success: true, message: 'Team deleted successfully' });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
