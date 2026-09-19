-- Migration 019: Field-Level Permissions
-- Adds project_members table and field_permissions column

-- 1. Create project_members table for role-based access
CREATE TABLE IF NOT EXISTS public.project_members (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_owner VARCHAR(255) NOT NULL,
  project_name  VARCHAR(255) NOT NULL,
  member_email  VARCHAR(255) NOT NULL,
  role          VARCHAR(30)  NOT NULL DEFAULT 'viewer',
  -- Roles: 'owner', 'admin', 'editor', 'viewer'
  created_at    TIMESTAMPTZ  DEFAULT now(),
  deleted       BOOLEAN      NOT NULL DEFAULT false,
  CONSTRAINT project_members_unique UNIQUE (project_owner, project_name, member_email)
);

-- Index for quick membership lookups by user
CREATE INDEX IF NOT EXISTS idx_project_members_email ON public.project_members (member_email) WHERE NOT deleted;

-- Index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members (project_owner, project_name) WHERE NOT deleted;

-- 2. Add field_permissions column to fields table
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS field_permissions JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Check constraint to ensure valid JSON object
ALTER TABLE public.fields
  ADD CONSTRAINT fields_permissions_shape
  CHECK (jsonb_typeof(field_permissions) = 'object');

-- 3. Add visibility column to fields table (persist frontend conditional display)
ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS visibility JSONB;

-- 4. Add comment for documentation
COMMENT ON COLUMN public.fields.field_permissions IS 'JSONB map of role -> permission level (edit/view/hidden). Empty {} means all roles get edit access.';
COMMENT ON COLUMN public.fields.visibility IS 'JSONB conditional visibility rules for dynamic field display.';
COMMENT ON COLUMN public.project_members.role IS 'Role: owner, admin, editor, or viewer';
