-- 023_retire_unsupported_global_templates.sql
-- The geolocation, entity_link, tags, file, timestamp and checklist field
-- types are no longer offered, so the global templates seeded by 022 that
-- used them are retired and replaced with versions built only from the
-- remaining field types (text, markdown, date, boolean, numeric, currency,
-- image, custom select).
--
-- Templates are deep-copied into projects on creation (no live inheritance),
-- so retiring these rows leaves every existing project (and any personal
-- forks users already made) untouched.

-- Retire the 022 seeds that used a removed field type:
-- Lab Report (tags), Meeting Notes (timestamp), Field Observation
-- (geolocation), Daily Log (checklist).
UPDATE public.schema_templates
SET deleted = true,
    deleted_at = now(),
    updated_at = now()
WHERE scope = 'global'
  AND user_email = 'admin@codacaine.com'
  AND name IN ('Lab Report', 'Meeting Notes', 'Field Observation', 'Daily Log')
  AND deleted = false;

-- Lab Report — same structure as before with the Tags field dropped.
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
SELECT
  'admin@codacaine.com',
  'global',
  'Lab Report',
  'Standard template for laboratory experiment reports with hypothesis, methodology, and results.',
  '[
    {
      "field_name": "Experiment Title",
      "data_type": "text",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 0
    },
    {
      "field_name": "Date",
      "data_type": "date",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 1
    },
    {
      "field_name": "Hypothesis",
      "data_type": "markdown",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 2
    },
    {
      "field_name": "Methodology",
      "data_type": "markdown",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 3
    },
    {
      "field_name": "Results",
      "data_type": "markdown",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 4
    },
    {
      "field_name": "Conclusion",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 5
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.schema_templates
  WHERE scope = 'global' AND name = 'Lab Report' AND deleted = false
);

-- Meeting Notes — the timestamp Date & Time becomes a plain date.
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
SELECT
  'admin@codacaine.com',
  'global',
  'Meeting Notes',
  'Capture meeting attendees, agenda items, decisions, and follow-ups.',
  '[
    {
      "field_name": "Meeting Title",
      "data_type": "text",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 0
    },
    {
      "field_name": "Date",
      "data_type": "date",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 1
    },
    {
      "field_name": "Attendees",
      "data_type": "text",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 2
    },
    {
      "field_name": "Agenda",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 3
    },
    {
      "field_name": "Decisions",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 4
    },
    {
      "field_name": "Follow-up Required",
      "data_type": "boolean",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 5
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.schema_templates
  WHERE scope = 'global' AND name = 'Meeting Notes' AND deleted = false
);

-- Field Observation — the geolocation field becomes a plain text Location;
-- the weather select and photo attachment stay.
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
SELECT
  'admin@codacaine.com',
  'global',
  'Field Observation',
  'Field observations with location, weather, and photo documentation.',
  '[
    {
      "field_name": "Location",
      "data_type": "text",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 0
    },
    {
      "field_name": "Date",
      "data_type": "date",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 1
    },
    {
      "field_name": "Weather",
      "data_type": "custom",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [
        {"label": "Sunny", "value": "sunny"},
        {"label": "Cloudy", "value": "cloudy"},
        {"label": "Rainy", "value": "rainy"},
        {"label": "Snowy", "value": "snowy"}
      ],
      "display_order": 2
    },
    {
      "field_name": "Observations",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 3
    },
    {
      "field_name": "Photos",
      "data_type": "image",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 4
    },
    {
      "field_name": "Follow-up Required",
      "data_type": "boolean",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 5
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.schema_templates
  WHERE scope = 'global' AND name = 'Field Observation' AND deleted = false
);

-- Daily Log — the checklist Tasks field becomes a markdown list; the mood
-- select and free-text sections stay.
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
SELECT
  'admin@codacaine.com',
  'global',
  'Daily Log',
  'Simple daily log entry with tasks, notes, and reflections.',
  '[
    {
      "field_name": "Date",
      "data_type": "date",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 0
    },
    {
      "field_name": "Tasks",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 1
    },
    {
      "field_name": "Notes",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 2
    },
    {
      "field_name": "Reflections",
      "data_type": "markdown",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 3
    },
    {
      "field_name": "Mood",
      "data_type": "custom",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [
        {"label": "Great", "value": "great"},
        {"label": "Good", "value": "good"},
        {"label": "Okay", "value": "okay"},
        {"label": "Tough", "value": "tough"}
      ],
      "display_order": 4
    }
  ]'::jsonb
WHERE NOT EXISTS (
  SELECT 1 FROM public.schema_templates
  WHERE scope = 'global' AND name = 'Daily Log' AND deleted = false
);
