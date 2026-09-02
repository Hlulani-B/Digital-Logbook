# Keep-Alive System (Supabase + Render)

## Problem

Two free-tier services need protection from inactivity pauses:

| Service | Inactivity Policy | Consequence |
|---------|-------------------|-------------|
| **Render** | Sleeps after **15 minutes** of no HTTP traffic | Cold starts take ~30s, service appears offline |
| **Supabase** | Pauses after **7 days** of no DB activity | All API calls fail, app appears down |

Both need a keep-alive mechanism to stay warm for a demo/portfolio project that must be available at all times.

## Solution: Two Birds, One Stone

A **single GitHub Actions workflow** pings a `/service/health-ping` endpoint every 10 minutes. This endpoint:

1. **Wakes the Render instance** (prevents Render's 15-minute sleep)
2. **Writes "hello hlulani" to Supabase** then deletes it (prevents Supabase's 7-day pause)

One HTTP request solves both problems simultaneously.

## Architecture

```
┌─────────────────────┐       curl every 10min          ┌──────────────────────────┐
│   GitHub Actions     │ ──────────────────────────────► │  Render Service           │
│   (keep-alive.yml)   │  GET /service/health-ping       │  (dashboard-service)      │
│                      │                                 │                           │
│   cron: */10 * * * * │                                 │  ┌─────────────────────┐  │
│                      │                                 │  │ health-ping endpoint │  │
└─────────────────────┘                                 │  │        │              │  │
                                                        │  │        ▼              │  │
                                                        │  │   ping() ─────────┐  │  │
                                                        │  └─────────────────┼──┘  │  │
                                                        └────────────────────┼──────┘  │
                                                                             │         │
                                                            ┌────────────────┘         │
                                                            │ 1. CREATE TABLE IF NOT   │
                                                            │    EXISTS health_ping    │
                                                            │ 2. INSERT "hello hlulani"│
                                                            │ 3. DELETE the row        │
                                                            ▼                          │
                                                   ┌────────────────┐                  │
                                                   │   Supabase DB   │                  │
                                                   │                 │                  │
                                                   │  health_ping    │                  │
                                                   │  ┌───────────┐  │                  │
                                                   │  │ id        │  │                  │
                                                   │  │ message   │  │                  │
                                                   │  │ pinged_at │  │                  │
                                                   │  └───────────┘  │                  │
                                                   └────────────────┘                  │
```

### Why This Works

| Action | Render Effect | Supabase Effect |
|--------|---------------|-----------------|
| GitHub Actions sends `curl` to Render | Wakes the sleeping container | — |
| Express receives the HTTP request | Service is now active | — |
| `/service/health-ping` calls `ping()` | — | INSERT "hello hlulani" registers DB activity |
| `ping()` deletes the row immediately | — | Table stays clean, ~0 storage cost |

## The Endpoint

### File: `services/dashboard-service/src/index.js`

```javascript
import { startDaemon, ping } from './functions/daemon.js';

// Health-ping endpoint — triggered by GitHub Actions every 10 min.
// Wakes the Render instance AND pings Supabase with "hello hlulani".
app.get('/service/health-ping', async (req, res) => {
  try {
    const result = await ping();
    if (result.success) {
      return res.json({ status: 'ok', ...result });
    }
    return res.status(503).json({ status: 'degraded', ...result });
  } catch (err) {
    console.error('[HealthPing] Error:', err.message);
    return res.status(500).json({ status: 'error', reason: err.message });
  }
});
```

### Response Format

**Success (200):**
```json
{
  "status": "ok",
  "success": true,
  "id": 1,
  "message": "hello hlulani",
  "pinged_at": "2026-09-02T12:00:00.000Z"
}
```

**Degraded (503):**
```json
{
  "status": "degraded",
  "success": false,
  "reason": "no_pool"
}
```

## The GitHub Actions Workflow

### File: `.github/workflows/keep-alive.yml`

```yaml
name: Keep Render Alive & Supabase Active

on:
  schedule:
    - cron: '*/10 * * * *'   # Every 10 minutes
  workflow_dispatch:          # Manual trigger from GitHub UI

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping health-ping endpoint (wakes Render + pings Supabase)
        env:
          RENDER_URL: ${{ secrets.RENDER_URL }}
        run: |
          curl -f "$RENDER_URL/service/health-ping" || echo "Ping failed, but workflow continues"
```

### Setup Steps

1. **Create the workflow file** at `.github/workflows/keep-alive.yml` (already done).
2. **Add the Render URL secret:**
   - Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `RENDER_URL`
   - Value: your live Render web service URL (e.g. `https://digital-logbook.onrender.com`)
3. **Push to `hlulani`** — GitHub Actions picks up the cron schedule automatically.

### Manual Trigger

The workflow supports `workflow_dispatch`, so you can manually trigger it from the GitHub Actions tab without waiting for the cron schedule. This is useful for immediately waking the service after a deploy.

## The Internal Daemon (Fallback)

In addition to the GitHub Actions trigger, the `ping()` function also runs on an internal 12-hour `setInterval` as a fallback. This ensures Supabase stays active even if GitHub Actions has an outage.

### File: `services/dashboard-service/src/functions/daemon.js`

| Export             | Type       | Description                                  |
|--------------------|------------|----------------------------------------------|
| `ping()`           | `async`    | Executes one ping cycle (ensure → insert → delete) |
| `startDaemon(ms?)` | `function` | Starts the daemon with optional interval override |
| `stopDaemon()`     | `function` | Stops the daemon and clears the timer        |
| `isDaemonRunning()`| `function` | Returns `true` if the daemon is active       |
| `getDaemonConfig()`| `function` | Returns current config (interval, message, running state) |

The daemon is started automatically when the service boots:

```javascript
app.listen(PORT, () => {
  console.log(`dashboard-service running on port ${PORT}`);
  startDaemon();  // ← fallback: pings Supabase every 12h
});
```

### Graceful Shutdown

The timer is `unref()`'d so it doesn't keep the Node.js process alive artificially. This allows graceful shutdown — when the service receives a termination signal, the event loop can exit cleanly even if the daemon timer is still pending.

## Database Schema

The `health_ping` table is created by migration `006_create_health_ping_table.sql`:

| Column      | Type         | Description                          |
|-------------|--------------|--------------------------------------|
| `id`        | `BIGINT`     | Auto-generated identity primary key  |
| `message`   | `TEXT`       | Always `"hello hlulani"`             |
| `pinged_at` | `TIMESTAMPTZ`| Timestamp of the ping (defaults to `now()`) |

Row Level Security (RLS) is enabled on the table, but no user-facing policies exist. Only the backend service (using the service-role key / direct `DATABASE_URL`) can access it.

## Performance Impact

| Metric         | Value                        |
|----------------|------------------------------|
| Queries/ping   | 3 (CREATE TABLE IF NOT EXISTS + INSERT + DELETE) |
| Ping frequency | Every 10 minutes (via GitHub Actions) + every 12 hours (internal fallback) |
| Data per ping  | 1 row inserted, 1 row deleted |
| Storage impact | ~0 (rows are deleted immediately) |
| Network cost   | Negligible (3 tiny queries per ping) |

## Cost

| Resource | Free Allowance | Usage | Cost |
|----------|---------------|-------|------|
| GitHub Actions minutes | 2,000/month | ~43 min/month (144 pings/day × 0.3 min) | **$0** |
| Render bandwidth | Included | ~1 request/10 min | **$0** |
| Supabase queries | 500M/month | ~432 queries/day | **$0** |

## Testing

The keep-alive system has **18 tests** across two test files:

| File | Tests | What it tests |
|------|-------|---------------|
| `daemon.test.js` | 12 | Ping lifecycle, start/stop, config, error handling |
| `healthPing.test.js` | 6 | Endpoint behavior, "hello hlulani" message, INSERT→DELETE ordering |

Run tests:

```bash
cd services/dashboard-service
npx jest src/__tests__/daemon.test.js src/__tests__/healthPing.test.js
```

## Why This Approach?

| Alternative                  | Why Not                                       |
|------------------------------|-----------------------------------------------|
| External cron service        | Adds infrastructure complexity, costs money   |
| Pinging from frontend        | Unreliable (users may not visit for days)     |
| Supabase Edge Functions      | Separate deployment, extra cost               |
| Only the in-process daemon   | Render free tier sleeps after 15 min — daemon never runs |
| Only a root URL ping         | Keeps Render warm but doesn't ping Supabase DB |
| **`/service/health-ping` via GitHub Actions** | **One curl wakes Render AND writes "hello hlulani" to Supabase** |

The `/service/health-ping` endpoint is the unified solution: a single HTTP request that kills two birds with one stone. GitHub Actions provides the reliable external trigger, and the endpoint ensures both Render and Supabase stay active.
