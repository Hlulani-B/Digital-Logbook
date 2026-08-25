# Getting Started

This guide gets a new contributor (or a marking tutor) from zero to a running
local copy of the project.

## Prerequisites

- **Node.js 20+**
- **Git**
- **A Supabase project** (free tier works) — you'll need the database connection string
- A Gitea account on `sdp.ms.wits.ac.za`, registered with your **student email**
- A Gitea Personal Access Token (PAT) — SSH is disabled on this instance, so
  HTTPS + PAT is required for pushing

## 1. Get access

1. Register at `https://sdp.ms.wits.ac.za` using your student email.
   Accounts registered with any other email are automatically removed.
2. Once added to the `codacaine` organisation, generate a Personal Access
   Token under **Gitea → Settings → Applications**.

   !!! warning
   The token is only shown once, at creation. Copy it immediately — the
   token _label_ (e.g. "hlulani") is not the secret itself.

## 2. Clone the repository

```bash
git clone https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook.git
cd Digital-Logbook
```

If you hit an authentication error, set your token directly on the remote so
you don't need to re-enter it on every push:

```bash
git remote set-url origin https://<TOKEN>@sdp.ms.wits.ac.za/codacaine/Digital-Logbook.git
```

!!! danger "Never commit your token"
The token must never be committed to a tracked file. It's stored only in
your local `.git/config` (which is not tracked) and, separately, in a
private note. Anyone holding it could push to or modify the repository.

## 3. Set up the database

The project uses a **PostgreSQL** database (hosted on Supabase). All backend
services connect directly via `pg` (node-postgres) — not the Supabase SDK.

### 3a. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a free project.
2. Once ready, open the **SQL Editor** and run the full schema from
   [`supabase/setup.sql`](https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook/src/branch/main/supabase/setup.sql).
   This creates all tables, functions, indexes, and the nightly cron job.

### 3b. Get your connection string

In Supabase: **Settings → Database → Connection string → URI**. It looks like:

```
postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

!!! tip
If your password contains special characters (e.g. `@`, `#`, `?`),
URL-encode them — otherwise `pg` will fail to parse the connection string.

## 4. Configure environment variables

### Frontend — `frontend/.env`

```env
VITE_SUPABASE_URL=https://<PROJECT_REF>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-key>
VITE_SUPABASE_ANON_JWT=<your-anon-jwt>
VITE_AUTH_SERVICE_URL=http://localhost:5001
VITE_DASHBOARD_SERVICE_URL=http://localhost:5002
VITE_PROJECT_SERVICE_URL=http://localhost:5003
VITE_PROFILE_SERVICE_URL=http://localhost:5004
```

!!! note "Dev mode bypass"
Setting `VITE_DEV_BYPASS=true` in `.env` skips Supabase auth for local
testing (uses a hardcoded test user). Only works in `vite dev` mode.

### Backend services — one `.env` per service

Each service under `services/` needs its own `.env` file. They all share the
same `DATABASE_URL` (the Supabase Postgres connection string from step 3b).

**`services/auth-service/.env`**

```env
PORT=5001
SUPABASE_URL=https://<PROJECT_REF>.supabase.co
SUPABASE_KEY=<your-service-role-key>
```

**`services/dashboard-service/.env`**

```env
PORT=5002
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

**`services/project-service/.env`**

```env
PORT=5003
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
SUPABASE_JWKS_URL=https://<PROJECT_REF>.supabase.co/auth/v1/.well-known/jwks.json
```

**`services/profile-service/.env`**

```env
PORT=5004
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

### Optional — AI API keys (project-service)

The natural-language quick-add feature uses AI to parse spoken/text entries.
It tries multiple providers in a fallback chain. Add any of these to
`services/project-service/.env` to enable them:

```env
OPENROUTER_API_KEY=<key>
HF_API_KEY=<key>
CEREBRAS_API_KEY=<key>
GEMINI_API_KEY=<key>
GROQ_API_KEY=<key>
```

If no AI keys are set, natural-language parsing is skipped and entries must be
created manually through the normal form.

## 5. Install and run the frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server starts on **http://localhost:3000**.

## 6. Install and run backend services

Each backend service lives under `services/` and runs independently. Open a
separate terminal for each one:

```bash
# Terminal 1 — Auth service (port 5001)
cd services/auth-service
npm install
npm start

# Terminal 2 — Dashboard service (port 5002)
cd services/dashboard-service
npm install
npm start

# Terminal 3 — Project service (port 5003)
cd services/project-service
npm install
npm start

# Terminal 4 — Profile service (port 5004)
cd services/profile-service
npm install
npm start
```

### Service ports

| Service             | Default port | Description                                     |
| ------------------- | ------------ | ----------------------------------------------- |
| `auth-service`      | 5001         | User authentication (Supabase auth)             |
| `dashboard-service` | 5002         | Dashboard analytics, search, stats              |
| `project-service`   | 5003         | Projects, entries, fields, AI parsing, archives |
| `profile-service`   | 5004         | User profiles, login check, avatar, settings    |

!!! tip
You don't need all four services running to develop the frontend. At
minimum, `project-service` covers most entry/project CRUD. The frontend
will still load even if some services are unreachable.

## 7. Run the tests

Each service has its own test suite. From the service directory:

```bash
npm test
```

The project-service has the largest suite (~125 tests). Dashboard-service has
~22 tests and profile-service has ~18 tests.

## 8. Work Tracker (Trello)

Sprint planning, task allocation, and progress tracking are managed through Trello.

**Sprint 1 Board:**

- https://trello.com/b/bu363Eql/digital-logbook-sprint-1

Contributors should check the board before starting work, move tasks as they
progress, and ensure completed work is reflected on the board for Sprint 1
evidence and tracking.

The `auth-service` uses `SUPABASE_SERVICE_ROLE_KEY` instead of `SUPABASE_KEY`
for privileged account operations.

The frontend needs a `.env` file in `frontend/` with:

```
VITE_SUPABASE_URL=<same Supabase URL>
VITE_SUPABASE_ANON_KEY=<Supabase anon key>
VITE_PROJECT_SERVICE_URL=http://localhost:5003
VITE_PROFILE_SERVICE_URL=http://localhost:5004
```

See each folder's `.env.example` for the exact variables that service expects.

## Branches

- `main` — the default branch. All completed work is merged here.
- Feature branches — create a branch off `main` for each feature or fix, then
  open a merge request back into `main`.

!!! tip
Keep feature branches short-lived and focused on one change. This makes
reviews easier and reduces merge conflicts.

## Project structure

```
Digital-Logbook/
├── frontend/               # Vite + React + TypeScript SPA
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── context/        # React context (AuthContext)
│   │   ├── functions/      # API client functions
│   │   ├── pages/          # Route pages (Dashboard, SignIn, etc.)
│   │   └── lib/            # Supabase client, API URL helpers
│   └── vite.config.ts
├── services/
│   ├── auth-service/       # Express — Supabase auth proxy (port 5001)
│   ├── dashboard-service/  # Express — search, stats (port 5002)
│   ├── project-service/    # Express — CRUD, AI, archives (port 5003)
│   └── profile-service/    # Express — user profiles (port 5004)
├── supabase/
│   └── setup.sql           # Full database schema + RPCs + cron
├── docs-site/              # MkDocs documentation site
└── render.yaml             # Render deployment blueprint
```
