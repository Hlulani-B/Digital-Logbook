// Supabase client — optional for local dev
const supabase = undefined;
import { randomUUID } from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

export function validateAttachmentMetadata({ name, mime_type, expected_size }) {
  if (!name || typeof name !== 'string' || name.length > 180 || name.length === 0) {
    throw new Error('Attachment name must be 1–180 characters.');
  }
  if (!ALLOWED_MIME_TYPES.includes(mime_type)) {
    throw new Error(`MIME type ${mime_type} is not allowed.`);
  }
  if (!Number.isInteger(expected_size) || expected_size < 1 || expected_size > MAX_FILE_SIZE) {
    throw new Error(`File size must be 1–${MAX_FILE_SIZE} bytes.`);
  }
}

export async function createAttachmentLease(
  userEmail,
  projectId,
  fieldId,
  { name, mime_type, expected_size }
) {
  validateAttachmentMetadata({ name, mime_type, expected_size });
  const id = randomUUID();
  const upload_token = randomUUID();
  const storage_key = `${userEmail}/${projectId}/${fieldId}/${id}/${encodeURIComponent(name)}`;
  const lease_until = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  const { data, error } = await supabase
    .from('field_attachments')
    .insert({
      id,
      user_email: userEmail,
      project_id: projectId,
      field_id: fieldId,
      storage_key,
      name,
      mime_type,
      expected_size,
      status: 'pending',
      upload_token,
      lease_until,
    })
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    storage_key: data.storage_key,
    upload_token: data.upload_token,
    lease_until: data.lease_until,
    name: data.name,
    mime_type: data.mime_type,
    expected_size: data.expected_size,
  };
}

export async function finalizeAttachment(userEmail, attachmentId, { entryId, upload_token }) {
  const { data: attachment, error: fetchError } = await supabase
    .from('field_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('user_email', userEmail)
    .single();
  if (fetchError) {
    if (fetchError.code === 'PGRST116') return null;
    throw fetchError;
  }
  if (attachment.status !== 'pending') {
    throw new Error('Attachment is not pending finalization.');
  }
  if (attachment.upload_token !== upload_token) {
    throw new Error('Invalid upload token.');
  }
  if (attachment.lease_until < new Date()) {
    throw new Error('Upload lease has expired.');
  }
  const { data: entry, error: entryError } = await supabase
    .from('entries')
    .select('id, user_email, project_id')
    .eq('id', entryId)
    .eq('user_email', userEmail)
    .single();
  if (entryError || !entry) {
    throw new Error('Entry not found or access denied.');
  }
  const { data: field, error: fieldError } = await supabase
    .from('fields')
    .select('id, data_type')
    .eq('id', attachment.field_id)
    .eq('user_email', userEmail)
    .eq('deleted', false)
    .single();
  if (fieldError || !field) {
    throw new Error('Field not found or access denied.');
  }
  if (!['file', 'image'].includes(field.data_type)) {
    throw new Error('Field does not support attachments.');
  }
  const { data: updated, error: updateError } = await supabase
    .from('field_attachments')
    .update({
      status: 'finalized',
      entry_id: entryId,
      uploaded_at: new Date().toISOString(),
      upload_token: null,
      lease_until: null,
    })
    .eq('id', attachmentId)
    .select()
    .single();
  if (updateError) throw updateError;
  return {
    id: updated.id,
    entry_id: updated.entry_id,
    storage_key: updated.storage_key,
    name: updated.name,
    mime_type: updated.mime_type,
    size: updated.size,
  };
}

export async function getAttachment(userEmail, attachmentId) {
  const { data, error } = await supabase
    .from('field_attachments')
    .select('*')
    .eq('id', attachmentId)
    .eq('user_email', userEmail)
    .single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw error;
  }
  return {
    id: data.id,
    storage_key: data.storage_key,
    name: data.name,
    mime_type: data.mime_type,
    size: data.size,
    expected_size: data.expected_size,
    status: data.status,
    entry_id: data.entry_id,
    field_id: data.field_id,
    project_id: data.project_id,
  };
}

export async function cleanupStaleAttachments(limit = 100) {
  const { data: stale, error } = await supabase
    .from('field_attachments')
    .select('id, storage_key, cleanup_attempts')
    .lt('lease_until', new Date().toISOString())
    .eq('status', 'pending')
    .limit(limit);
  if (error) throw error;
  if (!stale || stale.length === 0) return { cleaned: 0, failed: 0 };
  let cleaned = 0,
    failed = 0;
  for (const attachment of stale) {
    try {
      const { error: deleteError } = await supabase.storage
        .from('field-attachments')
        .remove([attachment.storage_key]);
      if (deleteError && !deleteError.message?.includes('not found')) {
        await supabase
          .from('field_attachments')
          .update({
            status: 'cleanup_pending',
            cleanup_attempts: attachment.cleanup_attempts + 1,
            cleanup_after: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq('id', attachment.id);
        failed++;
        continue;
      }
      await supabase
        .from('field_attachments')
        .update({ deleted: true, deleted_at: new Date().toISOString() })
        .eq('id', attachment.id);
      cleaned++;
    } catch {
      failed++;
    }
  }
  return { cleaned, failed };
}
