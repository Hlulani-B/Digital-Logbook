/**
 * When user signs up or logs in, this function is called to check if the user exists in the database.
 * if the user does not exist then return false so that frontend can direct them to create a profile
 * if user does exist then return true so that frontend can direct them to the dashboard
 */
import { supabase } from '../supabase.js';


export class Login {
  async checkUser(email) {
    try {
      if (!supabase) {
        console.error('Supabase client not initialized');
        return false;
      }

      const { data, error } = await supabase
        .from('users')
        .select('email')
        .eq('email', email)
        .single();

      if (error) {
        console.error(error);
        return false;
      }

      return data ? true : false;
    } catch (error) {
      console.error(error);
      return false;
    }
  }
}
