import sharp from 'sharp';
import { gzip } from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(gzip);

/** 500 KB in bytes */
const MAX_SIZE = 500 * 1024;

const IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.webp', '.gif', '.tiff', '.tif', '.avif',
];

/**
 * Detect whether a filename/extension refers to an image.
 * @param {string} filenameOrExt  e.g. "photo.png" or ".png"
 * @returns {boolean}
 */
export function isImage(filenameOrExt) {
  if (!filenameOrExt) return false;
  const lower = filenameOrExt.toLowerCase();
  return IMAGE_EXTENSIONS.some((ext) => lower.includes(ext));
}

/**
 * Compress an image buffer using sharp.
 * Tries JPEG/WebP at decreasing quality, then resizes, until ≤ maxSize.
 *
 * @param {Buffer} buffer  Raw file bytes
 * @param {number} [maxSize=MAX_SIZE]  Target max size in bytes
 * @returns {Promise<{buffer: Buffer, format: string}>}
 */
export async function compressImage(buffer, maxSize = MAX_SIZE) {
  if (buffer.length <= maxSize) {
    return { buffer, format: 'original' };
  }

  // Try JPEG at decreasing quality levels
  for (const quality of [70, 50, 30, 15]) {
    try {
      const compressed = await sharp(buffer)
        .jpeg({ quality, mozjpeg: quality >= 50 })
        .toBuffer();
      if (compressed.length <= maxSize) {
        return { buffer: compressed, format: 'jpeg' };
      }
    } catch {
      // sharp may fail on unsupported formats — continue
    }
  }

  // Try WebP at decreasing quality
  for (const quality of [60, 40, 20]) {
    try {
      const compressed = await sharp(buffer)
        .webp({ quality })
        .toBuffer();
      if (compressed.length <= maxSize) {
        return { buffer: compressed, format: 'webp' };
      }
    } catch {
      // continue
    }
  }

  // Resize down progressively while trying JPEG q=10
  for (const width of [1600, 1200, 800, 600, 400]) {
    try {
      const compressed = await sharp(buffer)
        .resize(width)
        .jpeg({ quality: 10 })
        .toBuffer();
      if (compressed.length <= maxSize) {
        return { buffer: compressed, format: 'jpeg' };
      }
    } catch {
      // continue
    }
  }

  // Last resort: return the smallest we managed to produce
  try {
    const smallest = await sharp(buffer)
      .resize(400)
      .jpeg({ quality: 1 })
      .toBuffer();
    return { buffer: smallest, format: 'jpeg' };
  } catch {
    return { buffer, format: 'original' };
  }
}

/**
 * Compress a file buffer.
 * - Images → re-encoded via sharp (JPEG/WebP) until ≤ 500 KB.
 * - Other files → gzip-compressed; if gzip is larger, returns the original.
 *
 * @param {Buffer|string} file  Buffer of bytes **or** a base64 string
 * @param {string} [filename='']  Original filename (used to detect image type)
 * @param {number} [maxSize=MAX_SIZE]  Target max size in bytes (default 500 KB)
 * @returns {Promise<Buffer>}  Compressed file bytes
 */
export async function compressFile(file, filename = '', maxSize = MAX_SIZE) {
  // Accept base64 strings
  let buffer;
  if (typeof file === 'string') {
    buffer = Buffer.from(file, 'base64');
    console.log('[compressFile] input is base64 string, decoded buffer length=', buffer.length);
  } else if (Buffer.isBuffer(file)) {
    buffer = file;
    console.log('[compressFile] input is Buffer, length=', buffer.length);
  } else {
    throw new TypeError('file must be a Buffer or a base64 string');
  }

  // Already small enough
  if (buffer.length <= maxSize) {
    console.log('[compressFile] buffer already <= maxSize (' + maxSize + '), skipping compression');
    return buffer;
  }

  // Image path
  if (isImage(filename)) {
    console.log('[compressFile] detected image (' + filename + '), running compressImage...');
    const result = await compressImage(buffer, maxSize);
    console.log('[compressFile] compressImage done, output format=', result.format, 'length=', result.buffer.length);
    return result.buffer;
  }

  // Non-image: try gzip
  try {
    const gzipped = await gzipAsync(buffer);
    if (gzipped.length < buffer.length) {
      return gzipped;
    }
  } catch {
    // gzip failed — return original
  }

  return buffer;
}

export default compressFile;
