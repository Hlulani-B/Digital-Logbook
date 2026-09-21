import express from 'express';
import { requireAuth } from '../middleware/auth.js';
import {
  listTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  TemplateError,
} from '../functions/templates.js';

const router = express.Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const scope = req.query.scope ?? 'all';
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
    const template = await createTemplate(req.user.email, req.body, {
      isAdmin: req.user.app_metadata?.is_admin === true,
    });
    res.status(201).json({ template });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const template = await updateTemplate(req.user.email, req.params.id, req.body, {
      isAdmin: req.user.app_metadata?.is_admin === true,
    });
    if (!template) return res.status(404).json({ error: 'Template not found or access denied.' });
    res.json({ template });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const deleted = await deleteTemplate(req.user.email, req.params.id, {
      isAdmin: req.user.app_metadata?.is_admin === true,
    });
    if (!deleted) return res.status(404).json({ error: 'Template not found or access denied.' });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

router.use((error, req, res, next) => {
  if (res.headersSent) return next(error);
  if (error instanceof TemplateError && [400, 403, 404, 503].includes(error.status)) {
    return res.status(error.status).json({
      error: error.message,
      ...(error.status === 400 && error.details ? { details: error.details } : {}),
    });
  }
  return res.status(503).json({ error: 'Template storage is unavailable.' });
});

export default router;
