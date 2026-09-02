import { describe, it, expect, beforeEach } from 'vitest';
import { getTone, setTone, getToneInstruction, TONE_OPTIONS } from '../tone';

describe('getTone', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns "soft" when nothing is stored', () => {
    expect(getTone()).toBe('soft');
  });

  it('returns the stored tone', () => {
    localStorage.setItem('dl_tone', 'tough');
    expect(getTone()).toBe('tough');
  });

  it('returns "soft" for an invalid stored value', () => {
    localStorage.setItem('dl_tone', 'invalid');
    expect(getTone()).toBe('soft');
  });

  it('returns "cynical" when stored', () => {
    localStorage.setItem('dl_tone', 'cynical');
    expect(getTone()).toBe('cynical');
  });
});

describe('setTone', () => {
  beforeEach(() => { localStorage.clear(); });

  it('stores the tone in localStorage', () => {
    setTone('tough');
    expect(localStorage.getItem('dl_tone')).toBe('tough');
  });

  it('overwrites a previous tone', () => {
    setTone('soft');
    setTone('cynical');
    expect(getTone()).toBe('cynical');
  });
});

describe('getToneInstruction', () => {
  beforeEach(() => { localStorage.clear(); });

  it('returns warm message for soft tone', () => {
    setTone('soft');
    expect(getToneInstruction()).toContain('warm');
  });

  it('returns direct message for tough tone', () => {
    setTone('tough');
    expect(getToneInstruction()).toContain('direct');
  });

  it('returns sarcastic message for cynical tone', () => {
    setTone('cynical');
    expect(getToneInstruction()).toContain('sarcastic');
  });

  it('defaults to soft when no tone is set', () => {
    expect(getToneInstruction()).toContain('warm');
  });
});

describe('TONE_OPTIONS', () => {
  it('has exactly 3 options', () => {
    expect(TONE_OPTIONS).toHaveLength(3);
  });

  it('contains soft, tough, and cynical values', () => {
    const values = TONE_OPTIONS.map((o) => o.value);
    expect(values).toContain('soft');
    expect(values).toContain('tough');
    expect(values).toContain('cynical');
  });

  it('each option has a label, description, and icon', () => {
    TONE_OPTIONS.forEach((option) => {
      expect(option.label).toBeTruthy();
      expect(option.description).toBeTruthy();
      expect(option.icon).toBeDefined();
    });
  });
});
