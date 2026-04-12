import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { limboResult } from '@/lib/rng';
import { getGameContext, checkGameActive, checkRoundActive, validateBet, recordBet } from '@/lib/gameHelper';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { betAmount, targetMultiplier } = body;

    if (!targetMultiplier || targetMultiplier < 1.01 || targetMultiplier > 1000000) {
      return NextResponse.json({ error: 'Target multiplier must be between 1.01 and 1,000,000' }, { status: 400 });
    }

    await checkGameActive('limbo');
    await checkRoundActive(user.role);
    const ctx = await getGameContext(user.userId, 1);
    await validateBet(betAmount, ctx.balance, 'limbo');

    const resultMultiplier = limboResult(ctx.floats[0]);
    const won = resultMultiplier >= targetMultiplier;
    const payout = won ? Math.round(betAmount * targetMultiplier * 100) / 100 : 0;
    const winChance = parseFloat((99 / targetMultiplier).toFixed(4));

    const { newBalance } = await recordBet(ctx, 'limbo', betAmount, won ? 'win' : 'loss', payout, resultMultiplier, {
      targetMultiplier,
      resultMultiplier,
      winChance,
    });

    return NextResponse.json({
      won,
      resultMultiplier,
      targetMultiplier,
      payout,
      newBalance,
      winChance,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
