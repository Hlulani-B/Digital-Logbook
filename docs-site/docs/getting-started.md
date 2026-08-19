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

Repeat for `dashboard-service` and `project-service` (each has its own
`package.json` and default port — see
[Architecture Overview](architecture/overview.md)).

## 5. Work Tracker (Trello)

Sprint planning, task allocation, and progress tracking are managed through Trello.

**Sprint 1 Board:**

- https://trello.com/b/bu363Eql/digital-logbook-sprint-1

Contributors should check the board before starting work, move tasks as they progress, and ensure completed work is reflected on the board for Sprint 1 evidence and tracking.

## Branches

- `main` — the current default/working branch
- `services` — *(clarify with the team what this branch is for and whether it should be merged into `main` or retired)*

!!! note "Open question"
    Confirm with the team which branch new work should target, and whether
    `services` should be merged into `main`. See
    [Open Questions & Decisions](development/decisions.md).
