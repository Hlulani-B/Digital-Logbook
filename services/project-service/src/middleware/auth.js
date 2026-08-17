import { supabase } from '../supabase.js';

/**
 * Express middleware that verifies the Supabase JWT from the
 * Authorization: Bearer <token> header.
 *
 * On success, attaches:
 *   req.user     — the Supabase user object
 *   req.userEmail — the verified user's email
 *
 * On failure, responds with 401 and does not call next().
 */
export async function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: missing access token' });
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Supabase client not initialized' });
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('Token verification failed:', error?.message || 'No user returned');
    return res.status(401).json({ error: 'Unauthorized: invalid access token' });
  }

  req.user = user;
  req.userEmail = user.email;

  // Ensure a matching row exists in our public.users table. Some auth flows
  // (OAuth, restored sessions, sign-in before the create-profile page ran)
  // never inserted the row, but project FKs depend on it.
  if (req.userEmail) {
    try {
      const { error: upsertError } = await supabase
        .from('users')
        .upsert({ email: req.userEmail }, { onConflict: 'email' });
      if (upsertError) {
        console.error('User provisioning failed:', upsertError.message);
      }
    } catch (err) {
      console.error('User provisioning exception:', err.message);
    }
  }

  next();
}
