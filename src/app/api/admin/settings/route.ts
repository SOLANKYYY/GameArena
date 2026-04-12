import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET game settings (all 7 games)
export async function GET(req: NextRequest) {
  try {
    requireAdmin(req);
    const db = await getDb();
    const gameSettings = db.collection('game_settings');
    const settings = await gameSettings.find({}).sort({ game_name: 1 }).toArray();

    // Strip MongoDB _id for clean response
    const cleaned = settings.map(({ _id, ...rest }) => rest);
    return NextResponse.json({ settings: cleaned });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}

// POST - toggle game or update limits
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { gameName, isActive, minBet, maxBet } = body;

    const db = await getDb();
    const gameSettings = db.collection('game_settings');

    const updateFields: any = {};
    if (isActive !== undefined) {
      updateFields.is_active = isActive ? true : false;
    }
    if (minBet !== undefined) {
      updateFields.min_bet = minBet;
    }
    if (maxBet !== undefined) {
      updateFields.max_bet = maxBet;
    }

    if (Object.keys(updateFields).length > 0) {
      await gameSettings.updateOne({ game_name: gameName }, { $set: updateFields });
    }

    return NextResponse.json({ success: true, gameName, isActive });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
