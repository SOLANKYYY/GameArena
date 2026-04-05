import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { WHEEL_PAYOUTS } from '@/lib/constants';
import { wheelResult } from '@/lib/rng';
import { getGameContext, checkGameActive, validateBet, recordBet } from '@/lib/gameHelper';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { betAmount, segments, risk } = await req.json();

    const validSegments = ['10', '20', '30', '40', '50'];
    const validRisks = ['low', 'medium', 'high'];

    if (!validSegments.includes(String(segments))) {
      return NextResponse.json({ error: 'Segments must be 10, 20, 30, 40, or 50' }, { status: 400 });
    }
    if (!validRisks.includes(risk)) {
      return NextResponse.json({ error: 'Risk must be low, medium, or high' }, { status: 400 });
    }

    checkGameActive('wheel');
    const ctx = getGameContext(user.userId, 1);
    validateBet(betAmount, ctx.balance, 'wheel');

    const payouts = WHEEL_PAYOUTS[String(segments)][risk];
    const segCount = parseInt(String(segments));
    const { segmentIndex, multiplier } = wheelResult(ctx.floats[0], segCount, payouts);
    const won = multiplier > 0;
    const payout = won ? Math.round(betAmount * multiplier * 100) / 100 : 0;

    const { newBalance } = recordBet(ctx, 'wheel', betAmount, won ? 'win' : 'loss', payout, multiplier, {
      segments: segCount, risk, segmentIndex, multiplier,
    });

    return NextResponse.json({
      won, segmentIndex, multiplier, payout, newBalance, segments: segCount, risk, payouts,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
