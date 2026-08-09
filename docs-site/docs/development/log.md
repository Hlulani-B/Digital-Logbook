# Development Log

This log records real issues we hit and how we resolved them, alongside the
reasoning behind our engineering decisions. We're keeping this intentionally
honest rather than presenting a falsely clean version of events — the course
rubric rewards showing evidence of process and decision-making, not just a
working end result.

## Repository & authentication setup

**Issue:** Pushing to the Gitea remote failed with an authentication error.
The token *label* ("hlulani") was mistaken for the actual secret token —
Gitea only shows the real generated token once, at creation.

**Fix:** Generated a new access token under **Gitea → Applications**, then
embedded it directly in the remote URL:

```bash
git remote set-url origin https://<TOKEN>@sdp.ms.wits.ac.za/codacaine/Digital-Logbook.git
```

Git then stores the token inside the local `.git/config`, so future pushes
don't require re-entering credentials.

**Security note:** the token is never committed to a tracked file — only kept
in local git config and, separately, in a private note. A leaked token would
let anyone push to or modify the repository.

## CI/CD constraints

See [CI/CD & Deployment](../architecture/cicd-deployment.md) for the full
writeup — summary of the two blocking constraints we had to design around:

1. Gitea Actions isn't enabled on `sdp.ms.wits.ac.za`.
2. The Gitea server sits on a private network, unreachable by Render/Vercel/Netlify directly.

Solved with a Gitea → GitHub push mirror → Render pipeline.

## Deployment issues (Render)

Three separate issues surfaced while deploying the backend services — folder
structure mismatch, a missing `start` script, and an entry-point path
mismatch. Full detail and fixes in
[CI/CD & Deployment](../architecture/cicd-deployment.md#problems-hit-during-deployment-and-fixes).

## Database design

Chose a dynamic, table-per-project schema (`fields` + `entries` with JSONB)
over a fixed-column schema, specifically to avoid needing a migration every
time a user customises their entry format. Full reasoning in
[Database Schema](../architecture/database.md).

## Frontend push delay

**Issue:** the frontend folder existed locally on a teammate's machine but
hadn't been pushed to Gitea, which briefly looked like a lost/missing-files
problem when checked from a different machine.

**Resolution:** confirmed via `git log --all --stat` that no commit touching
`frontend/` existed on any branch — it was simply not pushed yet. Once
pushed, `git fetch && git checkout main && git pull` picked it up correctly.

**Takeaway:** writing code and pushing it are two separate steps — worth
teammates confirming a push happened (not just a local commit) before
assuming something is "done."
