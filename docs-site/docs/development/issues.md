# Issues & Trouleshooting

A record of the issues encountered during development and deployment, how they were diagnosed, and how they were resolved.

---

## Deployment & Routing

### Issue 1: OAuth Redirect Pointing to localhost

After deploying to Render, signing in via OAuth redirected users to `localhost:3000` instead of the live site.

**Root cause:** Supabase Authentication was configured with `http://localhost:3000` as both the Site URL and the only Redirect URL. When a redirect URL doesn't match the allow list, Supabase silently falls back to the Site URL.

**Fix:** Updated Supabase Authentication → URL Configuration:

- Changed Site URL to `https://digital-logbook-bxgv.onrender.com`
- Added `https://digital-logbook-bxgv.onrender.com/**` to the Redirect URLs allow list
- Retained the localhost entry for local development

### Issue 2: 404 on Client-Side Routes

Direct navigation to `/signin` on the deployed site returned "Not Found" from Render, despite the route existing locally.

**Root cause:** The SPA uses client-side routing. Render's static host was serving requests literally, looking for a file matching `/signin` on disk. Since all content is rendered client-side after `index.html` loads, the request failed before React Router could handle it.

**Fix:** Added a rewrite rule in Render's Redirects/Rewrites settings so all paths (`/*`) serve `/index.html`.

### Issue 3: Background Video Assets Exceeded Deployment Limits

Background videos on the sign-in pages were too large to push to the repository and deploy on Render.

**Fix:** Removed background videos from the production build. Lighter alternatives (compressed video, GIF, static imagery) or external CDN hosting would be needed if this feature is revisited.

**Takeaway:** Enhancements beyond the core rubric (such as background video assets) need to be evaluated against deployment constraints like repository size and hosting limits before being finalised.

---

## CORS & Express 5 Compatibility

### Issue 4: CORS Policy Blocking Frontend-to-Backend Requests

The frontend at `digital-logbook-bxgv.onrender.com` was unable to make requests to backend services due to CORS policy violations.

**Affected endpoints:**

- `POST /service/profile` — profile creation/updates
- `POST /service/login` — user existence checks (`checkUser`)

**Root causes identified:**

1. **Express 5 incompatibility with `cors` package** — Express 5.2.1 has breaking changes in `path-to-regexp` v8+. `app.options('*', cors())` crashes with `PathError: Missing parameter name at index 1: *`. Safe Express 5 preflight handling requires regex matching: `app.options(/(.*)/, cors(...))`.

2. **Render free tier cold starts** — Services sleep after 15 minutes of inactivity. First request after sleep takes 30–50 seconds. Preflight `OPTIONS` requests may time out before the service wakes up.

3. **Unhandled route crashes bypassing CORS middleware** — Route handlers lacked `try/catch` wrappers. Internal DB query failures produced uncaught promise rejections. Default Express 5 error responses returned plain HTML without CORS headers.

4. **Frontend hitting wrong service URL** — The frontend was hitting `profile-service.onrender.com` (doesn't exist) instead of `profile-service-0zk7.onrender.com`. A wrong domain fails at DNS level, which the browser reports as a CORS error.

5. **`supabase.js` crashing at module load** — The `supabase.js` file threw at module load time if env vars were missing, crashing the entire service before Express/CORS middleware could register. Render returned a 502 without CORS headers.

**Fix:**

```js
// Dynamic origin checking & Express 5 compliant config
const corsOptions = {
  origin: (origin, callback) => {
    const allowedOrigins = ['https://digital-logbook-bxgv.onrender.com'];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options(/(.*)/, cors(corsOptions));
```

All route handlers were wrapped in `try/catch` blocks with default parameter fallbacks (`values = {}`).

**Takeaway:** Unhandled errors inside async route handlers cause Express to return default HTML error responses that bypass CORS middleware. Explicitly catching route-level exceptions ensures error responses remain within the JSON response lifecycle, preserving required CORS headers.

---

## Profile & Authentication

### Issue 5: NOT NULL Constraint Blocking Profile Creation

The `users` table has a NOT NULL constraint on `username`. The `addEmail()` function only inserted `{ email }`, which always failed.

**Fix:** Modified the backend `Email.email()` to generate a default `username` and `name` from the email prefix (e.g., `john.doe@gmail.com` → `john_doe`).

### Issue 6: Frontend Reading Email from localStorage Instead of Auth Context

Both `CreateProfile` and `Avatar` pages read email via `localStorage.getItem("email")`. If the user refreshed or navigated directly, the email was missing and the page redirected to sign-in.

**Fix:** Replaced `localStorage` reads with `useAuth()` context which always has the current Supabase session user.

### Issue 7: `getProfile` Response Structure Mismatch

The backend returns `{ success: true, data: { email, name, username, avatar } }` but the frontend was reading `result?.name` instead of `result?.data?.name`.

**Fix:** Added `const profileData = result?.data || result` to correctly unwrap the response.

### Issue 8: Profile Auto-Creation for Existing Users

Users who signed up before the `addEmail` fix had no row in the `users` table.

**Fix:** Added fallback in `SettingsPanel` — if `getProfile` fails, it calls `addEmail` to create the row, then re-fetches.

---

## Frontend Integration

### Issue 9: Dashboard Stats Hardcoded to Zero

The Dashboard component had all stats hardcoded to `0`. Backend functions existed but were never called.

**Fix:** Wired up `getProjectsByEmail()` and `getAllEntries()` to fetch real data on mount, with loading states.

### Issue 10: `ProjectsPage` Never Routed

The `ProjectsPage` component existed with full backend integration but was never imported or added to the App router.

**Fix:** Added `/projects` route in `App.tsx`, modified `ProjectsPage` to use `useAuth()` for the email.

### Issue 11: Avatar Not Syncing to Navbar

AvatarPicker saved to profile-service, but the navbar read from Supabase auth metadata. Two separate stores were never connected.

**Fix:** Connected the navbar avatar to profile-service data instead of Supabase auth metadata.

### Issue 12: Profile Data Not Refreshing

Dashboard's profile fetch ran once on mount. Closing settings didn't trigger a re-fetch.

**Fix:** Added a refresh trigger when the settings panel closes.

### Issue 13: AvatarPicker Had File Upload Instead of Preset Avatars

The `AvatarPicker` allowed photo uploads, but the project only supports DiceBear preset avatars.

**Fix:** Rewrote `AvatarPicker` to show a grid of 18 DiceBear avatars with auto-save on selection.

---

## UI & Theming

### Issue 14: Dark Theme Had Warm/Coloured Tones Instead of Neutral

The dark theme used olive/sage greens and warm charcoals instead of pure black/white/grey.

**Fix:** Replaced all dark theme variables with neutral values: `#0a0a0a` background, `#ffffff` text, `#e0e0e0` accent.

### Issue 15: Sign-In Page Right Panel Had Dark Theme Override

The `.split-right` panel had its own dark theme with gold accents, overriding the vintage light theme.

**Fix:** Removed all `.split-right` dark overrides (~130 lines), restored it to use root CSS variables.

---

## Build & Deployment Errors

### Issue 16: Duplicated Trailing Code in Dashboard.tsx

A bad merge left 30 lines of duplicated code at the end of the file, causing TypeScript build failures.

**Fix:** Removed the duplicated trailing code.

### Issue 17: Unused Import Causing Build Failure

`sortArchivedEntries` was still imported after being replaced, triggering TypeScript's `noUnusedLocals` error.

**Fix:** Removed the unused import.

---

## AI Provider Integration

### Issue 18: All AI Providers Failing on Render

Logs showed `HF_API_KEY`, `OPENROUTER_API_KEY`, and `GEMINI_API_KEY` were `NOT SET` on Render despite being declared in `render.yaml`.

**Root cause:** Keys were declared in `render.yaml` with `sync: false`, which requires manual value entry in the Render dashboard. The values were never actually pasted in.

**Fix:** Added the actual API key values in Render Dashboard → project-service → Environment.

### Issue 19: Wrong Supabase Import in `ai.js`

`ai.js` used `import supabase from "./supabase.js"` (default import) but `supabase.js` exports as named: `export const supabase`. The import path was also wrong (`./supabase.js` vs `../supabase.js`).

**Fix:** Changed to `import { supabase } from '../supabase.js'`.

### Issue 20: Natural Language Entry Always Showing Success

`natural_language.js` wrapped the backend response as `{ success: true, data }` regardless of what the backend actually returned.

**Fix:** Now checks `data?.success === false` before returning success.

### Issue 21: AI Hallucinating Due Dates

Entries created from phrases like "i want to wash my clothes today" were getting wrong or hallucinated due dates. Date keywords like "today" were leaking into custom fields.

**Root cause:** The AI model was asked to both parse the entry text and do date math in a single pass. Asking an LLM to compute calendar arithmetic inside a JSON-extraction prompt is unreliable.

**Fix:** Added a `getDate(text)` helper in `entries.js` that resolves dates server-side before the AI is called, using keyword matching:

| Input | Result |
|---|---|
| `"today"` | Today's date |
| `"tomorrow"` | Today + 1 |
| `"yesterday"` | Today − 1 |
| `"next week"` | Today + 7 |
| `"in 3 days"` / `"in 2 weeks"` | Today + 3 / Today + 14 |
| `"next wednesday"` | Next Wednesday |
| `"monday"` / `"friday"` | Next occurrence of that day |
| `"end of month"` | Last day of current month |
| `"august 25"` / `"25 dec"` | Explicit month + day dates |
| No date keyword found | `null` |

`getDate()` also returns the input text with date keywords stripped out, so the AI never sees "today"/"tomorrow" and can't copy them into unrelated fields. Fuzzy matching corrects common misspellings (e.g., "tommorow" → "tomorrow", "wendsday" → "wednesday") before keyword matching runs.

The prompt changed from asking the AI to compute the date to handing it the already-resolved value:

> "The due date has already been calculated: 2026-08-22. You MUST use this exact value. Do NOT change it."

As a second layer of defence, all call sites in `entries.js` that previously inserted `parsed.due_date` (the AI's output) into the database were changed to insert `calculatedDate` (the server-computed value) instead.

**Takeaway:** When an LLM prompt combines free-form extraction with a task that has a deterministic, rule-based answer (like calendar math), split them — compute the deterministic part in code first, and only ask the model to consume the pre-computed value, not derive it.

### Issue 22: `didyoumean` Too Strict for Real-World Misspellings

The `didyoumean` library (v1.2.2) was initially used for fuzzy matching of misspelled date keywords in `getDate()`. It failed to correct common misspellings like "todya" → "today" and "wendsday" → "wednesday", even with the threshold set to its maximum.

**Root cause:** `didyoumean` uses an internal Levenshtein distance check but only reliably handles single-character edits. Two-character transpositions or substitutions (e.g., "todya" has both y↔d and a↔y swapped) exceed its effective matching capability regardless of the threshold parameter. Additionally, it caused false positives on short words — "day" (3 chars) was being corrected to "may", turning "in 1 day" into "in 1 may" → May 1st.

**Fix:** Replaced `didyoumean` with `leven` (Levenshtein distance library) which provides direct access to the raw edit distance. The `correctDateKeywords()` function now:

1. Skips words shorter than 4 characters (avoids false positives like "day" → "may")
2. Computes `leven(input, keyword)` against all known date keywords
3. Accepts a match only if the distance is ≤ 40% of the input word's length

| Input | Distance | Target | Threshold (40%) | Result |
|---|---|---|---|---|
| `"todya"` (5) | 2 | `"today"` | 2 | Match |
| `"wendsday"` (8) | 2 | `"wednesday"` | 3 | Match |
| `"weak"` (4) | 1 | `"week"` | 1 | Match |
| `"days"` (4) | 2 | `"may"` | 1 | No match (correct) |
| `"want"` (4) | 2 | `"jan"` | 1 | No match (correct) |

All 33 unit tests pass, including 8 misspelling test cases and edge cases like "in 1 day" and "i want to wash my clothes today".

---

## Unused Backend Functions

### Issue 23: Backend Functions Never Wired Up

4 backend functions (`setPriority`, `deleteProfile`, `searchProjects`, `getArchives`) were never connected to the frontend.

**Fix:** Wired up the functions to their respective frontend pages and components.
