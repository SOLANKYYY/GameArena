import crypto from 'crypto';

/**
 * Provably Fair RNG System
 * Uses HMAC-SHA256 with serverSeed + clientSeed + nonce to produce deterministic results.
 * Players can verify results after seed rotation.
 */

// Generate a new random server seed
export function generateServerSeed(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Hash the server seed for public commitment (shown to player before game)
export function hashServerSeed(serverSeed: string): string {
  return crypto.createHash('sha256').update(serverSeed).digest('hex');
}

// Generate a default client seed
export function generateClientSeed(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Generate a sequence of floats from a single seed combo.
 * Each float consumes 4 bytes (32 bits) from the HMAC output.
 * For more than 8 floats per nonce, we increment a cursor suffix.
 */
export function generateFloats(
  serverSeed: string,
  clientSeed: string,
  nonce: number,
  count: number
): number[] {
  const floats: number[] = [];
  let cursor = 0;

  while (floats.length < count) {
    const hmac = crypto.createHmac('sha256', serverSeed);
    hmac.update(`${clientSeed}:${nonce}:${cursor}`);
    const buf = hmac.digest();

    // Each HMAC gives 32 bytes = 8 floats (4 bytes each)
    for (let i = 0; i < 32 && floats.length < count; i += 4) {
      const int = buf.readUInt32BE(i);
      floats.push(int / 0x100000000); // [0, 1)
    }
    cursor++;
  }

  return floats;
}

/** Generate a single float */
export function generateFloat(
  serverSeed: string,
  clientSeed: string,
  nonce: number
): number {
  return generateFloats(serverSeed, clientSeed, nonce, 1)[0];
}

// ── LIMBO ──────────────────────────────────────────────
export function limboResult(float: number): number {
  const houseEdge = 0.99;
  const floatPoint = (1e8 / (float * 1e8)) * houseEdge;
  const crashPoint = Math.floor(floatPoint * 100) / 100;
  return Math.max(crashPoint, 1.00);
}

// ── DICE ───────────────────────────────────────────────
export function diceResult(float: number): number {
  return (float * 10001) / 100; // 00.00 to 100.00
}

// ── MINES ──────────────────────────────────────────────
export function generateMinePositions(floats: number[], mineCount: number): number[] {
  const positions = Array.from({ length: 25 }, (_, i) => i);
  for (let i = 0; i < mineCount; i++) {
    const j = i + Math.floor(floats[i] * (25 - i));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }
  return positions.slice(0, mineCount);
}

// ── MOLES ──────────────────────────────────────────────
export function generateMolePositions(floats: number[], moleCount: number): number[] {
  const holes = [0, 1, 2, 3, 4, 5, 6];
  for (let i = 0; i < moleCount; i++) {
    const j = i + Math.floor(floats[i] * (7 - i));
    [holes[i], holes[j]] = [holes[j], holes[i]];
  }
  return holes.slice(0, moleCount);
}

// ── WHEEL ──────────────────────────────────────────────
export function wheelResult(
  float: number,
  segments: number,
  payouts: number[]
): { segmentIndex: number; multiplier: number } {
  const segmentIndex = Math.floor(float * segments);
  return { segmentIndex, multiplier: payouts[segmentIndex] };
}

// ── PLINKO ─────────────────────────────────────────────
export function plinkoPath(floats: number[], numPins: number): {
  path: ('left' | 'right')[];
  bucketIndex: number;
} {
  const path: ('left' | 'right')[] = [];
  let bucketIndex = 0;
  for (let i = 0; i < numPins; i++) {
    const direction = Math.floor(floats[i] * 2) === 0 ? 'left' : 'right';
    path.push(direction);
    if (direction === 'right') bucketIndex++;
  }
  return { path, bucketIndex };
}

// ── KENO ───────────────────────────────────────────────
export function generateKenoHits(floats: number[]): number[] {
  const squares = Array.from({ length: 40 }, (_, i) => i + 1);
  for (let i = 0; i < 10; i++) {
    const j = i + Math.floor(floats[i] * (40 - i));
    [squares[i], squares[j]] = [squares[j], squares[i]];
  }
  return squares.slice(0, 10);
}
