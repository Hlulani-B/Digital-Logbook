```markdown
# Codacaine - Digital Logbook

A microservices-based digital logbook app built with React (frontend) and Node.js/Express (backend services), using Supabase for auth and database.

## Test Coverage

| Service | Lines | Statements | Functions | Branches |
| :--- | :---: | :---: | :---: | :---: |
| **Project Service** | ![Lines](https://img.shields.io/badge/lines-33.96%25-e05d44) | ![Statements](https://img.shields.io/badge/statements-32.36%25-e05d44) | ![Functions](https://img.shields.io/badge/functions-36.92%25-e05d44) | ![Branches](https://img.shields.io/badge/branches-27.22%25-e05d44) |
| **Profile Service** | ![Lines](https://img.shields.io/badge/lines-36.80%25-e05d44) | ![Statements](https://img.shields.io/badge/statements-36.66%25-e05d44) | ![Functions](https://img.shields.io/badge/functions-53.84%25-yellow) | ![Branches](https://img.shields.io/badge/branches-28.30%25-e05d44) |
| **Dashboard Service** | ![Lines](https://img.shields.io/badge/lines-39.56%25-e05d44) | ![Statements](https://img.shields.io/badge/statements-37.50%25-e05d44) | ![Functions](https://img.shields.io/badge/functions-54.54%25-yellow) | ![Branches](https://img.shields.io/badge/branches-17.02%25-e05d44) |

## Architecture

This is a monorepo containing independent backend services and a React frontend. Each service runs as its own process on its own port.

```
codacaine/
├── frontend/                  # React app (Vite)
│   └── src/
├── services/
│   ├── auth-service/          # Handles login/signup via Supabase Auth
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── dashboard-service/     # Cross-project summaries (dashboard only)
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── project-service/       # Project entries, timeline, search, stats
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   └── profile-service/       # User profile management
│       ├── index.js
│       ├── package.json
│       └── .env
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Prerequisites

- Node.js (LTS) and npm
- A Supabase project (URL + API key)
- Git

## Getting Started

### 1. Clone the repo

```powershell
git clone https://sdp.ms.wits.ac.za/codacaine/Digital-Logbook.git
cd Digital-Logbook
```

### 2. Install dependencies for each service

```powershell
cd services\auth-service
npm install
cd ..\dashboard-service
npm install
cd ..\project-service
npm install
cd ..\profile-service
npm install
cd ..\..
```

### 3. Install frontend dependencies

```powershell
cd frontend
npm install
cd ..
```

## Environment Variables

Each backend service needs its own `.env` file in its root folder. These are not pushed to Gitea (listed in `.gitignore`) since they contain secret keys, so every teammate must create their own locally.

Create a `.env` file inside each service folder:

- `services/auth-service/.env`
- `services/dashboard-service/.env`
- `services/project-service/.env`
- `services/profile-service/.env`

Each file should contain:

```
SUPABASE_URL=https://yourproject.supabase.co
SUPABASE_KEY=your_supabase_key
PORT=4001
```

Use the same `SUPABASE_URL` and `SUPABASE_KEY` across all three services (shared database), but give each service a different `PORT`:

| Service | Port |
|---|---|
| auth-service | 4001 |
| dashboard-service | 4002 |
| project-service | 4003 |
| profile-service | 4004 |

Get the Supabase URL and key from the team lead or Supabase project settings — do not commit these values to the repo.

## Running the Project

Run each service in its own terminal:

```powershell
cd services\auth-service
node index.js
```

```powershell
cd services\dashboard-service
node index.js
```

```powershell
cd services\project-service
node index.js
```

```powershell
cd services\profile-service
node index.js
```

Run the frontend:

```powershell
cd frontend
npm run dev
```

## Branching Rules

- `main` and `services` branches are protected — no direct pushes, changes must go through a pull request with required approvals.
- Create a feature branch for your work:

```powershell
git checkout -b feature/your-feature-name
git add .
git commit -m "describe your change"
git push -u origin feature/your-feature-name
```

Then open a pull request on Gitea into `main` (or `services` for backend-only work).

## Rule: Dashboard vs Project Data

- Project entries and their statistics stay scoped to that project (`project-service`).
- The dashboard (`dashboard-service`) only shows cross-project summaries — it does not read individual entry tables directly.
```