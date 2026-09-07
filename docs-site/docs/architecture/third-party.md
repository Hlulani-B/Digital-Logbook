# Third-Party Dependencies

Every external package used by the Digital Logbook, why it was chosen over alternatives, and where it appears in the codebase.

---

## Frontend — Runtime

### @supabase/supabase-js `^2.112.3`

**What:** Official JavaScript client for Supabase — wraps PostgreSQL queries, Auth, Realtime, and Storage into a single SDK.

**Why chosen:** Supabase is our database and auth provider. This SDK is the only supported way to interact with Supabase from the browser. It provides typed query builders, automatic JWT refresh, and real-time subscription support. Alternatives like raw `fetch` calls to the Supabase REST API were rejected because the SDK handles token refresh and error normalization for free.

**Used in:** `frontend/src/lib/api.ts`, `frontend/src/functions/auth/`, every service function that reads or writes user data.

---

### idb `^8.0.3`

**What:** Tiny promise-based wrapper around the browser's native IndexedDB API.

**Why chosen:** Native IndexedDB is verbose and callback-heavy — opening a store, creating transactions, and handling cursor iteration takes 15–20 lines of boilerplate per operation. `idb` reduces this to 2–3 lines while adding zero bundle size overhead (under 1 KB gzipped). Alternatives like `Dexie.js` were considered but rejected as too heavy for our needs — we only need basic get/put/clear operations, not Dexie's full query DSL.

**Used in:** `frontend/src/lib/cache.js` — defines all 8 IndexedDB object stores (projects, entries, all-entries, profile, search, archives, fields, cache-meta) and the `cacheGet`/`cacheSet` helpers consumed by every page.

---

### react `^19.1.0` / react-dom `^19.1.0`

**What:** Component-based UI library and its DOM renderer.

**Why chosen:** The team had prior React experience from coursework and personal projects. React's component model maps directly to our repeated UI patterns (entry cards, stat widgets, project tiles). The massive ecosystem (hooks, dev tools, community packages) significantly reduces build time. React 19 was chosen over 18 for its improved concurrent features and automatic batching, which help during AI provider calls that can take 3–5 seconds. Alternatives like Vue or Svelte were rejected — the team's React fluency outweighed any marginal DX improvement.

**Used in:** Every file under `frontend/src/` — pages, components, hooks.

---

### react-icons `^5.7.0`

**What:** Icon library providing access to dozens of icon sets (Feather, Material, Font Awesome, etc.) as React components.

**Why chosen:** Gives us access to a consistent icon vocabulary (Feather icons for the NavBar, Material icons for actions) without manually managing SVG files. Tree-shaking ensures only the icons we import are included in the bundle. Alternatives like `lucide-react` or `heroicons` were considered but `react-icons` covers more icon sets in a single package.

**Used in:** `frontend/src/components/NavBar.tsx` (drawer icons), `frontend/src/pages/Dashboard.tsx` (stat card icons), `frontend/src/components/SettingsPanel.tsx` (close button, toggle indicators).

---

### react-media-recorder `^1.7.2`

**What:** React hook that wraps the browser's MediaRecorder API for audio/video recording.

**Why chosen:** The voice recording feature requires capturing audio from the user's microphone, converting it to a blob, and uploading it. `react-media-recorder` handles browser permission prompts, stream lifecycle, and blob assembly in a single hook. Building this from scratch with raw `MediaRecorder` would require 100+ lines of state management for recording/paused/stopped states. No comparable alternative exists in the React ecosystem.

**Used in:** `frontend/src/components/VoiceRecorder.tsx` — records audio, converts to blob, uploads to project-service for storage.

---

### react-router-dom `^7.6.1`

**What:** Client-side routing library for React single-page applications.

**Why chosen:** Standard routing solution for React with declarative `<Route>` syntax. Nested routes map cleanly to our layout (the Dashboard wrapper contains all authenticated pages). The `useNavigate` hook enables programmatic navigation after form submissions. Protected route patterns let us gate pages behind authentication. Version 7 was chosen for its improved data loading APIs and backward compatibility with our v6-style route definitions. Alternatives like TanStack Router were rejected as too new and under-documented.

**Used in:** `frontend/src/App.tsx` (route definitions), every page component (`useNavigate`, `useParams`).

---

## Frontend — Development

### @ffmpeg/ffmpeg `^0.12.15` / @ffmpeg/util `^0.12.2`

**What:** WebAssembly port of FFmpeg that runs entirely in the browser.

**Why chosen:** Voice recordings from different browsers produce different audio formats (WebM, OGG, WAV). We need a consistent format for playback and storage. `@ffmpeg/ffmpeg` converts audio in the browser without a server round-trip, keeping the pipeline fast and private. Alternatives like server-side conversion with `fluent-ffmpeg` would add latency and require storing temporary files on Render's ephemeral filesystem.

**Used in:** `frontend/src/components/VoiceRecorder.tsx` — converts recorded audio blobs to a consistent format before upload.

---

### @testing-library/react `^16.3.3` / @testing-library/jest-dom `^6.9.1` / @testing-library/user-event `^14.6.7`

**What:** Testing utilities that encourage testing React components the way users interact with them — by querying DOM text, labels, and roles rather than component internals.

**Why chosen:** Testing Library enforces best practices (no shallow rendering, no accessing component state) that produce more reliable tests. `jest-dom` adds matchers like `toBeInTheDocument()` and `toHaveTextContent()` that make assertions readable. `user-event` simulates real user interactions (typing, clicking) more accurately than `fireEvent`. This is the industry-standard testing stack for React — well-documented and widely adopted.

**Used in:** All 39 frontend unit test files and 5 integration test files under `frontend/src/__tests__/`.

---

### @vitejs/plugin-react `^4.4.1`

**What:** Vite plugin that configures Babel for React Fast Refresh (HMR) and JSX transform.

**Why chosen:** Required for Vite to understand `.tsx` files and provide instant hot module replacement during development. Without it, every code change would require a full page reload. This is the official React plugin maintained by the Vite team.

**Used in:** `frontend/vite.config.ts`.

---

### @vitest/coverage-v8 `^3.2.7`

**What:** Coverage provider for Vitest using the V8 JavaScript engine's built-in code coverage.

**Why chosen:** V8 coverage is more accurate than Istanbul/Babel-based instrumentation — it measures actual execution at the engine level with zero performance overhead. Vitest's built-in coverage integration means no separate `nyc` or `c8` configuration. Outputs JSON summaries compatible with our coverage badge pipeline.

**Used in:** `npm run test:coverage` script in `frontend/package.json`.

---

### fake-indexeddb `^6.2.5`

**What:** In-memory polyfill for the IndexedDB API, used in test environments.

**Why chosen:** Tests run in JSDOM (Node.js), which does not implement IndexedDB. `fake-indexeddb` provides a complete in-memory implementation so cache functions can be tested without a real browser. Alternatives like mocking `cacheGet`/`cacheSet` were rejected because we want to test the actual IndexedDB code paths, not just the mock behavior.

**Used in:** `frontend/src/__tests__/setup.ts` — imported before all tests to polyfill `indexedDB`, `IDBKeyRange`, and related globals.

---

### jsdom `^26.1.0`

**What:** JavaScript implementation of the DOM and HTML standards for Node.js.

**Why chosen:** Vitest uses JSDOM to simulate a browser environment for component tests. Without it, React components cannot render because there is no `document`, `window`, or DOM API in Node.js. This is the standard test environment for frontend testing — no viable alternative at this scale.

**Used in:** `frontend/vite.config.ts` — `test.environment: 'jsdom'`.

---

### typescript `~5.8.3`

**What:** Superset of JavaScript that adds static type checking.

**Why chosen:** Catches bugs at compile time (wrong prop types, missing fields, null dereferences) instead of runtime. IDE autocompletion dramatically speeds up development. Self-documenting code — types serve as inline documentation. Refactoring is safer because the compiler flags every breakage. The frontend was converted from JavaScript to TypeScript early because API response type errors were causing silent rendering failures.

**Used in:** Every `.ts` and `.tsx` file under `frontend/src/`.

---

### vite `^6.3.5`

**What:** Next-generation frontend build tool and development server.

**Why chosen:** Near-instant dev server startup using native ES modules (no bundling during development). Hot Module Replacement updates components in milliseconds without losing state. Production builds use Rollup for optimized output with tree-shaking and code splitting. We migrated from Create React App because CRA was deprecated and its Webpack builds took 30+ seconds. Vite builds the same project in under 5 seconds.

**Used in:** `frontend/vite.config.ts`, `frontend/package.json` scripts.

---

### vitest `^3.2.7`

**What:** Vite-native testing framework — runs tests using the same Vite config and transform pipeline.

**Why chosen:** Zero configuration needed — reuses `vite.config.ts` for path aliases, environment, and transforms. Compatible with Testing Library APIs. Watch mode is instant because it uses Vite's module graph. Jest was rejected for the frontend because it requires separate Babel configuration and does not understand Vite path aliases without extra plugins.

**Used in:** `npm run test` and `npm run test:watch` scripts. All 397 frontend unit tests and 47 integration tests run through Vitest.

---

## Backend — Runtime (project-service)

### @cerebras/cerebras_cloud_sdk `^1.0.0`

**What:** Official SDK for Cerebras AI inference — an ultra-fast chip-based AI provider.

**Why chosen:** Part of our 5-provider AI fallback chain. Cerebras provides the fastest inference speeds of any provider (sub-second responses), making it ideal as the third fallback when HuggingFace and OpenRouter are rate-limited. The SDK handles authentication, request formatting, and streaming. No alternative SDK exists — Cerebras is unique in offering wafer-scale chip inference.

**Used in:** `services/project-service/src/functions/AI.js` — third provider in the fallback chain.

---

### @google/generative-ai `^0.21.0`

**What:** Official Google SDK for the Gemini AI API.

**Why chosen:** Fourth provider in the AI fallback chain. Gemini excels at structured JSON output, which is critical for our natural language parsing that must return valid JSON with specific fields. The SDK provides typed request/response handling and file upload support. Selected over the raw REST API because the SDK handles authentication token refresh and provides better error messages.

**Used in:** `services/project-service/src/functions/AI.js` — fourth provider in the fallback chain.

---

### @huggingface/inference `^3.0.0`

**What:** JavaScript client for the HuggingFace Inference API — access to thousands of open-source AI models.

**Why chosen:** First provider in the AI fallback chain because HuggingFace's free tier costs nothing. Good for simple natural language parsing tasks. The SDK abstracts away model selection, API versioning, and rate-limit handling. Alternatives like calling the REST API directly were rejected because the SDK provides typed responses and automatic retry logic.

**Used in:** `services/project-service/src/functions/AI.js` — first (free) provider attempted.

---

### @neondatabase/serverless `^1.0.0`

**What:** Serverless PostgreSQL driver using HTTP/WebSocket transport instead of raw TCP.

**Why chosen:** Render's serverless environment does not support persistent TCP connections to PostgreSQL. The Neon driver uses HTTP POST requests for queries, which work in edge/serverless contexts where traditional `pg` connections time out. Used as a fallback database connector when the primary `pg` pool is unavailable.

**Used in:** `services/project-service/src/functions/db.js` — serverless database connection path.

---

### cors `^2.8.6`

**What:** Express middleware that enables Cross-Origin Resource Sharing.

**Why chosen:** The frontend (served from a different origin) makes API calls to each backend service. Without CORS, the browser blocks these requests. This is the standard, universally-used CORS middleware for Express — configurable per-origin, per-method, and per-header. No alternative provides the same level of control with zero configuration.

**Used in:** Every service's `src/index.js` — `app.use(cors({ origin: ... }))`.

---

### date-fns `^4.1.0`

**What:** Lightweight, tree-shakeable date utility library.

**Why chosen:** The natural language parser in `entries.js` needs to calculate dates ("tomorrow", "in 3 days", "next Friday", "2 days from now"). `date-fns` provides immutable, pure-function date manipulation without the heavy bundle size of Moment.js. Tree-shaking means only the functions we import (`addDays`, `nextDay`, `format`) are included. Alternatives like `dayjs` were considered but `date-fns` has better TypeScript support and a more functional API.

**Used in:** `services/project-service/src/functions/entries.js` — `getDate()` function for natural language date parsing.

---

### dotenv `^17.4.2`

**What:** Loads environment variables from a `.env` file into `process.env`.

**Why chosen:** Each service needs database URLs, API keys, and JWT secrets that must never be committed to the repository. `dotenv` reads these from `.env` files during local development. On Render, environment variables are set through the dashboard and injected directly — `dotenv` is a no-op there. This is the standard approach for Node.js configuration.

**Used in:** Every service's `src/index.js` — `import 'dotenv/config'` at the top of the entry point.

---

### express `^5.2.1`

**What:** Minimal web framework for building REST APIs in Node.js.

**Why chosen:** Industry standard for Node.js APIs. Middleware pattern lets us layer CORS, auth verification, error handling, and route-specific logic cleanly. Each microservice is approximately 100 lines of boilerplate. Express 5 adds improved async error handling and better path matching over v4. Alternatives like Fastify or Koa were rejected — Express's documentation depth and community size make troubleshooting trivial.

**Used in:** Every service's `src/index.js` and `src/Routes/*.js`.

---

### jose `^6.0.12`

**What:** JavaScript module for JSON Object Signing and Encryption — JWT verification and signing.

**Why chosen:** Each backend service independently verifies JWT tokens from Supabase Auth. `jose` is the most maintained, spec-compliant JWT library for JavaScript — supports JWKS (JSON Web Key Sets) for automatic key rotation, which Supabase uses. Alternatives like `jsonwebtoken` use callbacks and do not support modern ESM imports. `jose` is promise-based and ESM-native, matching our module system.

**Used in:** `services/project-service/src/middleware/auth.js`, and equivalent middleware in dashboard-service and auth-service.

---

### js-yaml `^5.4.1`

**What:** YAML parser and serializer for JavaScript.

**Why chosen:** The project-service serves an OpenAPI specification (`openapi.yaml`) through Swagger UI. `js-yaml` reads and parses the YAML file at startup so it can be passed to `swagger-ui-express`. No alternative was considered — this is the de facto standard YAML library for JavaScript.

**Used in:** `services/project-service/src/index.js` — loads `docs/openapi.yaml` for the Swagger UI endpoint.

---

### leven `^3.1.0`

**What:** Levenshtein distance algorithm — measures the number of single-character edits between two strings.

**Why chosen:** Used in the natural language parser for fuzzy project name matching. When a user types "fix login bug" and has a project called "WebApp Refactor", Levenshtein distance helps determine if the entry might relate to an existing project. The algorithm is fast (O(n*m) time), has zero dependencies, and the package is under 1 KB. Alternatives like `string-similarity` were rejected as heavier with no accuracy improvement.

**Used in:** `services/project-service/src/functions/entries.js` — fuzzy matching during project name resolution.

---

### openai `^4.0.0`

**What:** Official OpenAI SDK for GPT model API access.

**Why chosen:** Used as one of the AI fallback providers. OpenAI's GPT models are the most widely tested for structured JSON output. The SDK handles authentication, request formatting, streaming, and automatic retries with exponential backoff. Selected as a fallback provider because OpenAI's reliability is well-established, even if not the cheapest option.

**Used in:** `services/project-service/src/functions/AI.js` — part of the multi-provider fallback chain.

---

### pg `^8.16.3`

**What:** PostgreSQL client for Node.js — the standard driver for connecting to PostgreSQL databases.

**Why chosen:** The primary database driver for all services that query PostgreSQL directly (project-service, dashboard-service). Supports connection pooling, parameterized queries (SQL injection prevention), and async/await. The Neon serverless driver is used only as a fallback — `pg` is the workhorse. No alternative was considered — this is the official, most-maintained PostgreSQL driver for Node.js.

**Used in:** `services/project-service/src/functions/db.js`, `services/dashboard-service/src/functions/db.js`, and every function that executes raw SQL.

---

### swagger-ui-express `^5.0.1`

**What:** Serves Swagger/OpenAPI documentation through an Express route with an interactive UI.

**Why chosen:** Provides a browsable, interactive API documentation page at `/api-docs` for the project-service. Users (and developers) can test endpoints directly from the browser. The alternative — writing separate documentation — would go stale as the API changes. OpenAPI YAML is the source of truth, and this package renders it automatically.

**Used in:** `services/project-service/src/index.js` — mounts Swagger UI at the `/api-docs` route.

---

## Backend — Runtime (shared across services)

These packages appear in auth-service and/or dashboard-service with the same versions as project-service:

| Package | Version | Services | Purpose |
| --- | --- | --- | --- |
| `cors` | `^2.8.6` | All 4 | Cross-origin request handling |
| `dotenv` | `^17.4.2` | All 4 | Environment variable loading |
| `express` | `^5.2.1` | All 4 | HTTP framework |
| `pg` | `^8.16.3` | project, dashboard | PostgreSQL queries |

---

## Backend — Development

### @babel/core `^7.26.0` / @babel/preset-env `^7.26.0` / babel-jest `^29.7.0`

**What:** Babel transpiler and its Jest integration — converts modern JavaScript (ESM, optional chaining, nullish coalescing) to a format Jest can execute.

**Why chosen:** Jest does not natively understand ESM `import`/`export` syntax. Babel transforms ESM to CommonJS before Jest runs the tests. `@babel/preset-env` auto-detects the target Node.js version and only transforms what is needed. This is the standard Jest + ESM setup — no alternative provides the same compatibility.

**Used in:** `babel.config.js` in each service, referenced by Jest's `transform` configuration.

---

### coverage-badges-cli `^2.2.0`

**What:** Generates SVG coverage badge images from Jest's `coverage-summary.json`.

**Why chosen:** Reads the JSON coverage output and produces a colored badge (green/yellow/red) that is auto-committed to the repository after each CI run. Visible in the README, motivating the team to maintain coverage above thresholds. The `[skip ci]` commit message prevents infinite CI loops.

**Used in:** CI workflow — runs after `jest --coverage` to generate and commit badge SVGs.

---

### jest `^29.7.0` / jest-junit `^17.0.0`

**What:** JavaScript testing framework and its JUnit XML reporter.

**Why chosen:** Zero-config setup for Node.js projects. Built-in mocking (`jest.mock()`) isolates Supabase calls from business logic. Coverage reporting is built in. `jest-junit` produces XML reports that Gitea Actions can parse for test result summaries. Same framework across all 4 backend services ensures consistent testing patterns. Vitest was rejected for the backend because our services are plain JavaScript (not Vite projects), and Jest's mocking system is more mature for server-side code.

**Used in:** All 17 backend test files across 4 services.

---

### nodemon `^3.1.14`

**What:** Auto-restarts the Node.js server when source files change.

**Why chosen:** During development, manually restarting the server after every code change is slow. `nodemon` watches the `src/` directory and restarts automatically. Configured in `npm run dev` scripts. No alternative provides the same simplicity — `pm2` is overkill for development, and `ts-node-dev` only works with TypeScript.

**Used in:** `npm run dev` script in each service's `package.json`.

---

### supertest `^7.2.0`

**What:** HTTP assertion library for testing Express routes — sends real HTTP requests to the app without starting a server.

**Why chosen:** Used for backend integration tests that verify the full request/response cycle (status codes, response bodies, headers). Supertest creates a test server from the Express app, sends requests, and provides chainable assertions. Alternatives like manually calling route handlers were rejected because they skip middleware (CORS, auth) and do not test the real HTTP path.

**Used in:** `services/auth-service/src/__tests__/` — integration tests for auth endpoints.

---

## Documentation Site

### mkdocs

**What:** Static site generator purpose-built for project documentation.

**Why chosen:** Write docs in Markdown — no special syntax or build tools beyond Python. Lives alongside the code in `docs-site/` so documentation is versioned with the project. Simple YAML configuration for navigation, theme, and extensions. Alternatives like Docusaurus require a Node.js build pipeline and React knowledge — MkDocs is just Python and Markdown.

**Used in:** `docs-site/mkdocs.yml` configuration, `docs-site/requirements.txt`.

---

### mkdocs-material

**What:** Material Design theme for MkDocs — provides search, navigation, dark mode, and responsive layout.

**Why chosen:** The most popular MkDocs theme with built-in search (no separate search server needed), syntax highlighting, code copy buttons, tabbed content blocks, and admonition callouts. The pink/rose color palette matches the Digital Logbook brand. Free and open-source.

**Used in:** `docs-site/mkdocs.yml` theme configuration.

---

## Complete Dependency Map

| Package | Version | Layer | License |
| --- | --- | --- | --- |
| @cerebras/cerebras_cloud_sdk | ^1.0.0 | Backend (project) | Apache-2.0 |
| @ffmpeg/ffmpeg | ^0.12.15 | Frontend (dev) | LGPL-2.1 |
| @ffmpeg/util | ^0.12.2 | Frontend (dev) | LGPL-2.1 |
| @google/generative-ai | ^0.21.0 | Backend (project) | Apache-2.0 |
| @huggingface/inference | ^3.0.0 | Backend (project) | MIT |
| @neondatabase/serverless | ^1.0.0 | Backend (project) | MIT |
| @supabase/supabase-js | ^2.112.3 | Frontend + Backend | MIT |
| @testing-library/jest-dom | ^6.9.1 | Frontend (dev) | MIT |
| @testing-library/react | ^16.3.3 | Frontend (dev) | MIT |
| @testing-library/user-event | ^14.6.7 | Frontend (dev) | MIT |
| @vitejs/plugin-react | ^4.4.1 | Frontend (dev) | MIT |
| @vitest/coverage-v8 | ^3.2.7 | Frontend (dev) | MIT |
| cors | ^2.8.6 | Backend (all) | MIT |
| date-fns | ^4.1.0 | Backend (project) | MIT |
| dotenv | ^17.4.2 | Backend (all) | BSD-2-Clause |
| express | ^5.2.1 | Backend (all) | MIT |
| fake-indexeddb | ^6.2.5 | Frontend (dev) | Apache-2.0 |
| idb | ^8.0.3 | Frontend | ISC |
| jest | ^29.7.0 | Backend (dev) | MIT |
| jest-junit | ^17.0.0 | Backend (dev) | Apache-2.0 |
| jose | ^6.0.12 | Backend (project/dashboard/auth) | MIT |
| js-yaml | ^5.4.1 | Backend (project) | MIT |
| jsdom | ^26.1.0 | Frontend (dev) | MIT |
| leven | ^3.1.0 | Backend (project) | MIT |
| mkdocs | latest | Docs | BSD-2-Clause |
| mkdocs-material | latest | Docs | MIT |
| nodemon | ^3.1.14 | Backend (dev) | MIT |
| openai | ^4.0.0 | Backend (project) | Apache-2.0 |
| pg | ^8.16.3 | Backend (project/dashboard) | MIT |
| react | ^19.1.0 | Frontend | MIT |
| react-dom | ^19.1.0 | Frontend | MIT |
| react-icons | ^5.7.0 | Frontend | MIT |
| react-media-recorder | ^1.7.2 | Frontend | ISC |
| react-router-dom | ^7.6.1 | Frontend | MIT |
| supertest | ^7.2.0 | Backend (dev) | MIT |
| swagger-ui-express | ^5.0.1 | Backend (project) | MIT |
| typescript | ~5.8.3 | Frontend (dev) | Apache-2.0 |
| vite | ^6.3.5 | Frontend (dev) | MIT |
| vitest | ^3.2.7 | Frontend (dev) | MIT |
