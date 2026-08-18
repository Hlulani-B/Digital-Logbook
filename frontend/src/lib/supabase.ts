import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log('[Supabase] VITE_SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING');
console.log('[Supabase] VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? 'set' : 'MISSING');

function createDummyClient(): SupabaseClient {
  return {
    auth: {
      getSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
      setSession: async () => ({ data: { session: null }, error: new Error('Supabase not configured') }),
      signInWithOAuth: async () => ({ error: new Error('Supabase not configured') }),
      signOut: async () => ({ error: new Error('Supabase not configured') }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  } as unknown as SupabaseClient;
}

export const supabase: SupabaseClient =
  (!supabaseUrl || !supabaseAnonKey)
    ? (console.error('[Supabase] Missing credentials! Check Render environment variables.'), createDummyClient())
    : createClient(supabaseUrl, supabaseAnonKey);
