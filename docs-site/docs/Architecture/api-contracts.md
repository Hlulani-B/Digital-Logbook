# API Contracts

## Overview

All backend services follow a consistent API pattern:

- Base URL: Each service has its own deployed URL
- Authentication: Bearer token (Supabase JWT) in `Authorization` header
- Request/Response: JSON format
- Error handling: `{ success: false, message: string }`


## Profile Service (port 5004)

**Production URL:** `https://profile-service-0zk7.onrender.com`

### Get Profile

```http
POST /service/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "getProfile",
  "values": { "email": "user@example.com" }
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "username": "johndoe",
    "name": "John Doe",
    "avatar": "https://...",
    "deleted": false
  }
}
```

### Update Profile

```http
POST /service/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "updateProfile",
  "values": {
    "email": "user@example.com",
    "updates": { "name": "John Updated", "username": "johnupdated" }
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "email": "user@example.com",
    "username": "johnupdated",
    "name": "John Updated"
  }
}
```

### Create Profile

```http
POST /service/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "createProfile",
  "values": {
    "email": "user@example.com",
    "name": "John Doe",
    "username": "johndoe"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Profile created successfully"
}
```

### Restore Account

```http
POST /service/profile
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "restoreAccount",
  "values": { "email": "user@example.com" }
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Account restored successfully"
}
```

Calls the `restore_user()` RPC to reverse a soft-delete.

## Project Service (port 5003)

**Production URL:** `https://project-service-96ml.onrender.com`

**Interactive Docs:** `https://project-service-96ml.onrender.com/api-docs` (Swagger UI)

### Projects

#### Create Project

```http
POST /service/project
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "add",
  "values": {
    "user_email": "user@example.com",
    "project_name": "My Coding Project",
    "description": "A project for tracking coding tasks"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "message": "Project created successfully",
  "data": {
    "id": 1,
    "project_name": "My Coding Project",
    "user_email": "user@example.com"
  }
}
```

#### Get All Projects

```http
POST /service/project
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "getByEmail",
  "values": { "user_email": "user@example.com" }
}
```

**Response (200):**

```json
{
  "success": true,
  "projects": [
    {
      "id": 1,
      "project_name": "My Coding Project",
      "user_email": "user@example.com",
      "created_at": "2026-09-01T10:00:00Z"
    }
  ]
}
```

#### Rename Project

```
POST /service/project
Headers: Authorization: Bearer <token>
Body: { function: "rename", values: { user_email, old_name, new_name } }
Response: { success: boolean, message: string }
```

#### Delete Project

```
POST /service/project
Headers: Authorization: Bearer <token>
Body: { function: "delete", values: { user_email, project_name } }
Response: { success: boolean, message: string }
```

### Entries

#### Add Entry

```
POST /service/entry
Headers: Authorization: Bearer <token>
Body: { function: "add", values: { user_email, project_name, entry_object, due_date?, priority? } }
Response: { success: boolean, message: string, data?: object }
```

#### Get Entries

```
POST /service/entry
Headers: Authorization: Bearer <token>
Body: { function: "get", values: { user_email, project_name } }
Response: { success: boolean, data: array }
```

#### Get All Entries

```
POST /service/entry
Headers: Authorization: Bearer <token>
Body: { function: "getAll", values: { user_email } }
Response: { success: boolean, data: array }
```

#### Update Entry

```
POST /service/entry
Headers: Authorization: Bearer <token>
Body: { function: "update", values: { user_email, project_name, entry_id, new_entry, due_date?, priority? } }
Response: { success: boolean, message: string, data?: object }
```

#### Delete Entry

```
POST /service/entry
Headers: Authorization: Bearer <token>
Body: { function: "delete", values: { user_email, project_name, entry } }
Response: { success: boolean, message: string }
```

#### Sort Entries

```
POST /service/entry
Headers: Authorization: Bearer <token>
Body: { function: "sortUnarchived" | "sortArchived", values: { user_email, project_name?, sort_type } }
Response: { success: boolean, data: array }
```

#### Natural Language Entry

```http
POST /service/natural-language-entry
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "text": "Fix login bug in the auth service by tomorrow"
}
```

**Response (200):**

```json
{
  "success": true,
  "project": "Auth Service",
  "fields": {
    "description": "Fix login bug"
  },
  "priority": "Urgent and important",
  "due_date": "2026-09-14",
  "comment": null,
  "created_new_project": false
}
```

!!! note "AI constraint"
The AI prompt explicitly instructs the model to **never** include `due_date`, `due date`, `priority`, or `status` as custom fields — these are already built-in columns on every entry.

### Fields

#### Add Field

```
POST /service/field
Headers: Authorization: Bearer <token>
Body: { function: "add", values: { user_email, project_name, field_name, data_type, is_required } }
Response: { success: boolean, message: string }
```

#### Get Fields

```
POST /service/field
Headers: Authorization: Bearer <token>
Body: { function: "get", values: { user_email, project_name } }
Response: { success: boolean, data: array }
```

#### Delete Field

```
POST /service/field
Headers: Authorization: Bearer <token>
Body: { function: "delete", values: { user_email, project_name, field_name } }
Response: { success: boolean, message: string }
```

### Priority

#### Set Priority

```
POST /service/priority
Headers: Authorization: Bearer <token>
Body: { function: "set", values: { user_email, project_name, entry_id, priority } }
Response: { success: boolean, message: string }
```

### Activity Log

#### Log Activity

```
POST /service/activity
Headers: Authorization: Bearer <token>
Body: { function: "log", values: { user_email, action, entity_type, entity_name, details? } }
Response: { success: boolean, message: string }
```

#### Get Activity

```
POST /service/activity
Headers: Authorization: Bearer <token>
Body: { function: "get", values: { user_email, limit? } }
Response: { success: boolean, data: array }
```

## Dashboard Service (port 5002)

**Production URL:** `https://dashboard-service-bpc5.onrender.com`

### Search

#### Search All Projects

```http
POST /service/search
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "searchAll",
  "values": {
    "user_email": "user@example.com",
    "query": "login bug"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "project_name": "Auth Service",
      "entries": [
        {
          "id": 42,
          "title": "Fix login bug",
          "due_date": "2026-09-14"
        }
      ]
    }
  ]
}
```

#### Search Specific Project

```http
POST /service/search
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "searchProject",
  "values": {
    "user_email": "user@example.com",
    "project_name": "Auth Service",
    "query": "login"
  }
}
```

**Response (200):**

```json
{
  "success": true,
  "data": [
    {
      "id": 42,
      "title": "Fix login bug",
      "due_date": "2026-09-14"
    }
  ]
}
```

### Stats

#### Get Dashboard Stats

```http
POST /service/stats
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "function": "getStats",
  "values": { "user_email": "user@example.com" }
}
```

**Response (200):**

```json
{
  "success": true,
  "data": {
    "total_entries": 47,
    "total_projects": 5,
    "due_soon": 3,
    "time_tracked": "12h 30m"
  }
}
```

### Soft-Delete

#### Delete User Account (Soft)

```
POST /service/profile
Headers: Authorization: Bearer <token>
Body: { function: "deleteAccount", values: { email } }
Response: { success: boolean, message: string }
```

Calls `delete_user()` RPC. Marks all user data as `deleted = true` rather than hard-deleting.

#### Restore User Account

```
POST /service/profile
Headers: Authorization: Bearer <token>
Body: { function: "restoreAccount", values: { email } }
Response: { success: boolean, message: string }
```

Calls `restore_user()` RPC. Reverses soft-delete — sets `deleted = false` on user and all related rows.

## Common Response Patterns

### Success

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}
```

### Error

```json
{
  "success": false,
  "message": "Description of what went wrong"
}
```

### Unauthorized

```json
{
  "error": "Unauthorized: missing access token"
}
```

## Authentication Flow

1. Frontend sends email/password to auth-service
2. Auth-service verifies with Supabase Auth
3. Supabase returns JWT token
4. Frontend stores token and sends in `Authorization: Bearer <token>` header
5. Each backend service verifies token via `requireAuth` middleware
6. Middleware attaches `req.user` and `req.userEmail` to request

## OpenAPI 3 Specification

The full API is described by an [OpenAPI 3.0 specification](https://github.com/codacaine/Digital-Logbook/blob/main/services/project-service/docs/openapi.yaml) that documents all 15 endpoint paths across 4 microservices.

### Browsable Documentation

A Swagger UI is served at `/api-docs` on the project-service, allowing interactive testing of endpoints directly from the browser.

**Local URL:** `http://localhost:5003/api-docs`

**Production URL:** `https://project-service-96ml.onrender.com/api-docs`

### Spec Validation

12 automated tests in `services/project-service/src/__tests__/openapi.test.js` verify that:

- The YAML parses correctly
- All 15 expected paths are present
- No phantom routes exist (spec has no path the code lacks)
- All POST operations have request bodies
- JWT-protected routes have 401 responses
- Reusable schemas are defined

### How to Test the API Externally

### 1. Get a JWT Token

Sign in via the frontend at `https://digital-logbook-bxgv.onrender.com` and extract the JWT token from the browser's localStorage or network tab.

Alternatively, use the Supabase dashboard to generate a test token.

### 2. Make Authenticated Requests

Use the token in the `Authorization` header:

```bash
# Get all projects
curl -X POST https://project-service-96ml.onrender.com/service/project \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"function": "getByEmail", "values": {"user_email": "your@email.com"}}'

# Get dashboard stats
curl -X POST https://dashboard-service-bpc5.onrender.com/service/stats \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"function": "getStats", "values": {"user_email": "your@email.com"}}'

# Get profile
curl -X POST https://profile-service-0zk7.onrender.com/service/profile \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"function": "getProfile", "values": {"email": "your@email.com"}}'
```

### 3. Use Swagger UI (Project Service Only)

Visit `https://project-service-96ml.onrender.com/api-docs` in your browser:

1. Click "Authorize" button
2. Paste your JWT token (without "Bearer " prefix)
3. Click "Authorize"
4. Test endpoints directly from the browser

### 4. Use Postman Collection

Import the Postman collection from [`docs-site/docs/assets/api/Digital-Logbook.postman_collection.json`](../assets/api/Digital-Logbook.postman_collection.json) to test all endpoints with a GUI.

---

## External API Integrations

The Digital Logbook integrates with **5 external AI providers** in a fallback chain for natural language processing:

| Provider          | Purpose                                          | Fallback Order |
| ----------------- | ------------------------------------------------ | -------------- |
| **HuggingFace**   | Free-tier AI inference (DeepSeek, Llama)         | 1st (free)     |
| **OpenRouter**    | Aggregated model access (Llama, Nemotron, Gemma) | 2nd (free)     |
| **Cerebras**      | Ultra-fast wafer-scale chip inference (Llama)    | 3rd (paid)     |
| **Google Gemini** | Structured JSON output (Gemini 2.5 Flash)        | 4th (paid)     |
| **Groq**          | Ultra-fast Llama inference                       | 5th (paid)     |

### How the Fallback Chain Works

1. Request comes in to `/service/natural-language-entry`
2. Try HuggingFace (free) → if rate-limited (429) or error (503), move to next
3. Try OpenRouter (free) → if rate-limited, move to next
4. Try Cerebras (paid, fast) → if rate-limited, move to next
5. Try Gemini (paid, structured JSON) → if rate-limited, move to next
6. Try Groq (paid, fast) → if all fail, return error

Each provider has a 5-minute cooldown after a rate-limit error, tracked in the `ai_provider_cooldowns` database table.

### AI Provider Configuration

All API keys are stored as environment variables on Render:

- `HF_API_KEY` — HuggingFace API key
- `OPENROUTER_API_KEY` — OpenRouter API key
- `CEREBRAS_API_KEY` — Cerebras API key
- `GEMINI_API_KEY` — Google Gemini API key
- `GROQ_API_KEY` — Groq API key
