import { supabase } from '../supabase.js';

export class Fields {
  async addField(user_email, table_name, field_name, data_type, is_required) {
    try {
      const { error } = await supabase
        .from('fields')
        .insert({ user_email, table_name, field_name, data_type, is_required })
        .select();

      if (error) {
        throw error;
      }

      console.log('Field added successfully');
      return { success: true, message: 'Field added successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async editField(user_email, table_name, field_name, data_type, is_required) {
    try {
      const { data, error } = await supabase
        .from('fields')
        .update({ data_type, is_required })
        .eq('user_email', user_email)
        .eq('table_name', table_name)
        .eq('field_name', field_name)
        .select();

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        console.log('Field not found. Something went wrong');
        return { success: false, message: 'Field not found. Something went wrong' };
      }

      console.log('Field updated successfully');
      return { success: true, message: 'Field updated successfully', data };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getFields(user_email, table_name) {
    try {
      const { data, error } = await supabase
        .from('fields')
        .select('*')
        .eq('user_email', user_email)
        .eq('table_name', table_name);

      if (error) {
        throw error;
      }

      return { success: true, message: 'Fields retrieved successfully', data };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}