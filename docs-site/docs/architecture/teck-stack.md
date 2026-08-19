# Tech Stack

## Frontend

### React 18
**What**: Component-based UI library for building interactive interfaces.

**Why**:
- Team had prior React experience from coursework and personal projects
- Massive ecosystem (component libraries, hooks, dev tools) reduces build time
- Component reusability maps well to our repeated UI patterns (EntryBox, drawer items, stats cards)
- Concurrent features in React 18 improve perceived performance during AI calls and data fetching
- Easy to hire for — most frontend developers know React

### TypeScript
**What**: Superset of JavaScript that adds static type checking.

**Why**:
- Catches bugs at compile time instead of runtime (e.g., wrong prop types, missing fields)
- IDE autocompletion speeds up development and reduces typos
- Self-documenting code — types serve as inline documentation for team members
- Refactoring is safer — the compiler flags every place that breaks when you rename a field
- The frontend started as JavaScript but was converted to TypeScript early because type errors from API responses were causing silent failures

### Vite
**What**: Next-generation frontend build tool and dev server.

**Why**:
- Near-instant dev server startup (uses native ES modules instead of bundling)
- Hot Module Replacement (HMR) updates components in milliseconds without losing state
- Built-in TypeScript support — no separate `tsc` config needed for development
- Smaller production bundles than Webpack/CRA thanks to Rollup-based optimization
- We switched from Create React App to Vite because CRA was deprecated and its Webpack builds took 30+ seconds

### CSS Custom Properties (Variables)
**What**: Native CSS theming system using `--variable-name` syntax.

**Why**:
- Enables runtime theme switching without JavaScript or CSS-in-JS libraries
- One set of variable definitions powers all 6 themes (light, dark, pastel, brown vintage, etc.)
- No build step needed — the browser handles variable resolution natively
- Dark mode is a simple `[data-theme="dark"]` selector override, not a separate stylesheet
- Avoids the complexity and bundle size of styled-components or Tailwind for a project our size

### React Router v6
**What**: Client-side routing library for single-page applications.

**Why**:
- Standard routing solution for React with declarative `<Route>` syntax
- Nested routes map cleanly to our layout (Dashboard wraps all authenticated pages)
- `useNavigate` hook replaces the deprecated `useHistory` for programmatic navigation
- Protected route pattern lets us gate authenticated pages behind `requireAuth` logic

---

## Backend

### Node.js 20
**What**: JavaScript runtime for server-side applications.

**Why**:
- Same language (JavaScript/TypeScript) on frontend and backend reduces context switching
- Team already knew JavaScript from the frontend — no need to learn Python, Java, or Go
- Non-blocking I/O handles concurrent API calls (especially AI provider chains) efficiently
- Massive npm ecosystem means we never build common things (CORS, JWT verification, HTTP clients) from scratch
- Render's native support for Node.js means zero-config deployment

### Express.js
**What**: Minimal web framework for building REST APIs in Node.js.

**Why**:
- Industry standard for Node.js APIs — well-documented, battle-tested
- Middleware pattern lets us layer CORS, auth verification, and error handling cleanly
- Lightweight — no opinionated structure, so we control our own architecture
- Each microservice is ~100 lines of boilerplate (app setup, middleware, routes, error handler)
- Express 5 (which we use) adds better async error handling and improved path matching

### Microservices Architecture (4 services)
**What**: Separate Express apps for auth, project, dashboard, and profile concerns.

**Why**:
- **auth-service** (port 5001): Isolates all authentication logic — other services just verify a JWT token, they never handle passwords or OAuth flows directly
- **project-service** (port 5003): Owns the core data (projects, entries, fields, priorities, activity log, natural language parsing) — the heaviest service with the most business logic
- **dashboard-service** (port 5002): Aggregates cross-project data (search, stats) without polluting project-service with reporting concerns
- **profile-service** (port 5004): Manages user profiles (username, avatar) separately from auth — profiles can be updated without touching authentication
- Each service deploys independently on Render — if one crashes, the others keep running
- Satisfies the course requirement for a "hand-written API" since each endpoint is explicitly coded

### ES Modules (ESM)
**What**: Native JavaScript module system using `import`/`export` syntax.

**Why**:
- Modern standard — matches the frontend's module system
- Tree-shaking support reduces bundle size
- `"type": "module"` in package.json enables ESM across all services
- Consistent syntax between frontend and backend reduces mental overhead

---

## Database

### Supabase (PostgreSQL)
**What**: Open-source Firebase alternative built on top of PostgreSQL.

**Why**:
- **Auth built in**: Email/password, Google OAuth, GitHub OAuth — all handled by Supabase Auth with JWT issuance, token refresh, and password reset flows. We would have spent weeks building this from scratch.
- **PostgreSQL**: Full relational database with ACID compliance, foreign keys, and advanced features like JSONB — not a NoSQL store that limits us later
- **JSONB support**: Entry fields are stored as JSONB because each project has different custom fields. PostgreSQL JSONB supports indexing and querying, so we don't sacrifice query power for flexibility
- **Real-time subscriptions** (available but not yet used): Could power live dashboard updates in Sprint 2
- **Free tier**: Generous enough for our course project — 500MB database, 50,000 monthly active auth users
- **Row Level Security** (available): Could add an extra layer of data isolation if needed

### Database Schema Design
**What**: 5 core tables with email-based foreign keys.

**Why**:
- `users` (email PK): Email as primary key avoids a separate user_id lookup — the auth system already identifies users by email
- `projects` (user_email FK): Direct foreign key to users without an intermediate join table
- `entries` (user_email + project_name FK): Composite foreign key ensures entries always belong to a valid user-project pair
- `fields` (user_email + project_name FK): Custom fields are per-project, so the FK mirrors the project relationship
- `activity_log` (user_email FK): Append-only log for auditing — never deletes, only inserts
- Cascade deletes on foreign keys ensure cleaning up a user removes all their data in one operation

---

## AI Integration

### Multi-Provider AI Chain
**What**: Sequential fallback through 5 AI providers for natural language parsing.

**Why**:
- **HuggingFace** (free tier): Tried first — zero cost, good for simple parsing tasks
- **OpenRouter** (pay-per-use): Second fallback — accesses multiple models through one API, reliable
- **Cerebras** (fast inference): Third — extremely fast response times for time-sensitive parsing
- **Gemini** (Google): Fourth — strong at structured JSON output
- **Groq** (fast inference): Fifth — another fast option with good JSON compliance
- Cooldown tracking prevents rapid retries to a rate-limited provider
- Lazy-loaded SDKs keep memory footprint small — only the active provider's SDK is loaded
- If all providers fail, the user gets a clear error message instead of a silent failure

---

## CI/CD

### Gitea Actions
**What**: CI/CD workflow system (GitHub Actions compatible) running on our self-hosted Gitea.

**Why**:
- Gitea is our primary repository host (self-hosted at sdp.ms.wits.ac.za for the course)
- Gitea Actions uses the same YAML workflow syntax as GitHub Actions — no new syntax to learn
- Triggers on every push to `main` and `hlulani` branches
- Runs tests with coverage reporting across all services
- Generates coverage badges automatically

### Render
**What**: Cloud platform for deploying web applications and services.

**Why**:
- **Free tier**: Each microservice deploys for free — critical for a student project with zero budget
- **Native Node.js support**: Auto-detects `package.json`, runs `npm install` and `npm start` — no Dockerfile needed
- **Independent deployments**: Each of the 4 services has its own Render instance with its own deploy hook
- **Environment variables**: Managed through Render dashboard — API keys never live in the repository
- **Automatic HTTPS**: SSL certificates are provisioned automatically for all `.onrender.com` domains
- **Deploy from Git**: Connects directly to our Gitea repo — push to `main` triggers a deploy
- **render.yaml blueprint**: Infrastructure as code — all 4 services, environment variables, and build commands defined in one file

---

## Testing

### Jest
**What**: JavaScript testing framework for unit and integration tests.

**Why**:
- Zero-config setup for Node.js projects — works out of the box with ESM via Babel
- Built-in mocking (`jest.mock()`) lets us isolate Supabase calls from business logic
- Snapshot testing available for regression detection
- Coverage reporting built in — we use it for the coverage badges
- Same framework across all 4 backend services — consistent testing patterns

### Supabase Mock Client
**What**: Custom mock that mimics Supabase's chainable query builder pattern.

**Why**:
- Supabase uses `.from().select().eq().then()` chains — standard mocks don't handle this
- Our mock returns a chainable object where every method returns `this`, and `await` resolves to `{ data, error }`
- Tests can control exact responses per table (e.g., `projects` returns data, `entries` returns an error)
- No real database connection needed — tests run in milliseconds

### Coverage Badges
**What**: Visual indicators showing test coverage percentage.

**Why**:
- `coverage-badges-cli` reads Jest's `coverage-summary.json` and generates SVG badges
- Badges are auto-committed after each CI run with `[skip ci]` to prevent infinite loops
- Visible in the README — motivates the team to maintain coverage above thresholds

---

## Authentication

### Supabase Auth
**What**: Complete authentication system with JWT tokens.

**Why**:
- Handles password hashing (bcrypt), token issuance (JWT), and token refresh automatically
- Supports email/password, Google OAuth, and GitHub OAuth — all configured through the Supabase dashboard
- Cloudflare Turnstile CAPTCHA integration prevents bot sign-ups
- Brevo SMTP for transactional emails (password reset, email verification)
- The `requireAuth` middleware in each service verifies JWTs independently — services don't need to call auth-service on every request

---

## Version Control

### Gitea (Self-Hosted)
**What**: Lightweight, self-hosted Git service.

**Why**:
- Course requirement — hosted at sdp.ms.wits.ac.za for the SDP module
- Full GitHub-like experience (pull requests, issues, actions) but on our own infrastructure
- No dependency on external services for the primary repository
- Gitea Actions provides CI/CD without needing a separate CI server

### GitHub (Mirror Only)
**What**: GitHub repository used exclusively as a read-only mirror for deployment.

**Why**:
- Render's free tier deploys directly from the repository — it needs a public Git URL to clone from
- GitHub was initially added as a second remote so Render could deploy, but it is NOT used for development
- GitHub has since been removed as a local remote — all pushes go to Gitea only
- Render is configured to mirror from Gitea directly, eliminating the need for a dual-push workflow
- This avoids the risk of GitHub and Gitea falling out of sync (which caused stale builds when GitHub lagged behind)

### Git Branching Strategy
**What**: `main` (production) + `hlulani` (development) + feature branches.

**Why**:
- `hlulani` is the integration branch — all work merges here first
- `main` is the production branch — only merged from `hlulani` when stable
- Feature branches (e.g., `feature/activity-log`) isolate large features before merging
- This mirrors GitFlow lite — simple enough for a 1-person team but structured enough for documentation

---

## Documentation

### MkDocs with Material Theme
**What**: Static site generator for project documentation.

**Why**:
- Write docs in Markdown — no special syntax or build tools beyond Python
- Material theme provides search, navigation, and responsive layout out of the box
- Lives alongside the code in `docs-site/` — docs are versioned with the project
- Can be deployed as a static site on Render or GitHub Pages

---

## External Services

### Cloudflare Turnstile
**What**: Privacy-friendly CAPTCHA alternative.

**Why**: Replaces Google reCAPTCHA — no tracking, faster verification, free for our usage level.

### Brevo (formerly Sendinblue)
**What**: Transactional email service.

**Why**: Supabase uses it as the SMTP provider for password reset and email verification emails. Free tier allows 300 emails/day.

### Google Cloud Console
**What**: OAuth 2.0 credential management.

**Why**: Provides the Client ID and Secret for "Sign in with Google" through Supabase Auth.

---

## Summary Table

| Layer | Technology | Purpose |
|---|---|---|
| Frontend Framework | React 18 | Component-based UI |
| Language | TypeScript | Type safety |
| Build Tool | Vite | Fast dev server + bundling |
| Styling | CSS Custom Properties | Runtime theming |
| Routing | React Router v6 | Client-side navigation |
| Backend Runtime | Node.js 20 | Server-side JavaScript |
| Backend Framework | Express.js | REST API |
| Architecture | Microservices (4) | Service isolation |
| Database | Supabase (PostgreSQL) | Data storage + auth |
| AI | Multi-provider chain | Natural language parsing |
| CI/CD | Gitea Actions | Automated testing |
| Hosting | Render | Free-tier deployment |
| Testing | Jest + custom mocks | Unit + integration tests |
| Auth | Supabase Auth | JWT + OAuth |
| Version Control | Gitea (self-hosted) | Git hosting + CI |
| Docs | MkDocs Material | Project documentation |
| CAPTCHA | Cloudflare Turnstile | Bot prevention |
| Email | Brevo SMTP | Transactional emails |
