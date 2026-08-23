# Getting Started

This guide gets a new contributor (or a marking tutor) from zero to a running
local copy of the project.

## Prerequisites

- Node.js 20+
- Git
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
       token *label* (e.g. "hlulani") is not the secret itself.

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

## 3. Install and run the frontend

```bash
cd frontend
npm install
npm run dev
```

## 4. Install and run a backend service

Each backend service lives under `services/` and runs independently.

```bash
cd services/auth-service
npm install
npm start
```

Repeat for `dashboard-service`, `project-service`, and `profile-service` (each has its own
`package.json` and default port — see
[Architecture Overview](architecture/overview.md)).

## 5. Environment variables

Each service needs a local `.env` file (not committed) containing at least:

```
PORT=5001
SUPABASE_URL=<ask a teammate or check the team's shared secrets note>
SUPABASE_KEY=<ask a teammate or check the team's shared secrets note>
```

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
