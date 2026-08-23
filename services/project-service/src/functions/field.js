import pool from '../db.js';

export class Fields {
  async addField(user_email, table_name, field_name, data_type, is_required) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      await pool.query(
        `INSERT INTO fields (user_email, table_name, field_name, data_type, is_required)
         VALUES ($1, $2, $3, $4, $5)`,
        [user_email, table_name, field_name, data_type, is_required]
      );

      console.log('Field added successfully');
      return { success: true, message: 'Field added successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async editField(user_email, table_name, field_name, data_type, is_required) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `UPDATE fields SET data_type = $1, is_required = $2
         WHERE user_email = $3 AND table_name = $4 AND field_name = $5
         RETURNING *`,
        [data_type, is_required, user_email, table_name, field_name]
      );

      if (!rows || rows.length === 0) {
        console.log('Field not found. Something went wrong');
        return { success: false, message: 'Field not found. Something went wrong' };
      }

      console.log('Field updated successfully');
      return { success: true, message: 'Field updated successfully', data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async getFields(user_email, table_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `SELECT * FROM fields
         WHERE user_email = $1 AND table_name = $2 AND (deleted = false OR deleted IS NULL)`,
        [user_email, table_name]
      );

      return { success: true, message: 'Fields retrieved successfully', data: rows };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }
}
