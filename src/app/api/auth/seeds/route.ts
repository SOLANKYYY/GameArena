import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import getDb from '@/lib/db';
import { generateServerSeed, hashServerSeed } from '@/lib/rng';

// GET - get current seed info (hash only, not the actual server seed)
export async function GET(req: NextRequest) {
  try {
    const user = requireAuth(req);
    const db = await getDb();
    const users = db.collection('users');
    const dbUser = await users.findOne({ id: user.userId }) as any;

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
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const { action, clientSeed: newClientSeed } = body;
    const db = await getDb();
    const users = db.collection('users');

    if (action === 'rotate') {
      // Reveal old server seed and generate new one
      const dbUser = await users.findOne({ id: user.userId }) as any;
      const oldServerSeed = dbUser.server_seed;
      const newServerSeed = generateServerSeed();

      await users.updateOne(
        { id: user.userId },
        { $set: { server_seed: newServerSeed, server_seed_hash: hashServerSeed(newServerSeed), nonce: 0 } }
      );

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
      await users.updateOne({ id: user.userId }, { $set: { client_seed: newClientSeed } });
      return NextResponse.json({ clientSeed: newClientSeed, message: 'Client seed updated.' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}
