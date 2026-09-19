-- Entity linking fields for relational tagging.
-- Links entries to other entries within the same project or across projects.
BEGIN;

ALTER TABLE public.fields
  ADD COLUMN IF NOT EXISTS link_target_project TEXT,
  ADD COLUMN IF NOT EXISTS link_target_table TEXT,
  ADD COLUMN IF NOT EXISTS link_allow_multiple BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fields_link_target_consistency' AND conrelid = 'public.fields'::regclass) THEN
    ALTER TABLE public.fields ADD CONSTRAINT fields_link_target_consistency CHECK (
      (data_type = 'entity_link' AND link_target_table IS NOT NULL) OR
      (data_type <> 'entity_link' AND link_target_project IS NULL AND link_target_table IS NULL AND link_allow_multiple = false)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS fields_entity_link_targets
  ON public.fields (user_email, link_target_table)
  WHERE data_type = 'entity_link' AND deleted IS NOT TRUE;

COMMIT;
