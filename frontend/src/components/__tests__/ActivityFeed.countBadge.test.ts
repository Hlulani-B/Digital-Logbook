import { describe, it, expect } from 'vitest';
import { getCategoryCounts } from '../ActivityFeed';

type Activity = {
  id: number;
  user_email: string;
  action_type: string;
  entity_type: string;
  entity_name: string;
  details: Record<string, unknown>;
  created_at: string;
};

function makeActivity(actionType: string): Activity {
  return {
    id: 1,
    user_email: 'test@example.com',
    action_type: actionType,
    entity_type: 'project',
    entity_name: 'TestProject',
    details: {},
    created_at: new Date().toISOString(),
  };
}

describe('getCategoryCounts', () => {
  it('returns all zeros for empty activities array', () => {
    const counts = getCategoryCounts([]);
    expect(counts.all).toBe(0);
    expect(counts.projects).toBe(0);
    expect(counts.entries).toBe(0);
    expect(counts.fields).toBe(0);
    expect(counts.other).toBe(0);
  });

  it('counts "all" as total activities', () => {
    const activities = [
      makeActivity('PROJECT_CREATED'),
      makeActivity('ENTRY_ADDED'),
      makeActivity('FIELD_ADDED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.all).toBe(3);
  });

  it('counts project activities correctly', () => {
    const activities = [
      makeActivity('PROJECT_CREATED'),
      makeActivity('PROJECT_RENAMED'),
      makeActivity('PROJECT_DELETED'),
      makeActivity('PROJECT_ARCHIVED'),
      makeActivity('PROJECT_UNARCHIVED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.projects).toBe(5);
  });

  it('counts entry activities correctly', () => {
    const activities = [
      makeActivity('ENTRY_ADDED'),
      makeActivity('ENTRY_EDITED'),
      makeActivity('ENTRY_DELETED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.entries).toBe(3);
  });

  it('counts field activities correctly', () => {
    const activities = [
      makeActivity('FIELD_ADDED'),
      makeActivity('FIELD_EDITED'),
      makeActivity('FIELD_DELETED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.fields).toBe(3);
  });

  it('counts other activities correctly', () => {
    const activities = [
      makeActivity('PRIORITY_SET'),
      makeActivity('TIMER_STARTED'),
      makeActivity('TIMER_STOPPED'),
      makeActivity('PROFILE_CREATED'),
      makeActivity('PROFILE_USERNAME_UPDATED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.other).toBe(5);
  });

  it('counts mixed activities correctly', () => {
    const activities = [
      makeActivity('PROJECT_CREATED'),
      makeActivity('PROJECT_CREATED'),
      makeActivity('ENTRY_ADDED'),
      makeActivity('FIELD_ADDED'),
      makeActivity('PRIORITY_SET'),
      makeActivity('TIMER_STARTED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.all).toBe(6);
    expect(counts.projects).toBe(2);
    expect(counts.entries).toBe(1);
    expect(counts.fields).toBe(1);
    expect(counts.other).toBe(2);
  });

  it('ignores unknown action types', () => {
    const activities = [
      makeActivity('PROJECT_CREATED'),
      makeActivity('UNKNOWN_ACTION'),
      makeActivity('ENTRY_ADDED'),
    ];
    const counts = getCategoryCounts(activities);
    expect(counts.all).toBe(3);
    expect(counts.projects).toBe(1);
    expect(counts.entries).toBe(1);
    expect(counts.fields).toBe(0);
    expect(counts.other).toBe(0);
  });

  it('handles single activity', () => {
    const activities = [makeActivity('PROJECT_CREATED')];
    const counts = getCategoryCounts(activities);
    expect(counts.all).toBe(1);
    expect(counts.projects).toBe(1);
    expect(counts.entries).toBe(0);
  });
});
