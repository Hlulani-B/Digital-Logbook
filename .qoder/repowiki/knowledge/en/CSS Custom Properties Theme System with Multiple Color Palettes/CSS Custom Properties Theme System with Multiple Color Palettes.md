---
kind: frontend_style
name: CSS Custom Properties Theme System with Multiple Color Palettes
category: frontend_style
scope:
  - '**'
source_files:
  - frontend/src/index.css
  - frontend/src/hooks/useTheme.ts
  - frontend/src/App.css
  - frontend/vite.config.ts
  - frontend/package.json
---

## What system/approach is used

The frontend uses a **pure CSS custom properties (variables) theming system** built on top of Vite + React, with no CSS-in-JS library, no Tailwind, and no component UI framework. All visual styling lives in plain `.css` files imported into `src/index.css`, which defines a comprehensive design token surface via CSS variables under `:root` and theme-scoped overrides using `[data-theme='...']` attribute selectors on `<html>`.

Fonts are loaded from Google Fonts at the top of `index.css`: `Plus Jakarta Sans` (body), `Playfair Display`, `Lora`, `Crimson Text`, and `EB Garamond`. The app ships with **14 distinct themes**: default light, dark, pink, blue, purple, green, brown, navy, darkpurple, coffee, oled, teal, solarized, and darkpink — each defined as a full palette of semantic tokens (`--bg`, `--surface`, `--text`, `--accent`, `--border`, `--success`, `--danger`, shadows, navbar, scrollbar, selection colors, etc.).

Theme switching is driven by a React hook `useTheme.ts` that persists the chosen theme to `localStorage` under key `dl_theme` and applies it by setting/removing the `data-theme` attribute on `document.documentElement`. A `toggleTheme()` helper flips between light and dark; a full `setTheme(theme)` lets callers pick any of the 14 themes.

## Key files and packages

- `frontend/src/index.css` — single source of truth for all global styles, CSS reset, typography, layout utilities, and every theme's variable definitions (~8000 lines). Contains per-theme blocks for `.glass`, `.navbar`, `.bg-mesh`, `.auth-title`, `.dash-greeting h1`, stat icons, avatars, buttons, and selection.
- `frontend/src/hooks/useTheme.ts` — typed theme state (`type Theme = 'light' | 'dark' | 'pink' | ... | 'solarized' | 'darkpink'`), validation against a whitelist, persistence, and `isDark` boolean derived from the current theme.
- `frontend/src/App.css` — small set of page-level styles (hero, next-steps layout, ticks decoration) that reference the shared CSS variables rather than hard-coded colors.
- `frontend/vite.config.ts` — minimal Vite config with a `@` path alias pointing to `./src`; no CSS preprocessor or PostCSS plugin configured beyond the React plugin.
- Per-page/component CSS modules (e.g. `Calendar.css`, `Kanban.css`, `Timeline.css`, `Today.css`, `DataPortability.css`, `Templates/ProjectTemplates/ProjectTable.css`) co-located with their components and scoped to those views.

## Architecture and conventions

1. **Design-token-first CSS**: Every color, radius, shadow, and font family is exposed as a CSS custom property. Components consume these tokens via `var(--name)` instead of literal values, enabling instant theme swaps without JS re-renders.
2. **Attribute-based theming**: Themes are activated by adding `data-theme="<name>"` to `<html>`. The default light theme has no attribute; all other themes override the root variables. This keeps runtime logic out of the DOM tree and makes devtools inspection straightforward.
3. **Semantic token naming**: Tokens follow a consistent vocabulary across themes — `--bg` / `--surface` / `--surface-hover` / `--surface-solid` for backgrounds, `--text` / `--text-dim` / `--text-muted` / `--text-secondary` for text hierarchy, `--accent` / `--accent-light` / `--accent-glow` for brand color, `--success` / `--danger` for status, plus `--border`, `--radius*`, `--shadow-*`, `--overlay-bg`, `--navbar-bg`, `--toggle-track`, `--scrollbar-thumb*`.
4. **Per-theme visual polish**: Each theme block not only redefines variables but also adds targeted overrides for special classes (e.g. `.glass`, `.navbar`, `.bg-mesh::before/::after`, `.auth-title` gradient text, `.stat-icon.*`, `.profile-avatar-badge`, `::selection`, avatar backgrounds, `.btn-primary`). Darker themes additionally apply `backdrop-filter: blur(...)` to glassmorphic surfaces.
5. **No build-time CSS processing**: There is no Sass/Less/Stylus, no Tailwind, no CSS Modules, and no CSS-in-JS. Styles are plain CSS compiled by Vite. Component-scoped styles live in sibling `.css` files alongside their `.tsx` counterparts.
6. **Responsive strategy**: Handled via native CSS `@media` queries inside the same files (e.g. breakpoints at `1024px` in `App.css`); no responsive utility framework is used.
7. **Type safety for themes**: The `Theme` union type in `useTheme.ts` acts as the single source of truth for allowed theme names, validated against a `VALID_THEMES` array before being persisted to localStorage.

## Conventions and constraints

- **Add a new theme by**: defining a `[data-theme='<name>']` block in `index.css` that redefines the full set of semantic tokens listed above, then appending `'<'name>'` to both the `Theme` type and `VALID_THEMES` array in `useTheme.ts`. Omitting a token will cause fallback to the default light theme's value.
- **Components must never hard-code colors**: they should use `var(--token)` so theme switches work uniformly. Existing code follows this pattern throughout `App.css` and per-component CSS files.
- **Dark vs light detection**: consumers should call `isDark` from `useTheme()` rather than inspecting the string theme name, since multiple themes (navy, darkpurple, coffee, oled, teal, solarized, darkpink) are considered dark.
- **Persistence key**: the chosen theme is stored in `localStorage` under the fixed key `dl_theme`; changing this key would break user preference retention.
- **Font loading**: fonts are loaded once at the top of `index.css` via `@import url(...)`. New fonts must be added there to ensure they are available before first paint.
- **Scoped CSS per view**: page-specific styles go into dedicated `.css` files colocated with their pages/components (e.g. `Calendar.css`, `Kanban.css`, `Timeline.css`, `Today.css`, `DataPortability.css`, `ProjectTable.css`) rather than extending `index.css`.
