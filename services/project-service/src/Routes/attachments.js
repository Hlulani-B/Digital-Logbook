import express from 'express';
import { requireAuth } from '../../middleware/auth.js';
import { createAttachmentLease, finalizeAttachment, getAttachment } from '../attachments.js';

const router = express.Router();

router.post('/projects/:projectId/fields/:fieldId/leases', requireAuth, async (req, res, next) => {
  try {
    const { name, mime_type, expected_size } = req.body;
    const lease = await createAttachmentLease(
      req.user.email,
      Number(req.params.projectId),
      req.params.fieldId,
      { name, mime_type, expected_size }
    );
    res.status(201).json(lease);
  } catch (error) {
    if (error.message?.includes('must be') || error.message?.includes('not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.post('/:id/finalize', requireAuth, async (req, res, next) => {
  try {
    const { entryId, upload_token } = req.body;
    const attachment = await finalizeAttachment(req.user.email, req.params.id, {
      entryId,
      upload_token,
    });
    if (!attachment) return res.status(404).json({ error: 'Attachment not found.' });
    res.json(attachment);
  } catch (error) {
    if (
      error.message?.includes('not pending') ||
      error.message?.includes('expired') ||
      error.message?.includes('Invalid')
    ) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const attachment = await getAttachment(req.user.email, req.params.id);
    if (!attachment) return res.status(404).json({ error: 'Attachment not found.' });
    res.json(attachment);
  } catch (error) {
    next(error);
  }
});

export default router;
