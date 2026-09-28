import { describe, it, expect } from 'vitest';
import { parseKeyEvent, matchesShortcut } from '../useKeyboardShortcuts';

// Helper to create a mock keyboard event
function createKeyEvent(
  key: string,
  options: { ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean; metaKey?: boolean } = {}
): KeyboardEvent {
  return {
    key,
    ctrlKey: options.ctrlKey || false,
    altKey: options.altKey || false,
    shiftKey: options.shiftKey || false,
    metaKey: options.metaKey || false,
  } as KeyboardEvent;
}

describe('parseKeyEvent', () => {
  it('parses single letter key', () => {
    expect(parseKeyEvent(createKeyEvent('a'))).toBe('A');
    expect(parseKeyEvent(createKeyEvent('z'))).toBe('Z');
  });

  it('parses special keys', () => {
    expect(parseKeyEvent(createKeyEvent('Escape'))).toBe('Escape');
    expect(parseKeyEvent(createKeyEvent('Enter'))).toBe('Enter');
    expect(parseKeyEvent(createKeyEvent(' '))).toBe(' ');
  });

  it('parses Ctrl+key combination', () => {
    expect(parseKeyEvent(createKeyEvent('k', { ctrlKey: true }))).toBe('Ctrl+K');
    expect(parseKeyEvent(createKeyEvent('s', { ctrlKey: true }))).toBe('Ctrl+S');
  });

  it('parses Alt+key combination', () => {
    expect(parseKeyEvent(createKeyEvent('n', { altKey: true }))).toBe('Alt+N');
  });

  it('parses Shift+key combination', () => {
    expect(parseKeyEvent(createKeyEvent('n', { shiftKey: true }))).toBe('Shift+N');
  });

  it('parses Ctrl+Shift+key combination', () => {
    expect(parseKeyEvent(createKeyEvent('k', { ctrlKey: true, shiftKey: true }))).toBe(
      'Ctrl+Shift+K'
    );
  });

  it('parses meta (Cmd) key as Ctrl', () => {
    expect(parseKeyEvent(createKeyEvent('k', { metaKey: true }))).toBe('Ctrl+K');
  });

  it('ignores modifier-only keys', () => {
    expect(parseKeyEvent(createKeyEvent('Control'))).toBe('');
    expect(parseKeyEvent(createKeyEvent('Alt'))).toBe('');
    expect(parseKeyEvent(createKeyEvent('Shift'))).toBe('');
    expect(parseKeyEvent(createKeyEvent('Meta'))).toBe('');
  });
});

describe('matchesShortcut', () => {
  it('matches single key shortcut', () => {
    expect(matchesShortcut(createKeyEvent('?'), '?')).toBe(true);
    expect(matchesShortcut(createKeyEvent('/'), '/')).toBe(true);
    expect(matchesShortcut(createKeyEvent('n'), 'N')).toBe(true);
  });

  it('matches Ctrl+key shortcut', () => {
    expect(matchesShortcut(createKeyEvent('k', { ctrlKey: true }), 'Ctrl+K')).toBe(true);
    expect(matchesShortcut(createKeyEvent('k'), 'Ctrl+K')).toBe(false);
  });

  it('matches Shift+key shortcut', () => {
    expect(matchesShortcut(createKeyEvent('?', { shiftKey: true }), 'Shift+?')).toBe(true);
  });

  it('does not match wrong key', () => {
    expect(matchesShortcut(createKeyEvent('a'), 'B')).toBe(false);
    expect(matchesShortcut(createKeyEvent('k', { ctrlKey: true }), 'Ctrl+S')).toBe(false);
  });

  it('does not match when extra modifiers pressed', () => {
    expect(matchesShortcut(createKeyEvent('k', { ctrlKey: true, altKey: true }), 'Ctrl+K')).toBe(
      false
    );
  });
});
