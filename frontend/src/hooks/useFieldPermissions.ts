/**
 * Field permission resolution utilities.
 */

import type { FieldDefinition, FieldPermissionLevel } from '@/lib/fieldSchema';

/**
 * Resolve the permission level for a field based on user role.
 * Returns 'edit' if no permissions are set (backward compatible).
 */
export function resolveFieldPermission(
  field: FieldDefinition,
  userRole: string | null | undefined
): FieldPermissionLevel {
  if (!field.field_permissions || Object.keys(field.field_permissions).length === 0) {
    return 'edit'; // Default: full access (backward compatible)
  }

  if (!userRole) {
    return 'edit'; // No role info, default to edit
  }

  return field.field_permissions[userRole] ?? 'edit';
}

/**
 * Check if a field should be visible to the user.
 */
export function isFieldVisible(
  field: FieldDefinition,
  userRole: string | null | undefined
): boolean {
  const permission = resolveFieldPermission(field, userRole);
  return permission !== 'hidden';
}

/**
 * Check if a field is editable by the user.
 */
export function isFieldEditable(
  field: FieldDefinition,
  userRole: string | null | undefined
): boolean {
  const permission = resolveFieldPermission(field, userRole);
  return permission === 'edit';
}

/**
 * Check if a field is read-only for the user.
 */
export function isFieldReadOnly(
  field: FieldDefinition,
  userRole: string | null | undefined
): boolean {
  const permission = resolveFieldPermission(field, userRole);
  return permission === 'view';
}

/**
 * Filter fields by visibility for a given role.
 */
export function filterVisibleFields(
  fields: FieldDefinition[],
  userRole: string | null | undefined
): FieldDefinition[] {
  return fields.filter((field) => isFieldVisible(field, userRole));
}
