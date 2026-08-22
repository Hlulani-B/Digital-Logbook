/**
 * When user signs up or logs in, this function is called to check if the user exists in the database.
 * Returns an object with:
 *   - exists: whether the user row was found (regardless of deleted status)
 *   - deleted: whether the user is currently soft-deleted (in 30-day grace period)
 * Frontend uses this to decide: active user → dashboard, deleted user → auto-restore, new user → create-profile
 */
import { supabase } from '../supabase.js';


export class Login {
  async checkUser(email) {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized');
        return { exists: false, deleted: false };
      }

      const { data, error } = await supabase
        .from('users')
        .select('email, deleted')
        .eq('email', email)
        .single();

      if (error) {
        console.error(error);
        return { exists: false, deleted: false };
      }

      return { exists: !!data, deleted: data?.deleted === true };
    } catch (error) {
      console.error(error);
      return { exists: false, deleted: false };
    }
  }
}
