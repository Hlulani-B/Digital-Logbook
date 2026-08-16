import express from 'express';
import { Fields } from '../functions/field.js';

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

    switch (func) {
      case 'add': {
        const { user_email, table_name, field_name, data_type, is_required } = values;
        if (!user_email || !table_name || !field_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await fields.addField(user_email, table_name, field_name, data_type, is_required);
        return res.json(result);
      }
      case 'edit': {
        const { user_email, table_name, field_name, data_type, is_required } = values;
        if (!user_email || !table_name || !field_name) return res.status(400).json({ error: 'Missing required parameters' });
        const result = await fields.editField(user_email, table_name, field_name, data_type, is_required);
        return res.json(result);
      }
      case 'get': {
        const { user_email, table_name } = values;
        if (!user_email || !table_name) return res.status(400).json({ error: 'Missing required parameters' });
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
      details: error.message 
    });
  }
});

export default router;
