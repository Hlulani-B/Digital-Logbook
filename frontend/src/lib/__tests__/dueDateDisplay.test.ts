import {
  parseDueDateForDisplay,
  formatDueTime,
  formatDueDateParts,
  formatDueDateTime,
} from '../dueDateDisplay';

// Times below are built from local Date components and converted with
// toISOString(), so the assertions hold in every timezone the suite runs in.
const localInstant = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min).toISOString();

describe('dueDateDisplay', () => {
  describe('parseDueDateForDisplay', () => {
    it('returns null for absent or invalid values', () => {
      expect(parseDueDateForDisplay(null)).toBeNull();
      expect(parseDueDateForDisplay(undefined)).toBeNull();
      expect(parseDueDateForDisplay('')).toBeNull();
      expect(parseDueDateForDisplay('   ')).toBeNull();
      expect(parseDueDateForDisplay('not-a-date')).toBeNull();
      expect(parseDueDateForDisplay('2026-02-30')).toBeNull();
    });

    it('parses a bare calendar date without a timezone shift', () => {
      const parsed = parseDueDateForDisplay('2026-10-10');
      expect(parsed).not.toBeNull();
      expect(parsed!.hasTime).toBe(false);
      expect(parsed!.date.getFullYear()).toBe(2026);
      expect(parsed!.date.getMonth()).toBe(9);
      expect(parsed!.date.getDate()).toBe(10);
    });

    it('treats the backend end-of-day marker as date-only on its verbatim calendar date', () => {
      const parsed = parseDueDateForDisplay('2026-10-10T23:59:59.999Z');
      expect(parsed).not.toBeNull();
      expect(parsed!.hasTime).toBe(false);
      expect(parsed!.date.getFullYear()).toBe(2026);
      expect(parsed!.date.getMonth()).toBe(9);
      expect(parsed!.date.getDate()).toBe(10);
    });

    it('treats the local end-of-day marker as date-only', () => {
      const localEndOfDay = new Date(2026, 9, 10, 23, 59, 59, 999).toISOString();
      const parsed = parseDueDateForDisplay(localEndOfDay);
      expect(parsed).not.toBeNull();
      expect(parsed!.hasTime).toBe(false);
      expect(parsed!.date.getDate()).toBe(10);
    });

    it('keeps a real saved time as a time', () => {
      const parsed = parseDueDateForDisplay(localInstant(2026, 10, 10, 18, 0));
      expect(parsed).not.toBeNull();
      expect(parsed!.hasTime).toBe(true);
      expect(parsed!.date.getHours()).toBe(18);
      expect(parsed!.date.getMinutes()).toBe(0);
    });

    it('does not treat UTC midnight as a date-only marker', () => {
      const parsed = parseDueDateForDisplay('2026-10-10T00:00:00.000Z');
      expect(parsed).not.toBeNull();
      expect(parsed!.hasTime).toBe(true);
    });

    it('accepts Date instances', () => {
      const parsed = parseDueDateForDisplay(new Date(2026, 9, 10, 18, 0));
      expect(parsed).not.toBeNull();
      expect(parsed!.hasTime).toBe(true);
    });
  });

  describe('formatDueTime', () => {
    it('formats the saved time as a 24-hour HH:mm', () => {
      expect(formatDueTime(new Date(2026, 9, 10, 18, 0), 'en-GB')).toBe('18:00');
    });

    it('pads morning times', () => {
      expect(formatDueTime(new Date(2026, 9, 10, 9, 5), 'en-GB')).toBe('09:05');
    });
  });

  describe('formatDueDateTime', () => {
    it('renders date and saved time together', () => {
      expect(formatDueDateTime(localInstant(2026, 10, 10, 18, 0), { locale: 'en-GB' })).toBe(
        '10 Oct 2026 \u00b7 18:00'
      );
    });

    it('renders date-only values without fabricating a time', () => {
      expect(formatDueDateTime('2026-10-10', { locale: 'en-GB' })).toBe('10 Oct 2026');
      expect(formatDueDateTime('2026-10-10T23:59:59.999Z', { locale: 'en-GB' })).toBe(
        '10 Oct 2026'
      );
    });

    it('returns null for absent or invalid values', () => {
      expect(formatDueDateTime(null)).toBeNull();
      expect(formatDueDateTime('')).toBeNull();
      expect(formatDueDateTime('not-a-date')).toBeNull();
    });

    it('honours per-surface date options', () => {
      expect(
        formatDueDateTime('2026-10-10', {
          locale: 'en-GB',
          dateOptions: { day: 'numeric', month: 'short' },
        })
      ).toBe('10 Oct');
    });
  });

  describe('formatDueDateParts', () => {
    it('exposes the time only when one was saved', () => {
      const withTime = formatDueDateParts(localInstant(2026, 10, 10, 18, 0), {
        locale: 'en-GB',
      });
      expect(withTime).not.toBeNull();
      expect(withTime!.hasTime).toBe(true);
      expect(withTime!.time).toBe('18:00');

      const dateOnly = formatDueDateParts('2026-10-10', { locale: 'en-GB' });
      expect(dateOnly).not.toBeNull();
      expect(dateOnly!.hasTime).toBe(false);
      expect(dateOnly!.time).toBeNull();
    });
  });
});
