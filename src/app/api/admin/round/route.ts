import { NextRequest, NextResponse } from 'next/server';
import getDb from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

// GET - get current round status (no auth required for timer display)
export async function GET() {
  try {
    const db = await getDb();
    const roundConfig = db.collection('round_config');
    const current = await roundConfig.findOne({ _id: 'current_round' as any });

    if (!current) {
      return NextResponse.json({ round: null });
    }

    const { _id, ...round } = current;
    return NextResponse.json({ round });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST - initialize/stop a round with timer
export async function POST(req: NextRequest) {
  try {
    requireAdmin(req);
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { roundNumber, timerDuration, action } = body;
    const db = await getDb();
    const roundConfig = db.collection('round_config');

    if (action === 'stop') {
      await roundConfig.updateOne(
        { _id: 'current_round' as any },
        { $set: { is_active: false, stopped_at: new Date() } }
      );
      return NextResponse.json({ success: true, message: 'Round stopped' });
    }

    if (action === 'initialize') {
      if (!roundNumber || !timerDuration) {
        return NextResponse.json({ error: 'Round number and timer duration are required' }, { status: 400 });
      }

      const duration = Number(timerDuration);
      if (!Number.isFinite(duration) || duration < 1) {
        return NextResponse.json({ error: 'Timer duration must be at least 1 second' }, { status: 400 });
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + duration * 1000);

      await roundConfig.updateOne(
        { _id: 'current_round' as any },
        {
          $set: {
            round_number: Number(roundNumber),
            is_active: true,
            timer_duration: duration,
            started_at: now,
            ends_at: endsAt,
          },
        },
        { upsert: true }
      );

      return NextResponse.json({
        success: true,
        message: `Round ${roundNumber} initialized with ${duration}s timer`,
        round: {
          round_number: Number(roundNumber),
          is_active: true,
          timer_duration: duration,
          started_at: now,
          ends_at: endsAt,
        },
      });
    }

    return NextResponse.json({ error: 'Invalid action. Use "initialize" or "stop"' }, { status: 400 });
  } catch (error: any) {
    const status = error.message === 'Forbidden' ? 403 : error.message === 'Unauthorized' ? 401 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }
}
