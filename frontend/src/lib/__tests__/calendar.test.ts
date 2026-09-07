import {
  isSameDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addMonths,
  eachDay,
  buildMonthGrid,
  buildWeekGrid,
  getEntriesForDay,
  getEntryTitle,
  parseDueDate,
} from '../calendar';

describe('calendar date helpers', () => {
  describe('isSameDay', () => {
    it('returns true for the same calendar day', () => {
      const a = new Date(2026, 8, 3, 10, 0);
      const b = new Date(2026, 8, 3, 22, 30);
      expect(isSameDay(a, b)).toBe(true);
    });

    it('returns false for different calendar days', () => {
      const a = new Date(2026, 8, 3);
      const b = new Date(2026, 8, 4);
      expect(isSameDay(a, b)).toBe(false);
    });
  });

  describe('startOfWeek', () => {
    it('returns Sunday for a week starting on Sunday', () => {
      // 3 Sep 2026 is a Thursday
      const start = startOfWeek(new Date(2026, 8, 3), 0);
      expect(start.getDay()).toBe(0);
      expect(start.getDate()).toBe(30);
      expect(start.getMonth()).toBe(7); // August
    });

    it('returns Monday for a week starting on Monday', () => {
      const start = startOfWeek(new Date(2026, 8, 3), 1);
      expect(start.getDay()).toBe(1);
      expect(start.getDate()).toBe(31);
      expect(start.getMonth()).toBe(7);
    });
  });

  describe('endOfWeek', () => {
    it('returns Saturday for a week starting on Sunday', () => {
      const end = endOfWeek(new Date(2026, 8, 3), 0);
      expect(end.getDay()).toBe(6);
      expect(end.getDate()).toBe(5);
      expect(end.getMonth()).toBe(8);
    });
  });

  describe('startOfMonth and endOfMonth', () => {
    it('returns the first and last day of the month', () => {
      const start = startOfMonth(new Date(2026, 8, 15));
      const end = endOfMonth(new Date(2026, 8, 15));
      expect(start.getDate()).toBe(1);
      expect(end.getDate()).toBe(30);
    });
  });

  describe('addDays and addMonths', () => {
    it('adds days without mutating the input', () => {
      const original = new Date(2026, 8, 3);
      const shifted = addDays(original, 5);
      expect(shifted.getDate()).toBe(8);
      expect(original.getDate()).toBe(3);
    });

    it('adds months without mutating the input', () => {
      const original = new Date(2026, 8, 3);
      const shifted = addMonths(original, 1);
      expect(shifted.getMonth()).toBe(9);
      expect(original.getMonth()).toBe(8);
    });
  });

  describe('eachDay', () => {
    it('returns every day between two dates inclusive', () => {
      const days = eachDay(new Date(2026, 8, 1), new Date(2026, 8, 5));
      expect(days).toHaveLength(5);
      expect(days[0].getDate()).toBe(1);
      expect(days[4].getDate()).toBe(5);
    });
  });

  describe('buildMonthGrid', () => {
    it('returns a full 7-column grid covering the month', () => {
      const grid = buildMonthGrid(new Date(2026, 8, 1), 0);
      expect(grid.length % 7).toBe(0);
      expect(grid[0].getDay()).toBe(0);
      expect(grid.some((d) => d.getMonth() === 8)).toBe(true);
    });
  });

  describe('buildWeekGrid', () => {
    it('returns exactly seven days', () => {
      const grid = buildWeekGrid(new Date(2026, 8, 3), 0);
      expect(grid).toHaveLength(7);
      expect(grid[0].getDay()).toBe(0);
      expect(grid[6].getDay()).toBe(6);
    });
  });
});

describe('calendar entry helpers', () => {
  describe('parseDueDate', () => {
    it('returns null for empty values', () => {
      expect(parseDueDate(null)).toBeNull();
      expect(parseDueDate(undefined)).toBeNull();
      expect(parseDueDate('')).toBeNull();
    });

    it('parses valid ISO strings', () => {
      const d = parseDueDate('2026-09-03T00:00:00.000Z');
      expect(d).not.toBeNull();
      expect(d!.getUTCDate()).toBe(3);
    });

    it('returns null for invalid strings', () => {
      expect(parseDueDate('not-a-date')).toBeNull();
    });
  });

  describe('getEntriesForDay', () => {
    const entries = [
      {
        id: 1,
        due_date: '2026-09-03T10:00:00.000Z',
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: {},
        priority: null,
      },
      {
        id: 2,
        due_date: '2026-09-04T10:00:00.000Z',
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: {},
        priority: null,
      },
      {
        id: 3,
        due_date: null,
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: {},
        priority: null,
      },
    ];

    it('returns entries matching the calendar day', () => {
      const result = getEntriesForDay(entries, new Date('2026-09-03T00:00:00.000Z'));
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('excludes entries without a due date', () => {
      const result = getEntriesForDay(entries, new Date('2026-09-03T00:00:00.000Z'));
      expect(result.some((e) => e.id === 3)).toBe(false);
    });
  });

  describe('getEntryTitle', () => {
    it('prefers the task field', () => {
      const entry = {
        id: 1,
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: { task: 'Fix login', description: 'Details' },
        due_date: null,
        priority: null,
      };
      expect(getEntryTitle(entry)).toBe('Fix login');
    });

    it('falls back through known fields', () => {
      const entry = {
        id: 1,
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: { note: 'Buy milk' },
        due_date: null,
        priority: null,
      };
      expect(getEntryTitle(entry)).toBe('Buy milk');
    });

    it('falls back to first non-empty value', () => {
      const entry = {
        id: 1,
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: { custom: 'Some value' },
        due_date: null,
        priority: null,
      };
      expect(getEntryTitle(entry)).toBe('Some value');
    });

    it('parses JSON string entries', () => {
      const entry = {
        id: 1,
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: '{"task":"String task"}',
        due_date: null,
        priority: null,
      };
      expect(getEntryTitle(entry)).toBe('String task');
    });

    it('returns untitled for empty entries', () => {
      const entry = {
        id: 1,
        user_email: 'a@b.com',
        project_name: 'P1',
        entries: {},
        due_date: null,
        priority: null,
      };
      expect(getEntryTitle(entry)).toBe('Untitled entry');
    });
  });
});
