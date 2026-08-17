import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

// Polyfill WebSocket for Node.js 20 compatibility.
if (typeof globalThis.WebSocket === 'undefined') {
  globalThis.WebSocket = ws;
}

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('WARNING: Missing SUPABASE_URL or SUPABASE_KEY - service will start but database calls will fail');
}

export const supabase = (supabaseUrl && supabaseKey)
  ? createClient(supabaseUrl, supabaseKey, {
      realtime: false,
      auth: { persistSession: false },
    })
  : null;
