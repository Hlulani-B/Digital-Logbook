# Code Quality Tools

This page documents every code quality tool configured across the Digital
Logbook project, what it checks, and how it is enforced.

---

## Summary

| Category | Tool | Scope | Enforced |
|---|---|---|---|
| Static types | TypeScript (strict) | Frontend | Build (`tsc -b`) |
| Build & bundle | Vite | Frontend | CI on every push |
| Unit tests | Vitest | Frontend | CI on every push |
| Component tests | Testing Library | Frontend | CI on every push |
| Coverage (frontend) | `@vitest/coverage-v8` | Frontend | CI badge |
| Unit tests | Jest | Backend (3 services) | CI on every push |
| Coverage (backend) | Jest `--coverage` | Backend (3 services) | CI badge |
| Coverage badges | `coverage-badges-cli` | All services | Auto-committed after CI |
| ESM compatibility | Babel (`babel-jest`) | Backend | Enables Jest + ESM |
| Dev reload | nodemon | Backend (project-service) | Local dev only |
| Commit format | Conventional Commits | All | Git workflow convention |
| CI/CD | Gitea Actions | All | Every push to `main` |
| Documentation | MkDocs Material | All | Built alongside code |

---

## Frontend

### TypeScript (strict mode)

**What**: Static type checker running as part of the Vite build pipeline.

**Configuration** (`frontend/tsconfig.json`):
- `"strict": true` — all strict checks enabled
- `"noUnusedLocals": true` — flags unused variables
- `"noUnusedParameters": true` — flags unused function parameters
- `"noFallthroughCasesInSwitch": true` — prevents accidental switch fallthrough
- `"verbatimModuleSyntax": true` — enforces explicit `type` imports
- `"noUncheckedSideEffectImports": true` — catches side-effect import issues

**Enforced**: Yes — `npm run build` runs `tsc -b && vite build`. If TypeScript fails, the build fails.

### Vite

**What**: Build tool and dev server for the frontend.

**Why it matters for quality**:
- Production builds use Rollup under the hood — tree-shaking removes dead code
- Native ES module dev server catches import errors immediately
- HMR (Hot Module Replacement) surfaces runtime errors without full page reloads

### Vitest

**What**: Unit testing framework for the frontend, configured with `jsdom` for DOM simulation.

**Configuration** (`frontend/vitest.config.ts`):
- Environment: `jsdom` — simulates a browser DOM in Node.js
- Globals: `true` — `describe`, `it`, `expect` available without imports
- Setup file: `src/test/setup.ts` — configures Testing Library matchers

**Key dependencies**:
- `@testing-library/react` — renders React components in tests
- `@testing-library/jest-dom` — custom matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)
- `@testing-library/user-event` — simulates user interactions (clicks, typing)

**Run**: `npm test` (single run) or `npm run test:watch` (watch mode)

### Coverage (Frontend)

**Tool**: `@vitest/coverage-v8`

**Run**: `npm run test:coverage`

**Output**: Coverage report printed to terminal with line, branch, and function percentages.

---

## Backend

### Jest

**What**: Unit testing framework used across all three backend services (auth-service, project-service, dashboard-service).

**Configuration**: Each service has a `jest` section in its `package.json`:
- Babel transform (`babel-jest` with `@babel/preset-env`) — enables Jest to run ES module code
- `collectCoverageFrom` — targets `src/functions/**/*.js`, excludes test and mock files
- `moduleNameMapper` (project-service) — maps `date-fns` to its CJS build for compatibility

**Supabase mock**: A custom mock client (`src/__mocks__/supabase.js`) simulates Supabase's chainable query builder (`.from().select().eq()`) without a real database connection.

**Run**: `npm test` in any service directory

**Test suites** (project-service as example):
- `entries.test.js` — CRUD operations for entries
- `natural_language.test.js` — AI parsing and project matching
- `project.test.js` — project creation, rename, archive
- `field.test.js` — custom field management
- `priority.test.js` — priority setting
- `activityLog.test.js` — activity log recording
- `archives.test.js` — archive/unarchive operations
- `getDate.test.js` — date extraction from text

### Coverage (Backend)

**Tool**: Jest `--coverage` with `coverage-badges-cli`

**Run**: `npm run test:coverage` in any service directory

**Output**:
- `coverage/coverage-summary.json` — machine-readable coverage data
- SVG badge generated and auto-committed with `[skip ci]` to prevent CI loops
- Badges displayed in the project README

### Babel (ESM Compatibility)

**What**: `@babel/core` + `@babel/preset-env` + `babel-jest`

**Why**: Jest does not natively support ES modules. Babel transforms `import`/`export` syntax to CommonJS at test time so Jest can run the same source code used in production.

---

## Project-Wide

### Conventional Commits

**What**: Commit message format enforced as a team convention.

**Format**: `<type>: <short description>`

| Type | Meaning |
|---|---|
| `feat` | New feature |
| `fix` | Bug fix |
| `docs` | Documentation only |
| `test` | Adding or updating tests |
| `refactor` | Code restructuring |
| `style` | Formatting, no logic change |
| `ci` | CI/CD configuration |
| `chore` | Maintenance tasks |

### Gitea Actions (CI/CD)

**What**: CI pipeline running on every push to `main`.

**Checks**:
- Frontend build (`tsc -b && vite build`)
- Backend tests (`npm test` in each service)
- Coverage reporting

### MkDocs Material

**What**: Static documentation site generator.

**Why it matters**: Documentation lives alongside code in `docs-site/`, versioned with the project. Material theme provides search, navigation, and responsive layout.

---

## How to Run All Checks Locally

```bash
# Frontend
cd frontend
npm run build          # TypeScript + Vite production build
npm test               # Vitest unit tests
npm run test:coverage  # Coverage report

# Backend (repeat for each service)
cd services/project-service
npm test
npm run test:coverage

cd services/auth-service
npm test

cd services/dashboard-service
npm test
```
