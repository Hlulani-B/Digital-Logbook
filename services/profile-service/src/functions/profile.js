import { supabase } from '../supabase.js';

/**
 * Handles username checks and updates.
 * If the username already exists in the users table, the update is rejected.
 */
export class Username {
  async username(email, username) {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not connected' };
      }

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
 * Generates a default username from the email prefix to satisfy NOT NULL constraint.
 */
export class Email {
  async email(email) {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not connected' };
      }

      // Generate a default username from the email prefix (before @)
      const defaultUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_');

      const { error } = await supabase
        .from('users')
        .insert({ email, username: defaultUsername, name: defaultUsername });

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
      if (!supabase) {
        return { success: false, message: 'Database not connected' };
      }

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
      if (!supabase) {
        return { success: false, message: 'Database not connected' };
      }

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
  async getProfile(email) {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not connected' };
      }

      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('deleted', false)
        .single();

      if (error) throw error;

      return { success: true, data };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }

  async deleteProfile(email) {
    try {
      if (!supabase) {
        return { success: false, message: 'Database not connected' };
      }

      let error;

      // Soft-delete all entries for this user
      ({ error } = await supabase.from('entries').update({ deleted: true }).eq('user_email', email).eq('deleted', false));
      if (error) throw error;

      // Soft-delete all fields for this user
      ({ error } = await supabase.from('fields').update({ deleted: true }).eq('user_email', email).eq('deleted', false));
      if (error) throw error;

      // Soft-delete all projects for this user
      ({ error } = await supabase.from('projects').update({ deleted: true }).eq('user_email', email).eq('deleted', false));
      if (error) throw error;

      // Soft-delete all activity logs for this user
      ({ error } = await supabase.from('activity_log').update({ deleted: true }).eq('user_email', email).eq('deleted', false));
      if (error) throw error;

      // Soft-delete the user account
      ({ error } = await supabase.from('users').update({ deleted: true }).eq('email', email).eq('deleted', false));
      if (error) throw error;

      return { success: true, message: 'Profile deleted successfully' };
    } catch (error) {
      console.error(error);
      return { success: false, message: error.message };
    }
  }
}
