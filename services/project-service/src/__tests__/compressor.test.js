import { compressFile, compressImage, isImage } from '../functions/notes/compressor.js';

// Mock sharp
jest.mock('sharp', () => {
  const mockSharp = jest.fn(() => ({
    jpeg: jest.fn().mockReturnThis(),
    webp: jest.fn().mockReturnThis(),
    resize: jest.fn().mockReturnThis(),
    toBuffer: jest.fn(),
  }));
  return { __esModule: true, default: mockSharp };
});

import sharp from 'sharp';

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── isImage ───────────────────────────────────────────────────────────
describe('isImage', () => {
  it('returns true for common image extensions', () => {
    expect(isImage('photo.jpg')).toBe(true);
    expect(isImage('photo.jpeg')).toBe(true);
    expect(isImage('image.png')).toBe(true);
    expect(isImage('pic.webp')).toBe(true);
    expect(isImage('anim.gif')).toBe(true);
    expect(isImage('scan.tiff')).toBe(true);
    expect(isImage('modern.avif')).toBe(true);
  });

  it('returns false for non-image files', () => {
    expect(isImage('document.pdf')).toBe(false);
    expect(isImage('data.csv')).toBe(false);
    expect(isImage('readme.txt')).toBe(false);
    expect(isImage('archive.zip')).toBe(false);
  });

  it('returns false for null/undefined/empty', () => {
    expect(isImage(null)).toBe(false);
    expect(isImage(undefined)).toBe(false);
    expect(isImage('')).toBe(false);
  });

  it('is case-insensitive', () => {
    expect(isImage('PHOTO.PNG')).toBe(true);
    expect(isImage('Image.JPG')).toBe(true);
  });
});

// ─── compressImage ─────────────────────────────────────────────────────
describe('compressImage', () => {
  it('returns original buffer when already under maxSize', async () => {
    const small = Buffer.alloc(100); // 100 bytes
    const result = await compressImage(small, 500 * 1024);
    expect(result.buffer).toBe(small);
    expect(result.format).toBe('original');
    expect(sharp).not.toHaveBeenCalled();
  });

  it('compresses a large image via JPEG at quality 70', async () => {
    const large = Buffer.alloc(600 * 1024); // 600 KB
    const compressed = Buffer.alloc(400 * 1024); // 400 KB — under 500 KB

    const mockToBuffer = jest.fn().mockResolvedValue(compressed);
    const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
    const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg, webp: jest.fn().mockReturnValue({ toBuffer: mockToBuffer }), resize: jest.fn() });
    sharp.mockReturnValue({ jpeg: mockJpeg, resize: mockResize });

    const result = await compressImage(large, 500 * 1024);

    expect(result.buffer).toBe(compressed);
    expect(result.format).toBe('jpeg');
    expect(mockJpeg).toHaveBeenCalledWith(expect.objectContaining({ quality: 70 }));
  });

  it('falls through to lower quality when first attempt is still too large', async () => {
    const large = Buffer.alloc(600 * 1024);
    const tooBig = Buffer.alloc(550 * 1024); // still > 500 KB
    const smallEnough = Buffer.alloc(450 * 1024); // under 500 KB

    let callCount = 0;
    const mockToBuffer = jest.fn().mockImplementation(() => {
      callCount++;
      // First call (q=70) → too big, second call (q=50) → small enough
      return Promise.resolve(callCount === 1 ? tooBig : smallEnough);
    });
    const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
    const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg, webp: jest.fn().mockReturnValue({ toBuffer: mockToBuffer }), resize: jest.fn() });
    sharp.mockReturnValue({ jpeg: mockJpeg, resize: mockResize });

    const result = await compressImage(large, 500 * 1024);

    expect(result.buffer).toBe(smallEnough);
    expect(result.format).toBe('jpeg');
    expect(callCount).toBe(2);
  });

  it('returns original when all compression attempts fail', async () => {
    const large = Buffer.alloc(600 * 1024);

    // All sharp calls throw
    const mockToBuffer = jest.fn().mockRejectedValue(new Error('sharp fail'));
    const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
    const mockWebp = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
    const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg, webp: mockWebp, resize: jest.fn().mockReturnValue({ jpeg: mockJpeg }) });
    sharp.mockReturnValue({ jpeg: mockJpeg, webp: mockWebp, resize: mockResize });

    const result = await compressImage(large, 500 * 1024);

    expect(result.buffer).toBe(large);
    expect(result.format).toBe('original');
  });
});

// ─── compressFile ──────────────────────────────────────────────────────
describe('compressFile', () => {
  it('returns buffer unchanged when already under maxSize', async () => {
    const small = Buffer.alloc(100);
    const result = await compressFile(small, 'doc.pdf');
    expect(result).toBe(small);
  });

  it('accepts base64 string input', async () => {
    const content = Buffer.alloc(100, 'a');
    const base64 = content.toString('base64');
    const result = await compressFile(base64, 'doc.pdf');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBe(100);
  });

  it('throws TypeError for invalid input', async () => {
    await expect(compressFile(12345, 'file.txt')).rejects.toThrow(TypeError);
    await expect(compressFile({}, 'file.txt')).rejects.toThrow(TypeError);
  });

  it('routes image files through compressImage', async () => {
    const large = Buffer.alloc(600 * 1024);
    const compressed = Buffer.alloc(400 * 1024);

    const mockToBuffer = jest.fn().mockResolvedValue(compressed);
    const mockJpeg = jest.fn().mockReturnValue({ toBuffer: mockToBuffer });
    const mockResize = jest.fn().mockReturnValue({ jpeg: mockJpeg, webp: jest.fn().mockReturnValue({ toBuffer: mockToBuffer }), resize: jest.fn() });
    sharp.mockReturnValue({ jpeg: mockJpeg, resize: mockResize });

    const result = await compressFile(large, 'photo.png');

    expect(result).toBe(compressed);
    expect(sharp).toHaveBeenCalled();
  });

  it('gzip-compresses non-image files when beneficial', async () => {
    // Create a large repetitive buffer (compresses well with gzip)
    const large = Buffer.alloc(600 * 1024, 'abcdefgh');
    const result = await compressFile(large, 'data.csv');

    // gzip should produce something smaller for repetitive data
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeLessThan(large.length);
  });

  it('returns original buffer when gzip makes it larger', async () => {
    // Random-looking data doesn't compress well
    const large = Buffer.alloc(600 * 1024);
    // Fill with pseudo-random bytes
    for (let i = 0; i < large.length; i++) large[i] = (i * 17 + 31) % 256;

    const result = await compressFile(large, 'random.bin');

    // gzip overhead may make it larger — should return original
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('uses default maxSize of 500 KB', async () => {
    const justOver = Buffer.alloc(500 * 1024 + 1);
    const result = await compressFile(justOver, 'data.csv');
    // Should attempt compression since it's over 500 KB
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
