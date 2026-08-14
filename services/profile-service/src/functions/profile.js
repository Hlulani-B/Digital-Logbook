import { supabase } from '../supabase.js';

/**
 * Handles username checks and updates.
 * If the username already exists in the users table, the update is rejected.
 */
export class Username {
  async username(email, username) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username')
        .eq('username', username);

      if (error) throw error;

      if (data && data.length > 0) {
        return { success: false, message: 'Username not available' };
      }

      const { error: updateError } = await supabase
        .from('users')
        .update({ username })
        .eq('email', email);

      if (updateError) throw updateError;

      return { success: true, message: 'Username updated successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Inserts a new user's email during sign-up.
 */
export class Email {
  async email(email) {
    try {
      const { error } = await supabase
        .from('users')
        .insert({ email });

      if (error) throw error;

      return { success: true, message: 'Email added successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Updates a user's display name.
 */
export class Name {
  async name(email, new_name) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ name: new_name })
        .eq('email', email);

      if (error) throw error;

      return { success: true, message: 'Name updated successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Updates a user's avatar URL.
 */
export class Avatar {
  async avatar(email, url) {
    try {
      const { error } = await supabase
        .from('users')
        .update({ avatar: url })
        .eq('email', email);

      if (error) throw error;

      return { success: true, message: 'Avatar updated successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}

/**
 * Aggregates read/delete operations for a user profile.
 */
export class Profile {
  /**
   * Fetch a profile by email.
   */
  async getProfile(email) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }

  /**
   * Delete a profile and all rows across every table tied to this email.
   */
  async deleteProfile(email) {
    try {
      let error;

      ({ error } = await supabase.from('entries').delete().eq('user_email', email));
      if (error) throw error;

      ({ error } = await supabase.from('fields').delete().eq('user_email', email));
      if (error) throw error;

      ({ error } = await supabase.from('projects').delete().eq('user_email', email));
      if (error) throw error;

      ({ error } = await supabase.from('users').delete().eq('email', email));
      if (error) throw error;

      return { success: true, message: 'Profile deleted successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}
