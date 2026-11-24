import { NextResponse } from 'next/server';
import { playerAction } from '@/lib/playerAction';
import { PLINKO_MULTIPLIERS } from '@/lib/constants';
import { plinkoPath } from '@/lib/rng';
import { getGameContext, checkGameActive, checkRoundActive, validateBet, recordBet } from '@/lib/gameHelper';

export const POST = playerAction(async (user, body) => {
  const { betAmount, pins, risk } = body;

  const numPins = parseInt(String(pins));
  if (numPins < 8 || numPins > 16 || isNaN(numPins)) {
    return NextResponse.json({ error: 'Pins must be between 8 and 16' }, { status: 400 });
  }
  if (!['low', 'medium', 'high'].includes(risk)) {
    return NextResponse.json({ error: 'Risk must be low, medium, or high' }, { status: 400 });
  }

  await checkGameActive('plinko');
  await checkRoundActive(user.role);
  const ctx = await getGameContext(user.userId, numPins);
  await validateBet(betAmount, ctx.balance, 'plinko');

  const { path, bucketIndex } = plinkoPath(ctx.floats, numPins);
  const multipliers = PLINKO_MULTIPLIERS[String(numPins)][risk];
  const multiplier = multipliers[bucketIndex];
  const won = multiplier > 0;
  const payout = won ? Math.round(betAmount * multiplier * 100) / 100 : 0;

  const { newBalance } = await recordBet(ctx, 'plinko', betAmount, won ? 'win' : 'loss', payout, multiplier, {
    pins: numPins, risk, path, bucketIndex,
  });

  return NextResponse.json({
    won, path, bucketIndex, multiplier, payout, newBalance, pins: numPins, risk, multipliers,
  });
});
