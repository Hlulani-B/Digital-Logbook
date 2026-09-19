export const FIELD_TYPES = [
  'text',
  'markdown',
  'integer',
  'float',
  'number',
  'date',
  'timestamp',
  'boolean',
  'select',
  'multiselect',
  'geolocation',
  'currency',
  'file',
  'image',
  'entity_link',
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
  [key: string]: unknown;
}
export interface FieldRules {
  min?: number | string;
  max?: number | string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
}
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

/** Normalize schema metadata only. Entry strings are deliberately never JSON-parsed. */
export function normalizeField(input: unknown, index = 0): FieldDefinition {
  const source = isRecord(input) ? input : {};
  const originalType = typeof source.data_type === 'string' ? source.data_type : 'text';
  const legacySelect = originalType === 'custom' || originalType.startsWith('custom:');
  let options = Array.isArray(source.options) ? source.options : [];
  if (!options.length && originalType.startsWith('custom:')) {
    options = originalType
      .slice(7)
      .split(',')
      .map((label) => label.trim())
      .filter(Boolean);
  }
  return {
    ...source,
    ...(typeof source.id === 'string' ? { id: source.id } : {}),
    field_name: typeof source.field_name === 'string' ? source.field_name : '',
    data_type: (legacySelect ? 'select' : originalType) as FieldType,
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
      };
    }),
    display_order: typeof source.display_order === 'number' ? source.display_order : index,
  };
}

export function normalizeFields(input: unknown): FieldDefinition[] {
  return Array.isArray(input) ? input.map(normalizeField) : [];
}
