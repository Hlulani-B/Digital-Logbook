// Supabase client — optional for local dev (built-in templates work without it)
const supabase = undefined;
import { validateFieldDefinitions, normalizeFields } from '../domain/fieldSchema.js';

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
    return resolved;
  });
}

export async function listTemplates(userEmail, { scope = 'all' } = {}) {
  const templates = [];
  if (scope === 'all' || scope === 'built_in') {
    templates.push(
      ...BUILT_IN_TEMPLATES.map((tpl) => ({
        ...tpl,
        fields: resolveBuiltInDefaults(tpl.fields),
        scope: 'built_in',
        is_fork: false,
        version: 1,
      }))
    );
  }
  if (scope === 'all' || scope === 'personal' || scope === 'global') {
    try {
      let query = supabase
        .from('schema_templates')
        .select('*')
        .eq('deleted', false)
        .order('created_at', { ascending: false });
      if (scope === 'personal') query = query.eq('user_email', userEmail).eq('scope', 'personal');
      else if (scope === 'global') query = query.eq('scope', 'global');
      else query = query.or(`user_email.eq.${userEmail},scope.eq.global`);
      const { data, error } = await query;
      if (error) throw error;
      templates.push(
        ...(data || []).map((row) => ({
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
        }))
      );
    } catch (err) {
      // Supabase not available — built-in templates still work
      console.log('[templates] Personal/global templates unavailable:', err.message);
    }
  }
  return templates;
}

export async function getTemplate(userEmail, templateId) {
  const builtIn = BUILT_IN_TEMPLATES.find((tpl) => tpl.id === templateId);
  if (builtIn) {
    return {
      ...builtIn,
      fields: resolveBuiltInDefaults(builtIn.fields),
      scope: 'built_in',
      is_fork: false,
      version: 1,
    };
  }
  const { data, error } = await supabase
    .from('schema_templates')
    .select('*')
    .eq('id', templateId)
    .eq('deleted', false)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  if (data.scope === 'personal' && data.user_email !== userEmail) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    fields: normalizeFields(data.fields),
    scope: data.scope,
    version: data.version,
    is_fork: data.is_fork,
    forked_from: data.forked_from,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function createTemplate(
  userEmail,
  { name, description, fields, scope = 'personal', forked_from = null }
) {
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    throw new Error('Template name is required.');
  }
  if (!['personal', 'global'].includes(scope)) {
    throw new Error('Templates must be personal or global.');
  }
  if (scope === 'global') {
    const { data: user } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('email', userEmail)
      .single();
    if (!user?.is_admin) throw new Error('Only administrators can create global templates.');
  }
  const validation = validateFieldDefinitions(fields);
  if (!validation.valid) {
    const error = new Error('Invalid template fields.');
    error.details = validation.errors;
    throw error;
  }
  const insertData = {
    user_email: scope === 'personal' ? userEmail : null,
    scope,
    name: name.trim(),
    description: description?.trim() || null,
    fields: validation.fields,
    version: 1,
    is_fork: !!forked_from,
    forked_from: forked_from || null,
  };
  const { data, error } = await supabase
    .from('schema_templates')
    .insert(insertData)
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    fields: normalizeFields(data.fields),
    scope: data.scope,
    version: data.version,
    is_fork: data.is_fork,
    forked_from: data.forked_from,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function updateTemplate(userEmail, templateId, { name, description, fields }) {
  const { data: existing, error: fetchError } = await supabase
    .from('schema_templates')
    .select('*')
    .eq('id', templateId)
    .eq('deleted', false)
    .single();
  if (fetchError) {
    if (fetchError.code === 'PGRST116') return null;
    throw fetchError;
  }
  if (existing.scope === 'personal' && existing.user_email !== userEmail) return null;
  if (existing.scope === 'global') {
    const { data: user } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('email', userEmail)
      .single();
    if (!user?.is_admin) return null;
  }
  const updates = { updated_at: new Date().toISOString() };
  if (name !== undefined) {
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new Error('Template name is required.');
    }
    updates.name = name.trim();
  }
  if (description !== undefined) updates.description = description?.trim() || null;
  if (fields !== undefined) {
    const validation = validateFieldDefinitions(fields);
    if (!validation.valid) {
      const error = new Error('Invalid template fields.');
      error.details = validation.errors;
      throw error;
    }
    updates.fields = validation.fields;
    updates.version = existing.version + 1;
  }
  const { data, error } = await supabase
    .from('schema_templates')
    .update(updates)
    .eq('id', templateId)
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    fields: normalizeFields(data.fields),
    scope: data.scope,
    version: data.version,
    is_fork: data.is_fork,
    forked_from: data.forked_from,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

export async function deleteTemplate(userEmail, templateId) {
  const { data: existing, error: fetchError } = await supabase
    .from('schema_templates')
    .select('*')
    .eq('id', templateId)
    .eq('deleted', false)
    .single();
  if (fetchError) {
    if (fetchError.code === 'PGRST116') return false;
    throw fetchError;
  }
  if (existing.scope === 'personal' && existing.user_email !== userEmail) return false;
  if (existing.scope === 'global') {
    const { data: user } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('email', userEmail)
      .single();
    if (!user?.is_admin) return false;
  }
  const { error } = await supabase
    .from('schema_templates')
    .update({ deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', templateId);
  if (error) throw error;
  return true;
}
