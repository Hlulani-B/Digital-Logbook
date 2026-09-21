import pool from '../db.js';
import { validateFieldDefinitions, normalizeFields, isRecord } from '../domain/fieldSchema.js';

export const BUILT_IN_TEMPLATES = Object.freeze([
  {
    id: 'tpl-lab-notebook',
    name: 'Lab Notebook',
    description: 'Scientific experiment tracking with observations, measurements, and results.',
    fields: [
      {
        field_name: 'Hypothesis',
        data_type: 'markdown',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 0,
      },
      {
        field_name: 'Method',
        data_type: 'markdown',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 1,
      },
      {
        field_name: 'Observations',
        data_type: 'markdown',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 2,
      },
      {
        field_name: 'Results',
        data_type: 'markdown',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 3,
      },
      {
        field_name: 'Temperature',
        data_type: 'float',
        is_required: false,
        is_unique: false,
        rules: { min: -273.15, max: 1000 },
        has_default: false,
        options: [],
        display_order: 4,
      },
      {
        field_name: 'Sample ID',
        data_type: 'text',
        is_required: false,
        is_unique: true,
        rules: { pattern: '^[A-Z]{2,4}-\\d{4,8}$' },
        has_default: false,
        options: [],
        display_order: 5,
      },
    ],
  },
  {
    id: 'tpl-field-log',
    name: 'Field Log',
    description: 'Field observations with location, weather, and photo documentation.',
    fields: [
      {
        field_name: 'Location',
        data_type: 'geolocation',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 0,
      },
      {
        field_name: 'Date',
        data_type: 'date',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: true,
        default_value: () => new Date().toISOString().slice(0, 10),
        options: [],
        display_order: 1,
      },
      {
        field_name: 'Weather',
        data_type: 'select',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [
          { id: 'sunny', label: 'Sunny', value: 'sunny' },
          { id: 'cloudy', label: 'Cloudy', value: 'cloudy' },
          { id: 'rainy', label: 'Rainy', value: 'rainy' },
          { id: 'snowy', label: 'Snowy', value: 'snowy' },
        ],
        display_order: 2,
      },
      {
        field_name: 'Notes',
        data_type: 'markdown',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 3,
      },
      {
        field_name: 'Photos',
        data_type: 'image',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 4,
      },
      {
        field_name: 'Species',
        data_type: 'multiselect',
        is_required: false,
        is_unique: false,
        rules: { maxLength: 20 },
        has_default: false,
        options: [],
        display_order: 5,
      },
    ],
  },
  {
    id: 'tpl-project-tracker',
    name: 'Project Tracker',
    description: 'Project management with status, priority, and budget tracking.',
    fields: [
      {
        field_name: 'Status',
        data_type: 'select',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: true,
        default_value: 'planning',
        options: [
          { id: 'planning', label: 'Planning', value: 'planning' },
          { id: 'active', label: 'Active', value: 'active' },
          { id: 'review', label: 'In Review', value: 'review' },
          { id: 'completed', label: 'Completed', value: 'completed' },
        ],
        display_order: 0,
      },
      {
        field_name: 'Priority',
        data_type: 'integer',
        is_required: false,
        is_unique: false,
        rules: { min: 1, max: 5 },
        has_default: true,
        default_value: 3,
        options: [],
        display_order: 1,
      },
      {
        field_name: 'Budget',
        data_type: 'currency',
        is_required: false,
        is_unique: false,
        rules: { min: '0' },
        has_default: false,
        options: [],
        display_order: 2,
      },
      {
        field_name: 'Progress',
        data_type: 'float',
        is_required: false,
        is_unique: false,
        rules: { min: 0, max: 100 },
        has_default: true,
        default_value: 0,
        options: [],
        display_order: 3,
      },
      {
        field_name: 'Description',
        data_type: 'markdown',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 4,
      },
      {
        field_name: 'Documents',
        data_type: 'file',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 5,
      },
    ],
  },
  {
    id: 'tpl-inspection',
    name: 'Inspection Report',
    description: 'Equipment or facility inspection with checklist and findings.',
    fields: [
      {
        field_name: 'Inspector',
        data_type: 'text',
        is_required: true,
        is_unique: false,
        rules: { minLength: 2, maxLength: 100 },
        has_default: false,
        options: [],
        display_order: 0,
      },
      {
        field_name: 'Inspection Date',
        data_type: 'timestamp',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: true,
        default_value: () => new Date().toISOString(),
        options: [],
        display_order: 1,
      },
      {
        field_name: 'Location',
        data_type: 'text',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 2,
      },
      {
        field_name: 'Findings',
        data_type: 'markdown',
        is_required: true,
        is_unique: false,
        rules: { minLength: 10 },
        has_default: false,
        options: [],
        display_order: 3,
      },
      {
        field_name: 'Pass/Fail',
        data_type: 'boolean',
        is_required: true,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 4,
      },
      {
        field_name: 'Severity',
        data_type: 'select',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [
          { id: 'low', label: 'Low', value: 'low' },
          { id: 'medium', label: 'Medium', value: 'medium' },
          { id: 'high', label: 'High', value: 'high' },
          { id: 'critical', label: 'Critical', value: 'critical' },
        ],
        display_order: 5,
      },
      {
        field_name: 'Evidence',
        data_type: 'image',
        is_required: false,
        is_unique: false,
        rules: {},
        has_default: false,
        options: [],
        display_order: 6,
      },
    ],
  },
]);

function resolveBuiltInDefaults(fields) {
  return fields.map((field) => {
    const resolved = { ...field };
    if (resolved.has_default && typeof resolved.default_value === 'function') {
      resolved.default_value = resolved.default_value();
    }
    return structuredClone(resolved);
  });
}

export class TemplateError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function queryTemplates(sql, parameters) {
  try {
    return await pool.query(sql, parameters);
  } catch (cause) {
    const error = new TemplateError(503, 'Template storage is unavailable.');
    error.cause = cause;
    throw error;
  }
}

function validateSavedId(id) {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    throw new TemplateError(400, 'Invalid template ID.');
  }
}

function validateMutationId(id) {
  if (BUILT_IN_TEMPLATES.some((tpl) => tpl.id === id)) {
    throw new TemplateError(403, 'Built-in templates cannot be changed.');
  }
  validateSavedId(id);
}

function validatePayload(payload) {
  if (!isRecord(payload)) throw new TemplateError(400, 'Template data must be an object.');
}

function validateName(name) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    [...name.trim()].length > 255 ||
    name.includes('\0')
  ) {
    throw new TemplateError(400, 'Template name must contain 1–255 characters.');
  }
  return name.trim();
}

function validateDescription(description) {
  if (description == null) return null;
  if (
    typeof description !== 'string' ||
    [...description].length > 2000 ||
    description.includes('\0')
  ) {
    throw new TemplateError(400, 'Template description must contain at most 2000 characters.');
  }
  return description.trim() || null;
}

function validateFields(fields) {
  let validation;
  try {
    validation = validateFieldDefinitions(fields);
  } catch {
    throw new TemplateError(400, 'Invalid template fields.');
  }
  if (!validation.valid) {
    throw new TemplateError(400, 'Invalid template fields.', validation.errors);
  }
  return validation.fields;
}

function savedTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    fields: normalizeFields(row.fields),
    scope: row.scope,
    version: row.version,
    is_fork: row.is_fork,
    forked_from: row.forked_from,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function builtInTemplate(template) {
  return {
    ...template,
    fields: resolveBuiltInDefaults(template.fields),
    scope: 'built_in',
    is_fork: false,
    version: 1,
  };
}

export async function listTemplates(userEmail, { scope = 'all' } = {}) {
  if (!['all', 'built_in', 'personal', 'global'].includes(scope)) {
    throw new TemplateError(400, 'Invalid template scope.');
  }
  if (scope === 'built_in') return BUILT_IN_TEMPLATES.map(builtInTemplate);
  const { rows } = await queryTemplates(
    `SELECT * FROM schema_templates
     WHERE deleted = false AND scope IN ('personal', 'global')
       AND (user_email = $1 OR scope = 'global')
       AND ($2 = 'all' OR scope = $2)
     ORDER BY created_at DESC`,
    [userEmail, scope]
  );
  const saved = rows.map(savedTemplate);
  return scope === 'all' ? [...BUILT_IN_TEMPLATES.map(builtInTemplate), ...saved] : saved;
}

export async function getTemplate(userEmail, templateId) {
  const builtIn = BUILT_IN_TEMPLATES.find((tpl) => tpl.id === templateId);
  if (builtIn) return builtInTemplate(builtIn);
  validateSavedId(templateId);
  const { rows } = await queryTemplates(
    `SELECT * FROM schema_templates
     WHERE id = $1 AND deleted = false AND scope IN ('personal', 'global')
       AND (user_email = $2 OR scope = 'global')`,
    [templateId, userEmail]
  );
  return rows[0] ? savedTemplate(rows[0]) : null;
}

export async function createTemplate(userEmail, payload, { isAdmin = false } = {}) {
  validatePayload(payload);
  const { name, description, fields, scope = 'personal', forked_from = null } = payload;
  const validName = validateName(name);
  const validDescription = validateDescription(description);
  const validFields = validateFields(fields);
  if (!['personal', 'global'].includes(scope)) {
    throw new TemplateError(400, 'Templates must be personal or global.');
  }
  if (scope === 'global' && isAdmin !== true) {
    throw new TemplateError(403, 'Only administrators can create global templates.');
  }
  const savedParent =
    forked_from !== null && !BUILT_IN_TEMPLATES.some((tpl) => tpl.id === forked_from);
  if (savedParent) validateSavedId(forked_from);
  // Validate saved parents in the insert itself so an unreadable source never creates a fork.
  const source = savedParent
    ? `FROM schema_templates AS source
       WHERE source.id = $7::uuid AND source.deleted = false
         AND source.scope IN ('personal', 'global')
         AND (source.user_email = $1 OR source.scope = 'global')`
    : '';
  const { rows } = await queryTemplates(
    `INSERT INTO schema_templates
       (user_email, scope, name, description, fields, version, is_fork, forked_from)
     SELECT $1::text, $2, $3, $4, $5::jsonb, 1, $6, $7::text
     ${source}
     RETURNING *`,
    [
      userEmail,
      scope,
      validName,
      validDescription,
      JSON.stringify(validFields),
      forked_from !== null,
      forked_from,
    ]
  );
  if (!rows[0]) {
    throw new TemplateError(
      savedParent ? 404 : 503,
      savedParent ? 'Fork source not found or access denied.' : 'Template storage is unavailable.'
    );
  }
  return savedTemplate(rows[0]);
}

export async function updateTemplate(userEmail, templateId, payload, { isAdmin = false } = {}) {
  validateMutationId(templateId);
  validatePayload(payload);
  const { name, description, fields } = payload;
  const parameters = [templateId, userEmail, isAdmin === true];
  const updates = ['updated_at = now()'];
  if (name !== undefined) {
    parameters.push(validateName(name));
    updates.push(`name = $${parameters.length}`);
  }
  if (description !== undefined) {
    parameters.push(validateDescription(description));
    updates.push(`description = $${parameters.length}`);
  }
  if (fields !== undefined) {
    parameters.push(JSON.stringify(validateFields(fields)));
    updates.push(`fields = $${parameters.length}::jsonb`, 'version = version + 1');
  }
  const { rows } = await queryTemplates(
    `UPDATE schema_templates SET ${updates.join(', ')}
     WHERE id = $1 AND deleted = false
       AND ((scope = 'personal' AND user_email = $2) OR (scope = 'global' AND $3::boolean = true))
     RETURNING *`,
    parameters
  );
  return rows[0] ? savedTemplate(rows[0]) : null;
}

export async function deleteTemplate(userEmail, templateId, { isAdmin = false } = {}) {
  validateMutationId(templateId);
  const { rows } = await queryTemplates(
    `UPDATE schema_templates SET deleted = true, deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted = false
       AND ((scope = 'personal' AND user_email = $2) OR (scope = 'global' AND $3::boolean = true))
     RETURNING id`,
    [templateId, userEmail, isAdmin === true]
  );
  return rows.length > 0;
}
