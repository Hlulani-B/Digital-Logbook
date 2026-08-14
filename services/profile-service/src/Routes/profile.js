import express from 'express';
import { Username, Email, Name, Avatar, Profile } from '../functions/profile.js';

const router = express.Router();
const username = new Username();
const email = new Email();
const name = new Name();
const avatar = new Avatar();
const profile = new Profile();

/**
 * input:
 *     function
 *  values("username","email","name","avatar","getProfile","deleteProfile")
 */
router.post('/profile', async (req, res) => {
  const { function: func, values } = req.body;
  if (!func) return res.status(400).json({ error: 'Function not provided' });

  switch (func) {
    case 'username': {
      const { email, username: userName } = values;
      const result = await username.username(email, userName);
      return res.json(result);
    }
    case 'email': {
      const { email: userEmail } = values;
      const result = await email.email(userEmail);
      return res.json(result);
    }
    case 'name': {
      const { email, new_name } = values;
      const result = await name.name(email, new_name);
      return res.json(result);
    }
    case 'avatar': {
      const { email, url } = values;
      const result = await avatar.avatar(email, url);
      return res.json(result);
    }
    case 'getProfile': {
      const { email } = values;
      const result = await profile.getProfile(email);
      return res.json(result);
    }
    case 'deleteProfile': {
      const { email } = values;
      const result = await profile.deleteProfile(email);
      return res.json(result);
    }
    default:
      return res.status(400).json({ error: 'Invalid function' });
  }
});

export default router;
