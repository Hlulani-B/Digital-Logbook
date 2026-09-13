import express from 'express';
import {
  Username,
  Email,
  Name,
  Avatar,
  Profile,
  EmailNotifications,
} from '../functions/profile.js';

const router = express.Router();

// Instantiate classes safely
let username, email, name, avatar, profile, emailNotifications;
try {
  username = new Username();
  email = new Email();
  name = new Name();
  avatar = new Avatar();
  profile = new Profile();
  emailNotifications = new EmailNotifications();
} catch (err) {
  console.error('Failed to instantiate profile handlers:', err);
}

/**
 * input:
 *     function
 *  values("username","email","name","avatar","getProfile","deleteProfile")
 */
router.post('/profile', async (req, res) => {
  try {
    const { function: func, values = {} } = req.body || {};

    if (!func) {
      return res.status(400).json({ error: 'Function not provided' });
    }

    switch (func) {
      case 'username': {
        const { email: userEmail, username: userName } = values;
        if (!userEmail || !userName)
          return res.status(400).json({ error: 'Missing required parameters' });

        const result = await username.username(userEmail, userName);
        return res.json(result);
      }
      case 'email': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });

        const result = await email.email(userEmail);
        return res.json(result);
      }
      case 'name': {
        const { email: userEmail, new_name } = values;
        if (!userEmail || !new_name)
          return res.status(400).json({ error: 'Missing required parameters' });

        const result = await name.name(userEmail, new_name);
        return res.json(result);
      }
      case 'avatar': {
        const { email: userEmail, url } = values;
        if (!userEmail || !url)
          return res.status(400).json({ error: 'Missing required parameters' });

        const result = await avatar.avatar(userEmail, url);
        return res.json(result);
      }
      case 'getProfile': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });

        const result = await profile.getProfile(userEmail);
        return res.json(result);
      }
      case 'emailNotifications': {
        const { email: userEmail, enabled } = values;
        if (!userEmail || typeof enabled !== 'boolean') {
          return res.status(400).json({ error: 'Missing email parameter or enabled flag' });
        }

        const result = await emailNotifications.setEmailNotifications(userEmail, enabled);
        return res.json(result);
      }
      case 'deleteProfile': {
        const { email: userEmail } = values;
        if (!userEmail) return res.status(400).json({ error: 'Missing email parameter' });

        const result = await profile.deleteProfile(userEmail);
        return res.json(result);
      }
      default:
        return res.status(400).json({ error: 'Invalid function' });
    }
  } catch (error) {
    console.error('Error in POST /service/profile:', error);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: error.message,
    });
  }
});

export default router;
