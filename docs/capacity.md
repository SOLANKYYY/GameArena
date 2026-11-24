# 50-player capacity check

Tested on 25 November 2026 (India time) with a production build of GameArena, Node.js 24 and a disposable local PostgreSQL database. The database connection pool used its default limit of five. The test created 50 separate teams and opened an event round before measuring requests.

## Player workload

All 50 teams signed in concurrently. In each of 21 waves, every team completed one game and fetched one lobby, leaderboard, profile or round update. Mines included a reveal and a cash-out when the tile was safe. Moles included starting a session, completing a round and ending the session.

| Request | Count | 95th percentile | Slowest |
| --- | ---: | ---: | ---: |
| Sign-in | 50 | 702 ms | 747 ms |
| Game action | 1,646 | 129 ms | 214 ms |
| Recent plays | 263 | 76 ms | 133 ms |
| Round status | 263 | 74 ms | 142 ms |
| Player profile | 262 | 81 ms | 143 ms |
| Leaderboard | 263 | 80 ms | 137 ms |

All 1,050 games completed and all 50 final balances and play counts matched the results returned to the players. A separate check submitted eight overlapping Dice plays on one account and verified the final balance, game count and nonce (the sequence number used to generate each result).

## Verify on another machine

1. Start a local production build against a fresh disposable PostgreSQL database using the [setup instructions](../README.md#run-locally).
2. In a second terminal, set `LOAD_TEST_ADMIN_PASSWORD` to the local app's admin password.
3. Run `node scripts/load-test.mjs` from the repository root. If using another local port, set `LOAD_TEST_ORIGIN` to that origin.

The script creates real teams and starts a round in the test database. Its results include application processing and the client's connection to that host. Public event latency also depends on the hosting region, database load and the players' network.

## Public deployment check

After deploying the Mumbai function-region configuration, the production admin login succeeded. A synchronized burst of 50 read-only requests using that session returned **50 valid responses out of 50**. The requests were divided evenly across the profile, leaderboard, recent plays, round status and admin statistics endpoints. The public response headers included the Mumbai function region (`bom1`).

From the test client, median end-to-end time was **5.61 s**, the 95th percentile was **5.92 s**, and the slowest request took **5.96 s**. These timings include the external network path. The 50-account gameplay measurements above used the isolated database.
