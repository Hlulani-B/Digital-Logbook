Three sibling content areas are maintained in parallel:

- `docs/` — lightweight ad-hoc docs (user stories, AI transcript) plus a PDF export.
- `docs-site/` — the canonical MkDocs site. Source Markdown lives under `docs-site/docs/`, organized into top-level sections (`Architecture`, `Meetings`, `Stakeholder_Interactions`, `User_Stories`, `Project_Management`, `Testing`) with shared assets under `docs/assets/` (UML SVGs, UI screenshots, meeting photos, feedback spreadsheets). The site is configured by `mkdocs.yml`, which declares the Material theme, search plugin, pymdownx extensions (including Mermaid fenced code blocks), custom CSS/JS, and the full sidebar navigation. Static output is generated into `docs-site/site/` (HTML, minified assets, search index, sitemap).
- `presentations/` — standalone Markdown slides and their compiled PDFs per sprint.
  Dependency direction is one-way: Markdown sources → MkDocs build → static `site/`; no runtime code depends on this module.
