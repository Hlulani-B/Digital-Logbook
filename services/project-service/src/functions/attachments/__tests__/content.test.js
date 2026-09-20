import sharp from 'sharp';
import { deflateRawSync } from 'node:zlib';
import { validateContent } from '../content.js';
import { crc32, validateOfficeArchive } from '../archive.js';
import { MAX_FILE_SIZE, TYPES, validateDescriptor } from '../policy.js';
import { createAttachmentStorage } from '../storage.js';

function zip(parts, compressed = false) {
  const locals = [],
    directory = [];
  let offset = 0;
  for (const [filename, source] of Object.entries(parts)) {
    const name = Buffer.from(filename),
      data = Buffer.from(source);
    const payload = compressed ? deflateRawSync(data) : data;
    const local = Buffer.alloc(30),
      central = Buffer.alloc(46);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(compressed ? 8 : 0, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    central.writeUInt32LE(0x02014b50);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(compressed ? 8 : 0, 10);
    central.writeUInt32LE(crc32(data), 16);
    central.writeUInt32LE(payload.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, payload);
    directory.push(central, name);
    offset += local.length + name.length + payload.length;
  }
  const central = Buffer.concat(directory),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(Object.keys(parts).length, 8);
  end.writeUInt16LE(Object.keys(parts).length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, central, end]);
}
function officeParts(extension) {
  const main = extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
  return {
    '[Content_Types].xml': `<Types><Override PartName="/${main}" ContentType="${TYPES[extension]}.main+xml"/></Types>`,
    '_rels/.rels': `<Relationships><Relationship Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="${main}"/></Relationships>`,
    [main]: '<document>Example</document>',
  };
}
const validate = (name, value, mimeType) => {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return validateContent(bytes, { name, mimeType, size: bytes.length }, mimeType);
};

describe('bounded field attachment content validation', () => {
  test.each([
    ['notes.txt', 'plain text'],
    ['data.csv', 'name,value\na,1'],
    ['notes.md', '# Heading\nA paragraph'],
    ['notes.markdown', '*hello*'],
    ['value.json', '{"answer":42}'],
    ['document.pdf', '%PDF-1.7\n1 0 obj\n<< /Type /Catalog >>\nendobj\nstartxref\n0\n%%EOF\n'],
  ])('accepts %s', async (name, bytes) => {
    await expect(validate(name, bytes)).resolves.toMatchObject({ name });
  });
  test.each(['png', 'jpeg', 'webp'])('validates and sanitizes %s images', async (format) => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } })
      .toFormat(format)
      .toBuffer();
    const result = await validate(`image.${format}`, bytes, `image/${format}`);
    expect((await sharp(result.bytes).metadata()).format).toBe(format);
    expect(result.size).toBe(result.bytes.length);
  });
  test.each([
    ['file.exe', 'MZpayload'],
    ['file.html', '<html>bad</html>'],
    ['file.svg', '<svg/>'],
    ['file.txt', '<!doctype html><html>bad</html>'],
    ['file.csv', '<svg/>'],
    ['file.md', '<script>alert(1)</script>'],
    ['file.txt', '#!/bin/sh'],
    ['file.txt', Buffer.from([255, 254])],
    ['file.txt', 'MZrenamed'],
    ['file.png', 'not an image'],
    ['file.json', '{broken}'],
    ['file.pdf', '%PDF-1.7\nforged'],
    ['file.pdf', '%PDF-1.7\n1 0 obj << /J#53 (alert) >> endobj\nstartxref\n0\n%%EOF'],
  ])('rejects unsafe/mismatched %s', async (name, bytes) => {
    await expect(validate(name, bytes)).rejects.toMatchObject({ status: 415 });
  });
  test('rejects declared and actual size or MIME mismatch', async () => {
    expect(() => validateDescriptor({ name: 'a.txt', size: MAX_FILE_SIZE + 1 })).toThrow('10 MiB');
    expect(() => validateDescriptor({ name: 'a.txt', size: 0 })).toThrow('10 MiB');
    expect(() => validateDescriptor({ name: '../a.txt', size: 1 })).toThrow('filename');
    await expect(validate('a.txt', 'x', 'text/html')).rejects.toMatchObject({ status: 415 });
    await expect(
      validateContent(Buffer.from('xx'), { name: 'a.txt', size: 1 })
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      validateContent(Buffer.from('x'), { name: 'a.txt', size: 1 }, 'image/png')
    ).rejects.toMatchObject({ status: 415 });
  });
  test('rejects image dimensions before decode', async () => {
    const image = await sharp({
      create: { width: 4100, height: 4000, channels: 3, background: 'red' },
    })
      .png()
      .toBuffer();
    await expect(validate('huge.png', image)).rejects.toMatchObject({ status: 415 });
  });
  test.each(['docx', 'xlsx'])(
    'accepts bounded %s archives, stored and deflated',
    async (extension) => {
      for (const compress of [false, true]) {
        await expect(
          validate(`test.${extension}`, zip(officeParts(extension), compress))
        ).resolves.toMatchObject({ extension });
      }
    }
  );
  test.each([
    'word/vbaProject.bin',
    'word/activeX/a.xml',
    '../escape.xml',
    '/root.xml',
    'word/embeddings/a.xml',
  ])('rejects unsafe archive part %s', (name) => {
    expect(() =>
      validateOfficeArchive(zip({ ...officeParts('docx'), [name]: 'bad' }), 'docx')
    ).toThrow();
  });
  test('rejects wrong Office type, CRC corruption, archive bombs, and encrypted flags', () => {
    expect(() => validateOfficeArchive(zip(officeParts('xlsx')), 'docx')).toThrow();
    expect(() =>
      validateOfficeArchive(
        zip({ ...officeParts('docx'), 'word/large.xml': 'a'.repeat(100000) }, true),
        'docx'
      )
    ).toThrow();
    const bad = zip(officeParts('docx'));
    bad[50] ^= 1;
    expect(() => validateOfficeArchive(bad, 'docx')).toThrow();
    const encrypted = zip(officeParts('docx'));
    encrypted.writeUInt16LE(1, 6);
    expect(() => validateOfficeArchive(encrypted, 'docx')).toThrow();
    expect(() =>
      validateOfficeArchive(Buffer.concat([Buffer.from('MZ'), zip(officeParts('docx'))]), 'docx')
    ).toThrow();
  });
  test('caps declared output before inflating and rejects malformed archive directories', () => {
    const bomb = zip(officeParts('docx'), true);
    const end = bomb.length - 22,
      central = bomb.readUInt32LE(end + 16);
    bomb.writeUInt32LE(0xffffff00, central + 24);
    expect(() => validateOfficeArchive(bomb, 'docx')).toThrow();
    expect(() => validateOfficeArchive(Buffer.alloc(10), 'docx')).toThrow();
  });
});

describe('private Supabase REST transport (mocked only)', () => {
  const key = '1/11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222.txt';
  const env = {
    SUPABASE_URL: 'https://storage.example.test',
    SUPABASE_SERVICE_ROLE_KEY: 'server-only-test',
  };
  test('uses five-minute signing and a safe download name', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ signedURL: `/object/sign/field-attachments/${key}?token=test` }),
    });
    const storage = createAttachmentStorage({ env, fetchImpl });
    const signed = new URL(await storage.sign(key, 'résumé "1".txt', 'text/plain'));
    expect(signed.searchParams.get('download')).toBe('r_sum_ _1_.txt');
    expect(JSON.parse(fetchImpl.mock.calls[0][1].body)).toEqual({ expiresIn: 300 });
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe('Bearer server-only-test');
    const preview = new URL(await storage.sign(key, 'picture.png', 'image/png'));
    expect(preview.searchParams.has('download')).toBe(false);
  });
  test('uploads bytes without public URLs or overwrites; removes only the exact object', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true });
    const storage = createAttachmentStorage({ env, fetchImpl }),
      bytes = Buffer.from('hello');
    await storage.upload(key, bytes, 'text/plain');
    await storage.remove(key);
    expect(fetchImpl.mock.calls[0][1].body).toBe(bytes);
    expect(fetchImpl.mock.calls[0][1].headers['x-upsert']).toBe('false');
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({ prefixes: [key] });
  });
  test('fails closed without configuration and redacts upstream failures', async () => {
    const fetchImpl = jest.fn().mockRejectedValue(new Error('server-only-test secret'));
    await expect(
      createAttachmentStorage({ env: {}, fetchImpl }).sign(key, 'x.txt', 'text/plain')
    ).rejects.toMatchObject({ status: 503 });
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(createAttachmentStorage({ env, fetchImpl }).remove(key)).rejects.toThrow(
      'Private attachment storage request failed.'
    );
  });
});
