import express from 'express';
import { Login } from '../functions/login.js';

const router = express.Router();
const login = new Login();

/**
 * input:
 *     function
 *  values("checkUser")
 */
router.post('/login', async (req, res) => {
  const { function: func, values } = req.body;
  if (!func) return res.status(400).json({ error: 'Function not provided' });

  switch (func) {
    case 'checkUser': {
      const { email } = values;
      const result = await login.checkUser(email);
      return res.json({ exists: result });
    }
    default:
      return res.status(400).json({ error: 'Invalid function' });
  }
});

export default router;
