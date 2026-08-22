import { getDate } from '../functions/entries.js';
import { format, addDays, nextDay, endOfMonth, startOfDay } from 'date-fns';

// Helper to get today's date in YYYY-MM-DD format
function getTodayISO() {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

// Helper to calculate expected dates
function expectedDate(daysFromNow) {
  return format(addDays(startOfDay(new Date()), daysFromNow), 'yyyy-MM-dd');
}

function expectedNextDay(dayIndex) {
  return format(nextDay(startOfDay(new Date()), dayIndex), 'yyyy-MM-dd');
}

function expectedEndOfMonth() {
  return format(endOfMonth(startOfDay(new Date())), 'yyyy-MM-dd');
}

describe('getDate', () => {
  // ─── Basic keywords ─────────────────────────────────────────────
  describe('basic date keywords', () => {
    it('1. should detect "today"', () => {
      const result = getDate('today');
      expect(result.dueDate).toBe(getTodayISO());
      expect(result.cleanedText).toBe('');
    });

    it('2. should detect "tomorrow"', () => {
      const result = getDate('tomorrow');
      expect(result.dueDate).toBe(expectedDate(1));
      expect(result.cleanedText).toBe('');
    });

    it('3. should detect "yesterday"', () => {
      const result = getDate('yesterday');
      expect(result.dueDate).toBe(expectedDate(-1));
      expect(result.cleanedText).toBe('');
    });

    it('4. should detect "next week"', () => {
      const result = getDate('next week');
      expect(result.dueDate).toBe(expectedDate(7));
      expect(result.cleanedText).toBe('');
    });
  });

  // ─── Relative dates ─────────────────────────────────────────────
  describe('relative date expressions', () => {
    it('5. should detect "in 3 days"', () => {
      const result = getDate('in 3 days');
      expect(result.dueDate).toBe(expectedDate(3));
      expect(result.cleanedText).toBe('');
    });

    it('6. should detect "in 2 weeks"', () => {
      const result = getDate('in 2 weeks');
      expect(result.dueDate).toBe(expectedDate(14));
      expect(result.cleanedText).toBe('');
    });

    it('7. should detect "in 1 day" (singular)', () => {
      const result = getDate('in 1 day');
      expect(result.dueDate).toBe(expectedDate(1));
      expect(result.cleanedText).toBe('');
    });
  });

  // ─── Day names ──────────────────────────────────────────────────
  describe('day names', () => {
    it('8. should detect "monday" (next occurrence)', () => {
      const result = getDate('monday');
      expect(result.dueDate).toBe(expectedNextDay(1));
      expect(result.cleanedText).toBe('');
    });

    it('9. should detect "next wednesday"', () => {
      const result = getDate('next wednesday');
      expect(result.dueDate).toBe(expectedNextDay(3));
      expect(result.cleanedText).toBe('');
    });

    it('10. should detect "friday"', () => {
      const result = getDate('friday');
      expect(result.dueDate).toBe(expectedNextDay(5));
      expect(result.cleanedText).toBe('');
    });
  });

  // ─── End of period ──────────────────────────────────────────────
  describe('end of period', () => {
    it('11. should detect "end of month"', () => {
      const result = getDate('end of month');
      expect(result.dueDate).toBe(expectedEndOfMonth());
      expect(result.cleanedText).toBe('');
    });

    it('12. should detect "end of the week" (next Friday)', () => {
      const result = getDate('end of the week');
      expect(result.dueDate).toBe(expectedNextDay(5));
      expect(result.cleanedText).toBe('');
    });
  });

  // ─── Explicit dates ─────────────────────────────────────────────
  describe('explicit month/day dates', () => {
    it('13. should detect "august 25"', () => {
      const result = getDate('august 25');
      expect(result.dueDate).toBe('2026-08-25');
      expect(result.cleanedText).toBe('');
    });

    it('14. should detect "25 december"', () => {
      const result = getDate('25 december');
      expect(result.dueDate).toBe('2026-12-25');
      expect(result.cleanedText).toBe('');
    });

    it('15. should detect "sep 15th" (short month name)', () => {
      const result = getDate('sep 15th');
      expect(result.dueDate).toBe('2026-09-15');
      expect(result.cleanedText).toBe('');
    });
  });

  // ─── Text with date embedded ────────────────────────────────────
  describe('text with embedded dates', () => {
    it('16. should extract date from "i want to wash my clothes today"', () => {
      const result = getDate('i want to wash my clothes today');
      expect(result.dueDate).toBe(getTodayISO());
      expect(result.cleanedText).toBe('i want to wash my clothes');
    });

    it('17. should extract date from "submit report by tomorrow"', () => {
      const result = getDate('submit report by tomorrow');
      expect(result.dueDate).toBe(expectedDate(1));
      expect(result.cleanedText).toBe('submit report by');
    });
  });

  // ─── No date ────────────────────────────────────────────────────
  describe('no date detected', () => {
    it('18. should return null for text with no date references', () => {
      const result = getDate('i need to buy groceries');
      expect(result.dueDate).toBeNull();
      expect(result.cleanedText).toBe('i need to buy groceries');
    });

    it('19. should return null for empty string', () => {
      const result = getDate('');
      expect(result.dueDate).toBeNull();
      expect(result.cleanedText).toBe('');
    });
  });

  // ─── Misspellings ───────────────────────────────────────────────
  describe('misspelled date keywords (should still detect)', () => {
    it('20. should detect "tommorow" (misspelled tomorrow)', () => {
      const result = getDate('tommorow');
      expect(result.dueDate).toBe(expectedDate(1));
    });

    it('21. should detect "todya" (misspelled today)', () => {
      const result = getDate('todya');
      expect(result.dueDate).toBe(getTodayISO());
    });

    it('22. should detect "tmoorrow" (misspelled tomorrow)', () => {
      const result = getDate('tmoorrow');
      expect(result.dueDate).toBe(expectedDate(1));
    });

    it('23. should detect "wendsday" (misspelled wednesday)', () => {
      const result = getDate('wendsday');
      expect(result.dueDate).toBe(expectedNextDay(3));
    });

    it('24. should detect "next weak" (misspelled week)', () => {
      const result = getDate('next weak');
      expect(result.dueDate).toBe(expectedDate(7));
    });

    it('25. should detect "tommorrow" (another misspelling of tomorrow)', () => {
      const result = getDate('tommorrow');
      expect(result.dueDate).toBe(expectedDate(1));
    });

    it('26. should detect "todaay" (misspelled today)', () => {
      const result = getDate('todaay');
      expect(result.dueDate).toBe(getTodayISO());
    });

    it('27. should detect "thurday" (misspelled thursday)', () => {
      const result = getDate('thurday');
      expect(result.dueDate).toBe(expectedNextDay(4));
    });
  });

  // ─── Fuzzy correction edge cases ──────────────────────────────
  describe('fuzzy correction edge cases', () => {
    it('28. should NOT correct "day" to "may" in "in 1 day"', () => {
      const result = getDate('in 1 day');
      expect(result.dueDate).toBe(expectedDate(1));
      expect(result.cleanedText).toBe('');
    });

    it('29. should NOT correct "day" to "may" in "do this every day"', () => {
      const result = getDate('do this every day');
      expect(result.dueDate).toBeNull();
      expect(result.cleanedText).toBe('do this every day');
    });

    it('30. should handle null input', () => {
      const result = getDate(null);
      expect(result.dueDate).toBeNull();
      expect(result.cleanedText).toBe('');
    });

    it('31. should handle undefined input', () => {
      const result = getDate(undefined);
      expect(result.dueDate).toBeNull();
      expect(result.cleanedText).toBe('');
    });

    it('32. should detect "febuary 14" (misspelled february)', () => {
      const result = getDate('febuary 14');
      expect(result.dueDate).toBe('2026-02-14');
    });

    it('33. should detect "saterday" (misspelled saturday)', () => {
      const result = getDate('saterday');
      expect(result.dueDate).toBe(expectedNextDay(6));
    });
  });
});
