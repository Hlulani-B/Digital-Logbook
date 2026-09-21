import { describe, it, expect } from 'vitest';
import {
  resolveFieldPermission,
  isFieldVisible,
  isFieldEditable,
  isFieldReadOnly,
  filterVisibleFields,
} from '@/hooks/useFieldPermissions';
import type { FieldDefinition } from '@/lib/fieldSchema';

function createField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    field_name: 'test_field',
    data_type: 'text',
    is_required: false,
    is_unique: false,
    rules: {},
    has_default: false,
    options: [],
    display_order: 0,
    ...overrides,
  };
}

describe('resolveFieldPermission', () => {
  it('returns "edit" when no field_permissions are set', () => {
    const field = createField();
    expect(resolveFieldPermission(field, 'viewer')).toBe('edit');
  });

  it('returns "edit" when field_permissions is empty object', () => {
    const field = createField({ field_permissions: {} });
    expect(resolveFieldPermission(field, 'viewer')).toBe('edit');
  });

  it('returns the correct permission for a role', () => {
    const field = createField({
      field_permissions: {
        admin: 'edit',
        editor: 'edit',
        viewer: 'view',
      },
    });
    expect(resolveFieldPermission(field, 'admin')).toBe('edit');
    expect(resolveFieldPermission(field, 'editor')).toBe('edit');
    expect(resolveFieldPermission(field, 'viewer')).toBe('view');
  });

  it('returns "hidden" for hidden fields', () => {
    const field = createField({
      field_permissions: {
        admin: 'edit',
        viewer: 'hidden',
      },
    });
    expect(resolveFieldPermission(field, 'viewer')).toBe('hidden');
  });

  it('returns "edit" when role is not in permissions map', () => {
    const field = createField({
      field_permissions: {
        admin: 'edit',
      },
    });
    expect(resolveFieldPermission(field, 'unknown_role')).toBe('edit');
  });

  it('returns "edit" when userRole is null', () => {
    const field = createField({
      field_permissions: {
        viewer: 'hidden',
      },
    });
    expect(resolveFieldPermission(field, null)).toBe('edit');
  });

  it('returns "edit" when userRole is undefined', () => {
    const field = createField({
      field_permissions: {
        viewer: 'hidden',
      },
    });
    expect(resolveFieldPermission(field, undefined)).toBe('edit');
  });
});

describe('isFieldVisible', () => {
  it('returns true when field has no permissions', () => {
    const field = createField();
    expect(isFieldVisible(field, 'viewer')).toBe(true);
  });

  it('returns false when field is hidden', () => {
    const field = createField({
      field_permissions: {
        viewer: 'hidden',
      },
    });
    expect(isFieldVisible(field, 'viewer')).toBe(false);
  });

  it('returns true when field is view-only', () => {
    const field = createField({
      field_permissions: {
        viewer: 'view',
      },
    });
    expect(isFieldVisible(field, 'viewer')).toBe(true);
  });

  it('returns true when field is editable', () => {
    const field = createField({
      field_permissions: {
        admin: 'edit',
      },
    });
    expect(isFieldVisible(field, 'admin')).toBe(true);
  });
});

describe('isFieldEditable', () => {
  it('returns true when field has no permissions', () => {
    const field = createField();
    expect(isFieldEditable(field, 'viewer')).toBe(true);
  });

  it('returns true when field permission is "edit"', () => {
    const field = createField({
      field_permissions: {
        admin: 'edit',
      },
    });
    expect(isFieldEditable(field, 'admin')).toBe(true);
  });

  it('returns false when field permission is "view"', () => {
    const field = createField({
      field_permissions: {
        viewer: 'view',
      },
    });
    expect(isFieldEditable(field, 'viewer')).toBe(false);
  });

  it('returns false when field permission is "hidden"', () => {
    const field = createField({
      field_permissions: {
        viewer: 'hidden',
      },
    });
    expect(isFieldEditable(field, 'viewer')).toBe(false);
  });
});

describe('isFieldReadOnly', () => {
  it('returns false when field has no permissions', () => {
    const field = createField();
    expect(isFieldReadOnly(field, 'viewer')).toBe(false);
  });

  it('returns true when field permission is "view"', () => {
    const field = createField({
      field_permissions: {
        viewer: 'view',
      },
    });
    expect(isFieldReadOnly(field, 'viewer')).toBe(true);
  });

  it('returns false when field permission is "edit"', () => {
    const field = createField({
      field_permissions: {
        admin: 'edit',
      },
    });
    expect(isFieldReadOnly(field, 'admin')).toBe(false);
  });

  it('returns false when field permission is "hidden"', () => {
    const field = createField({
      field_permissions: {
        viewer: 'hidden',
      },
    });
    expect(isFieldReadOnly(field, 'viewer')).toBe(false);
  });
});

describe('filterVisibleFields', () => {
  const fields = [
    createField({ field_name: 'visible_field', field_permissions: { viewer: 'edit' } }),
    createField({ field_name: 'readonly_field', field_permissions: { viewer: 'view' } }),
    createField({ field_name: 'hidden_field', field_permissions: { viewer: 'hidden' } }),
    createField({ field_name: 'no_permissions_field' }),
  ];

  it('filters out hidden fields for viewer', () => {
    const visible = filterVisibleFields(fields, 'viewer');
    expect(visible).toHaveLength(3);
    expect(visible.map((f) => f.field_name)).toEqual([
      'visible_field',
      'readonly_field',
      'no_permissions_field',
    ]);
  });

  it('shows all fields for admin', () => {
    const visible = filterVisibleFields(fields, 'admin');
    expect(visible).toHaveLength(4);
  });

  it('shows all fields when no role is provided', () => {
    const visible = filterVisibleFields(fields, null);
    expect(visible).toHaveLength(4);
  });

  it('returns empty array for empty input', () => {
    const visible = filterVisibleFields([], 'viewer');
    expect(visible).toHaveLength(0);
  });
});
