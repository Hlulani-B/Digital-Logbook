# Architecture Overview

## High-level shape

```
Frontend (React + Vite)
        |
        | HTTP requests
        v
Backend services (Node/Express)
  - auth-service       (port 5001)
  - dashboard-service   (port 5002)
  - project-service     (port 5003)
        |
        v
Supabase (PostgreSQL)
```

The frontend never talks to Supabase directly. Every read or write goes
through one of our own Express services first. This is what satisfies the
course's "hand-written API" requirement — Supabase is used purely as a hosted
database, not as an auto-generating API layer.

## Current status: separate deployed microservices

!!! warning "Team decision needed"
    Each service above is deployed **independently** on Render, with its own
    port, its own `package.json`, and its own live URL (see
    [CI/CD & Deployment](cicd-deployment.md)). This is a genuine microservices
    architecture, not the "microservices-inspired but deployed as one backend
    app" approach the team originally scoped for Sprint 1 to avoid extra
    deployment complexity. This is real, working infrastructure — but it's a
    bigger commitment (three services to keep running, debug, and keep in sync)
    than originally planned, and should be confirmed as an intentional team
    decision rather than something that happened by default.

## Services

| Service | Responsibility | Port | Live URL |
|---|---|---|---|
| `auth-service` | Token verification, sign-in/sign-up integration via Firebase Auth | 5001 | `https://auth-service-hl52.onrender.com` |
| `dashboard-service` | Cross-project summaries for the dashboard view | 5002 | `https://dashboard-service-bpc5.onrender.com` |
| `project-service` | Create/read/update/archive projects; project entry formats and entries | 5003 | `https://project-service-96ml.onrender.com` |

!!! note "Not yet clarified"
    Entry and entry-format logic is currently expected to live inside
    `project-service`. This should be confirmed — see
    [Open Questions & Decisions](../development/decisions.md).

## Why this split

- **auth-service** isolates all authentication concerns behind Firebase Auth,
  so no other service needs to know how login/signup actually works — they
  only need to verify a token.
- **project-service** owns projects, entry formats, and entries — the actual
  core data of the logbook.
- **dashboard-service** exists to aggregate data across projects for the
  dashboard view (total time per project, active project count, etc.) without
  making `project-service` responsible for cross-project reporting.

## Each service's minimal bootstrap

Every service follows the same base pattern, differing only in port and name:

```js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ service: 'auth-service', status: 'healthy' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Auth Service running on port ${PORT}`);
});
```

- `dotenv` loads local environment variables for development; in production,
  Render injects real environment variables directly, so this call is a no-op there.
- `process.env.PORT || 5001` — Render assigns its own port at runtime via
  `PORT`; hardcoding a port would break Render's health check.
- Binding to `0.0.0.0` (not `localhost`) is required so the service is
  reachable from outside its container.
- `cors()` is required because the frontend and each backend service are
  hosted on different origins.
- The `/` health route gives an immediate, simple way to confirm a service is
  actually running.
