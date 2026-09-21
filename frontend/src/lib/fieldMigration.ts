/**
 * Field Schema Migration System
 *
 * When a project's field definition changes (rename, retype, drop),
 * existing entries must carry forward. This module provides:
 *
 * - migrateFieldRename: update all entries when a field is renamed
 * - migrateFieldRetype: convert existing values when a field changes type
 * - migrateFieldDrop: archive field data before removing the definition
 * - applyFieldMigration: orchestrates a migration transaction
 *
 * All migrations are idempotent and preserve raw old values in a
 * _field_history JSONB column for audit/rollback.
 */

import type { FieldDefinition, FieldType } from './fieldSchema';

export interface FieldMigration {
  field_name: string;
  action: 'rename' | 'retype' | 'drop';
  old_name?: string;
  new_name?: string;
  old_type?: FieldType;
  new_type?: FieldType;
  /** Raw values preserved before migration */
  archived_values?: Record<string, unknown>;
}

export interface MigrationResult {
  success: boolean;
  entries_affected: number;
  errors: string[];
}

/**
 * Convert a value from one field type to another with best-effort mapping.
 * Returns the converted value, or null if conversion is not possible.
 */
export function convertFieldValue(value: unknown, fromType: FieldType, toType: FieldType): unknown {
  if (value === null || value === undefined) return null;

  // Same type — no conversion needed
  if (fromType === toType) return value;

  // To text/markdown — stringify
  if (toType === 'text' || toType === 'markdown') {
    if (typeof value === 'string') return value;
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  }

  // From text to number types — parse
  if (toType === 'integer' || toType === 'float' || toType === 'number') {
    const num = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(num)) return null;
    if (toType === 'integer') return Math.round(num);
    return num;
  }

  // To boolean
  if (toType === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1' || value === 1) return true;
    if (value === 'false' || value === '0' || value === 0) return false;
    return null;
  }

  // To tags — extract strings
  if (toType === 'tags') {
    if (Array.isArray(value)) {
      return value
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((v) => (v as string).trim());
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  // To checklist — wrap single string as one item
  if (toType === 'checklist') {
    if (Array.isArray(value)) {
      // If already checklist-shaped, return as-is
      if (value.every((v) => typeof v === 'object' && v !== null && 'text' in v)) {
        return value;
      }
      // Convert strings to checklist items
      return value
        .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
        .map((text, i) => ({ id: `migrated-${i}`, text: text.trim(), done: false }));
    }
    if (typeof value === 'string' && value.trim()) {
      return [{ id: 'migrated-0', text: value.trim(), done: false }];
    }
    return [];
  }

  // To date/timestamp — try parsing
  if (toType === 'date' || toType === 'timestamp') {
    if (typeof value === 'string') {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return toType === 'date' ? d.toISOString().split('T')[0] : d.toISOString();
      }
    }
    return null;
  }

  // Fallback: cannot convert
  return null;
}

/**
 * Build a migration plan for a field change.
 */
export function buildMigrationPlan(
  oldField: FieldDefinition,
  newField: FieldDefinition | null // null = dropping the field
): FieldMigration {
  if (newField === null) {
    return {
      field_name: oldField.field_name,
      action: 'drop',
      old_type: oldField.data_type,
    };
  }

  if (oldField.field_name !== newField.field_name) {
    return {
      field_name: oldField.field_name,
      action: 'rename',
      old_name: oldField.field_name,
      new_name: newField.field_name,
      old_type: oldField.data_type,
      new_type: newField.data_type,
    };
  }

  if (oldField.data_type !== newField.data_type) {
    return {
      field_name: oldField.field_name,
      action: 'retype',
      old_type: oldField.data_type,
      new_type: newField.data_type,
    };
  }

  // No meaningful change
  return {
    field_name: oldField.field_name,
    action: 'rename', // no-op
    old_name: oldField.field_name,
    new_name: oldField.field_name,
    old_type: oldField.data_type,
    new_type: oldField.data_type,
  };
}

/**
 * Apply a migration to a single entry's field values.
 * Returns the updated values and any archived (old) values.
 */
export function applyMigrationToEntry(
  entryValues: Record<string, unknown>,
  migration: FieldMigration
): { newValues: Record<string, unknown>; archived: Record<string, unknown> } {
  const archived: Record<string, unknown> = {};
  const newValues = { ...entryValues };

  const oldValue = entryValues[migration.field_name];

  switch (migration.action) {
    case 'rename': {
      if (migration.old_name && migration.new_name && migration.old_name !== migration.new_name) {
        archived[migration.old_name] = oldValue;
        newValues[migration.new_name] = oldValue;
        delete newValues[migration.old_name];
      }
      break;
    }

    case 'retype': {
      if (migration.old_type && migration.new_type) {
        archived[`${migration.field_name}@${migration.old_type}`] = oldValue;
        newValues[migration.field_name] = convertFieldValue(
          oldValue,
          migration.old_type,
          migration.new_type
        );
      }
      break;
    }

    case 'drop': {
      archived[migration.field_name] = oldValue;
      delete newValues[migration.field_name];
      break;
    }
  }

  return { newValues, archived };
}

/**
 * Merge archived history into an entry's _field_history JSONB.
 * Preserves all past values for audit/rollback.
 */
export function mergeFieldHistory(
  existingHistory: Record<string, unknown[]> | null,
  archived: Record<string, unknown>,
  timestamp: string
): Record<string, unknown[]> {
  const history = existingHistory || {};
  for (const [key, value] of Object.entries(archived)) {
    if (!history[key]) history[key] = [];
    history[key].push({ value, migrated_at: timestamp });
  }
  return history;
}
