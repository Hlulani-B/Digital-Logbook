import { describe, it, expect } from 'vitest';

// Test the filter categories configuration
const FILTER_CATEGORIES = {
  all: { label: 'All', types: null },
  projects: {
    label: 'Projects',
    types: [
      'PROJECT_CREATED',
      'PROJECT_RENAMED',
      'PROJECT_DELETED',
      'PROJECT_ARCHIVED',
      'PROJECT_UNARCHIVED',
    ],
  },
  entries: { label: 'Entries', types: ['ENTRY_ADDED', 'ENTRY_EDITED', 'ENTRY_DELETED'] },
  fields: { label: 'Fields', types: ['FIELD_ADDED', 'FIELD_EDITED', 'FIELD_DELETED'] },
  other: {
    label: 'Other',
    types: [
      'PRIORITY_SET',
      'TIMER_STARTED',
      'TIMER_STOPPED',
      'PROFILE_CREATED',
      'PROFILE_USERNAME_UPDATED',
      'PROFILE_EMAIL_UPDATED',
      'PROFILE_PASSWORD_UPDATED',
    ],
  },
} as const;

type FilterKey = keyof typeof FILTER_CATEGORIES;

// Simulate the filtering logic
function filterActivities(activities: any[], activeFilter: FilterKey, searchTerm: string) {
  return activities.filter((activity) => {
    const filterConfig = FILTER_CATEGORIES[activeFilter];
    if (filterConfig.types && !filterConfig.types.includes(activity.action_type)) {
      return false;
    }
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const entityName = (activity.entity_name || '').toLowerCase();
      const details = JSON.stringify(activity.details || {}).toLowerCase();
      return entityName.includes(searchLower) || details.includes(searchLower);
    }
    return true;
  });
}

// Simulate the empty state logic
function getEmptyState(activitiesLength: number, activeFilter: FilterKey, searchTerm: string) {
  const hasFilter = activeFilter !== 'all';
  const hasSearch = searchTerm.trim() !== '';

  if (activitiesLength === 0) {
    return { icon: 'clock', title: 'No activity yet' };
  }
  if (hasSearch && hasFilter) {
    return { icon: 'search', title: 'No matching results' };
  }
  if (hasSearch) {
    return { icon: 'search', title: 'No results found' };
  }
  if (hasFilter) {
    return {
      icon: 'filter',
      title: `No ${FILTER_CATEGORIES[activeFilter].label.toLowerCase()} activity`,
    };
  }
  return { icon: 'clock', title: 'No activity yet' };
}

describe('Empty State per Filter', () => {
  describe('FILTER_CATEGORIES', () => {
    it('has "all" filter with null types (no filtering)', () => {
      expect(FILTER_CATEGORIES.all.types).toBeNull();
      expect(FILTER_CATEGORIES.all.label).toBe('All');
    });

    it('has "projects" filter with correct action types', () => {
      expect(FILTER_CATEGORIES.projects.types).toContain('PROJECT_CREATED');
      expect(FILTER_CATEGORIES.projects.types).toContain('PROJECT_DELETED');
      expect(FILTER_CATEGORIES.projects.types).not.toContain('ENTRY_ADDED');
    });

    it('has "entries" filter with correct action types', () => {
      expect(FILTER_CATEGORIES.entries.types).toContain('ENTRY_ADDED');
      expect(FILTER_CATEGORIES.entries.types).toContain('ENTRY_DELETED');
      expect(FILTER_CATEGORIES.entries.types).not.toContain('PROJECT_CREATED');
    });

    it('has "fields" filter with correct action types', () => {
      expect(FILTER_CATEGORIES.fields.types).toContain('FIELD_ADDED');
      expect(FILTER_CATEGORIES.fields.types).toContain('FIELD_DELETED');
    });

    it('has "other" filter with miscellaneous action types', () => {
      expect(FILTER_CATEGORIES.other.types).toContain('PRIORITY_SET');
      expect(FILTER_CATEGORIES.other.types).toContain('TIMER_STARTED');
      expect(FILTER_CATEGORIES.other.types).toContain('PROFILE_CREATED');
    });
  });

  describe('filterActivities', () => {
    const activities = [
      { action_type: 'PROJECT_CREATED', entity_name: 'MyProject', details: {} },
      {
        action_type: 'ENTRY_ADDED',
        entity_name: 'Buy milk',
        details: { project_name: 'Shopping' },
      },
      { action_type: 'FIELD_ADDED', entity_name: 'priority', details: { project_name: 'Work' } },
      { action_type: 'PRIORITY_SET', entity_name: 'High', details: { project_name: 'Work' } },
    ];

    it('returns all activities when filter is "all"', () => {
      const result = filterActivities(activities, 'all', '');
      expect(result).toHaveLength(4);
    });

    it('filters to only project activities', () => {
      const result = filterActivities(activities, 'projects', '');
      expect(result).toHaveLength(1);
      expect(result[0].action_type).toBe('PROJECT_CREATED');
    });

    it('filters to only entry activities', () => {
      const result = filterActivities(activities, 'entries', '');
      expect(result).toHaveLength(1);
      expect(result[0].action_type).toBe('ENTRY_ADDED');
    });

    it('filters to only field activities', () => {
      const result = filterActivities(activities, 'fields', '');
      expect(result).toHaveLength(1);
      expect(result[0].action_type).toBe('FIELD_ADDED');
    });

    it('filters to only other activities', () => {
      const result = filterActivities(activities, 'other', '');
      expect(result).toHaveLength(1);
      expect(result[0].action_type).toBe('PRIORITY_SET');
    });

    it('filters by search term in entity_name', () => {
      const result = filterActivities(activities, 'all', 'milk');
      expect(result).toHaveLength(1);
      expect(result[0].entity_name).toBe('Buy milk');
    });

    it('filters by search term in details', () => {
      const result = filterActivities(activities, 'all', 'Shopping');
      expect(result).toHaveLength(1);
      expect(result[0].action_type).toBe('ENTRY_ADDED');
    });

    it('combines filter and search', () => {
      const result = filterActivities(activities, 'entries', 'milk');
      expect(result).toHaveLength(1);
    });

    it('returns empty when filter and search do not match', () => {
      const result = filterActivities(activities, 'projects', 'milk');
      expect(result).toHaveLength(0);
    });

    it('search is case-insensitive', () => {
      const result = filterActivities(activities, 'all', 'MYPROJECT');
      expect(result).toHaveLength(1);
    });
  });

  describe('getEmptyState', () => {
    it('returns "No activity yet" when no activities exist', () => {
      const state = getEmptyState(0, 'all', '');
      expect(state.title).toBe('No activity yet');
      expect(state.icon).toBe('clock');
    });

    it('returns "No results found" when search has no matches', () => {
      const state = getEmptyState(10, 'all', 'nonexistent');
      expect(state.title).toBe('No results found');
      expect(state.icon).toBe('search');
    });

    it('returns "No {filter} activity" when filter has no matches', () => {
      const state = getEmptyState(10, 'projects', '');
      expect(state.title).toBe('No projects activity');
      expect(state.icon).toBe('filter');
    });

    it('returns "No matching results" when both filter and search have no matches', () => {
      const state = getEmptyState(10, 'entries', 'nonexistent');
      expect(state.title).toBe('No matching results');
      expect(state.icon).toBe('search');
    });

    it('returns "No activity yet" when no activities regardless of filter', () => {
      const state = getEmptyState(0, 'projects', 'test');
      expect(state.title).toBe('No activity yet');
    });
  });
});
