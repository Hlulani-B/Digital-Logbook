# Third-Party Dependencies

Every external package used by the Digital Logbook, what it does, why it was chosen over alternatives, and exactly how it is used in the codebase.

---

## Frontend — Runtime

### @supabase/supabase-js `^2.112.3`

**What:** Official JavaScript client for Supabase — wraps PostgreSQL queries, Auth, Realtime, and Storage into a single SDK.

**Why chosen:** Supabase is our database and auth provider. This SDK is the only supported way to interact with Supabase from the browser. It provides typed query builders, automatic JWT refresh, and real-time subscription support. Alternatives like raw `fetch` calls to the Supabase REST API were rejected because the SDK handles token refresh and error normalization for free.

**How it is used:**

The client is created once in `frontend/src/lib/supabase.ts` using `createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` and exported as a singleton via `getSupabase()`. Every other module imports this function rather than creating its own client.

The SDK is used for three distinct purposes across the frontend:

1. **Authentication flows** — `getSupabase().auth.signInWithOtp()` sends magic-link emails in `SignIn.tsx`. `auth.getSession()` retrieves the current JWT in `AuthContext.tsx`, `AuthCallback.tsx`, `AuthRestore.tsx`, and `sse.js`. `auth.signOut()` is called from `useInactivityLogout.ts` (after 30 minutes of idle) and from `SignIn.tsx` (manual logout). `auth.exchangeCodeForSession()` handles the OAuth callback in `AuthCallback.tsx`, and `auth.setSession()` restores persisted sessions in the same file.

2. **JWT token retrieval for API calls** — `frontend/src/lib/api.ts` calls `getSupabase().auth.getSession()` to extract the `access_token` before every `fetch()` to a backend service. The token is attached as `Authorization: Bearer <token>`. This same pattern is used in `sse.js` for the Server-Sent Events connection, where the token is passed as a query parameter because `EventSource` does not support custom headers.

3. **Type imports** — `AuthContext.tsx` imports the `User` and `Session` TypeScript types from `@supabase/supabase-js` to type the auth state that flows through the React context.

---

### idb `^8.0.3`

**What:** Tiny promise-based wrapper around the browser's native IndexedDB API.

**Why chosen:** Native IndexedDB is verbose and callback-heavy — opening a store, creating transactions, and handling cursor iteration takes 15–20 lines of boilerplate per operation. `idb` reduces this to 2–3 lines while adding zero bundle size overhead (under 1 KB gzipped). Alternatives like `Dexie.js` were considered but rejected as too heavy for our needs — we only need basic get/put/clear operations, not Dexie's full query DSL.

**How it is used:**

`idb` is imported in `frontend/src/lib/cache.js` as `import { openDB } from 'idb'`. It opens the `digital-logbook-cache` database (version 3) with 8 object stores:

- `projects` — keyed by `{email}`, stores the full project list response
- `entries` — keyed by `{email}:{project_name}`, stores per-project entry arrays
- `all-entries` — keyed by `{email}`, stores all entries across all projects
- `profile` — keyed by `{email}`, stores username/avatar/name
- `search` — keyed by `{email}`, stores cached search results
- `archives` — keyed by `{email}:all`, stores archived entries and projects
- `fields` — keyed by `{email}`, stores custom field definitions
- `cache-meta` — stores timestamps for stale-while-revalidate checks

The `openDB` call includes an `upgrade` callback that creates stores on first visit or when the version bumps. All reads go through `cacheGet(store, key)` which calls `db.get(store, key)`, and all writes go through `cacheSet(store, key, data)` which calls `db.put(store, { ...data, key })`. The `cacheSubscribe(store, key, callback)` function implements a pub/sub layer on top — when `cacheSet` fires, all subscribers for that store+key are notified, which is what makes the UI reactive without polling.

Every page in the frontend reads from these stores via the `useCachedData` hook (`frontend/src/hooks/useCachedData.js`). The `syncAllData` function in `frontend/src/CacheFunctions/syncService.js` fetches from the server and populates every store on login.

---

### react `^19.1.0` / react-dom `^19.1.0`

**What:** Component-based UI library and its DOM renderer.

**Why chosen:** The team had prior React experience from coursework and personal projects. React's component model maps directly to our repeated UI patterns (entry cards, stat widgets, project tiles). The massive ecosystem (hooks, dev tools, community packages) significantly reduces build time. React 19 was chosen over 18 for its improved concurrent features and automatic batching, which help during AI provider calls that can take 3–5 seconds. Alternatives like Vue or Svelte were rejected — the team's React fluency outweighed any marginal DX improvement.

**How it is used:**

Every file under `frontend/src/` is a React component or hook. The application is structured as:

- **Pages** (20 pages in `frontend/src/pages/`) — `Dashboard.tsx`, `AllEntries.tsx`, `Project.tsx`, `ProjectDetailPage.tsx`, `StatsView.tsx`, `StreakView.tsx`, `Calendar.tsx`, `Kanban.tsx`, `Today.tsx`, `Timeline.tsx`, `Archives.tsx`, `Activity.tsx`, `VoiceFeature.jsx`, `SignIn.tsx`, `AuthCallback.tsx`, `AuthRestore.tsx`, `ResetPassword.tsx`, `UpdatePassword.tsx`, `CreateProfile.tsx`, `AvatarPage.tsx`, `ToneSetup.tsx`, `ThemeSetup.tsx`, `FrequencySetup.tsx`, `DataPortability.tsx`
- **Components** (reusable UI in `frontend/src/components/`) — `NavBar.tsx`, `QuickEntryBar.tsx`, `SettingsPanel.tsx`, `ProtectedRoute.tsx`, `ProjectSettingsPanel.tsx`
- **Hooks** (custom logic in `frontend/src/hooks/`) — `useTheme.ts`, `useCachedData.js`, `useInactivityLogout.ts`
- **Context** (`frontend/src/context/AuthContext.tsx`) — provides the authenticated user to all descendant components

React 19's automatic batching means that when the QuickAdd bar fires an AI call (which takes 3–5 seconds), the subsequent state updates (entry created, cache updated, UI re-rendered) are batched into a single render pass instead of triggering multiple re-renders.

---

### react-icons `^5.7.0`

**What:** Icon library providing access to dozens of icon sets (Feather, Material, Font Awesome, etc.) as React components.

**Why chosen:** Gives us a consistent icon vocabulary without manually managing SVG files. Tree-shaking ensures only the icons we import are included in the bundle. Alternatives like `lucide-react` or `heroicons` were considered but `react-icons` covers more icon sets in a single package.

**How it is used:**

All icons are imported from `react-icons/fi` (Feather Icons set). The specific icons and where they appear:

- `FiArchive` — NavBar drawer toggle, Project page archive button, Dashboard archive link, ProjectSettingsPanel archive action
- `FiMic` — VoiceFeature recording button, ProjectDetailPage voice entry trigger, QuickEntryBar voice button
- `FiStopCircle` — VoiceFeature stop recording button
- `FiRefreshCw` — VoiceFeature retry/re-record button
- `FiSkipBack` — VoiceFeature restart button
- `FiSend` — VoiceFeature send transcript button
- `FiX` — VoiceFeature close modal, Dashboard close panel, SettingsPanel close button, Project close button
- `FiEdit2` — Project page edit button, ProjectSettingsPanel edit action
- `FiTrash2` — Project page delete button
- `FiBookOpen` — Project page "view entries" button
- `FiPlus` — Project page create new project button
- `FiSettings` — Project page settings button
- `FiHeart`, `FiZap`, `FiSmile` — Tone selection icons in `tone.ts`
- `FiBellOff`, `FiBell`, `FiClock` — Frequency setup notification options

---

### react-media-recorder `^1.7.2`

**What:** React hook that wraps the browser's MediaRecorder API for audio/video recording.

**Why chosen:** The voice recording feature requires capturing audio from the user's microphone, converting it to a blob, and uploading it. `react-media-recorder` handles browser permission prompts, stream lifecycle, and blob assembly in a single hook. Building this from scratch with raw `MediaRecorder` would require 100+ lines of state management for recording/paused/stopped states. No comparable alternative exists in the React ecosystem.

**How it is used:**

Imported in `frontend/src/pages/VoiceFeature.jsx` as `useReactMediaRecorder`. The hook is initialized with `{ audio: true, blobType: 'webm' }` and returns `{ status, startRecording, stopRecording, clearBlobUrl }`.

The VoiceFeature component is a full-screen modal that auto-starts recording on mount. The flow is:

1. `useEffect` calls `startRecording()` after a 300ms delay (gives the speech recognition time to initialize)
2. While recording, the component shows animated pulse rings and a live transcript from the Web Speech API
3. When the user taps stop, `stopRecording()` is called, which finalizes the WebM blob
4. The blob URL is available via the hook's internal state, and the component can then send the transcript to QuickAdd via `addNaturalLanguageEntry()`
5. `clearBlobUrl()` is called on unmount to free memory

---

### react-router-dom `^7.6.1`

**What:** Client-side routing library for React single-page applications.

**Why chosen:** Standard routing solution for React with declarative `<Route>` syntax. Nested routes map cleanly to our layout (the Dashboard wrapper contains all authenticated pages). The `useNavigate` hook enables programmatic navigation after form submissions. Protected route patterns let us gate pages behind authentication. Version 7 was chosen for its improved data loading APIs and backward compatibility with our v6-style route definitions. Alternatives like TanStack Router were rejected as too new and under-documented.

**How it is used:**

`BrowserRouter` wraps the entire app in `frontend/src/App.tsx`. The route tree has two categories:

**Public routes** (wrapped in `PublicRoute` — redirects to `/dashboard` if already logged in):

- `/` and `/signin` → `SignIn.tsx`
- `/reset-password` → `ResetPassword.tsx`
- `/auth/update-password` → `UpdatePassword.tsx`

**Auth callback routes** (no wrapper — handle OAuth redirects):

- `/auth/callback` → `AuthCallback.tsx` (exchanges code for session)
- `/auth/restore` → `AuthRestore.tsx` (restores soft-deleted account)

**Protected routes** (wrapped in `ProtectedRoute` — redirects to `/signin` if not logged in):

- `/dashboard` → `Dashboard.tsx`
- `/dashboard/all` and `/entries` → `AllEntriesPage.tsx`
- `/dashboard/archives` → `ArchivesPage.tsx`
- `/dashboard/activity` → `ActivityPage.tsx`
- `/create-profile` → `CreateProfile.tsx`
- `/avatar` → `AvatarPage.tsx`
- `/tone-setup` → `ToneSetup.tsx`
- `/theme-setup` → `ThemeSetup.tsx`
- `/frequency-setup` → `FrequencySetup.tsx`
- `/projects` → `ProjectsPage.tsx`
- `/projects/:name` → `ProjectDetailPage.tsx` (uses `useParams` to read the project name from the URL)
- `/stats` → `StatsView.tsx`
- `/streaks` → `StreakView.tsx`
- `/calendar` → `CalendarPage.tsx`
- `/kanban` → `KanbanPage.tsx`
- `/today` → `TodayPage.tsx`
- `/timeline` → `TimelinePage.tsx`
- `/data-portability` → `DataPortability.tsx`

`useNavigate` is used in `SignIn.tsx` (after successful login), `CreateProfile.tsx` (after profile creation), and `VoiceFeature.jsx` (after entry creation).

---

## Frontend — Development

### @ffmpeg/ffmpeg `^0.12.15` / @ffmpeg/util `^0.12.2`

**What:** WebAssembly port of FFmpeg that runs entirely in the browser.

**Why chosen:** Voice recordings from different browsers produce different audio formats (WebM, OGG, WAV). We need a consistent format for playback and storage. `@ffmpeg/ffmpeg` converts audio in the browser without a server round-trip, keeping the pipeline fast and private. Alternatives like server-side conversion with `fluent-ffmpeg` would add latency and require storing temporary files on Render's ephemeral filesystem.

**How it is used:**

Listed in `frontend/package.json` devDependencies. The FFmpeg WASM core is loaded dynamically at runtime when the VoiceFeature component needs to convert audio. `@ffmpeg/util` provides the `fetchFile` helper that converts a Blob into a Uint8Array for FFmpeg to process.

The conversion happens in the voice recording pipeline: after `react-media-recorder` produces a WebM blob, FFmpeg transcodes it to a consistent format before the blob is uploaded to project-service for storage. This ensures playback works uniformly across all browsers and devices.

---

### @testing-library/react `^16.3.3` / @testing-library/jest-dom `^6.9.1` / @testing-library/user-event `^14.6.7`

**What:** Testing utilities that encourage testing React components the way users interact with them — by querying DOM text, labels, and roles rather than component internals.

**Why chosen:** Testing Library enforces best practices (no shallow rendering, no accessing component state) that produce more reliable tests. `jest-dom` adds matchers like `toBeInTheDocument()` and `toHaveTextContent()` that make assertions readable. `user-event` simulates real user interactions (typing, clicking) more accurately than `fireEvent`. This is the industry-standard testing stack for React — well-documented and widely adopted.

**How it is used:**

All 39 frontend unit test files and 5 integration test files under `frontend/src/__tests__/` use this stack. A typical test pattern:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('submits the quick-add form', async () => {
  render(<QuickEntryBar />);
  await userEvent.type(screen.getByRole('textbox'), 'Fixed login bug');
  await userEvent.click(screen.getByText('Add'));
  expect(screen.getByText('Entry created')).toBeInTheDocument();
});
```

`jest-dom` matchers used throughout: `toBeInTheDocument()`, `toHaveTextContent()`, `toBeVisible()`, `toBeDisabled()`, `toHaveValue()`.

---

### @vitejs/plugin-react `^4.4.1`

**What:** Vite plugin that configures Babel for React Fast Refresh (HMR) and JSX transform.

**Why chosen:** Required for Vite to understand `.tsx` files and provide instant hot module replacement during development. Without it, every code change would require a full page reload. This is the official React plugin maintained by the Vite team.

**How it is used:**

Imported in `frontend/vite.config.ts` and added to the `plugins` array. It enables React Fast Refresh, which patches edited components in place without losing their state — critical when iterating on the theme system (13 themes) or the dashboard layout where losing scroll position would be frustrating.

---

### @vitest/coverage-v8 `^3.2.7`

**What:** Coverage provider for Vitest using the V8 JavaScript engine's built-in code coverage.

**Why chosen:** V8 coverage is more accurate than Istanbul/Babel-based instrumentation — it measures actual execution at the engine level with zero performance overhead. Vitest's built-in coverage integration means no separate `nyc` or `c8` configuration. Outputs JSON summaries compatible with our coverage badge pipeline.

**How it is used:**

Invoked via `npm run test:coverage` which runs `vitest run --coverage`. The V8 provider instruments every file under `frontend/src/` and produces a `coverage/` directory with HTML, JSON, and text reports. The JSON summary is consumed by the CI pipeline to generate coverage badges.

---

### fake-indexeddb `^6.2.5`

**What:** In-memory polyfill for the IndexedDB API, used in test environments.

**Why chosen:** Tests run in JSDOM (Node.js), which does not implement IndexedDB. `fake-indexeddb` provides a complete in-memory implementation so cache functions can be tested without a real browser. Alternatives like mocking `cacheGet`/`cacheSet` were rejected because we want to test the actual IndexedDB code paths, not just the mock behavior.

**How it is used:**

Imported in `frontend/src/__tests__/setup.ts` before all tests run. It polyfills `indexedDB`, `IDBKeyRange`, `IDBFactory`, and related globals so that `idb`'s `openDB()` call in `cache.js` works identically in tests as it does in the browser. Every test that touches the cache layer (which is most of them, since the frontend is local-first) relies on this polyfill.

---

### jsdom `^26.1.0`

**What:** JavaScript implementation of the DOM and HTML standards for Node.js.

**Why chosen:** Vitest uses JSDOM to simulate a browser environment for component tests. Without it, React components cannot render because there is no `document`, `window`, or DOM API in Node.js. This is the standard test environment for frontend testing — no viable alternative at this scale.

**How it is used:**

Configured in `frontend/vite.config.ts` as `test.environment: 'jsdom'`. Every Vitest test file runs inside a JSDOM environment, which provides `document.createElement`, `window.addEventListener`, `localStorage`, and all other browser APIs that React components depend on.

---

### typescript `~5.8.3`

**What:** Superset of JavaScript that adds static type checking.

**Why chosen:** Catches bugs at compile time (wrong prop types, missing fields, null dereferences) instead of runtime. IDE autocompletion dramatically speeds up development. Self-documenting code — types serve as inline documentation. Refactoring is safer because the compiler flags every breakage. The frontend was converted from JavaScript to TypeScript early because API response type errors were causing silent rendering failures.

**How it is used:**

Every `.ts` and `.tsx` file under `frontend/src/` is type-checked. The `tsconfig.json` configures strict mode, path aliases (`@/` maps to `src/`), and the React JSX transform. The build script runs `tsc -b` before `vite build` to catch type errors before production deploys. Key typed interfaces include `User`, `Session`, `Profile`, `Project`, `Entry`, and the theme type union in `useTheme.ts`.

---

### vite `^6.3.5`

**What:** Next-generation frontend build tool and development server.

**Why chosen:** Near-instant dev server startup using native ES modules (no bundling during development). Hot Module Replacement updates components in milliseconds without losing state. Production builds use Rollup for optimized output with tree-shaking and code splitting. We migrated from Create React App because CRA was deprecated and its Webpack builds took 30+ seconds. Vite builds the same project in under 5 seconds.

**How it is used:**

`frontend/vite.config.ts` configures the dev server (port 5173), path aliases, the React plugin, and Vitest settings. `npm run dev` starts the dev server, `npm run build` runs `tsc -b && vite build` to produce the production bundle in `frontend/dist/`, and `npm run preview` serves the production build locally. The `dist/` directory is what Render deploys as a static site.

---

### vitest `^3.2.7`

**What:** Vite-native testing framework — runs tests using the same Vite config and transform pipeline.

**Why chosen:** Zero configuration needed — reuses `vite.config.ts` for path aliases, environment, and transforms. Compatible with Testing Library APIs. Watch mode is instant because it uses Vite's module graph. Jest was rejected for the frontend because it requires separate Babel configuration and does not understand Vite path aliases without extra plugins.

**How it is used:**

`npm run test` runs `vitest run` (single pass), `npm run test:watch` runs `vitest` (watch mode). All 397 frontend unit tests and 47 integration tests run through Vitest. Test files are co-located with the code they test in `__tests__/` directories.

---

## Backend — Runtime (project-service)

### @cerebras/cerebras_cloud_sdk `^1.0.0`

**What:** Official SDK for Cerebras AI inference — an ultra-fast chip-based AI provider.

**Why chosen:** Part of our 5-provider AI fallback chain. Cerebras provides the fastest inference speeds of any provider (sub-second responses), making it ideal as the third fallback when HuggingFace and OpenRouter are rate-limited. The SDK handles authentication, request formatting, and streaming. No alternative SDK exists — Cerebras is unique in offering wafer-scale chip inference.

**How it is used:**

Imported in `services/project-service/src/functions/AI.js` as `Cerebras`. A client is lazily instantiated via `getCerebrasClient()` using `new Cerebras({ apiKey: process.env.CEREBRAS_API_KEY })`. The SDK is called through `callCerebrasModel(model, question)` which uses `client.chat.completions.create()` with the `llama-3.3-70b` and `llama3.1-8b` models.

Cerebras is the third provider in the fallback chain: HuggingFace → OpenRouter → **Cerebras** → Gemini → Groq. If the two free-tier providers (HuggingFace, OpenRouter) are rate-limited, Cerebras provides a fast, reliable fallback. The `tryProviderModels` function tries each model with exponential backoff on 429/503 errors, and if all models fail, sets a 5-minute cooldown in the `ai_provider_cooldowns` database table so subsequent requests skip Cerebras entirely.

---

### @google/generative-ai `^0.21.0`

**What:** Official Google SDK for the Gemini AI API.

**Why chosen:** Fourth provider in the AI fallback chain. Gemini excels at structured JSON output, which is critical for our natural language parsing that must return valid JSON with specific fields. The SDK provides typed request/response handling and file upload support. Selected over the raw REST API because the SDK handles authentication token refresh and provides better error messages.

**How it is used:**

Imported in `services/project-service/src/functions/AI.js` as `GoogleGenerativeAI`. A client is lazily instantiated via `getGeminiClient()` using `new GoogleGenerativeAI(process.env.GEMINI_API_KEY)`. The SDK is called through `callGeminiModel(model, question)` which uses `genAI.getGenerativeModel()` with `generationConfig: { responseMimeType: 'application/json' }` — this forces Gemini to always return valid JSON, which is critical for the natural language parser.

Gemini uses `gemini-2.5-flash` and `gemini-2.0-flash` models. It is the fourth provider in the fallback chain, attempted after HuggingFace, OpenRouter, and Cerebras have all failed or are on cooldown.

---

### @huggingface/inference `^3.0.0`

**What:** JavaScript client for the HuggingFace Inference API — access to thousands of open-source AI models.

**Why chosen:** First provider in the AI fallback chain because HuggingFace's free tier costs nothing. Good for simple natural language parsing tasks. The SDK abstracts away model selection, API versioning, and rate-limit handling. Alternatives like calling the REST API directly were rejected because the SDK provides typed responses and automatic retry logic.

**How it is used:**

Imported in `services/project-service/src/functions/AI.js` as `InferenceClient`. A client is lazily instantiated via `getHFClient()` using `new InferenceClient(process.env.HF_API_KEY)`. The SDK is called through `callHFModel(model, question)` which uses `client.chatCompletion()` with `temperature: 0.1` (low creativity, high determinism — critical for structured JSON output).

HuggingFace uses `deepseek-ai/DeepSeek-R1` and `meta-llama/Llama-3.3-70B-Instruct` models. It is the first provider attempted in the fallback chain because it is free. If it returns a 429 (rate limit) or 503 (model loading), the chain moves to OpenRouter.

---

### @neondatabase/serverless `^1.0.0`

**What:** Serverless PostgreSQL driver using HTTP/WebSocket transport instead of raw TCP.

**Why chosen:** Render's serverless environment does not support persistent TCP connections to PostgreSQL. The Neon driver uses HTTP POST requests for queries, which work in edge/serverless contexts where traditional `pg` connections time out. Used as a fallback database connector when the primary `pg` pool is unavailable.

**How it is used:**

Listed in `services/project-service/package.json` dependencies. The primary database connection uses `pg.Pool` (see below), but the Neon driver is available as a fallback for environments where persistent connections are not possible. The `db.js` module checks for `DATABASE_URL` and creates a `pg.Pool`; if that fails or the environment does not support TCP, the Neon driver can be used instead.

---

### cors `^2.8.6`

**What:** Express middleware that enables Cross-Origin Resource Sharing.

**Why chosen:** The frontend (served from Render's static hosting) makes API calls to each backend service on different ports/origins. Without CORS, the browser blocks these requests. This is the standard, universally-used CORS middleware for Express — configurable per-origin, per-method, and per-header. No alternative provides the same level of control with zero configuration.

**How it is used:**

Applied in every service's `src/index.js` with a strict allowlist of origins:

```javascript
const allowedOrigins = [
  'https://digital-logbook-bxgv.onrender.com',
  'https://digital-logbook-bjev.onrender.com',
  'https://digital-logbook-hlulani.onrender.com',
  'http://localhost:5173',
  'http://localhost:3000',
];
const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    callback(null, false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
```

The `origin` callback dynamically checks each incoming request's `Origin` header against the allowlist. Requests from unknown origins are rejected. `credentials: true` allows the browser to send cookies and `Authorization` headers cross-origin. The global error handler also re-applies CORS headers so that error responses are not blocked by the browser.

---

### date-fns `^4.1.0`

**What:** Lightweight, tree-shakeable date utility library.

**Why chosen:** The natural language parser in `entries.js` needs to calculate dates ("tomorrow", "in 3 days", "next Friday", "2 days from now"). `date-fns` provides immutable, pure-function date manipulation without the heavy bundle size of Moment.js. Tree-shaking means only the functions we import (`addDays`, `nextDay`, `format`) are included. Alternatives like `dayjs` were considered but `date-fns` has better TypeScript support and a more functional API.

**How it is used:**

Imported in `services/project-service/src/functions/entries.js` as `import { format, addDays, nextDay, endOfMonth, startOfDay } from 'date-fns'`. The functions are used in the `getDate()` method of the natural language parser:

- `format(date, 'yyyy-MM-dd')` — converts a Date object to an ISO date string for the `due_date` column
- `addDays(today, 1)` — "tomorrow" → today + 1 day
- `addDays(today, -1)` — "yesterday" → today - 1 day
- `addDays(today, 7)` — "next week" → today + 7 days
- `addDays(today, num * 7)` — "in 2 weeks" → today + 14 days
- `addDays(today, num)` — "in 3 days" → today + 3 days
- `nextDay(today, i)` — "next Monday" → finds the next occurrence of day `i` (0=Sunday, 1=Monday, etc.)
- `nextDay(today, 5)` — "end of the week" → next Friday
- `startOfDay()` and `endOfMonth()` — used for date range calculations in the calendar view

The parser also handles relative phrases like "2 days from now", "in 3 weeks", and "next Tuesday" by combining these primitives.

---

### dotenv `^17.4.2`

**What:** Loads environment variables from a `.env` file into `process.env`.

**Why chosen:** Each service needs database URLs, API keys, and JWT secrets that must never be committed to the repository. `dotenv` reads these from `.env` files during local development. On Render, environment variables are set through the dashboard and injected directly — `dotenv` is a no-op there. This is the standard approach for Node.js configuration.

**How it is used:**

Every service imports `dotenv` at the top of its entry point:

- `services/project-service/src/index.js` — `import './config.js'` which calls `import 'dotenv/config'`
- `services/dashboard-service/src/index.js` — same pattern
- `services/profile-service/src/index.js` — same pattern
- `services/auth-service/src/index.js` — `require('dotenv').config()` (CommonJS)

The `.env` files (never committed) contain: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT`, `HF_API_KEY`, `OPENROUTER_API_KEY`, `CEREBRAS_API_KEY`, `GEMINI_API_KEY`, `GROQ_API_KEY`.

---

### express `^5.2.1`

**What:** Minimal web framework for building REST APIs in Node.js.

**Why chosen:** Industry standard for Node.js APIs. Middleware pattern lets us layer CORS, auth verification, error handling, and route-specific logic cleanly. Each microservice is approximately 100 lines of boilerplate. Express 5 adds improved async error handling and better path matching over v4. Alternatives like Fastify or Koa were rejected — Express's documentation depth and community size make troubleshooting trivial.

**How it is used:**

Every service creates an Express app in `src/index.js` and mounts routes:

**project-service** (port 5003) — the largest service, mounts 7 route modules:

```javascript
app.use('/service', requireAuth, projectRoutes); // CRUD for projects
app.use('/service', requireAuth, entryRoutes); // CRUD for entries + natural language
app.use('/service', requireAuth, priorityRoutes); // priority updates
app.use('/service', requireAuth, fieldRoutes); // custom field definitions
app.use('/service', requireAuth, archiveRoutes); // archive/unarchive
app.use('/service', requireAuth, activityRoutes); // activity log
app.use('/service', requireAuth, aiRoutes); // AI summary generation
```

All `/service` routes require JWT authentication via `requireAuth` middleware. The `/api-docs` route serves Swagger UI. The `/` route returns a health check JSON.

**dashboard-service** (port 5002) — mounts search routes and starts the keep-alive daemon:

```javascript
app.use('/service', requireAuth, searchRoutes);
```

**profile-service** (port 5004) — mounts login and profile routes:

```javascript
app.use('/service', loginRoutes); // checkUser, createProfile
app.use('/service', profileRoutes); // getProfile, updateUsername, updateAvatar
```

**auth-service** (port 5001) — the simplest service, no database connection, just health check and error handler.

---

### jose `^6.0.12`

**What:** JavaScript module for JSON Object Signing and Encryption — JWT verification and signing.

**Why chosen:** Each backend service independently verifies JWT tokens from Supabase Auth. `jose` is the most maintained, spec-compliant JWT library for JavaScript — supports JWKS (JSON Web Key Sets) for automatic key rotation, which Supabase uses. Alternatives like `jsonwebtoken` use callbacks and do not support modern ESM imports. `jose` is promise-based and ESM-native, matching our module system.

**How it is used:**

Imported in `services/project-service/src/middleware/auth.js` as `import * as jose`. The middleware:

1. Creates a JWKS client: `jose.createRemoteJWKSet(new URL(JWKS_URL))` pointing to Supabase's `/.well-known/jwks.json` endpoint. This automatically fetches and caches the public signing keys, and re-fetches when keys rotate.
2. Extracts the JWT from the `Authorization: Bearer <token>` header (or from a `?token=` query parameter for SSE connections, since `EventSource` does not support custom headers).
3. Verifies the token: `jose.jwtVerify(token, jwks)` — this checks the signature, expiration, and issuer.
4. Attaches `req.user` (the decoded JWT payload) and `req.userEmail` (the verified email) to the request.
5. Provisions the user in `public.users` if they do not exist yet (handles OAuth signups where the auth flow never inserted a row).

The same middleware pattern is duplicated in `dashboard-service/src/middleware/auth.js`.

---

### js-yaml `^5.4.1`

**What:** YAML parser and serializer for JavaScript.

**Why chosen:** The project-service serves an OpenAPI specification (`openapi.yaml`) through Swagger UI. `js-yaml` reads and parses the YAML file at startup so it can be passed to `swagger-ui-express`. No alternative was considered — this is the de facto standard YAML library for JavaScript.

**How it is used:**

Imported in `services/project-service/src/index.js` as `import * as yaml from 'js-yaml'` (namespace import for ESM compatibility with the CJS module). At startup, it reads and parses the OpenAPI spec:

```javascript
const openApiSpec = yaml.load(readFileSync(join(__dirname, '..', 'docs', 'openapi.yaml'), 'utf8'), {
  schema: yaml.DEFAULT_SCHEMA,
});
```

The parsed spec object is then passed to `swaggerUi.setup(openApiSpec)` which renders the interactive API documentation at `/api-docs`. The `DEFAULT_SCHEMA` option enables YAML tags like `!!seq` and `!!map` that the OpenAPI spec uses.

---

### leven `^3.1.0`

**What:** Levenshtein distance algorithm — measures the number of single-character edits between two strings.

**Why chosen:** Used in the natural language parser for fuzzy project name matching. When a user types "fix login bug" and has a project called "WebApp Refactor", Levenshtein distance helps determine if the entry might relate to an existing project. The algorithm is fast (O(n*m) time), has zero dependencies, and the package is under 1 KB. Alternatives like `string-similarity` were rejected as heavier with no accuracy improvement.

**How it is used:**

Imported in `services/project-service/src/functions/entries.js` as `import leven from 'leven'`. Used in the `getDate()` method for fuzzy matching of date keywords:

```javascript
for (const keyword of DATE_KEYWORDS) {
  const distance = leven(alpha, keyword);
  if (distance <= maxDistance && distance < bestDistance) {
    bestDistance = distance;
    bestMatch = keyword;
  }
}
```

When a user types "tommorow" (misspelled), `leven('tommorow', 'tomorrow')` returns 2, which is within the allowed edit distance, so the parser correctly interprets it as "tomorrow" and calculates the due date accordingly.

---

### openai `^4.0.0`

**What:** Official OpenAI SDK for GPT model API access.

**Why chosen:** Used as one of the AI fallback providers. OpenAI's GPT models are the most widely tested for structured JSON output. The SDK handles authentication, request formatting, streaming, and automatic retries with exponential backoff. Selected as a fallback provider because OpenAI's reliability is well-established, even if not the cheapest option.

**How it is used:**

Imported in `services/project-service/src/functions/AI.js` as `OpenAI`. The SDK is used for two providers in the fallback chain:

1. **OpenRouter** — `getOpenRouterClient()` creates `new OpenAI({ baseURL: 'https://openrouter.ai/api/v1', apiKey: process.env.OPENROUTER_API_KEY })`. This reuses the OpenAI SDK with a custom base URL to access OpenRouter's model aggregation (which provides free access to Llama 3.3, Nemotron, and Gemma models). Called via `callOpenRouterModel()` using `client.chat.completions.create()` with `response_format: { type: 'json_object' }`.

2. **Groq** — `getGroqClient()` creates `new OpenAI({ baseURL: 'https://api.groq.com/openai/v1', apiKey: process.env.GROQ_API_KEY })`. Same pattern — reuses the OpenAI SDK with Groq's base URL for their ultra-fast Llama inference. Called via `callGroqModel()`.

The OpenAI SDK is the second provider (OpenRouter) and fifth provider (Groq) in the fallback chain: HuggingFace → **OpenRouter** → Cerebras → Gemini → **Groq**.

---

### pg `^8.16.3`

**What:** PostgreSQL client for Node.js — the standard driver for connecting to PostgreSQL databases.

**Why chosen:** The primary database driver for all services that query PostgreSQL directly (project-service, dashboard-service, profile-service). Supports connection pooling, parameterized queries (SQL injection prevention), and async/await. The Neon serverless driver is used only as a fallback — `pg` is the workhorse. No alternative was considered — this is the official, most-maintained PostgreSQL driver for Node.js.

**How it is used:**

Each service that connects to PostgreSQL has its own `db.js` file with identical structure:

```javascript
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
pool.query('SELECT 1').then(() => console.log('PostgreSQL pool connected successfully'));
```

The pool is used in every function that executes SQL:

- **project-service** — `entries.js` (INSERT/UPDATE/DELETE entries), `project.js` (CRUD projects), `field.js` (CRUD fields), `archives.js` (archive/unarchive with transactions), `activity.js` (INSERT activity_log), `search.js` (full-text search), `AI.js` (cooldown tracking)
- **dashboard-service** — `search.js` (searchAll, searchProject, searchProjects), `daemon.js` (INSERT/DELETE health_ping)
- **profile-service** — `login.js` (checkUser, provisionUser), `profile.js` (getProfile, updateUsername, updateAvatar, deleteAccount)

All queries use parameterized statements (`$1`, `$2`) to prevent SQL injection. The pool manages up to 10 concurrent connections per service instance.

---

### swagger-ui-express `^5.0.1`

**What:** Serves Swagger/OpenAPI documentation through an Express route with an interactive UI.

**Why chosen:** Provides a browsable, interactive API documentation page at `/api-docs` for the project-service. Users (and developers) can test endpoints directly from the browser. The alternative — writing separate documentation — would go stale as the API changes. OpenAPI YAML is the source of truth, and this package renders it automatically.

**How it is used:**

Imported in `services/project-service/src/index.js` as `swaggerUi`. Mounted at `/api-docs`:

```javascript
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(openApiSpec, {
    customSiteTitle: 'Codacaine API Docs',
    swaggerOptions: { persistAuthorization: true },
  })
);
```

The `persistAuthorization: true` option keeps the JWT token in the UI between page reloads, so developers do not have to re-paste their token every time they refresh. The `openApiSpec` object is parsed from `docs/openapi.yaml` by `js-yaml` at startup.

---

## Backend — Runtime (shared across services)

These packages appear in multiple services with the same versions:

| Package   | Version   | Services                    | Purpose                                                 |
| --------- | --------- | --------------------------- | ------------------------------------------------------- |
| `cors`    | `^2.8.6`  | All 4                       | Cross-origin request handling with per-origin allowlist |
| `dotenv`  | `^17.4.2` | All 4                       | Environment variable loading from `.env` files          |
| `express` | `^5.2.1`  | All 4                       | HTTP framework for REST APIs                            |
| `pg`      | `^8.16.3` | project, dashboard, profile | PostgreSQL connection pool and query execution          |

---

## Backend — Development

### @babel/core `^7.26.0` / @babel/preset-env `^7.26.0` / babel-jest `^29.7.0`

**What:** Babel transpiler and its Jest integration — converts modern JavaScript (ESM, optional chaining, nullish coalescing) to a format Jest can execute.

**Why chosen:** Jest does not natively understand ESM `import`/`export` syntax. Babel transforms ESM to CommonJS before Jest runs the tests. `@babel/preset-env` auto-detects the target Node.js version and only transforms what is needed. This is the standard Jest + ESM setup — no alternative provides the same compatibility.

**How it is used:**

Each service has a `babel.config.js` (or inline Jest config in `package.json`) that specifies:

```javascript
transform: { '^.+\\.js$': 'babel-jest' }
```

`@babel/preset-env` is configured to target the Node.js version running on Render. When `npm run test` invokes Jest, Babel transforms every `.js` file from ESM to CommonJS before Jest executes it. The `moduleNameMapper` in project-service maps `date-fns` to its CommonJS entry point to avoid ESM/CJS conflicts during testing.

---

### coverage-badges-cli `^2.2.0`

**What:** Generates SVG coverage badge images from Jest's `coverage-summary.json`.

**Why chosen:** Reads the JSON coverage output and produces a colored badge (green/yellow/red). Visible in the README, motivating the team to maintain coverage above thresholds.

**How it is used:**

Invoked via `node scripts/generate-badges.js` from the repo root after running `jest --coverage` in each service. The script reads `coverage/coverage-summary.json` (produced by Jest's `json-summary` reporter) and generates SVG badge files in `badges/<service>/`. The badges display statement, branch, function, and line coverage percentages.

---

### jest `^29.7.0` / jest-junit `^17.0.0`

**What:** JavaScript testing framework and its JUnit XML reporter.

**Why chosen:** Zero-config setup for Node.js projects. Built-in mocking (`jest.mock()`) isolates Supabase calls from business logic. Coverage reporting is built in. `jest-junit` produces XML reports that Gitea Actions can parse for test result summaries. Same framework across all 4 backend services ensures consistent testing patterns. Vitest was rejected for the backend because our services are plain JavaScript (not Vite projects), and Jest's mocking system is more mature for server-side code.

**How it is used:**

All 17 backend test files across 4 services use Jest. Key patterns:

- `jest.mock('../db.js')` — mocks the database pool so tests do not need a real PostgreSQL connection. The mock returns a fake `pool.query()` that resolves with predefined rows.
- `jest.mock('@supabase/supabase-js')` — mocks the Supabase client in auth tests.
- `describe/it/expect` — standard BDD-style test structure.
- `jest-junit` outputs JUnit XML to `reports/junit.xml`, which Gitea Actions parses to display test results in the PR UI.

Test files are located in `src/__tests__/` directories within each service.

---

### nodemon `^3.1.14`

**What:** Auto-restarts the Node.js server when source files change.

**Why chosen:** During development, manually restarting the server after every code change is slow. `nodemon` watches the `src/` directory and restarts automatically. Configured in `npm run dev` scripts. No alternative provides the same simplicity — `pm2` is overkill for development, and `ts-node-dev` only works with TypeScript.

**How it is used:**

Each service's `package.json` has `"dev": "nodemon src/index.js"`. Running `npm run dev` starts the service and watches for file changes. When a `.js` file in `src/` is saved, nodemon kills the Node.js process and restarts it. This is used by all 4 backend services during local development.

---

### supertest `^7.2.0`

**What:** HTTP assertion library for testing Express routes — sends real HTTP requests to the app without starting a server.

**Why chosen:** Used for backend integration tests that verify the full request/response cycle (status codes, response bodies, headers). Supertest creates a test server from the Express app, sends requests, and provides chainable assertions. Alternatives like manually calling route handlers were rejected because they skip middleware (CORS, auth) and do not test the real HTTP path.

**How it is used:**

Used in `services/auth-service/src/__tests__/cors.integration.test.js` to verify that CORS headers are correctly set on responses:

```javascript
import request from 'supertest';
import app from '../index.js';

it('allows requests from the frontend origin', async () => {
  const res = await request(app).get('/').set('Origin', 'http://localhost:5173');
  expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
});
```

Supertest mounts the Express app in-memory (no `listen()` call), sends HTTP requests to it, and returns the response for assertions. This tests the full middleware chain including CORS, JSON parsing, and error handling.

---

## Documentation Site

### mkdocs

**What:** Static site generator purpose-built for project documentation.

**Why chosen:** Write docs in Markdown — no special syntax or build tools beyond Python. Lives alongside the code in `docs-site/` so documentation is versioned with the project. Simple YAML configuration for navigation, theme, and extensions. Alternatives like Docusaurus require a Node.js build pipeline and React knowledge — MkDocs is just Python and Markdown.

**How it is used:**

`docs-site/mkdocs.yml` configures the site title, theme, navigation tree, and plugins. The `docs/` directory contains Markdown files organized by category: `Architecture/` (database, tech stack, UI design), `Meetings/` and `Stakeholder_Interactions/` (sprint-by-sprint logs), `User_Stories/`, `Project_Management/` (methodology, decisions, work tracker), and `Testing/`. Running `mkdocs build` produces a static HTML site in `docs-site/site/`, which Render deploys as a static site.

---

### mkdocs-material

**What:** Material Design theme for MkDocs — provides search, navigation, dark mode, and responsive layout.

**Why chosen:** The most popular MkDocs theme with built-in search (no separate search server needed), syntax highlighting, code copy buttons, tabbed content blocks, and admonition callouts. The pink/rose color palette matches the Digital Logbook brand. Free and open-source.

**How it is used:**

Configured in `docs-site/mkdocs.yml`:

```yaml
theme:
  name: material
  palette:
    primary: pink
    accent: rose
  features:
    - navigation.tabs
    - navigation.sections
    - search.suggest
    - content.code.copy
```

The theme provides the sidebar navigation, the search bar at the top, syntax-highlighted code blocks with copy buttons, and responsive layout for mobile devices. Listed in `docs-site/requirements.txt` alongside `mkdocs`.
