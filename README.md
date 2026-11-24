# GameArena — Hollow House

SOLANKYYY's fork of h4ckt0zit3/GameArena, with a gothic Halloween theme.
Seven games, team accounts, an admin dashboard, and an event leaderboard.
This is an arena-coin event game, not a real-money payment platform.

## Run locally

1. Run `npm ci`.
2. Create an untracked `.env.local` file using the configuration below.
3. Run `npm run dev` and open http://localhost:3000.
4. Sign in as `admin` using your configured `ADMIN_PASSWORD`, then create teams.

## Vercel and Supabase

Import `SOLANKYYY/GameArena` into Vercel as a Next.js project. The `master`
branch is production. Next.js route handlers provide the backend; a separate
API server is not required.

Configure these server-only environment variables in Vercel:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | A dedicated Supabase database transaction-pooler connection URI from the dashboard Connect panel. |
| `JWT_SECRET` | A unique, randomly generated authentication secret of at least 32 bytes. |
| `ADMIN_PASSWORD` | A unique strong password for the admin account. |
| `ADMIN_KEY` | Optional random secret for magic admin login. Omit to disable that endpoint. |
| `DB_POOL_MAX` | Optional per-process pool limit, initially 5. |

Never prefix database credentials or authentication secrets with `NEXT_PUBLIC_`.
Do not commit secrets. Use a separate database from unrelated projects.
The trusted server database role initializes the tables on first use and must
have schema creation privileges and RLS bypass (the Supabase postgres role).
Row-level security is enabled without browser-facing policies: access is via
authenticated Next.js endpoints, not the Supabase public Data API.
Production login requires explicit JWT and administrator secrets.

## Capacity

Start with Vercel Functions plus a Supabase transaction pooler, colocated where
possible. Twenty-five simultaneous players is the initial test target, not a
verified guarantee. Before an event, load-test concurrent login, game actions,
balance updates, and leaderboard reads against a dedicated test database.
Measure errors, latency, pool saturation, and balance consistency.

## Theme

`src/app/haunting.css` contains the responsive gothic theme. The original
haunted-house artwork is `public/hollow-house.svg`. Motion respects the
system reduced-motion setting.
