import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getAllArticles, searchArticles, HELP_CATEGORIES } from '../helpContent';

describe('HELP_CATEGORIES', () => {
  it('contains at least one category', () => {
    expect(HELP_CATEGORIES.length).toBeGreaterThan(0);
  });

  it('each category has id, title, icon and articles', () => {
    for (const cat of HELP_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.title).toBeTruthy();
      expect(cat.icon).toBeTruthy();
      expect(Array.isArray(cat.articles)).toBe(true);
      expect(cat.articles.length).toBeGreaterThan(0);
    }
  });

  it('each article has id, title, content and keywords', () => {
    for (const cat of HELP_CATEGORIES) {
      for (const article of cat.articles) {
        expect(article.id).toBeTruthy();
        expect(article.title).toBeTruthy();
        expect(typeof article.content).toBe('string');
        expect(Array.isArray(article.keywords)).toBe(true);
      }
    }
  });

  it('has no duplicate article ids across categories', () => {
    const ids = new Set<string>();
    for (const cat of HELP_CATEGORIES) {
      for (const article of cat.articles) {
        expect(ids.has(article.id)).toBe(false);
        ids.add(article.id);
      }
    }
  });
});

describe('getAllArticles', () => {
  it('returns a flat list of all articles', () => {
    const all = getAllArticles();
    const totalArticles = HELP_CATEGORIES.reduce((sum, c) => sum + c.articles.length, 0);
    expect(all).toHaveLength(totalArticles);
  });

  it('each article includes categoryId and categoryTitle', () => {
    const all = getAllArticles();
    for (const a of all) {
      expect(a.categoryId).toBeTruthy();
      expect(a.categoryTitle).toBeTruthy();
    }
  });
});

describe('searchArticles', () => {
  it('returns empty for empty query', () => {
    expect(searchArticles('')).toEqual([]);
    expect(searchArticles('   ')).toEqual([]);
  });

  it('finds articles by title (case-insensitive)', () => {
    const results = searchArticles('Welcome');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.id === 'welcome')).toBe(true);
  });

  it('finds articles by keyword', () => {
    const results = searchArticles('kanban');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((r) => r.keywords.includes('kanban'))).toBe(true);
  });

  it('finds articles by content match', () => {
    const results = searchArticles('Pomodoro');
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns empty when nothing matches', () => {
    const results = searchArticles('xyznonexistent12345');
    expect(results).toEqual([]);
  });

  it('includes categoryId and categoryTitle in results', () => {
    const results = searchArticles('Welcome');
    for (const r of results) {
      expect(r.categoryId).toBeTruthy();
      expect(r.categoryTitle).toBeTruthy();
    }
  });
});
