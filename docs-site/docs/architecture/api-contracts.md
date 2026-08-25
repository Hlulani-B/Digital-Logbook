# API Contracts

## Overview

All backend services follow a consistent API pattern:

- Base URL: Each service has its own deployed URL
- Authentication: Bearer token (Supabase JWT) in `Authorization` header
- Request/Response: JSON format
- Error handling: `{ success: false, message: string }`

## Auth Service (port 5001)

### Sign In

```
POST /auth/signin
Body: { email, password, captchaToken }
Response: { success: boolean, session?: object, message?: string }
```

### Sign Up

```
POST /auth/signup
Body: { email, password, captchaToken }
Response: { success: boolean, user?: object, message?: string }
```

### Sign Out

```
POST /auth/signout
Headers: Authorization: Bearer <token>
Response: { success: boolean, message: string }
```

### Reset Password

```
POST /auth/reset-password
Body: { email }
Response: { success: boolean, message: string }
```

### Delete Account

```
DELETE /auth/delete-account
Headers: Authorization: Bearer <token>
Response: { success: boolean, message: string }
```

### Check User

```
POST /auth/checkuser
Body: { email: string }
Response: { exists: boolean, deleted: boolean }
```

Returns `deleted: true` if the user has soft-deleted their account. The frontend uses this to auto-restore on sign-in.

## Profile Service (port 5004)

### Get Profile

```
POST /service/profile
Headers: Authorization: Bearer <token>
Body: { function: "getProfile", values: { email } }
Response: { success: boolean, data: { email, username, name, avatar, deleted } }
```

### Update Profile

```
POST /service/profile
Headers: Authorization: Bearer <token>
Body: { function: "updateProfile", values: { email, updates: { name?, username?, avatar? } } }
Response: { success: boolean, data: object }
```

### Create Profile

```
POST /service/profile
Headers: Authorization: Bearer <token>
Body: { function: "createProfile", values: { email, name, username, avatar? } }
Response: { success: boolean, message: string }
```

### Restore Account

```
POST /service/profile
Headers: Authorization: Bearer <token>
Body: { function: "restoreAccount", values: { email } }
Response: { success: boolean, message: string }
```

Calls the `restore_user()` RPC to reverse a soft-delete.

## Project Service (port 5003)

### Projects

#### Create Project

```
POST /service/project
Headers: Authorization: Bearer <token>
Body: { function: "add", values: { user_email, project_name, description } }
Response: { success: boolean, message: string, data?: object }
```

#### Get All Projects

```
POST /service/project
Headers: Authorization: Bearer <token>
Body: { function: "getByEmail", values: { user_email } }
Response: { success: boolean, projects: array }
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

```
POST /service/natural-language-entry
Headers: Authorization: Bearer <token>
Body: { text: string }
Response: {
  success: boolean,
  project: string,
  fields: object,
  priority: string | null,
  due_date: string | null,
  comment: string | null,
  created_new_project: boolean,
  new_fields?: array
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

### Search

#### Search All Projects

```
POST /service/search
Headers: Authorization: Bearer <token>
Body: { function: "searchAll", values: { user_email, query } }
Response: { success: boolean, data: array }
```

#### Search Specific Project

```
POST /service/search
Headers: Authorization: Bearer <token>
Body: { function: "searchProject", values: { user_email, project_name, query } }
Response: { success: boolean, data: array }
```

### Stats

#### Get Dashboard Stats

```
POST /service/stats
Headers: Authorization: Bearer <token>
Body: { function: "getStats", values: { user_email } }
Response: { success: boolean, data: { total_entries, total_projects, due_soon, time_tracked } }
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
