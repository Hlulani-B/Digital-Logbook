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

  async editField(user_email, table_name, old_field_name, field_name, data_type, is_required) {
    if (old_field_name === field_name) {
      try {
        if (!pool) throw new Error('Database pool not initialized');
        const { rows } = await pool.query(
          `UPDATE fields SET data_type = $1, is_required = $2
           WHERE user_email = $3 AND table_name = $4 AND field_name = $5
             AND (deleted = false OR deleted IS NULL)
           RETURNING *`,
          [data_type, is_required, user_email, table_name, field_name]
        );

        if (!rows || rows.length === 0) {
          return { success: false, message: 'Field not found' };
        }

        return { success: true, message: 'Field updated successfully', data: rows };
      } catch (error) {
        console.log(error);
        return { success: false, message: error.message };
      }
    }

    let client;
    try {
      if (!pool) throw new Error('Database pool not initialized');
      client = await pool.connect();
      await client.query('BEGIN');

      const { rows: sourceFields } = await client.query(
        `SELECT id FROM fields
         WHERE user_email = $1 AND table_name = $2 AND field_name = $3
           AND (deleted = false OR deleted IS NULL)
         FOR UPDATE`,
        [user_email, table_name, old_field_name]
      );
      if (!sourceFields?.length) {
        await client.query('ROLLBACK');
        return { success: false, message: 'Field not found' };
      }

      const { rows: targetFields } = await client.query(
        `SELECT id FROM fields
         WHERE user_email = $1 AND table_name = $2 AND field_name = $3
           AND (deleted = false OR deleted IS NULL)
         FOR UPDATE`,
        [user_email, table_name, field_name]
      );
      if (targetFields?.length) {
        await client.query('ROLLBACK');
        return { success: false, message: 'A field with that name already exists' };
      }

      const { rows: affectedEntries } = await client.query(
        `SELECT id, entries FROM entries
         WHERE user_email = $1 AND project_name = $2
           AND jsonb_typeof(entries) = 'object' AND entries ? $3
         FOR UPDATE`,
        [user_email, table_name, old_field_name]
      );
      if (affectedEntries.some(({ entries }) => Object.hasOwn(entries, field_name))) {
        await client.query('ROLLBACK');
        return {
          success: false,
          message: 'Some entries already contain the new field name. Rename them first.',
        };
      }

      const { rows: migratedEntries } = await client.query(
        `UPDATE entries
         SET entries = (entries - $1) || jsonb_build_object($2, entries -> $1)
         WHERE user_email = $3 AND project_name = $4
           AND jsonb_typeof(entries) = 'object' AND entries ? $1
         RETURNING id`,
        [old_field_name, field_name, user_email, table_name]
      );
      const { rows } = await client.query(
        `UPDATE fields SET field_name = $1, data_type = $2, is_required = $3
         WHERE id = $4
         RETURNING *`,
        [field_name, data_type, is_required, sourceFields[0].id]
      );

      await client.query('COMMIT');
      return {
        success: true,
        message: 'Field renamed successfully',
        data: rows,
        migrated_entry_count: migratedEntries.length,
      };
    } catch (error) {
      if (client) {
        try {
          await client.query('ROLLBACK');
        } catch {
          // Preserve the original operation failure.
        }
      }
      console.log(error);
      return { success: false, message: error.message };
    } finally {
      client?.release();
    }
  }

  async deleteField(user_email, table_name, field_name) {
    try {
      if (!pool) throw new Error('Database pool not initialized');
      const { rows } = await pool.query(
        `UPDATE fields SET deleted = true
         WHERE user_email = $1 AND table_name = $2 AND field_name = $3
           AND (deleted = false OR deleted IS NULL)
         RETURNING *`,
        [user_email, table_name, field_name]
      );

      if (!rows?.length) return { success: false, message: 'Field not found' };
      return { success: true, message: 'Field removed successfully', data: rows };
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
