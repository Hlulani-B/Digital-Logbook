import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from '../templates.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const scope = req.query.scope || 'all';
    const templates = await listTemplates(req.user.email, { scope });
    res.json({ templates });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const template = await getTemplate(req.user.email, req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found.' });
    res.json({ template });
  } catch (error) {
    next(error);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, description, fields, scope, forked_from } = req.body;
    const template = await createTemplate(req.user.email, {
      name,
      description,
      fields,
      scope,
      forked_from,
    });
    res.status(201).json({ template });
  } catch (error) {
    if (error.message?.includes('required') || error.message?.includes('must be')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.details) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const { name, description, fields } = req.body;
    const template = await updateTemplate(req.user.email, req.params.id, {
      name,
      description,
      fields,
    });
    if (!template) return res.status(404).json({ error: 'Template not found or access denied.' });
    res.json({ template });
  } catch (error) {
    if (error.message?.includes('required')) {
      return res.status(400).json({ error: error.message });
    }
    if (error.details) {
      return res.status(400).json({ error: error.message, details: error.details });
    }
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await deleteTemplate(req.user.email, req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template not found or access denied.' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;
