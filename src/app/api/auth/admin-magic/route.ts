import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { key } = body;

    const ADMIN_KEY = process.env.ADMIN_KEY || 'default-secret-admin-key-2026';

    if (!key || key !== ADMIN_KEY) {
      return NextResponse.json({ error: 'Invalid admin access key' }, { status: 401 });
    }

    const db = await getDb();
    const users = db.collection('users');
    const adminUser = await users.findOne({ username: 'admin' }) as any;
    
    if (!adminUser) {
      return NextResponse.json({ error: 'Admin account not found in database' }, { status: 404 });
    }

    const token = signToken({
      userId: adminUser.id,
      username: adminUser.username,
      role: adminUser.role,
      teamName: adminUser.team_name,
    });

    return NextResponse.json({
      token,
      user: {
        id: adminUser.id,
        username: adminUser.username,
        teamName: adminUser.team_name,
        balance: adminUser.balance,
        role: adminUser.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
