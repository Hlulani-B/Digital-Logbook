/**
 * Visibility evaluation engine for conditional field display.
 *
 * Evaluates visibility rules against current entry values to determine
 * whether a field should be shown or hidden.
 */

import type { FieldDefinition, VisibilityRule } from './fieldSchema';

export type AlertLevel = 'ok' | 'warning' | 'alert';

/**
 * Evaluate a single visibility rule against current values.
 */
function evaluateRule(rule: VisibilityRule, currentValues: Record<string, unknown>): boolean {
  const fieldValue = currentValues[rule.field];
  const hasValue = fieldValue !== undefined && fieldValue !== null;

  switch (rule.operator) {
    case 'exists':
      return hasValue;
    case 'not_exists':
      return !hasValue;
    case 'eq':
      return fieldValue === rule.value;
    case 'neq':
      return fieldValue !== rule.value;
    case 'in':
      return Array.isArray(rule.value) && rule.value.includes(fieldValue);
    case 'not_in':
      return Array.isArray(rule.value) && !rule.value.includes(fieldValue);
    case 'gt':
      if (typeof fieldValue !== 'number' || typeof rule.value !== 'number') return false;
      return fieldValue > rule.value;
    case 'lt':
      if (typeof fieldValue !== 'number' || typeof rule.value !== 'number') return false;
      return fieldValue < rule.value;
    case 'gte':
      if (typeof fieldValue !== 'number' || typeof rule.value !== 'number') return false;
      return fieldValue >= rule.value;
    case 'lte':
      if (typeof fieldValue !== 'number' || typeof rule.value !== 'number') return false;
      return fieldValue <= rule.value;
    default:
      return false;
  }
}

/**
 * Evaluate visibility for a field based on its visibility config and current values.
 * Returns true if the field should be visible.
 */
export function evaluateVisibility(
  field: FieldDefinition,
  currentValues: Record<string, unknown>
): boolean {
  if (!field.visibility || !field.visibility.rules || field.visibility.rules.length === 0) {
    return true; // No visibility rules = always visible
  }

  const { rules, logic = 'and' } = field.visibility;

  if (logic === 'or') {
    return rules.some((rule) => evaluateRule(rule, currentValues));
  }

  // Default: 'and' logic - all rules must match
  return rules.every((rule) => evaluateRule(rule, currentValues));
}

/**
 * Check for circular visibility dependencies.
 * Returns true if there's a circular dependency.
 */
export function hasCircularVisibility(fields: FieldDefinition[]): boolean {
  const visited = new Set<string>();
  const stack = new Set<string>();

  function dfs(fieldName: string): boolean {
    if (stack.has(fieldName)) return true;
    if (visited.has(fieldName)) return false;

    visited.add(fieldName);
    stack.add(fieldName);

    const field = fields.find((f) => f.field_name === fieldName);
    if (field?.visibility?.rules) {
      for (const rule of field.visibility.rules) {
        if (dfs(rule.field)) return true;
      }
    }

    stack.delete(fieldName);
    return false;
  }

  for (const field of fields) {
    if (!visited.has(field.field_name)) {
      if (dfs(field.field_name)) return true;
    }
  }

  return false;
}
