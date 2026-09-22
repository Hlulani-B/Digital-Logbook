-- 022_seed_global_templates.sql
-- Seeds default global templates available to all users.
-- These provide common field structures for typical logbook use cases.
--
-- Templates are deep-copied into projects on creation (no live inheritance),
-- so modifying these after the fact won't affect existing projects.

-- Lab Report template
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
VALUES (
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
      "has_default": true,
      "default_value": "now()",
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
    },
    {
      "field_name": "Tags",
      "data_type": "tags",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 6
    }
  ]'::jsonb
);

-- Meeting Notes template
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
VALUES (
  'admin@codacaine.com',
  'global',
  'Meeting Notes',
  'Capture meeting attendees, agenda items, decisions, and action items.',
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
      "field_name": "Date & Time",
      "data_type": "timestamp",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": true,
      "default_value": "now()",
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
      "field_name": "Action Items",
      "data_type": "checklist",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 5
    },
    {
      "field_name": "Next Meeting",
      "data_type": "date",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 6
    }
  ]'::jsonb
);

-- Field Observation template
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
VALUES (
  'admin@codacaine.com',
  'global',
  'Field Observation',
  'Record field observations with location, conditions, and findings.',
  '[
    {
      "field_name": "Observation Title",
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
      "has_default": true,
      "default_value": "now()",
      "options": [],
      "display_order": 1
    },
    {
      "field_name": "Location",
      "data_type": "geolocation",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 2
    },
    {
      "field_name": "Weather/Conditions",
      "data_type": "text",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 3
    },
    {
      "field_name": "Observations",
      "data_type": "markdown",
      "is_required": true,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 4
    },
    {
      "field_name": "Photos",
      "data_type": "image",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 5
    },
    {
      "field_name": "Follow-up Required",
      "data_type": "boolean",
      "is_required": false,
      "is_unique": false,
      "rules": {},
      "has_default": false,
      "options": [],
      "display_order": 6
    }
  ]'::jsonb
);

-- Daily Log template
INSERT INTO public.schema_templates (user_email, scope, name, description, fields)
VALUES (
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
      "has_default": true,
      "default_value": "now()",
      "options": [],
      "display_order": 0
    },
    {
      "field_name": "Tasks Completed",
      "data_type": "checklist",
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
);
