import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';
import { generateServerSeed, hashServerSeed } from '@/lib/rng';

// GET - get current seed info (hash only, not the actual server seed)
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const db = getDb();
    const dbUser = db.prepare('SELECT client_seed, server_seed_hash, nonce FROM users WHERE id = ?').get(user.userId) as any;

    return NextResponse.json({
      clientSeed: dbUser.client_seed,
      serverSeedHash: dbUser.server_seed_hash,
      nonce: dbUser.nonce,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

// POST - rotate server seed (reveals old one) or update client seed
export async function POST(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const { action, clientSeed: newClientSeed } = await req.json();
    const db = getDb();

    if (action === 'rotate') {
      // Reveal old server seed and generate new one
      const dbUser = db.prepare('SELECT server_seed, server_seed_hash, client_seed, nonce FROM users WHERE id = ?').get(user.userId) as any;
      const oldServerSeed = dbUser.server_seed;
      const newServerSeed = generateServerSeed();

      db.prepare('UPDATE users SET server_seed = ?, server_seed_hash = ?, nonce = 0 WHERE id = ?')
        .run(newServerSeed, hashServerSeed(newServerSeed), user.userId);

      return NextResponse.json({
        previousServerSeed: oldServerSeed,
        newServerSeedHash: hashServerSeed(newServerSeed),
        clientSeed: dbUser.client_seed,
        message: 'Server seed rotated. You can now verify previous bets with the revealed server seed.',
      });
    }

    if (action === 'updateClientSeed' && newClientSeed) {
      if (newClientSeed.length < 1 || newClientSeed.length > 64) {
        return NextResponse.json({ error: 'Client seed must be 1-64 characters' }, { status: 400 });
      }
      db.prepare('UPDATE users SET client_seed = ? WHERE id = ?').run(newClientSeed, user.userId);
      return NextResponse.json({ clientSeed: newClientSeed, message: 'Client seed updated.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
