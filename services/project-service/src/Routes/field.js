import express from 'express';
import { Fields } from '../functions/field.js';
import { logActivity } from '../functions/activityLog.js';

const router = express.Router();

// Instantiate class safely
let fields;
try {
  fields = new Fields();
} catch (err) {
  console.error('Failed to instantiate Fields handler:', err);
}

/**
 * input:
 *     function
 *  values("add","edit","get")
 */
router.post('/field', async (req, res) => {
  try {
    if (!fields) {
      return res.status(500).json({ error: 'Fields service uninitialized' });
    }

    const { function: func, values = {} } = req.body || {};
    if (!func) return res.status(400).json({ error: 'Function not provided' });

    // Use the verified email from the JWT, not the user_email supplied by the client.
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized: verified email not available' });
    }

    switch (func) {
      case 'add': {
        const { table_name, field_name, data_type, is_required } = values;
        if (!table_name || !field_name)
          return res.status(400).json({ error: 'Missing required parameters' });
        const result = await fields.addField(
          user_email,
          table_name,
          field_name,
          data_type,
          is_required
        );
        if (result.success) {
          await logActivity(user_email, 'FIELD_ADDED', 'field', field_name, {
            project_name: table_name,
            data_type,
            is_required,
          });
        }
        return res.json(result);
      }
      case 'edit': {
        const { table_name, old_field_name, field_name, data_type, is_required } = values;
        const sourceFieldName = old_field_name || field_name;
        if (!table_name || !sourceFieldName || !field_name)
          return res.status(400).json({ error: 'Missing required parameters' });
        const result = await fields.editField(
          user_email,
          table_name,
          sourceFieldName,
          field_name,
          data_type,
          is_required
        );
        if (result.success) {
          await logActivity(
            user_email,
            sourceFieldName === field_name ? 'FIELD_EDITED' : 'FIELD_RENAMED',
            'field',
            field_name,
            {
              project_name: table_name,
              old_field_name: sourceFieldName,
              data_type,
              is_required,
              migrated_entry_count: result.migrated_entry_count || 0,
            }
          );
        }
        return res.json(result);
      }
      case 'delete': {
        const { table_name, field_name } = values;
        if (!table_name || !field_name)
          return res.status(400).json({ error: 'Missing required parameters' });
        const result = await fields.deleteField(user_email, table_name, field_name);
        if (result.success) {
          await logActivity(user_email, 'FIELD_REMOVED', 'field', field_name, {
            project_name: table_name,
          });
        }
        return res.json(result);
      }
      case 'get': {
        const { table_name } = values;
        if (!table_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await fields.getFields(user_email, table_name);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/field:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;
