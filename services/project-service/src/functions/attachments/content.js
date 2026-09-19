import sharp from 'sharp';
import { TextDecoder } from 'node:util';
import { AttachmentError, MAX_FILE_SIZE, mimeMatches, validateDescriptor } from './policy.js';
import { validateOfficeArchive } from './archive.js';

const utf8 = new TextDecoder('utf-8', { fatal: true });
const MAX_PIXELS = 16_000_000;
function invalid() {
  throw new AttachmentError('File content does not match an allowed, safe format.', 415);
}
function imageFormat(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP' &&
    bytes.readUInt32LE(4) + 8 === bytes.length
  )
    return 'webp';
  return null;
}

export async function validateContent(bytes, descriptor, contentType) {
  const meta = validateDescriptor(descriptor);
  if (!Buffer.isBuffer(bytes) || bytes.length !== meta.size || bytes.length > MAX_FILE_SIZE) {
    throw new AttachmentError('Uploaded length must match the declared size, at most 10 MiB.', 413);
  }
  if (!mimeMatches(contentType, meta.mimeType)) invalid();
  try {
    if (meta.mimeType.startsWith('image/')) {
      const format = imageFormat(bytes);
      const expected = meta.mimeType.slice(6);
      if (!format || format !== expected) invalid();
      const options = {
        limitInputPixels: MAX_PIXELS,
        failOn: 'warning',
        sequentialRead: true,
        pages: 1,
      };
      const info = await sharp(bytes, options).timeout({ seconds: 5 }).metadata();
      if (
        info.format !== format ||
        !info.width ||
        !info.height ||
        info.width * info.height > MAX_PIXELS ||
        (info.pages || 1) > 1
      )
        invalid();
      // Decode only after the pixel bound; strip metadata/trailing polyglot data.
      const clean = await sharp(bytes, options)
        .timeout({ seconds: 5 })
        .rotate()
        .toFormat(format)
        .toBuffer();
      if (clean.length > MAX_FILE_SIZE)
        throw new AttachmentError('Sanitized image exceeds 10 MiB.', 413);
      return { ...meta, bytes: clean, size: clean.length };
    }
    if (meta.extension === 'docx' || meta.extension === 'xlsx') {
      validateOfficeArchive(bytes, meta.extension);
    } else if (meta.extension === 'pdf') {
      const text = bytes.toString('latin1');
      if (!/^%PDF-1\.[0-7][\r\n]/.test(text) && !/^%PDF-2\.0[\r\n]/.test(text)) invalid();
      if (
        !/%%EOF\s*$/.test(text) ||
        !/\b\d+\s+\d+\s+obj\b/.test(text) ||
        !/\bstartxref\s+\d+\s+%%EOF\s*$/.test(text)
      )
        invalid();
      // Reject active actions and embedded payloads, including escaped PDF names.
      const names = text.replace(/#([0-9a-f]{2})/gi, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
      );
      if (/\/(JavaScript|JS|Launch|EmbeddedFile|OpenAction|AA|RichMedia|XFA)\b/i.test(names))
        invalid();
    } else {
      const text = utf8.decode(bytes);
      if (
        /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) ||
        /^\s*(MZ|#!|\x7fELF|PK\x03\x04)/.test(text) ||
        /<\s*(?:!doctype\s+html|html\b|head\b|body\b|svg\b|script\b|iframe\b|object\b|embed\b)/i.test(
          text
        )
      )
        invalid();
      if (meta.extension === 'json') JSON.parse(text);
    }
    return { ...meta, bytes };
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    invalid();
  }
}
