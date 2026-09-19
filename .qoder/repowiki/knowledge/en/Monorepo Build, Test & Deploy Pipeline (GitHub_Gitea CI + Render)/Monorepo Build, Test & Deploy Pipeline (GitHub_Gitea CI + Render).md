---
kind: build_system
name: Monorepo Build, Test & Deploy Pipeline (GitHub/Gitea CI + Render)
category: build_system
scope:
  - '**'
source_files:
  - render.yaml
  - .github/workflows/ci.yml
  - .github/workflows/backend-unit-tests.yml
  - .github/workflows/backend-integration-tests.yml
  - .github/workflows/frontend-unit-tests.yml
  - .github/workflows/frontend-integration-tests.yml
  - .github/workflows/docs.yml
  - .gitea/workflows/ci.yml
  - package.json
  - frontend/package.json
  - services/auth-service/package.json
  - services/dashboard-service/package.json
  - services/profile-service/package.json
  - services/project-service/package.json
  - scripts/migrate.js
  - supabase/migrations/000_baseline_full_schema.sql
---

## Overview

The Digital Logbook monorepo uses a **multi-stage CI pipeline** driven by GitHub Actions (with parallel Gitea mirrors) and deploys to **Render** via a single `render.yaml` manifest. There are no Dockerfiles or Makefiles; the build system is entirely npm/Node.js based with per-package scripts.

## Build System

- **Frontend**: React + TypeScript app built with **Vite**. The build script is `tsc -b && vite build`, producing a static SPA under `frontend/dist/`. A `.env.example` defines `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` as build-time env vars consumed by Vite.
- **Backend microservices** (`auth-service`, `dashboard-service`, `profile-service`, `project-service`): Plain Node.js Express apps. Each service has its own `package.json` with `start: node src/index.js` and `dev: nodemon src/index.js`. No transpilation step — services run directly on Node 20.
- **Documentation site**: MkDocs site under `docs-site/`, built with `mkdocs build --strict` after `pip install -r requirements.txt`.
- **Database migrations**: Versioned SQL files under `supabase/migrations/` (e.g. `000_baseline_full_schema.sql` through `011_create_notifications.sql`) applied via a custom CLI at `scripts/migrate.js`, exposed as root npm scripts `db:migrate`, `db:status`, `db:bootstrap`.
- **Root workspace**: Root `package.json` only holds shared tooling (`prettier`, `husky`, `lint-staged`) and the DB migration scripts. It runs `npm ci` in CI but does not orchestrate per-package builds itself — each sub-project manages its own dependencies.

## CI Pipelines (GitHub Actions)

Two nearly identical sets of workflows exist under `.github/workflows/` and `.gitea/workflows/` for GitHub and Gitea respectively.

### Unit tests

- **Frontend unit tests** (`.github/workflows/frontend-unit-tests.yml`): Runs `vitest run --exclude "src/__integration__/**"` with JUnit output, caching `frontend/package-lock.json`.
- **Backend unit tests** (`.github/workflows/backend-unit-tests.yml`): Matrix job over all four services, running `jest --testPathIgnorePatterns="integration"` with JUnit output, caching each service's `package-lock.json`.

### Integration tests

- **Frontend integration tests** (`.github/workflows/frontend-integration-tests.yml`): Runs `vitest run src/__integration__/`.
- **Backend integration tests** (`.github/workflows/backend-integration-tests.yml`): Matrix job over all four services, running `jest --testPathPattern="integration"`.

### Full CI

- **`.gitea/workflows/ci.yml`**: Sequential pipeline that checks formatting (`npm run format:check`), then installs and runs lint/test/build for the frontend (`oxlint`, `npm test`, `npm run build`), and installs/tests for each backend service.

### Docs deployment

- **`.github/workflows/docs.yml`**: On push to `main` touching `docs-site/**`, builds with `mkdocs gh-deploy --force` using Python 3.11.

### Test reporting

All jobs publish results via `dorny/test-reporter@v1` to GitHub Checks and upload `test-results.xml` artifacts retained for 30 days.

## Deployment

Deployment is defined declaratively in `render.yaml`, which declares six Render services:

| Service             | Type       | Root Dir                     | Build Command                                              | Start Command           |
| ------------------- | ---------- | ---------------------------- | ---------------------------------------------------------- | ----------------------- |
| `digital-logbook`   | static web | `frontend`                   | `npm install && npm run build`                             | served from `dist/`     |
| `auth-service`      | node web   | `services/auth-service`      | `npm install`                                              | `npm start` (PORT 5001) |
| `dashboard-service` | node web   | `services/dashboard-service` | `npm install`                                              | `npm start` (PORT 5002) |
| `project-service`   | node web   | `services/project-service`   | `npm install`                                              | `npm start` (PORT 5003) |
| `profile-service`   | node web   | `services/profile-service`   | `npm install`                                              | `npm start` (PORT 5004) |
| `docs-site`         | static web | `docs-site`                  | `pip install -r requirements.txt && mkdocs build --strict` | served from `site/`     |

Environment variables (Supabase keys, AI provider keys) are injected as Render secrets. The frontend SPA routes are rewritten to `/index.html` for client-side routing.

## Conventions & Constraints

- **Node version pinned to 20** across all CI jobs via `actions/setup-node@v4`.
- **Dependency locking**: Every package directory ships a `package-lock.json`; CI uses `npm ci` (not `npm install`) for reproducible installs.
- **Test separation**: Backend tests use Jest with path patterns `--testPathIgnorePatterns="integration"` vs `--testPathPattern="integration"`; frontend tests use Vitest with `src/__integration__/` excluded from unit runs and explicitly invoked for integration runs.
- **Per-service isolation**: Each backend service has its own `package.json`, `babel.config.js`, `src/`, and `__tests__/` — there is no shared workspace dependency graph between services.
- **Formatting enforced at commit time**: Husky pre-commit hook runs `lint-staged` which invokes Prettier on staged files; CI also runs `npm run format:check` at the root level.
- **Frontend linting**: Uses `oxlint` (configured via `.oxlintrc.json`) rather than ESLint.
- **No containerization**: There are no `Dockerfile`s; deployment is direct to Render's managed runtime.
- **Database schema evolution**: All schema changes go through numbered SQL migration files in `supabase/migrations/` and are applied via `scripts/migrate.js`.
