import express from 'express';
import { AI } from '../functions/ai.js';

const router = express.Router();

/**
 * POST /service/ai
 * Body: { "prompt": "your prompt text here" }
 * Returns: { "success": true, "response": "<AI response text>" }
 */
router.post('/ai', async (req, res) => {
  try {
    const user_email = req.userEmail;
    if (!user_email) {
      return res.status(401).json({ success: false, error: 'Unauthorized: verified email not available' });
    }

    const { prompt } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ success: false, error: 'Prompt is required and must be a string' });
    }

    console.log(`[/ai] Prompt from ${user_email}: ${prompt.slice(0, 80)}...`);

    const response = await AI(prompt);

    return res.json({ success: true, response });
  } catch (error) {
    console.error('Error in /ai:', error);
    return res.status(500).json({ success: false, error: error.message || 'AI request failed' });
  }
});

export default router;
