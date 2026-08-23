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

## Google OAuth users and the `public.users` foreign key

**Issue:** Users who signed up with Google OAuth could not create projects.
The insert into `public.projects` failed with a foreign-key violation because
OAuth sign-in skips the create-profile page, so the user existed in
`auth.users` but not in `public.users`.

**Fix:** Two layers:

1. A migration (`002_auto_provision_public_users_for_auth.sql`) backfills
   existing auth users into `public.users` and adds an `AFTER INSERT` trigger
   on `auth.users` so future OAuth sign-ups are provisioned automatically.
2. The project-service auth middleware only tries to upsert a `public.users`
   row when `SUPABASE_SERVICE_ROLE_KEY` is set, avoiding permission errors
   when the service is configured with the anon key.

**Takeaway:** any authentication flow that can create an `auth.users` row must
also guarantee the matching application-level user row, or every foreign key
that references it will break for some users.

## Gitea → GitHub mirror delays

**Issue:** The team pushes to Gitea as the source of truth, but Render deploys
from the mirrored GitHub repo. After one push, the live site was still serving
the old build because the mirror had not forwarded the latest commit to GitHub.

**Fix:** Added GitHub as a second remote locally so any team member can push
straight to GitHub when the mirror stalls:

```bash
git remote add github https://github.com/Hlulani-B/Digital-Logbook.git
git push github main
```

This triggers Render immediately. The mirror still runs for normal pushes, but
the manual fallback removes the deployment bottleneck.

**Takeaway:** a push mirror is convenient but not instant; have a direct-push
fallback ready for demos and deadlines.

## Localhost testing limitations

**Issue:** The team could not reliably run the full stack locally, which made
it hard to test changes before committing. Code had to be pushed to confirm it
worked in the deployed environment.

**Fix:** No single fix yet. Mitigations include:

- Running services individually on their assigned ports and checking health
  routes (`/`) before starting the frontend.
- Using the deployed environment as the acceptance test while trying to keep
  local unit/service tests passing.
- Documenting the exact local ports and startup order in
  [Getting Started](../getting-started.md).

**Takeaway:** when local integration is painful, clear port assignments and
health-check habits become even more important. A containerised local setup
(Docker Compose) is a candidate improvement if time allows.
