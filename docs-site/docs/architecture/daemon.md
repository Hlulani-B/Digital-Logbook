# Keep-Alive Daemons (Supabase + Render)

## Problem

Two free-tier services need protection from inactivity pauses:

| Service | Inactivity Policy | Consequence |
|---------|-------------------|-------------|
| **Supabase** | Pauses after **7 days** of no DB activity | All API calls fail, app appears down |
| **Render** | Sleeps after **15 minutes** of no HTTP traffic | Cold starts take ~30s, service appears offline |

Both need a keep-alive mechanism to stay warm for a demo/portfolio project that must be available at all times.

## Solution Overview

Two complementary daemons handle each problem:

1. **Supabase Keep-Alive Daemon** — runs inside `dashboard-service` every 12 hours, pings the `health_ping` table to prevent Supabase from pausing.
2. **Render Keep-Alive Workflow** — a GitHub Actions cron job that pings the Render service URL every 10 minutes via `curl`, preventing Render's sleep timer from triggering.

## Part 1: Supabase Keep-Alive Daemon

### How It Works

A lightweight daemon runs inside the `dashboard-service` process. Every **12 hours** it:

1. Ensures the `health_ping` table exists (idempotent `CREATE TABLE`)
2. Inserts a row with the message `"hello hlulani"` and a timestamp
3. Deletes the row immediately after

This single INSERT + DELETE cycle is enough to register as database activity and prevent Supabase from pausing the project.

### Architecture

```
┌──────────────────────────────────────────────┐
│              dashboard-service               │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │         Keep-Alive Daemon              │  │
│  │                                        │  │
│  │  setInterval(12h) ──► ping()           │  │
│  │                       │                │  │
│  │                       ├─ ensureTable() │  │
│  │                       ├─ INSERT row    │  │
│  │                       └─ DELETE row    │  │
│  └────────────────────────────────────────┘  │
│                    │                         │
│                    ▼                         │
│              pool (pg Pool)                  │
└────────────────────┬─────────────────────────┘
                     │
                     ▼
            ┌────────────────┐
            │    Supabase     │
            │   PostgreSQL    │
            │                 │
            │  health_ping    │
            │  ┌───────────┐  │
            │  │ id        │  │
            │  │ message   │  │
            │  │ pinged_at │  │
            │  └───────────┘  │
            └────────────────┘
```

## Database Schema

The `health_ping` table is created by migration `006_create_health_ping_table.sql`:

| Column      | Type         | Description                          |
|-------------|--------------|--------------------------------------|
| `id`        | `BIGINT`     | Auto-generated identity primary key  |
| `message`   | `TEXT`       | Always `"hello hlulani"`             |
| `pinged_at` | `TIMESTAMPTZ`| Timestamp of the ping (defaults to `now()`) |

Row Level Security (RLS) is enabled on the table, but no user-facing policies exist. Only the backend service (using the service-role key / direct `DATABASE_URL`) can access it.

## Implementation

### File: `services/dashboard-service/src/functions/daemon.js`

| Export             | Type       | Description                                  |
|--------------------|------------|----------------------------------------------|
| `ping()`           | `async`    | Executes one ping cycle (ensure → insert → delete) |
| `startDaemon(ms?)` | `function` | Starts the daemon with optional interval override |
| `stopDaemon()`     | `function` | Stops the daemon and clears the timer        |
| `isDaemonRunning()`| `function` | Returns `true` if the daemon is active       |
| `getDaemonConfig()`| `function` | Returns current config (interval, message, running state) |

### Lifecycle

The daemon is started automatically when the `dashboard-service` boots:

```javascript
// services/dashboard-service/src/index.js
import { startDaemon } from './functions/daemon.js';

app.listen(PORT, () => {
  console.log(`dashboard-service running on port ${PORT}`);
  startDaemon();  // ← starts the keep-alive daemon
});
```

### Configuration

| Environment Variable | Default        | Description                       |
|----------------------|----------------|-----------------------------------|
| `PING_INTERVAL_MS`   | `43200000` (12h) | Interval between pings in milliseconds |

The interval can be overridden by passing a value to `startDaemon(intervalMs)` or setting the environment variable.

### Graceful Shutdown

The timer is `unref()`'d so it doesn't keep the Node.js process alive artificially. This allows graceful shutdown — when the service receives a termination signal, the event loop can exit cleanly even if the daemon timer is still pending.

## Performance Impact

| Metric         | Value                        |
|----------------|------------------------------|
| Queries/ping   | 3 (CREATE TABLE IF NOT EXISTS + INSERT + DELETE) |
| Ping frequency | Every 12 hours               |
| Data per ping  | 1 row inserted, 1 row deleted |
| Storage impact | ~0 (rows are deleted immediately) |
| Network cost   | Negligible (3 tiny queries/day) |

## Testing

The daemon has **12 unit tests** covering:

- Successful ping cycle (insert + delete)
- Error handling when pool is unavailable
- Error handling when queries fail
- Query ordering (ensureTable before INSERT before DELETE)
- Start/stop lifecycle
- Double-start prevention
- Immediate first ping + interval-based subsequent pings
- Configuration defaults and environment variable override
- Running state tracking through start/stop cycles

Run tests:

```bash
cd services/dashboard-service
npx jest src/__tests__/daemon.test.js
```

## Part 2: Render Keep-Alive Workflow (GitHub Actions)

### The Problem

Render free-tier services **sleep after 15 minutes** of inactivity. When a service is asleep, the first request takes ~30 seconds to cold-start. Worse, the in-process Supabase daemon can't run if the service is asleep in the first place.

### The Solution

A GitHub Actions workflow runs on GitHub's servers (not Render) and pings the Render URL every 10 minutes. Because GitHub runs the trigger, the service never hits the 15-minute inactivity window.

### File: `.github/workflows/keep-alive.yml`

```yaml
name: Keep Render Alive

on:
  schedule:
    - cron: '*/10 * * * *'   # Every 10 minutes
  workflow_dispatch:          # Manual trigger from GitHub UI

jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Send HTTP request to Render
        env:
          RENDER_URL: ${{ secrets.RENDER_URL }}
        run: |
          curl -f "$RENDER_URL" || echo "Ping failed, but workflow continues"
```

### Architecture

```
┌─────────────────────┐       curl every 10min      ┌──────────────────┐
│   GitHub Actions     │ ──────────────────────────► │  Render Service   │
│   (keep-alive.yml)   │                             │  (dashboard-svc)  │
│                      │                             │                    │
│   cron: */10 * * * * │                             │  ┌──────────────┐  │
│                      │                             │  │ Supabase     │  │
└─────────────────────┘                              │  │ Daemon (12h) │  │
                                                     │  └──────┬───────┘  │
                                                     └─────────┼──────────┘
                                                               │ ping DB
                                                               ▼
                                                      ┌────────────────┐
                                                      │   Supabase DB   │
                                                      └────────────────┘
```

### Setup Steps

1. **Create the workflow file** at `.github/workflows/keep-alive.yml` (already done).
2. **Add the Render URL secret:**
   - Go to GitHub repo → **Settings** → **Secrets and variables** → **Actions**
   - Click **New repository secret**
   - Name: `RENDER_URL`
   - Value: your live Render web service URL (e.g. `https://digital-logbook.onrender.com`)
3. **Push to `hlulani`** — GitHub Actions picks up the cron schedule automatically.

### Cost

| Resource | Free Allowance | Usage | Cost |
|----------|---------------|-------|------|
| GitHub Actions minutes | 2,000/month | ~43 min/month (144 pings/day × 0.3 min) | **$0** |
| Render bandwidth | Included | ~1 request/10 min | **$0** |

### Manual Trigger

The workflow supports `workflow_dispatch`, so you can manually trigger it from the GitHub Actions tab without waiting for the cron schedule. This is useful for immediately waking the service after a deploy.

## Why Two Daemons?

| Alternative                  | Why Not                                       |
|------------------------------|-----------------------------------------------|
| Cron job (external service)  | Adds infrastructure complexity, costs money   |
| Pinging from frontend        | Unreliable (users may not visit for days)     |
| Supabase Edge Functions      | Separate deployment, extra cost               |
| Only the in-process daemon   | Render free tier sleeps after 15 min — daemon never runs |
| Only the GitHub Actions ping | Keeps Render warm but doesn't ping Supabase DB |
| **Both daemons together**    | **GitHub keeps Render awake → daemon keeps Supabase alive** |

The two daemons are complementary:

- **GitHub Actions** solves the Render sleep problem — it runs on GitHub's servers, so it works even when Render is asleep. Every 10 minutes it sends an HTTP request to wake/keep the Render instance.
- **In-process daemon** solves the Supabase pause problem — once Render is awake and the service is running, the daemon periodically pings the database to prevent Supabase from pausing.

Neither daemon alone is sufficient. Together they cost nothing and keep the entire stack live.
