import { inflateRawSync } from 'node:zlib';
import { TextDecoder } from 'node:util';
import { AttachmentError, MAX_FILE_SIZE, TYPES } from './policy.js';

const MAX_ENTRIES = 512;
const MAX_ENTRY = 8 * 1024 * 1024;
const MAX_EXPANDED = 32 * 1024 * 1024;
const utf8 = new TextDecoder('utf-8', { fatal: true });
const crcTable = Array.from({ length: 256 }, (_, n) => {
  for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function reject() {
  throw new AttachmentError('Invalid, unsafe, or excessively compressed Office archive.', 415);
}
function check(condition) {
  if (!condition) reject();
}

// Inspect central and local records; never extract paths onto disk. Every inflate
// has an explicit output cap, including archives that lie about expanded sizes.
export function validateOfficeArchive(buffer, extension) {
  try {
    check(buffer.length >= 22 && buffer.length <= MAX_FILE_SIZE);
    let end = buffer.length - 22;
    const first = Math.max(0, end - 65535);
    while (end >= first && buffer.readUInt32LE(end) !== 0x06054b50) end--;
    check(end >= first && end + 22 + buffer.readUInt16LE(end + 20) === buffer.length);
    check(buffer.readUInt16LE(end + 4) === 0 && buffer.readUInt16LE(end + 6) === 0);
    const count = buffer.readUInt16LE(end + 10);
    check(count > 0 && count <= MAX_ENTRIES && count === buffer.readUInt16LE(end + 8));
    const directorySize = buffer.readUInt32LE(end + 12);
    const directoryStart = buffer.readUInt32LE(end + 16);
    check(directoryStart + directorySize === end);
    const entries = new Map();
    const names = new Set();
    const spans = [];
    let position = directoryStart;
    let total = 0;
    for (let index = 0; index < count; index++) {
      check(position + 46 <= end && buffer.readUInt32LE(position) === 0x02014b50);
      const flags = buffer.readUInt16LE(position + 8);
      const method = buffer.readUInt16LE(position + 10);
      const checksum = buffer.readUInt32LE(position + 16);
      const compressed = buffer.readUInt32LE(position + 20);
      const expanded = buffer.readUInt32LE(position + 24);
      const nameSize = buffer.readUInt16LE(position + 28);
      const extraSize = buffer.readUInt16LE(position + 30);
      const commentSize = buffer.readUInt16LE(position + 32);
      const mode = buffer.readUInt32LE(position + 38) >>> 16;
      const offset = buffer.readUInt32LE(position + 42);
      check((flags & ~0x808) === 0 && [0, 8].includes(method));
      check(buffer.readUInt16LE(position + 34) === 0 && (mode & 0xf000) !== 0xa000);
      check(
        nameSize > 0 && nameSize <= 240 && position + 46 + nameSize + extraSize + commentSize <= end
      );
      const nameBytes = buffer.subarray(position + 46, position + 46 + nameSize);
      const name = utf8.decode(nameBytes);
      const lower = name.toLowerCase();
      check(!names.has(lower) && !/[\\%:\x00-\x1f\x7f]/.test(name) && !name.startsWith('/'));
      check(!name.split('/').some((part) => part === '.' || part === '..' || !part));
      check(!/vba|macro|activex|embeddings|externallinks|customui/i.test(name));
      check(/\.(xml|rels|png|jpe?g|webp)$/i.test(name));
      names.add(lower);
      total += expanded;
      check(
        expanded <= MAX_ENTRY && total <= MAX_EXPANDED && expanded <= Math.max(1, compressed) * 100
      );
      check(offset + 30 <= directoryStart && buffer.readUInt32LE(offset) === 0x04034b50);
      check(
        buffer.readUInt16LE(offset + 6) === flags && buffer.readUInt16LE(offset + 8) === method
      );
      const localNameSize = buffer.readUInt16LE(offset + 26);
      const localExtraSize = buffer.readUInt16LE(offset + 28);
      const start = offset + 30 + localNameSize + localExtraSize;
      check(
        localNameSize === nameSize &&
          nameBytes.equals(buffer.subarray(offset + 30, offset + 30 + localNameSize))
      );
      check(start + compressed <= directoryStart);
      let finish = start + compressed;
      if (flags & 8) {
        check(finish + 12 <= directoryStart);
        if (buffer.readUInt32LE(finish) === 0x08074b50) finish += 4;
        check(
          finish + 12 <= directoryStart &&
            buffer.readUInt32LE(finish) === checksum &&
            buffer.readUInt32LE(finish + 4) === compressed &&
            buffer.readUInt32LE(finish + 8) === expanded
        );
        finish += 12;
      } else {
        check(
          buffer.readUInt32LE(offset + 14) === checksum &&
            buffer.readUInt32LE(offset + 18) === compressed &&
            buffer.readUInt32LE(offset + 22) === expanded
        );
      }
      spans.push([offset, finish]);
      const source = buffer.subarray(start, start + compressed);
      let data = source;
      if (method === 8) {
        const inflated = inflateRawSync(source, {
          maxOutputLength: Math.max(1, expanded),
          info: true,
        });
        check(inflated.engine.bytesWritten === compressed);
        data = inflated.buffer;
      }
      check(data.length === expanded && crc32(data) === checksum);
      if (/\.(xml|rels)$/i.test(name)) {
        const xml = utf8.decode(data);
        check(
          !/<!DOCTYPE|<!ENTITY|macroEnabled|vbaProject|oleObject|attachedTemplate|TargetMode\s*=\s*["']External["']/i.test(
            xml
          )
        );
        entries.set(name, xml);
      }
      position += 46 + nameSize + extraSize + commentSize;
    }
    check(position === end);
    spans.sort((a, b) => a[0] - b[0]);
    let boundary = 0;
    for (const [start, finish] of spans) {
      check(start === boundary);
      boundary = finish;
    }
    check(boundary === directoryStart);
    const main = extension === 'docx' ? 'word/document.xml' : 'xl/workbook.xml';
    const mainMime =
      extension === 'docx'
        ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml';
    const types = entries.get('[Content_Types].xml');
    const relationships = entries.get('_rels/.rels');
    check(Boolean(types && relationships && entries.has(main)));
    // The declared main part must match the extension, not just occur somewhere.
    const overrides = types.match(/<Override\b[^>]*\/>/g) || [];
    check(
      overrides.some(
        (tag) => tag.includes(`PartName="/${main}"`) && tag.includes(`ContentType="${mainMime}"`)
      )
    );
    check(relationships.includes(`Target="${main}"`) && relationships.includes('/officeDocument'));
    check(!types.includes(extension === 'docx' ? TYPES.xlsx : TYPES.docx));
    return true;
  } catch (error) {
    if (error instanceof AttachmentError) throw error;
    reject();
  }
}
