import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { diceResult } from '@/lib/rng';
import { getGameContext, checkGameActive, validateBet, recordBet } from '@/lib/gameHelper';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { betAmount, target, condition } = await req.json();

    if (target === undefined || target < 0.01 || target > 99.99) {
      return NextResponse.json({ error: 'Target must be between 0.01 and 99.99' }, { status: 400 });
    }
    if (!['over', 'under'].includes(condition)) {
      return NextResponse.json({ error: 'Condition must be "over" or "under"' }, { status: 400 });
    }

    checkGameActive('dice');
    const ctx = getGameContext(user.userId, 1);
    validateBet(betAmount, ctx.balance, 'dice');

    const roll = diceResult(ctx.floats[0]);
    const winChance = condition === 'over' ? 100 - target : target;
    const multiplier = Math.round((99 / winChance) * 10000) / 10000;
    const won = condition === 'over' ? roll > target : roll < target;
    const payout = won ? Math.round(betAmount * multiplier * 100) / 100 : 0;

    const { newBalance } = recordBet(ctx, 'dice', betAmount, won ? 'win' : 'loss', payout, multiplier, {
      target, condition, roll, winChance,
    });

    return NextResponse.json({
      won, roll: Math.round(roll * 100) / 100, target, condition, winChance, multiplier, payout, newBalance,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
