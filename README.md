# GameArena · Hollow House

Hollow House is a Halloween-themed tournament arcade maintained by **SOLANKYYY**. Teams start with 1,000 virtual Arena Coins and compete to finish a timed round with the highest balance. The organizer controls the clock, game availability and team accounts.

**[Enter Hollow House](https://gamearena-hollow-house.vercel.app/login)** · [Event rules](rules.txt) · [50-player test results](docs/capacity.md)

<img src="public/hollow-house.svg" width="420" alt="The haunted house used on the GameArena sign-in screen">

## Running an event

1. The organizer signs in as `admin`, creates one account per team and distributes the credentials.
2. Teams sign in and wait for the organizer to start a timed round.
3. Players choose Dice, Limbo, Wheel, Keno, Plinko, Mines or Moles. Each play updates the team's balance and history.
4. The organizer can follow active sessions, review the leaderboard and export the event's bet history as CSV.

## What changed in this edition

| Area | Implementation |
| --- | --- |
| Hollow House interface | A gothic sign-in page, illustrated house, themed game lobby and reduced-motion support. |
| Phone play | Open Menu to switch games or read the rules. The balance and round timer stay in the header. Starting a game brings its board into view on narrow screens. |
| Hosting and database | Next.js serves the interface and API on Vercel. The production configuration selects Mumbai and connects to Supabase PostgreSQL through its transaction pooler with TLS certificate verification. |
| Admin access | Vercel holds the password and JWT signing secret. The app stores a password hash and synchronizes the admin account during initialization. |
| Concurrent play | Each game action takes a database lock for that player. Balance changes, session updates and the game record commit together. Different teams can play concurrently. |
| Busy event screens | Password verification uses background workers. PostgreSQL calculates leaderboard totals and fetches recent plays with team names. Cold starts skip schema setup when tables and indexes are ready. |

## Capacity

In an isolated production-build test, **50 players signed in together and completed 1,050 games across all seven game types**. All recorded play counts and final balances matched. The 95th-percentile response time was **702 ms for sign-in** and **129 ms for game actions** on that test host. The report also documents a separate read-only check of the public deployment.

[Measurements and test method](docs/capacity.md) · [Repeatable test script](scripts/load-test.mjs)

## Run locally

Use Node.js 24 and a dedicated PostgreSQL database. The database role needs permission to create tables and indexes in the app schema and manage its game tables.

```sh
npm ci
cp .env.example .env.local
```

Fill in the three required values in `.env.local`, then run `npm run dev` and visit [the local sign-in page](http://localhost:3000/login). For a production build, run `npm run build` followed by `npm start`.

| Server variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection URI. On Vercel use the Supabase transaction pooler and the bundled root certificate. |
| `JWT_SECRET` | Random signing secret of at least 32 bytes. |
| `ADMIN_PASSWORD` | Password for the application's `admin` account. |
| `DB_POOL_MAX` | Optional maximum database connections per app process. The default is five. |
| `ADMIN_KEY` | Optional secret for the separate admin-link sign-in feature. An empty value disables it. |

Vercel deploys the `master` branch. Set production values in the Vercel project's environment settings, then redeploy. The production database login owns the six GameArena tables, with row-level security enabled. Players access them through the app's authenticated routes.

## Files worth opening

| File | Contents |
| --- | --- |
| [Game routes](src/app/api/games) | The rules and request handlers for all seven games. |
| [Player transactions](src/lib/playerAction.ts) and [database layer](src/lib/db.ts) | How player actions share a database transaction and how balances and rankings are read. |
| [Deployment settings](vercel.json) and [public database CA](certs/supabase-root-2021.crt) | Vercel region and the certificate used to verify Supabase. |
| [Environment template](.env.example) | Placeholder settings for a local copy. |
| [House artwork](public/hollow-house.svg) and [theme styles](src/app/haunting.css) | The visual identity used by this edition. |

## Credits

SOLANKYYY maintains this deployment and its event-specific changes. The project builds on [h4ckt0zit3/GameArena](https://github.com/h4ckt0zit3/GameArena).
