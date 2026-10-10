# Statistics Engine

## Overview

The Digital Logbook's **Statistics page** (`/stats`, titled "My Stats") is the analytics surface required by the project brief: _"useful statistics about what they are doing, how much time they've spent on specific projects."_ It renders in two scopes:

- **Global scope** (`/stats`) — aggregates across all of the user's projects, with cross-project charts.
- **Project scope** (`/stats?project=<name>`, linked from each project dashboard) — aggregates only that project's entries and unlocks per-field analytics for the project's custom fields.

Every panel on the page is computed in the browser from the locally cached entry rows. The backend is only involved in moving those rows from the database to the cache.

## Page Layout

As of Sprint 3 the page renders, in order:

| Panel                                                    | Scope        | What it shows                                                                          |
| -------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------------- |
| Overview cards (Active Projects, Due Soon, Time Tracked) | both         | Headline counts; "Time Tracked" is the pause-aware total with an in-progress sub-count |
| Time Distribution donut                                  | global only  | Tracked time per project                                                               |
| Entry Status breakdown                                   | both         | Completed / in-progress / no-timer percentages                                         |
| Time per Project bar chart                               | global only  | Tracked time per project, entry counts as sub-labels                                   |
| Entries per Project bar chart                            | global only  | Entry counts per project, tracked time as sub-labels                                   |
| Time per Entry                                           | both         | Every timed entry, longest first (see below)                                           |
| Field Insights                                           | project only | Field explorer, per-field panels, and a drill-in analysis per field (see below)        |

## Entry Duration

Every duration on the page comes from `entryDurationMs(entry, now)` (`stats.js`), which computes purely from timer stamps — the old stored `duration` column is ignored. `now` is the page-wide ticking clock, so running entries update live.

| Entry shape                                       | Formula                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------- |
| Completed (`started_at` + `ended_at`)             | `ended_at − started_at − paused_ms`, clamped to ≥ 0                           |
| Running (`started_at`, no `ended_at`)             | `now − started_at − paused_ms`                                                |
| Paused (`started_at`, `paused_at`, no `ended_at`) | frozen at `paused_at − started_at − paused_ms` (does not accrue while paused) |
| No `started_at`                                   | `0`                                                                           |

Details that matter:

- `paused_ms` is coerced with `Number(...)` because Postgres returns `BIGINT` as a string.
- Every branch floors at `Math.max(0, …)`, so corrupt stamps or a `paused_ms` larger than the elapsed window can never produce a negative duration.
- **Removed legacy fallback**: rows with `ended_at` but no `started_at` previously fell back to `ended_at − created_at`. That fallback was removed — without a start instant there is nothing to measure from, so such rows contribute `0` (and are excluded from Time per Entry, which lists only entries with a positive duration).

### Time per Entry panel

Lists each timed entry in the current scope, sorted by duration descending:

- The chart shows the top 10; a note says when the list is capped and the expandable "View complete data" table lists every timed entry.
- Untimed entries have no duration and are excluded.
- Entries have no title, so each row is labelled by its occurrence time (`Mar 9, 10:00`) — formatted from the UTC parts of `started_at` (falling back to `created_at`) so the label matches the page's UTC day labels in every viewer timezone. In global scope the label is prefixed with the project name (`Alpha · Mar 9, 10:00`).

## Occurrence-Day Bucketing

Daily charts bucket values by the **day the entry actually occurred**, not by today's clock:

- `dayBucket(entry)` takes `started_at`'s UTC date, falling back to `created_at` (`stats.js`). A 23:00 → 00:55 entry lands entirely on the first day.
- `dailyWindow(points, fill)` builds the series: with several occurrence days the window **spans every calendar day from the oldest to the latest occurrence**. With exactly one occurrence day, the window is that day plus the **two days before it**, so a single value can still draw a line.
- Gap filling depends on the aggregation: **sum** charts zero-fill missing days ("days without observations are zero"); **average** charts use `null` so genuine gaps render as "No observations" and the trend line breaks instead of pretending the average was zero.

## Field Analysis Engine

Field Insights analyses every owner-defined field of the scoped project without any per-project code, driven by three ideas:

1. **Field discovery** — `analysisFieldDefs(entries, declared)` merges the project's declared field definitions (from the `fields` table) with definitions derived from the entry data itself. Declared types win; derived fields fill the gaps so nothing present in the data is missed. `inferDataType` classifies values as number, boolean, date, or text.
2. **Type-driven policy** — `fieldAnalysisPolicy(data_type)` maps each field to a kind (numeric, date, category, boolean, multi, text, summary) and the views it is eligible for, plus a default view. Unknown types degrade to text. This is what makes the engine field-agnostic: a brand-new field appears with correct analytics as soon as entries carry values for it.
3. **One computation per field** — `computeFieldAnalysis(entries, def, { now, aggregation, compareDef })` returns a standard shape consumed by the UI:

   - `coverage` — total / filled / missing / invalid per entry,
   - `numeric` — total, average, min, max (numeric fields),
   - `frequencies` + `displayFrequencies` — sorted category counts, with the chart capped at the top entries and every category retained in the complete table,
   - `series` + `range` — the occurrence-day window described above,
   - `comparison` — an optional grouped matrix bucketing the field by a second field (e.g. Score grouped by Stage), with rows excluded when either value is missing or invalid.

The drill-in UI offers only the eligible views (Trend / Bars / Grouped / Donut / Search depending on kind) and a sum/average toggle for numeric kinds. Owner-declared `duration` fields participate as ordinary numeric fields with duration formatting.

## Deliberate Omissions

Two capabilities were removed during Sprint 3 and are documented here so the absence is intentional:

- **No standalone "Plot over time" panel.** Fields-over-time plotting lives in the field analysis Trend/Bars/Grouped views, whose series already span the occurrence window.
- **No synthesized "duration" field.** Timed entries used to add a virtual `duration` field to the field-analysis dropdown automatically. That was removed — timed entries alone must not create a dropdown entry; only owner-declared duration fields appear.

## Testing

| Suite                                                           | Locks in                                                                                                                                       |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `frontend/src/functions/dashboard/__tests__/stats.test.js`      | `entryDurationMs` (completed / running / paused / clamp / string `paused_ms`), totals and per-project stats                                    |
| `frontend/src/functions/dashboard/__tests__/fieldStats.test.js` | `dailyWindow` span + single-occurrence lead-up, field definition merging and type inference, coverage rules, comparison exclusion, aggregation |
| `frontend/src/pages/__tests__/StatsView.test.tsx`               | Panel rendering and scoping, Time per Entry ranking and labels, eligible views per kind, cap + complete table, live cache updates              |

## Key Files

- `frontend/src/pages/StatsView.tsx` — the `/stats` page: panels, charts, field-analysis UI
- `frontend/src/functions/dashboard/stats.js` — the statistics engine (pure functions)
- `frontend/src/CacheFunctions/syncService.js` — the single module that fetches server data into IndexedDB
- `frontend/src/functions/project/entries.js` — `getAllEntries`, the cache-first fetch the sync service uses
