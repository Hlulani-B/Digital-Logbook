# Digital Logbook Documentation Site (MkDocs source)

## First-time setup

1. Install Python 3.9+ if you don't have it.
2. Install dependencies:
   ```bash
   pip install -r requirements.txt     
   ```

## Preview locally (live reload)

```bash
mkdocs serve
```
Then open http://127.0.0.1:8000 — edit any file in `docs/` and it refreshes automatically.

## Build static site (for deployment)

```bash
mkdocs build
```
Output goes to a `site/` folder — plain HTML/CSS/JS, ready to deploy to
Cloudflare Pages or wherever the team decides.

## Folder structure

```
docs/
├── index.md                          # Home page
├── getting-started.md                # Setup instructions
├── architecture/
│   ├── overview.md                   # System architecture
│   ├── database.md                   # DB schema + rationale
│   └── cicd-deployment.md            # CI/CD pipeline + deployment
└── development/
    ├── log.md                        # Chronological dev log
    ├── user-stories.md               # Sprint 1 user stories
    └── decisions.md                  # Settled + open decisions
mkdocs.yml                            # Site config + navigation
```

To add a new page: create a `.md` file under `docs/`, then add it to the
`nav:` section in `mkdocs.yml` so it shows up in the sidebar.
