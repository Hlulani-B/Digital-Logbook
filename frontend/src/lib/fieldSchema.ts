export const FIELD_TYPES = [
  'text',
  'markdown',
  'integer',
  'float',
  'number',
  'date',
  'timestamp',
  'boolean',
  'geolocation',
  'currency',
  'file',
  'image',
  'entity_link',
  'tags',
  'multiselect',
  'checklist',
  'computed',
  'custom',
  'select', // Legacy alias for custom (select dropdown)
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];
export interface FieldError {
  field: string;
  code: string;
  message: string;
}
export interface FieldOption {
  id: string;
  label: string;
  value?: string;
  parent_id?: string; // Dynamic Taxonomy: references parent option id
  [key: string]: unknown;
}
export interface FieldRules {
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  // Conditional Thresholds
  warn_min?: number | string;
  warn_max?: number | string;
  alert_min?: number | string;
  alert_max?: number | string;
  [key: string]: unknown;
}
export interface VisibilityRule {
  field: string; // field_name to watch
  operator: 'eq' | 'neq' | 'in' | 'not_in' | 'exists' | 'not_exists' | 'gt' | 'lt' | 'gte' | 'lte';
  value?: unknown; // comparison value (not needed for exists/not_exists)
}

export interface VisibilityConfig {
  rules: VisibilityRule[]; // ALL must match (AND logic)
  logic?: 'and' | 'or'; // default: 'and'
}

// Field-Level Permissions
export type FieldPermissionLevel = 'edit' | 'view' | 'hidden';
export type FieldPermissionMap = Record<string, FieldPermissionLevel>;

export interface FieldDefinition {
  id?: string;
  field_name: string;
  data_type: FieldType;
  is_required: boolean;
  is_unique: boolean;
  rules: FieldRules;
  has_default: boolean;
  default_value?: unknown;
  options: FieldOption[];
  display_order: number;
  // Visibility Triggers
  visibility?: VisibilityConfig;
  // Field-Level Permissions
  field_permissions?: FieldPermissionMap;
  [key: string]: unknown;
}

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
export const hasOwn = (value: object, key: PropertyKey): boolean =>
  Object.prototype.hasOwnProperty.call(value, key);
export const supportsUnique = (type: FieldType): boolean =>
  !['multiselect', 'geolocation', 'file', 'image'].includes(type);
export const supportsDefault = (type: FieldType): boolean => !['file', 'image'].includes(type);
export const isTextField = (type: FieldType): boolean => type === 'text' || type === 'markdown';
export const isNumericField = (type: FieldType): boolean =>
  ['integer', 'float', 'number'].includes(type);
export const isTagsField = (type: FieldType): boolean => type === 'tags';
export const isChecklistField = (type: FieldType): boolean => type === 'checklist';
export const isComputedField = (type: FieldType): boolean => type === 'computed';

/** Normalize schema metadata only. Entry strings are deliberately never JSON-parsed. */
export function normalizeField(input: unknown, index = 0): FieldDefinition {
  const source = isRecord(input) ? input : {};
  const originalType = typeof source.data_type === 'string' ? source.data_type : 'text';
  const legacyCustom = originalType === 'custom';
  const legacyCustomWithOptions = originalType.startsWith('custom:');
  let options = Array.isArray(source.options) ? source.options : [];
  if (!options.length && legacyCustomWithOptions) {
    options = originalType
      .slice(7)
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
  }
  // 'custom' with options or 'custom:*' becomes 'select'; plain 'custom' stays 'custom'
  const becomesSelect = legacyCustomWithOptions || (legacyCustom && options.length > 0);
  const legacySelect = originalType === 'select' || becomesSelect;
  return {
    ...source,
    ...(typeof source.id === 'string' ? { id: source.id } : {}),
    field_name: typeof source.field_name === 'string' ? source.field_name : '',
    data_type: (becomesSelect ? 'select' : legacyCustom ? 'custom' : originalType) as FieldType,
    is_required: source.is_required === true,
    is_unique: source.is_unique === true,
    rules: isRecord(source.rules) ? { ...source.rules } : {},
    has_default:
      typeof source.has_default === 'boolean'
        ? source.has_default
        : hasOwn(source, 'default_value') &&
          source.default_value !== null &&
          source.default_value !== undefined,
    options: options.map((option, optionIndex) => {
      const item = isRecord(option) ? option : {};
      const label =
        typeof option === 'string' ? option : typeof item.label === 'string' ? item.label : '';
      return {
        ...item,
        id: typeof item.id === 'string' ? item.id : `option-${optionIndex + 1}`,
        label,
        ...(typeof item.value === 'string' ? { value: item.value } : {}),
        ...(typeof item.parent_id === 'string' ? { parent_id: item.parent_id } : {}),
      };
    }),
    display_order: typeof source.display_order === 'number' ? source.display_order : index,
    // Visibility Triggers
    ...(isRecord(source.visibility)
      ? {
          visibility: {
            rules: Array.isArray(source.visibility.rules) ? source.visibility.rules : [],
            ...(typeof source.visibility.logic === 'string' &&
            (source.visibility.logic === 'and' || source.visibility.logic === 'or')
              ? { logic: source.visibility.logic as 'and' | 'or' }
              : {}),
          } as VisibilityConfig,
        }
      : {}),
    // Field-Level Permissions
    ...(isRecord(source.field_permissions)
      ? { field_permissions: { ...source.field_permissions } as FieldPermissionMap }
      : {}),
  };
}

export function normalizeFields(input: unknown): FieldDefinition[] {
  return Array.isArray(input) ? input.map(normalizeField) : [];
}
