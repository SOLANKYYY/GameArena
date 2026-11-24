# Curse the Code – Hollow House Arena

Halloween-themed betting arena (Next.js + Supabase/Postgres).

## Run
```bash
cp .env.example .env.local   # fill in DATABASE_URL etc. (Supabase)
npm install
npm run dev                  # binds 0.0.0.0:3000
```
Others on your Wi-Fi/LAN open `http://<your-ip>:3000` (find it with `ipconfig getifaddr en0`).
For public access, deploy to Vercel (set the env vars above) or tunnel with `npx cloudflared tunnel --url http://localhost:3000`.

## Admin
- Username: `admin`  Password: `admin321` (override with `ADMIN_PASSWORD`; it is synced to the DB on startup).
- Magic link: `/admin-access/<ADMIN_KEY>`.
- Change the defaults before a public event.
