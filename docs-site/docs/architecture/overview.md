# Architecture Overview

## High-level shape

```
Frontend (React + Vite)
        |
        | HTTP requests
        v
Backend services (Node/Express)
  - auth-service       (port 5001)
  - dashboard-service  (port 5002)
  - project-service    (port 5003)
  - profile-service    (port 5004)
        |
        v
Supabase (PostgreSQL)
```

The frontend never talks to Supabase directly. Every read or write goes
through one of our own Express services first. This is what satisfies the
course's "hand-written API" requirement — Supabase is used purely as a hosted
database, not as an auto-generating API layer.

## Current status: separate deployed microservices

The architecture is intentionally split into four independent Node/Express
services, each deployed separately on Render with its own port, `package.json`,
and live URL (see [CI/CD & Deployment](cicd-deployment.md)). This is a genuine
microservices layout rather than a single shared backend, which keeps auth,
profile, project, and dashboard concerns isolated.

## Services

| Service             | Responsibility                                                         | Port | Live URL                                      |
| ------------------- | ---------------------------------------------------------------------- | ---- | --------------------------------------------- |
| `auth-service`      | Token verification and account deletion via Supabase Auth              | 5001 | `https://auth-service-hl52.onrender.com`      |
| `dashboard-service` | Cross-project summaries for the dashboard view                         | 5002 | `https://dashboard-service-bpc5.onrender.com` |
| `project-service`   | Create/read/update/archive projects; project entry formats and entries | 5003 | `https://project-service-96ml.onrender.com`   |
| `profile-service`   | Login and profile management                                           | 5004 | `https://profile-service-0zk7.onrender.com`   |

Entry formats and entries live inside `project-service`, alongside the
projects they belong to. The `profile-service` owns sign-in and user-profile
updates, while `auth-service` handles token verification and account deletion.

## Why this split

- **auth-service** isolates Supabase token verification and account deletion,
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
