BEGIN;

ALTER TABLE public.schema_templates
  ALTER COLUMN forked_from TYPE TEXT USING forked_from::text;

COMMIT;
