import express from 'express';
import { Login } from '../functions/login.js';

const router = express.Router();

// Wrap class instantiation safely
let login;
try {
  login = new Login();
} catch (err) {
  console.error('Failed to initialize Login function class:', err);
}

/**
 * input:
 *     function
 *  values("checkUser")
 */
router.post('/login', async (req, res) => {
  try {
    if (!login) {
      return res.status(500).json({ error: 'Login service uninitialized' });
    }

    const { function: func, values } = req.body || {};
    if (!func) {
      return res.status(400).json({ error: 'Function not provided' });
    }

    switch (func) {
      case 'checkUser': {
        if (!values || !values.email) {
          return res.status(400).json({ error: 'Email value missing' });
        }

        const result = await login.checkUser(values.email);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error inside POST /service/login:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;
