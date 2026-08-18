import express from 'express';
import { NaturalLanguage } from '../functions/natural_language_entry.js';

const router = express.Router();

const nlp = new NaturalLanguage();

router.post('/natural-language-entry', async (req, res) => {
  try {
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const result = await nlp.parseAndCreateEntry(user_email, text);
    return res.json(result);
  } catch (error) {
    console.error('Error in /natural-language-entry:', error);
    return res.status(500).json({ error: error.message });
  }
});

export default router;
