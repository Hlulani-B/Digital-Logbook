import express from 'express';
import { Fields } from '../functions/field.js';

const router = express.Router();
const fields = new Fields();

/**
 * input:
 *     function
 *  values("add","edit","get")
 */
router.post('/field', async (req, res) => {
  const { function: func, values } = req.body;
  if (!func) return res.status(400).json({ error: 'Function not provided' });

  switch (func) {
    case 'add': {
      const { user_email, table_name, field_name, data_type, is_required } = values;
      const result = await fields.addField(user_email, table_name, field_name, data_type, is_required);
      return res.json(result);
    }
    case 'edit': {
      const { user_email, table_name, field_name, data_type, is_required } = values;
      const result = await fields.editField(user_email, table_name, field_name, data_type, is_required);
      return res.json(result);
    }
    case 'get': {
      const { user_email, table_name } = values;
      const result = await fields.getFields(user_email, table_name);
      return res.json(result);
    }
    default:
      return res.status(400).json({ error: 'Invalid function' });
  }
});

export default router;
