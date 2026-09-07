# System Design

## Architecture Patterns

### Microservices

The application follows a microservices architecture with three independent backend services:

```
┌─────────────────┐
│   Frontend      │  React + Vite + TypeScript
│   (Port 5173)   │
└────────┬────────┘
         │ HTTP/REST
         ▼
┌────────────────────────────────────────┐
│         API Gateway Layer              │
│    (CORS + Auth Middleware)            │
└────────┬───────────────────────────────┘
         │
    ┌────┴────┬──────────┬──────────┐
    ▼         ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│ Auth   │ │Project │ │Dashboard│ │Profile │
│Service │ │Service │ │Service  │ │Service │
│:5001   │ │:5003   │ │:5002    │ │:5004   │
└────┬───┘ └────┬───┘ └────┬────┘ └────┬───┘
     │          │          │           │
     └──────────┴──────────┴───────────┘
                │
                ▼
         ┌─────────────┐
         │  Supabase   │
         │ PostgreSQL  │
         │    + Auth   │
         └─────────────┘
```

### Service Isolation

Each service is independently deployable with:

- Its own `package.json` and dependencies
- Its own port assignment
- Its own database connection pool
- Its own error handling
- Its own CORS configuration

## Data Flow

### Entry Creation Flow

```
User Input
    │
    ▼
QuickEntryBar (Frontend)
    │
    ▼
natural_language.js (Frontend API call)
    │
    ▼
POST /service/natural-language-entry
    │
    ▼
Natural_language.entry() (Backend)
    │
    ├──► Fetch user's projects
    ├──► Fetch fields for each project
    ├──► Build AI prompt with context
    ├──► Call AI provider chain
    │       ├── HuggingFace
    │       ├── OpenRouter
    │       ├── Cerebras
    │       ├── Gemini
    │       └── Groq
    ├──► Parse AI response
    ├──► Match or create project
    ├──► Create fields if new project
    └──► Insert entry
            │
            ▼
    Return { success, project, fields, comment, ... }
            │
            ▼
    Display toast notification
```

### Authentication Flow

```
User Credentials
    │
    ▼
SignIn.tsx
    │
    ▼
POST /auth/signin (auth-service)
    │
    ▼
supabase.auth.signInWithPassword()
    │
    ▼
Return JWT token
    │
    ▼
Store in localStorage
    │
    ▼
Attach to all subsequent requests
    │
    ▼
requireAuth middleware validates
    │
    ▼
Attach req.user, req.userEmail
```

## Key Design Decisions

### 1. No Direct Supabase Access from Frontend

**Decision**: Frontend never talks to Supabase directly.

**Rationale**:

- Satisfies course requirement for "hand-written API"
- Centralizes business logic in backend
- Easier to add validation, logging, rate limiting
- Better security (service role key never exposed)

### 2. AI Provider Chain

**Decision**: Try multiple AI providers in sequence with fallback.

**Rationale**:

- No single point of failure
- Rate limit resilience
- Cost optimization (try free/cheap providers first)
- Graceful degradation

**Implementation**:

```javascript
async function AI(prompt) {
  if (checkCooldown('huggingface')) {
    try {
      return await huggingface(prompt);
    } catch {
      setCooldown('huggingface');
    }
  }
  if (checkCooldown('openrouter')) {
    try {
      return await openrouter(prompt);
    } catch {
      setCooldown('openrouter');
    }
  }
  // ... continue chain
}
```

### 3. Class-Based Service Layer

**Decision**: Backend uses ES6 classes for each domain.

**Rationale**:

- Clear encapsulation of business logic
- Easy to instantiate and test
- Consistent pattern across services
- Methods map directly to API endpoints

**Example**:

```javascript
export class Entries {
  async addEntry(...) { }
  async updateEntry(...) { }
  async getEntries(...) { }
  async deleteEntry(...) { }
}
```

### 4. Unified Error Response Format

**Decision**: All errors return `{ success: false, message: string }`.

**Rationale**:

- Consistent frontend error handling
- Easy to display user-friendly messages
- Distinguish between operational errors and bugs

### 5. Activity Logging

**Decision**: Log all significant user actions to activity_log table.

**Rationale**:

- Audit trail for debugging
- User behavior insights
- Feature usage tracking
- Compliance requirements

**Implementation**:

```javascript
await logActivity({
  user_email,
  action: 'CREATE',
  entity_type: 'PROJECT',
  entity_name: projectName,
  details: { field_count: 3 },
});
```

### 6. Natural Language Entry — AI Field Constraints

**Decision**: The AI prompt explicitly forbids creating `due_date`, `priority`, or `status` as custom fields.

**Rationale**:

- These are built-in columns on every entry already
- Without the constraint, the AI would sometimes create redundant custom fields like "Due Date" alongside the real `due_date` column
- Keeps the schema clean and avoids user confusion

## Database Design

### Core Tables

- `users` - User profiles (email PK, username, avatar_url, deleted, deletion_scheduled_at)
- `projects` - User projects (user_email FK, project_name, description, unique_name, archived, deleted)
- `entries` - Log entries (user_email FK, project_name FK, entries JSONB, due_date, priority, deleted)
- `fields` - Custom fields per project (user_email FK, project_name FK, field_name, data_type, deleted)
- `activity_log` - User action history (user_email FK, action, entity_type, entity_name, details, deleted)

### JSONB Pattern

Entries use JSONB for flexible field storage:

```json
{
  "description": "Fixed login bug",
  "status": "completed",
  "hours_spent": 2
}
```

**Rationale**:

- Each project can have different fields
- No schema migration needed when adding fields
- PostgreSQL JSONB supports indexing and querying

## Security

### Authentication

- Supabase Auth handles password hashing, JWT issuance
- Tokens expire after 1 hour
- Refresh tokens stored in localStorage

### Soft-Delete & Account Recovery

**Decision**: Account deletion uses soft-delete rather than hard-delete.

**Rationale**:

- Users may delete their account impulsively — soft-delete lets them recover
- Sign-in flow checks `deleted` status and auto-restores if needed
- All related data (entries, projects, fields, activity_log) is marked `deleted = true` in one atomic RPC call
- `deletion_scheduled_at` enables future hard-delete expiry (e.g. after 30 days)

**Flow**:

```
User clicks "Delete Account"
    │
    ▼
Frontend calls deleteAccount()
    │
    ▼
Backend calls delete_user() RPC
    │
    ├──► Mark entries, fields, projects, activity_log as deleted = true
    ├──► Set users.deleted = true, deletion_scheduled_at = now()
    └──► Sign out user

User signs in again later
    │
    ▼
Frontend calls checkUser(email)
    │
    ▼
Backend returns { exists: true, deleted: true }
    │
    ▼
Frontend auto-calls restoreAccount()
    │
    ▼
Backend calls restore_user() RPC
    │
    └──► Set deleted = false on all rows, clear deletion_scheduled_at
```

### Authorization

- `requireAuth` middleware on all protected routes
- Token verification on every request
- User can only access their own data (enforced by user_email FK)

### Input Validation

- All route handlers validate request body
- SQL injection prevented via Supabase client
- XSS prevented via React's automatic escaping

## Performance Considerations

### Database

- Supabase connection pooling
- Indexed foreign keys (user_email, project_name)
- JSONB GIN indexes for entry queries

### Caching

- No server-side caching yet (Sprint 2 candidate)
- Frontend uses React Query for client-side caching

### AI Calls

- Cooldown tracking prevents rapid retries
- Lazy-loaded SDKs reduce memory footprint
- Prompt optimization reduces token usage

## Testing Strategy

### Unit Tests

- Jest for backend services
- Mock Supabase client for isolation
- Test each class method independently

### Integration Tests

- Curl scripts for end-to-end verification
- Test full request/response cycle
- Verify database state changes

### Frontend Tests

- React Testing Library (planned)
- Component rendering tests
- User interaction tests

## Deployment

### Render Configuration

- Each service deployed independently
- Environment variables via Render dashboard
- Automatic deployments from main branch
- Health checks on `/` endpoint

### CI/CD Pipeline

```
Push to main/hlulani
    │
    ▼
Gitea Actions workflow
    │
    ├──► Install dependencies
    ├──► Run tests with coverage
    ├──► Generate coverage badge
    └──► Trigger Render deploy
```

## Future Considerations

### Sprint 2 Candidates

- Server-side caching (Redis)
- Rate limiting middleware
- API versioning
- WebSocket for real-time updates
- Background job queue for AI calls
- Comprehensive logging (Winston/Pino)

### Scalability

- Horizontal scaling via Render auto-scale
- Database read replicas
- CDN for static assets
- API gateway consolidation
