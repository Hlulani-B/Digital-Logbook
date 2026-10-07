import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock createClient before importing the module
const mockSupabaseInstance = {
  auth: { getSession: vi.fn() },
  from: vi.fn(),
};
const mockCreateClient = vi.fn(() => mockSupabaseInstance);

vi.mock('@supabase/supabase-js', () => ({
  createClient: mockCreateClient,
}));

describe('supabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module registry so supabase.ts re-initialises
    vi.resetModules();
  });

  it('creates a Supabase client when env vars are set', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key');

    const mod = await import('../supabase');
    const client = mod.getSupabase();

    expect(mockCreateClient).toHaveBeenCalledWith('https://test.supabase.co', 'test-anon-key');
    expect(client).toBe(mockSupabaseInstance);
    expect(mod.supabase).toBe(mockSupabaseInstance);

    vi.unstubAllEnvs();
  });

  it('throws when getSupabase is called without valid config', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const mod = await import('../supabase');

    expect(() => mod.getSupabase()).toThrow('Supabase client is not configured');

    vi.unstubAllEnvs();
  });

  it('returns null supabase export when env vars are missing', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    const mod = await import('../supabase');
    expect(mod.supabase).toBeNull();

    vi.unstubAllEnvs();
  });

  it('does not create client when URL is invalid', async () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'not-a-url');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'some-key');

    const mod = await import('../supabase');
    expect(mod.supabase).toBeNull();

    vi.unstubAllEnvs();
  });
});
