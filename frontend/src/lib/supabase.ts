import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate that credentials look like real URLs/keys (not placeholders)
const isValidUrl = (v: string) => /^https?:\/\/.+/.test(v);

let supabase: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey && isValidUrl(supabaseUrl)) {
  try {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.warn("Failed to create Supabase client:", err);
  }
} else {
  console.warn(
    "Supabase credentials missing or invalid. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env"
  );
}

export { supabase };
