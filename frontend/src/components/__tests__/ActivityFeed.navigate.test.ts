import { describe, it, expect } from 'vitest';
import { getActivityLink } from '../ActivityFeed';

function makeActivity(overrides: Record<string, unknown>) {
  return {
    id: 1,
    user_email: 'a@b.com',
    action_type: 'PROJECT_CREATED',
    entity_type: 'project',
    entity_name: 'TestProject',
    details: {},
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('getActivityLink', () => {
  it('returns /project/{name} for PROJECT_CREATED', () => {
    const activity = makeActivity({ action_type: 'PROJECT_CREATED', entity_name: 'Photography' });
    expect(getActivityLink(activity as any)).toBe('/project/Photography');
  });

  it('returns /project/{name} for PROJECT_DELETED', () => {
    const activity = makeActivity({ action_type: 'PROJECT_DELETED', entity_name: 'OldProject' });
    expect(getActivityLink(activity as any)).toBe('/project/OldProject');
  });

  it('returns /project/{new_name} for PROJECT_RENAMED', () => {
    const activity = makeActivity({
      action_type: 'PROJECT_RENAMED',
      entity_name: 'NewName',
      details: { old_project_name: 'OldName', new_project_name: 'NewName' },
    });
    expect(getActivityLink(activity as any)).toBe('/project/NewName');
  });

  it('returns /project/{project_name} for ENTRY_ADDED with details.project_name', () => {
    const activity = makeActivity({
      action_type: 'ENTRY_ADDED',
      entity_type: 'entry',
      entity_name: 'Buy milk',
      details: { project_name: 'Shopping' },
    });
    expect(getActivityLink(activity as any)).toBe('/project/Shopping');
  });

  it('returns /project/{project_name} for FIELD_ADDED', () => {
    const activity = makeActivity({
      action_type: 'FIELD_ADDED',
      entity_type: 'field',
      entity_name: 'priority',
      details: { project_name: 'Work' },
    });
    expect(getActivityLink(activity as any)).toBe('/project/Work');
  });

  it('returns /project/{project_name} for PRIORITY_SET', () => {
    const activity = makeActivity({
      action_type: 'PRIORITY_SET',
      details: { project_name: 'Work' },
    });
    expect(getActivityLink(activity as any)).toBe('/project/Work');
  });

  it('returns null for PROFILE_CREATED (no project target)', () => {
    const activity = makeActivity({
      action_type: 'PROFILE_CREATED',
      entity_type: 'profile',
      entity_name: 'a@b.com',
      details: {},
    });
    expect(getActivityLink(activity as any)).toBeNull();
  });

  it('returns null for PROFILE_USERNAME_UPDATED', () => {
    const activity = makeActivity({
      action_type: 'PROFILE_USERNAME_UPDATED',
      entity_type: 'profile',
      details: { new_username: 'newname' },
    });
    expect(getActivityLink(activity as any)).toBeNull();
  });

  it('encodes project names with special characters', () => {
    const activity = makeActivity({
      action_type: 'PROJECT_CREATED',
      entity_name: 'My Project & More',
    });
    expect(getActivityLink(activity as any)).toBe('/project/My%20Project%20%26%20More');
  });

  it('handles JSON entity_name for project activities', () => {
    const activity = makeActivity({
      action_type: 'PROJECT_CREATED',
      entity_name: '{"project_name":"Photography"}',
    });
    // parseEntityName extracts "Photography" from the JSON
    expect(getActivityLink(activity as any)).toBe('/project/Photography');
  });
});
