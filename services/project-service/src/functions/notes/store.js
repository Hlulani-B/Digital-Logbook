import { randomUUID } from 'crypto';

function getSupabaseUrl() { return process.env.SUPABASE_URL; }
function getSupabaseKey() { return process.env.SUPABASE_SERVICE_ROLE_KEY; }
function getBucket() { return process.env.SUPABASE_STORAGE_BUCKET || 'logbook-files'; }

/**
 * Guess a MIME type from a filename extension.
 * @param {string} filename
 * @returns {string}
 */
function guessContentType(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  const map = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    tiff: 'image/tiff',
    tif: 'image/tiff',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    txt: 'text/plain',
    csv: 'text/csv',
    json: 'application/json',
    mp4: 'video/mp4',
    webm: 'video/webm',
    mp3: 'audio/mpeg',
    wav: 'audio/wav',
    zip: 'application/zip',
    gz: 'application/gzip',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * Upload a file to Supabase Storage and return its public URL.
 *
 * @param {Buffer|string} file  Buffer of bytes **or** a base64 string
 * @param {string} filename  Original filename (used for extension + MIME)
 * @param {string} userEmail  Owner — used as the top-level folder
 * @returns {Promise<string|null>}  Public URL, or null on failure
 */
export async function storeFile(file, filename, userEmail) {
  const buffer = typeof file === 'string'
    ? Buffer.from(file, 'base64')
    : file;

  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('file must be a non-empty Buffer or base64 string');
  }
  if (!filename) {
    throw new TypeError('filename is required');
  }
  if (!userEmail) {
    throw new TypeError('userEmail is required');
  }

  const ext = filename.split('.').pop() || 'bin';
  const uniqueName = `${randomUUID()}.${ext}`;
  const path = `${userEmail}/${uniqueName}`;
  const contentType = guessContentType(filename);

  const url = `${getSupabaseUrl()}/storage/v1/object/${getBucket()}/${path}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${getSupabaseKey()}`,
        'Content-Type': contentType,
        'x-upsert': 'true',
      },
      body: buffer,
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error('[storeFile] Upload failed:', response.status, text);
      return null;
    }

    const data = await response.json().catch(() => ({}));
    // Supabase returns { Key, ... } on success
    const publicUrl =
      data?.publicUrl ||
      `${getSupabaseUrl()}/storage/v1/object/public/${getBucket()}/${path}`;

    console.log('[storeFile] Uploaded:', path, '→', publicUrl);
    return publicUrl;
  } catch (err) {
    console.error('[storeFile] Error:', err.message);
    return null;
  }
}

export default storeFile;
