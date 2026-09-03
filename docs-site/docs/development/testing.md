# Testing

## Why testing mattered

The course brief (COMS3011A) requires evidence of both **automated testing**
and a **formal user feedback process**. Testing ensures that the frontend
behaves correctly as the codebase evolves across sprints, and the user
feedback loop guarantees that the product actually solves the problems its
stakeholders described.

## Testing policy

### Scope

| Layer | What is tested | Tool |
|---|---|---|
| Pure functions | Duration formatting, overdue detection, streak calculation, search API calls, tone preferences | Vitest |
| API layer | `request()` helper (auth headers, error handling, JSON parsing), service health checks | Vitest + mocked `fetch` |
| React components | ProtectedRoute (auth gating, redirects), QuickEntryBar (form submission, loading states, callbacks) | Vitest + Testing Library |
| Auth context | Sign-in, sign-up, sign-out, OAuth, password reset, account deletion/restore | Vitest + Testing Library |

### What is NOT tested (and why)

- **Visual/styling correctness** — CSS is reviewed manually during development; pixel-perfect testing is brittle and low-value at this project's scale.
- **Third-party library internals** — We mock Supabase, `react-router-dom`, and `fetch` rather than testing their implementations.
- **Voice recording (Web Speech API)** — Requires browser APIs unavailable in jsdom; covered by manual testing only.

### Policy rules

1. **Every new pure function must have a corresponding test file** in a `__tests__/` directory adjacent to the source.
2. **Every new React component that contains logic** (event handlers, conditional rendering, API calls) must have at least one render test and one interaction test.
3. **Tests must not depend on external services.** All HTTP calls are mocked; no test may reach a live backend URL.
4. **Tests must be deterministic.** No test may rely on `Date.now()` without accepting it as a parameter or mocking the clock. Time-dependent tests use fixed timestamps.
5. **CI must pass before merge.** The Gitea Actions CI pipeline runs `npm test` for the frontend and all services; a failing test blocks the push.

## Automated testing procedure

### Running tests locally

```bash
# From the frontend/ directory
npm test              # Run all tests once
npm run test:watch    # Watch mode (re-runs on file change)
npm run test:coverage # Generate coverage report (v8)
```

### Running tests in CI

The CI pipeline (`.gitea/workflows/ci.yml`) runs on every push and pull
request to `main`:

```yaml
- name: Install & Test Frontend
  run: |
    cd frontend
    npm install
    npm test --if-present
```

If any test fails, the pipeline fails and the push is flagged.

### Test file naming convention

- Test files live in `__tests__/` directories next to the code they test.
- File names match the source: `stats.js` → `__tests__/stats.test.js`.
- TypeScript tests use `.test.ts` or `.test.tsx` extensions.

### Test structure

Every test file follows the **Arrange → Act → Assert** pattern:

```javascript
import { describe, it, expect } from 'vitest';
import { formatDuration } from '../stats';

describe('formatDuration', () => {
  it('formats hours and minutes', () => {
    // Arrange
    const ms = 2 * 3600000 + 30 * 60000;
    // Act
    const result = formatDuration(ms);
    // Assert
    expect(result).toBe('2h 30m');
  });
});
```

### Mocking strategy

| What | How | Why |
|---|---|---|
| Supabase client | `vi.mock('@/lib/supabase')` | Prevents real database/auth calls |
| `fetch` | `vi.stubGlobal('fetch', vi.fn())` | Isolates API tests from network |
| React Router | `<MemoryRouter>` wrapper | Controls navigation in component tests |
| `localStorage` | `localStorage.clear()` in `beforeEach` | Prevents test pollution |
| Child components | `vi.mock('../Component')` | Tests one component in isolation |

### Coverage

Coverage is measured with `@vitest/coverage-v8` and reported in the
terminal. The goal is **meaningful coverage** of business logic, not 100%
line coverage. Pure functions (stats, overdue, streaks, tone) are fully
covered; component tests focus on user-facing behaviour.

## Test inventory

### Frontend tests

| Test file | What it covers | # tests |
|---|---|---|
| `functions/dashboard/__tests__/stats.test.js` | `formatDuration`, `formatInterval`, `calculateTotalTimeTracked`, `calculateProjectStats` | 18 |
| `functions/dashboard/__tests__/overdue.test.js` | `isOverdue`, `getOverdueText` | 12 |
| `functions/dashboard/__tests__/streaks.test.js` | `calculateStreaks`, `streakLabel` | 9 |
| `functions/dashboard/__tests__/search.test.js` | `searchAll`, `searchProject`, `searchProjects` (with fetch mocking) | 7 |
| `functions/__tests__/tone.test.ts` | `getTone`, `setTone`, `getToneInstruction`, `TONE_OPTIONS` | 11 |
| `lib/__tests__/api.test.ts` | `request()` (auth headers, errors, JSON), `api.*.health()` | 8 |
| `context/__tests__/AuthContext.test.tsx` | Full auth flow: sign-in, sign-up, OAuth, password reset, delete/restore | 12 |
| `components/__tests__/ProtectedRoute.test.tsx` | Auth gating, loading state, fallback session check, redirect | 5 |
| `components/__tests__/QuickEntryBar.test.tsx` | Form submission, success/error messages, callbacks, voice button, Enter key | 11 |

### Backend tests

Each microservice has its own test suite (run via `npm test` in the
service directory):

| Service | Test file | What it covers |
|---|---|---|
| auth-service | `src/__tests__/index.test.js` | Health endpoint, Supabase auth integration |
| dashboard-service | `src/__tests__/` | Search, stats, activity endpoints |
| project-service | `src/__tests__/` | CRUD for entries, fields, projects, archives, priority |

## User feedback formal process

### Overview

User feedback is collected, triaged, and acted upon through a structured
process that ensures stakeholder input directly shapes development
priorities.

### Feedback collection

| Method | When | Who |
|---|---|---|
| **Sprint client meetings** | End of each sprint | Full team + client stakeholder |
| **Stakeholder demos** | After major feature completion | Team presents working software to client |
| **Meeting minutes** | Every meeting | Recorded in `development/meetings.md` |
| **Issue tracker** | Ongoing | Client and team log bugs/requests as issues |

### Feedback triage process

```
Feedback received
       │
       ▼
Logged as issue (with label: bug / enhancement / UX)
       │
       ▼
Discussed in next sprint planning
       │
       ▼
Assigned to sprint backlog (or deferred with reason)
       │
       ▼
Implemented → tested → deployed
       │
       ▼
Confirmed with stakeholder at next demo
```

### Formal documentation

All feedback is documented in:

- **Meeting logs** (`development/meetings.md`) — dated entries with attendees,
  discussion points, and action items.
- **Stakeholder interaction log** (`development/stakeholder-interaction.md`) —
  summary of all client touchpoints and outcomes.
- **User stories** (`development/user-stories.md`) — sprint-scoped stories
  derived from feedback, written in "As a [user], I want [goal] so that
  [reason]" format.
- **Decisions log** (`development/decisions.md`) — architectural or product
  decisions made in response to feedback, with rationale.

### Acceptance criteria

Every user story derived from feedback must have:

1. **Clear acceptance criteria** — testable conditions that define "done".
2. **A corresponding automated test** — if the story involves logic, a test
   must verify the behaviour.
3. **Stakeholder sign-off** — confirmed at the next sprint demo or meeting.

### Feedback loop closure

After implementation, the team:

1. Updates the original issue with a link to the commit/PR.
2. Demonstrates the change to the stakeholder.
3. Records the stakeholder's response (accepted / needs revision).
4. If revision is needed, a new issue is created and the cycle repeats.

!!! note "Continuous improvement"
    This process is not fixed — it is reviewed and refined at each
    sprint retrospective based on what worked and what didn't.
