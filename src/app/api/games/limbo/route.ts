import { NextResponse } from 'next/server';
import { playerAction } from '@/lib/playerAction';
import { limboResult } from '@/lib/rng';
import { getGameContext, checkGameActive, checkRoundActive, validateBet, recordBet } from '@/lib/gameHelper';

export const POST = playerAction(async (user, body) => {
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
});
