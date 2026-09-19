export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const SIGNED_URL_SECONDS = 300;
export const BUCKET = 'field-attachments';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TYPES = Object.freeze({
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  pdf: 'application/pdf',
  txt: 'text/plain',
  csv: 'text/csv',
  md: 'text/markdown',
  markdown: 'text/markdown',
  json: 'application/json',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
});

export class AttachmentError extends Error {
  constructor(message, status = 400, code = 'INVALID_ATTACHMENT') {
    super(message);
    this.name = 'AttachmentError';
    this.status = status;
    this.code = code;
  }
}

export function requireUUID(value) {
  if (typeof value !== 'string' || !UUID.test(value))
    throw new AttachmentError('Invalid attachment or field ID.');
  return value.toLowerCase();
}

export function requireEmail(email) {
  if (typeof email !== 'string' || !email.trim())
    throw new AttachmentError('Authentication required.', 401);
}

export function safeName(name) {
  if (
    typeof name !== 'string' ||
    !name.trim() ||
    name.length > 180 ||
    /[\x00-\x1f\x7f/\\\u202a-\u202e\u2066-\u2069]/.test(name)
  ) {
    throw new AttachmentError(
      'Use a filename of 1–180 characters without paths or control characters.'
    );
  }
  return name.normalize('NFC').trim();
}

export function mimeMatches(value, expected) {
  const mime = String(value || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  return !mime || mime === 'application/octet-stream' || mime === expected;
}

export function validateDescriptor({ name, mimeType, size }) {
  name = safeName(name);
  const extension = name.split('.').pop().toLowerCase();
  const mime = Object.hasOwn(TYPES, extension) ? TYPES[extension] : null;
  if (!name.includes('.') || !mime || !mimeMatches(mimeType, mime)) {
    throw new AttachmentError('Unsupported extension or mismatched MIME type.', 415);
  }
  if (!Number.isSafeInteger(size) || size < 1 || size > MAX_FILE_SIZE) {
    throw new AttachmentError('Files must be nonempty and at most 10 MiB.', 413);
  }
  return { name, mimeType: mime, size, extension };
}

export function publicAttachment(row) {
  return {
    attachmentId: row.id,
    name: row.name,
    mimeType: row.mime_type,
    size: row.size ?? row.expected_size,
  };
}
