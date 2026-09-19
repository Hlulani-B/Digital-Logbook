import pool from '../db.js';

export class Fields {
  async addField(
    user_email,
    table_name,
    field_name,
    data_type,
    is_required,
    field_permissions,
    visibility
  ) {
    try {
      if (!pool) throw new Error('Database pool not initialized');

      // Validate field_permissions shape if provided
      if (field_permissions !== undefined) {
        if (typeof field_permissions !== 'object' || field_permissions === null) {
          return { success: false, message: 'field_permissions must be a JSON object' };
        }
      }

      await pool.query(
        `INSERT INTO fields (user_email, table_name, field_name, data_type, is_required, field_permissions, visibility)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          user_email,
          table_name,
          field_name,
          data_type,
          is_required,
          field_permissions ? JSON.stringify(field_permissions) : '{}',
          visibility ? JSON.stringify(visibility) : null,
        ]
      );

      console.log('Field added successfully');
      return { success: true, message: 'Field added successfully' };
    } catch (error) {
      console.log(error);
      return { success: false, message: error.message };
    }
  }

  async editField(
    user_email,
    table_name,
    old_field_name,
    field_name,
    data_type,
    is_required,
    field_permissions,
    visibility
  ) {
    if (old_field_name === field_name) {
      try {
        if (!pool) throw new Error('Database pool not initialized');

        const updateFields = ['data_type = $1', 'is_required = $2'];
        const params = [data_type, is_required];

        // Add field_permissions update if provided
        if (field_permissions !== undefined) {
          if (typeof field_permissions !== 'object' || field_permissions === null) {
            return { success: false, message: 'field_permissions must be a JSON object' };
          }
          updateFields.push('field_permissions = $' + (params.length + 1));
          params.push(JSON.stringify(field_permissions));
        }

        // Add visibility update if provided
        if (visibility !== undefined) {
          updateFields.push('visibility = $' + (params.length + 1));
          params.push(visibility ? JSON.stringify(visibility) : null);
        }

        params.push(user_email, table_name, field_name);

        const { rows } = await pool.query(
          `UPDATE fields SET ${updateFields.join(', ')}
           WHERE user_email = $${params.length - 2} AND table_name = $${params.length - 1} AND field_name = $${params.length}
             AND (deleted = false OR deleted IS NULL)
           RETURNING *`,
          params
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
        `UPDATE fields SET field_name = $1, data_type = $2, is_required = $3, field_permissions = $4, visibility = $5
         WHERE id = $6
         RETURNING *`,
        [
          field_name,
          data_type,
          is_required,
          field_permissions ? JSON.stringify(field_permissions) : '{}',
          visibility ? JSON.stringify(visibility) : null,
          sourceFields[0].id,
        ]
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
