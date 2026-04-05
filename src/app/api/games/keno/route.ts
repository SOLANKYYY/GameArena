import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { KENO_PAYOUTS } from '@/lib/constants';
import { generateKenoHits } from '@/lib/rng';
import { getGameContext, checkGameActive, validateBet, recordBet } from '@/lib/gameHelper';

export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { betAmount, picks } = await req.json();

    if (!Array.isArray(picks) || picks.length < 1 || picks.length > 10) {
      return NextResponse.json({ error: 'Must pick 1 to 10 numbers' }, { status: 400 });
    }
    // Validate each pick is 1-40 and unique
    const pickSet = new Set(picks);
    if (pickSet.size !== picks.length) {
      return NextResponse.json({ error: 'Picks must be unique' }, { status: 400 });
    }
    for (const p of picks) {
      if (p < 1 || p > 40 || !Number.isInteger(p)) {
        return NextResponse.json({ error: 'Each pick must be an integer from 1 to 40' }, { status: 400 });
      }
    }

    checkGameActive('keno');
    const ctx = getGameContext(user.userId, 10); // 10 floats needed for 10 draws
    validateBet(betAmount, ctx.balance, 'keno');

    const drawnNumbers = generateKenoHits(ctx.floats);
    const drawnSet = new Set(drawnNumbers);
    const matches = picks.filter((p: number) => drawnSet.has(p));
    const matchCount = matches.length;
    const pickCount = picks.length;

    const payoutTable = KENO_PAYOUTS[pickCount];
    const multiplier = payoutTable[matchCount] || 0;
    const won = multiplier > 0;
    const payout = won ? Math.round(betAmount * multiplier * 100) / 100 : 0;

    const { newBalance } = recordBet(ctx, 'keno', betAmount, won ? 'win' : 'loss', payout, multiplier, {
      picks, drawnNumbers, matches, matchCount,
    });

    return NextResponse.json({
      won, drawnNumbers, matches, matchCount, multiplier, payout, newBalance, picks, payoutTable,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
