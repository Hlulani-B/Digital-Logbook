# CI/CD & Deployment

## Why this mattered

The course brief requires CI/CD for both collaboration and deployment
(Section 2.1). This is a graded requirement, factoring into the Milestone 1
and Milestone 4 rubrics under Version Control, Git Methodology, and Deployment.

## Constraints we had to design around

- **Gitea Actions was not enabled** on the university's instance
  (`sdp.ms.wits.ac.za`). Enabling it would require university-side
  infrastructure (dedicated runners, Docker provisioning), which wasn't
  realistic to request for one project — so CI could not run natively inside Gitea.
- **The Gitea server is on a private network.** Cloud hosting platforms
  (Render, Vercel, Netlify) could not reach `sdp.ms.wits.ac.za` directly — any
  "connect your Git repo" flow on those platforms failed with an invalid
  repository error.

## Solution: Gitea → GitHub push mirror → Render

```
Local commit → Wits Gitea (source of truth) → Push Mirror → GitHub → Render (build & deploy)
```

- **Only one component needs to be publicly reachable:** GitHub. Gitea
  remains the actual working repository the whole team pushes to.
- **Push mirror, not pull mirror** — configured with "Sync when commits are
  pushed," so every push to Gitea is forwarded to GitHub automatically, with
  no manual syncing step.
- **Mirror interval set to 0** (periodic polling disabled) since the
  push-triggered sync already fires in real time.
- **Render is connected to the mirrored GitHub repo**, not Gitea, since
  that's the only route Render can actually reach.
- **Fallback to manual push.** If the mirror stalls or a deploy is urgent,
  any team member can add GitHub as a second remote and push directly:
  `git remote add github https://github.com/Hlulani-B/Digital-Logbook.git`
  then `git push github main`.
- Commit authorship (names, emails) is preserved through the mirror, so
  individual contribution is still attributable on GitHub.

## CI pipeline definition

Committed at `.gitea/workflows/ci.yml`, on Gitea itself (not just GitHub), so
CI evidence is visible in the same repository tutors will actually be marking:

```yaml
name: Continuous Integration (CI) Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js Environment
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install & Test Frontend
        run: |
          cd frontend
          npm install
          npm test --if-present

      - name: Install & Test Auth Service
        run: |
          cd services/auth-service
          npm install
          npm test --if-present

      - name: Install & Test Dashboard Service
        run: |
          cd services/dashboard-service
          npm install
          npm test --if-present

      - name: Install & Test Project Service
        run: |
          cd services/project-service
          npm install
          npm test --if-present

      - name: Install & Test Profile Service
        run: |
          cd services/profile-service
          npm install
          npm test --if-present
```

## Repository settings and branch protection

The following settings are configured at the repository level in Gitea, not in committed files:

### Gitea Actions runners

- The Wits Gitea instance (`sdp.ms.wits.ac.za`) provides the runners that execute workflow jobs.
- For this project, the course staff provisioned **two runners**.
- Runners pick up jobs automatically when a workflow is triggered; no manual start is needed.
- If jobs begin queuing for long periods, the number of runners can be increased by the Gitea administrator.

### Branch protection on `main`

- Direct pushes to `main` are restricted.
- At least **one approving review** is required before a pull request can be merged.
- The CI pipeline must pass before merge (all tests and builds green).
- These rules are enforced through Gitea's branch protection settings, under **Repository Settings → Branches**.

### Why each part exists

| Part                                          | Reason                                                                                                                                                |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `on: push` / `pull_request`                   | Runs both when code lands on `main` and when a PR targets it, catching broken code before merge, not just after                                       |
| `runs-on: ubuntu-latest`                      | A clean, disposable VM per run, so results aren't polluted by any local machine's installed packages or state                                         |
| `actions/checkout@v4`                         | Pulls a fresh copy of the repo onto the VM — without it there's no code to test                                                                       |
| `actions/setup-node@v4`, `node-version: '20'` | Installs the JS runtime, pinned to the version the services are built for                                                                             |
| Four separate install-and-test steps          | One per service, since the repo is a monorepo of independently deployable services — testing them as one blob would hide which specific service broke |
| `npm test --if-present`                       | Prevents the pipeline from failing just because a service doesn't yet have a test script defined; it only fails on an actual failing test             |

## Deploying with `render.yaml`

Instead of manually configuring each service through Render's dashboard, a
single `render.yaml` blueprint at the repo root provisions all three services
from one file:

```yaml
services:
  - type: web
    name: auth-service
    env: node
    plan: free
    rootDir: services/auth-service
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: PORT
        value: 5001
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_KEY
        sync: false
  # ...same pattern for dashboard-service (5002), project-service (5003),
  # and profile-service (5004). A separate static site service is also
  # defined for the React frontend.
```

- **`plan: free`** is set explicitly — Render defaults new services to a paid
  instance type unless told otherwise, which triggered a payment prompt.
- **`sync: false`** on Supabase keys tells Render "enter this manually in the
  dashboard, don't try to sync it automatically" — so real secrets are never
  written into the committed YAML file.

## Problems hit during deployment (and fixes)

| Problem                                                    | Cause                                                                                                      | Fix                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `Root directory 'services/project-service' does not exist` | An earlier push had accidentally created a nested duplicate folder (`project-service/project-service/...`) | Renamed/restructured the top-level folder cleanly under `services/`, rather than encoding the mistake into `rootDir` |
| `Missing script: "start"`                                  | Each service's `package.json` had no `"start"` entry, which Render calls by default after building         | Added `"scripts": { "start": "node index.js" }`                                                                      |
| `Cannot find module '.../services/auth-service/index.js'`  | Each service's real entry file lived at `src/index.js`, not at the folder root                             | Corrected `package.json`: `"main": "src/index.js"`, `"scripts": { "start": "node src/index.js" }`                    |

!!! note "Lesson learned"
`render.yaml`'s `rootDir` only tells Render which folder to run commands
in — it knows nothing about the internal file layout inside that folder.
The `package.json` inside each service is what has to be accurate.

## Live services

| Service           | URL                                                                                |
| ----------------- | ---------------------------------------------------------------------------------- |
| Frontend          | [digital-logbook-bxgv.onrender.com](https://digital-logbook-bxgv.onrender.com)     |
| auth-service      | [auth-service-hl52.onrender.com](https://auth-service-hl52.onrender.com)           |
| dashboard-service | [dashboard-service-bpc5.onrender.com](https://dashboard-service-bpc5.onrender.com) |
| project-service   | [project-service-96ml.onrender.com](https://project-service-96ml.onrender.com)     |
| profile-service   | [profile-service-0zk7.onrender.com](https://profile-service-0zk7.onrender.com)     |
