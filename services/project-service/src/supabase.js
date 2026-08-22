import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Polyfill WebSocket for Node.js 20 compatibility.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('CRITICAL: Missing SUPABASE_URL or SUPABASE_KEY - ALL database calls will fail!');
  console.error('  SUPABASE_URL:', supabaseUrl ? 'set' : 'MISSING');
  console.error('  SUPABASE_KEY:', supabaseKey ? 'set' : 'MISSING');
} else {
  console.log('Supabase client initialized successfully');
}

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: false,
      auth: { persistSession: false },
    })
  : null;
