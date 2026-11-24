import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, type JwtPayload } from './auth';
import { runPlayerAction } from './db';

export function playerAction(play: (user: JwtPayload, body: Record<string, any>) => Promise<Response>) {
  return async function POST(req: NextRequest) {
    try {
      const user = requireAuth(req);
      const body = await req.json().catch(() => null);
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
      }
      return await runPlayerAction(user.userId, () => play(user, body));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Game action failed';
      return NextResponse.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 400 });
    }
  };
}
