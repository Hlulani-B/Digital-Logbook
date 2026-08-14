# AI Pair-Programming Transcript — Digital Logbook

**Date:** 14 August 2026  
**Project:** Codacaine Digital Logbook (React frontend + Node/Express microservices + Supabase)  
**Repository:** `https://github.com/Hlulani-B/Digital-Logbook.git` / Gitea mirror  

This document records the changes made with the help of the AI coding assistant during the session.

---

## 1. Repository Setup

- Cloned `main` from the Gitea origin. When direct authentication failed, the GitHub mirror was used to initialise the local workspace.
- Added `GITEA_TOKEN` to the root `.env` file and ensured `.gitignore` excluded `.env` files.
- Added the Gitea remote and configured GitHub/Gitea remotes for pull/push workflow.

## 2. Profile Service

### Created
- `services/profile-service/` matching the existing service pattern.
- `services/profile-service/package.json` — Node/Express service with ESM (`"type": "module"`), Jest test script and Babel dev dependencies.
- `services/profile-service/src/supabase.js` — Supabase client using `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY || SUPABASE_KEY`.
- `services/profile-service/src/config.js` — loads `.env` before any imports that need environment variables.
- `services/profile-service/src/index.js` — Express server mounting routes under `/service`.

### Backend functions — `services/profile-service/src/functions/`
- `login.js` — `Login.checkUser(email)` returns `true` if the user exists in the `users` table, otherwise `false`.
- `profile.js` — preserved the user's class structure:
  - `Username.username(email, username)` — rejects if username is taken, otherwise updates the user's username.
  - `Email.email(email)` — inserts a new user email.
  - `Name.name(email, new_name)` — updates the user's display name.
  - `Avatar.avatar(email, url)` — updates the user's avatar URL.
  - `Profile.getProfile(email)` — fetches a full profile.
  - `Profile.deleteProfile(email)` — cascades deletion across `entries`, `fields`, `projects`, and `users`.

### Routes — `services/profile-service/src/Routes/`
- `login.js` — `POST /service/login` with `function: "checkUser"`.
- `profile.js` — `POST /service/profile` with `function`: `"username"`, `"email"`, `"name"`, `"avatar"`, `"getProfile"`, `"deleteProfile"`.

### Tests — `services/profile-service/src/__tests__/`
- `login.test.js` — 3 tests for user-exists, user-not-found, and error cases.
- `profile.test.js` — 13 tests covering all profile classes and success/failure paths.
- `src/__mocks__/supabase.js` and `src/__mocks__/supabaseMock.js` — shared Supabase mock helpers.
- `babel.config.js` — Babel/Jest ESM transform configuration.

### Frontend — `frontend/src/functions/profile/`
- `login.js` — `checkUser(email)`.
- `profile.js` — `updateUsername`, `addEmail`, `updateName`, `updateAvatar`, `getProfile`, `deleteProfile`.

### Result
All profile-service tests pass:

```text
Test Suites: 2 passed, 2 total
Tests:       16 passed, 16 total
```

---

## 3. Project Service Improvements

### ESM conversion
- Converted `services/project-service` from CommonJS to ESM (`"type": "module"`).
- Added `src/config.js` so `.env` loads before Supabase imports.
- Rewrote `src/index.js` with ESM imports and mounted all routes under `/service`.
- Updated `babel.config.js` for ESM Jest tests.

### Bug fixes
- Fixed `project.js` to import `{ supabase }` from `../supabase.js` (was using undefined `supabase_client`).
- Fixed `entries.js` and `priority.js` Supabase imports from default to named imports.
- Fixed `priority.js` logic that confused the method parameter with a constant.

### Cascade on project changes
- `deleteProject` now deletes related rows from `entries`, then `fields`, then `projects`.
- `editProjectName` now updates `project_name` in `entries` and `table_name` in `fields` before renaming the project.

### Archive feature end-to-end
- Implemented `services/project-service/src/functions/archives.js`:
  - `archive_project` / `unarchive_project` — sets `is_archived` on `projects`.
  - `archive_entry` / `unarchive_entry` — sets `archived` on `entries`.
- Created `services/project-service/src/Routes/archive.js` — `POST /service/archive`.
- Created `frontend/src/functions/project/archives.js` for the React frontend.
- Updated `docs-site/docs/architecture/database.md` to document the archive columns.
- Added `services/project-service/src/__tests__/archives.test.js`.

### Field feature
- Created `services/project-service/src/Routes/field.js` and connected it in `index.js`.
- Created `frontend/src/functions/project/fields.js` (user's frontend update).

### Tests
- `services/project-service` tests cover `project.js`, `entries.js`, `priority.js`, and `archives.js`.

```text
Test Suites: 4 passed, 4 total
Tests:       42 passed, 42 total
```

---

## 4. Database Schema Documentation

Updated `docs-site/docs/architecture/database.md` to match the live Supabase schema shown in the screenshot:

- `projects` now documents both `is_archived` (canonical project archive flag) and `archived` columns.
- `entries` documents the `archived` column.
- Added `idx_projects_is_archived` index and updated SQL `ALTER TABLE` statements.
- Added rationale explaining why `is_archived` is used for projects and `archived` for entries.

---

## 5. Render & CI Configuration

- Updated `render.yaml` to include the new `profile-service` and `.env` variables (`SUPABASE_URL`, `SUPABASE_KEY`, `PORT`) for all services with `sync: false` for secrets.
- Updated `.gitea/workflows/ci.yml` to include the profile-service build/test step.
- Added local `.env` files under each service directory for local development.

---

## 6. Sync & Push

- Fetched latest `main` from GitHub and Gitea.
- Merged remote changes where needed.
- Pushed commits to both GitHub and Gitea `main` so both mirrors stay in sync.

---

## Commands Verified During the Session

```bash
# Profile service tests
cd services/profile-service
npm test

# Project service tests
cd services/project-service
npm test

# Start profile service locally
cd services/profile-service
npm start

# curl health check
curl http://localhost:5004/

# curl login route
curl -X POST http://localhost:5004/service/login \
  -H "Content-Type: application/json" \
  -d '{"function":"checkUser","values":{"email":"test@example.com"}}'
```

---

## Notes

- The frontend profile-service URL is currently set to `https://profile-service.onrender.com`. Update it to the actual Render deployment URL once the service is deployed.
- An uncommitted `getAllEntries` method in `services/project-service/src/functions/entries.js` was preserved and included in the commit.
