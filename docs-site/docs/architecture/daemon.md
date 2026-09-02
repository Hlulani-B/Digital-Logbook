# Supabase Keep-Alive Daemon

## Problem

Supabase free-tier projects are **paused after 7 days of inactivity**. When the database is paused, all API calls fail and the application appears down. This is problematic for a demo/portfolio project that needs to be available at all times.

## Solution

A lightweight daemon runs inside the `dashboard-service` process. Every **12 hours** it:

1. Ensures the `health_ping` table exists (idempotent `CREATE TABLE`)
2. Inserts a row with the message `"hello hlulani"` and a timestamp
3. Deletes the row immediately after

This single INSERT + DELETE cycle is enough to register as database activity and prevent Supabase from pausing the project.

## Architecture

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

## Why This Approach?

| Alternative                  | Why Not                                       |
|------------------------------|-----------------------------------------------|
| Cron job (external service)  | Adds infrastructure complexity, costs money   |
| Pinging from frontend        | Unreliable (users may not visit for days)     |
| Supabase Edge Functions      | Separate deployment, extra cost               |
| **Daemon in existing service** | **Zero extra infra, runs wherever the service runs** |

The daemon piggybacks on the existing `dashboard-service` process — no additional servers, cron jobs, or external services needed. Since the service is already deployed on Render, the daemon runs for free as part of the existing deployment.
