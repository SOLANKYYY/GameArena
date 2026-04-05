import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { PLINKO_MULTIPLIERS } from '@/lib/constants';
import { plinkoPath } from '@/lib/rng';
import { getGameContext, checkGameActive, validateBet, recordBet } from '@/lib/gameHelper';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { betAmount, pins, risk } = await req.json();

    const numPins = parseInt(String(pins));
    if (numPins < 8 || numPins > 16) {
      return NextResponse.json({ error: 'Pins must be between 8 and 16' }, { status: 400 });
    }
    if (!['low', 'medium', 'high'].includes(risk)) {
      return NextResponse.json({ error: 'Risk must be low, medium, or high' }, { status: 400 });
    }

    checkGameActive('plinko');
    const ctx = getGameContext(user.userId, numPins);
    validateBet(betAmount, ctx.balance, 'plinko');

    const { path, bucketIndex } = plinkoPath(ctx.floats, numPins);
    const multipliers = PLINKO_MULTIPLIERS[String(numPins)][risk];
    const multiplier = multipliers[bucketIndex];
    const won = multiplier > 0;
    const payout = won ? Math.round(betAmount * multiplier * 100) / 100 : 0;

    const { newBalance } = recordBet(ctx, 'plinko', betAmount, won ? 'win' : 'loss', payout, multiplier, {
      pins: numPins, risk, path, bucketIndex,
    });

    return NextResponse.json({
      won, path, bucketIndex, multiplier, payout, newBalance, pins: numPins, risk, multipliers,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
