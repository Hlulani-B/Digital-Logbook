# Project Methodology

This page describes the development methodology we follow and the Git
workflow conventions we enforce. Both are referenced by the Sprint 1 rubric
under **Project Methodology (10%)** and **Git Methodology (5%)**.

---

## Development Methodology: Scrum

We use a lightweight **Scrum** process adapted for a six-person university
team working in two-week sprints.

### Why Scrum?

| Factor                  | Why Scrum fits                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team size (6)           | Small enough for daily standups and quick consensus, large enough that work needs explicit ownership                                                |
| Sprint length (2 weeks) | Short feedback loops let us adjust scope if requirements change or a task takes longer than expected                                                |
| Academic context        | Scrum artifacts (user stories, backlog, sprint review) double as the evidence the rubric requires                                                   |
| Iterative delivery      | The Digital Logbook has many interconnected features — Scrum lets us ship a vertical slice each sprint rather than building everything horizontally |

### Scrum Artifacts

| Artifact            | Where it lives                              | Purpose                                                   |
| ------------------- | ------------------------------------------- | --------------------------------------------------------- |
| **Product Backlog** | [User Stories](user-stories.md)             | All known requirements, prioritised by sprint             |
| **Sprint Backlog**  | Trello board (team-private)                 | Tasks selected for the current sprint, assigned to owners |
| **Increment**       | Deployed services on Render + live frontend | Working software at the end of each sprint                |
| **Sprint Review**   | This documentation site                     | Demonstrable output: docs, tests, deployed URLs           |

### Scrum Events

| Event                    | Cadence                       | Evidence                                                                                |
| ------------------------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| **Sprint Planning**      | Start of each sprint          | User stories written with Given/When/Then acceptance criteria                           |
| **Daily Standup**        | Informal / async via WhatsApp | Meeting notes capture progress and blockers                                             |
| **Sprint Review**        | End of each sprint            | Commit history on [Roadmap](../roadmap.md), deployed demo                               |
| **Sprint Retrospective** | End of each sprint            | Entries in the [Development Log](log.md) documenting what went well and what to improve |

### Roles

| Role             | Who                 | Responsibility                                      |
| ---------------- | ------------------- | --------------------------------------------------- |
| Product Owner    | Team (shared)       | Prioritise backlog, clarify requirements with tutor |
| Scrum Master     | Rotating per sprint | Unblock the team, facilitate standups               |
| Development Team | All 6 members       | Implement, test, review, deploy                     |

---

## Git Workflow

### Branching Strategy

```
main          ← always deployable, protected branch
  └── feat/   ← one branch per user story or feature
       US3-create-project
       US5-quick-entry
  └── fix/    ← bug fixes
       fix-login-redirect
  └── docs/   ← documentation-only changes
       docs-methodology
```

- **`main`** is the single source of truth. It is always in a deployable state.
- **Feature branches** are created from `main` for each user story or significant piece of work.
- Feature branches are **merged back into `main`** via pull request once the work is complete and tests pass.
- The CI pipeline (Gitea Actions) runs on every push to `main` and on every pull request, catching broken builds before they land.

### Commit Convention

Every commit message follows the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>: <short description>
```

| Type       | Meaning                                                 |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature or user story implementation                |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only (no code change)                     |
| `test`     | Adding or updating tests                                |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `style`    | Formatting, whitespace, linting — no logic change       |
| `ci`       | CI/CD pipeline configuration                            |
| `chore`    | Maintenance tasks (dependency updates, config changes)  |

Examples from our commit history:

```
feat(services): add Express server setup and health routes
fix: update package.json entry point path to src/index.js
docs: add MkDocs documentation site
test: add coverage tests for activityLog, archives, priority, entries
ci: add Gitea Actions workflow for frontend and microservices
```

### Pull Request Workflow

1. Developer creates a feature branch from `main`.
2. Work is committed following the convention above.
3. Developer pushes the branch and opens a pull request on Gitea.
4. CI pipeline runs automatically — all tests must pass.
5. At least one teammate reviews the changes.
6. PR is merged into `main`.
7. Render auto-deploys from `main`.

### Code Quality Enforcement

| Check | Tool | When |
|---|---|---|
| Type checking | TypeScript strict mode (`tsc -b`) | Build + CI |
| Unit tests (frontend) | Vitest (`npm test`) | Local + CI |
| Unit tests (backend) | Jest (`npm test`) | Local + CI |
| Coverage | Vitest / Jest `--coverage` | Local + CI (badges in README) |
| Build | Vite (frontend) / Node (services) | CI on every push |

See [Code Quality Tools](code-quality.md) for full details.

See [Code Quality Tools](code-quality.md) for full details.

---

## Evidence Map

The table below shows where a marker can find evidence for each rubric
criterion that this methodology supports:

| Rubric Criterion          | Evidence                                                                                                                                                                |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version Control (10%)     | This repo — organised structure, CI pipeline, linting, coverage badges, all members committed                                                                           |
| Work Tracker (5%)         | [Work Tracker](work-tracker.md) (public sprint backlog with task owners, status, and evidence); private Trello board used for daily coordination                        |
| Git Methodology (5%)      | This page (branching strategy, commit convention, PR workflow)                                                                                                          |
| Project Methodology (10%) | This page (Scrum), plus [User Stories](user-stories.md), [Meetings](meetings.md), [Development Log](log.md), [Decisions](decisions.md), [Work Tracker](work-tracker.md) |
