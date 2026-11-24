// Run against a local production build backed by a disposable database.
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { performance } from 'node:perf_hooks';

const origin = new URL(process.env.LOAD_TEST_ORIGIN ?? 'http://127.0.0.1:3000');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname), 'Use a local test server');
assert(process.env.LOAD_TEST_ADMIN_PASSWORD, 'Set LOAD_TEST_ADMIN_PASSWORD');
const playerCount = 50;
const run = randomBytes(5).toString('hex');
const password = randomBytes(18).toString('hex');
const timings = new Map();
let setup = true;

async function call(path, token, body) {
  const start = performance.now();
  const res = await fetch(new URL('/api/' + path, origin), {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: 'Bearer ' + token }) },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  assert(res.ok, path + ': ' + res.status + ' ' + (data.error ?? ''));
  if (!setup) {
    const group = path.startsWith('games/') ? 'Game actions' : path;
    if (!timings.has(group)) timings.set(group, []);
    timings.get(group).push(performance.now() - start);
  }
  return data;
}

const admin = await call('auth/login', null, { username: 'admin', password: process.env.LOAD_TEST_ADMIN_PASSWORD });
const teams = await call('admin/teams', admin.token);
assert(teams.teams.every(t => t.role === 'admin'), 'Start with a fresh disposable database');
const players = Array.from({ length: playerCount }, (_, i) => ({
  username: 'load-' + run + '-' + i, balance: 1000, bets: 0,
}));
for (const player of players) {
  await call('admin/teams', admin.token, { createTeam: true, username: player.username, teamName: player.username, password });
}
await call('admin/round', admin.token, { action: 'initialize', roundNumber: 1, timerDuration: 1800 });
setup = false;
await Promise.all(players.map(async p => {
  const login = await call('auth/login', null, { username: p.username, password });
  assert.equal(login.user.role, 'player');
  p.token = login.token;
}));

const games = [
  ['dice', { target: 50, condition: 'over' }],
  ['limbo', { targetMultiplier: 2 }],
  ['wheel', { segments: 10, risk: 'low' }],
  ['keno', { picks: [1, 2, 3] }],
  ['plinko', { pins: 8, risk: 'low' }],
];

async function play(p, index) {
  let result;
  if (index === 5) {
    const start = await call('games/mines/start', p.token, { betAmount: 1, numMines: 1 });
    const revealed = await call('games/mines/reveal', p.token, { sessionId: start.sessionId, position: 0 });
    result = revealed.isMine ? revealed : await call('games/mines/cashout', p.token, { sessionId: start.sessionId });
  } else if (index === 6) {
    const start = await call('games/moles/start', p.token, { betAmount: 1, moleCount: 2 });
    await call('games/moles/end', p.token, { sessionId: start.sessionId, action: 'round_complete', roundHits: 2, roundMisses: 0 });
    result = await call('games/moles/end', p.token, { sessionId: start.sessionId, action: 'end' });
  } else {
    const [game, args] = games[index];
    result = await call('games/' + game, p.token, { betAmount: 1, ...args });
  }
  p.balance = Math.round((p.balance - 1 + result.payout) * 100) / 100;
  p.bets++;
  assert.equal(result.newBalance, p.balance);
}

for (let wave = 0; wave < 21; wave++) {
  await Promise.all(players.map(async (p, i) => {
    await play(p, (wave + i) % 7);
    const views = ['admin/round', 'bets/recent?limit=15', 'leaderboard', 'auth/me'];
    const view = views[(i + wave) % views.length];
    const data = await call(view, p.token);
    if (view === 'auth/me') assert.equal(data.user.balance, p.balance);
    if (view === 'leaderboard') assert.equal(data.leaderboard.length, playerCount);
    if (view.startsWith('bets/recent')) assert(data.bets.length > 0 && data.bets.length <= 15);
    if (view === 'admin/round') assert(data.round.is_active);
  }));
}
const final = await call('leaderboard', players[0].token);
for (const player of players) {
  const row = final.leaderboard.find(r => r.username === player.username);
  assert.equal(row.balance, player.balance);
  assert.equal(row.totalBets, player.bets);
}
for (const [group, samples] of timings) {
  samples.sort((a, b) => a - b);
  const p95 = samples[Math.ceil(samples.length * .95) - 1];
  console.log(group, 'requests:', samples.length, 'p95 ms:', Math.round(p95), 'max ms:', Math.round(samples.at(-1)));
}
console.log('PASS:', playerCount, 'players,', players.reduce((sum, p) => sum + p.bets, 0), 'completed games. All balances and bet counts reconciled.');

// Overlapping actions on one account must retain every accepted balance change.
const p = players[0];
const seedBefore = await call('auth/seeds', p.token);
const plays = await Promise.all(Array.from({ length: 8 }, () =>
  call('games/dice', p.token, { target: 50, condition: 'over', betAmount: 1 })));
const expectedBalance = Math.round((p.balance + plays.reduce((net, game) => net + game.payout - 1, 0)) * 100) / 100;
assert.equal((await call('auth/me', p.token)).user.balance, expectedBalance);
assert.equal((await call('auth/seeds', p.token)).nonce, seedBefore.nonce + plays.length);
const finalRow = (await call('leaderboard', p.token)).leaderboard.find(r => r.username === p.username);
assert.equal(finalRow.totalBets, p.bets + plays.length);
console.log('PASS: overlapping plays on the same account preserved balance, bet count and nonce.');
