// Fitxers de prova per a l'àrea de client: PDF, PNG, JPG, CSV, paquets Office
// (ZIP sense comprimir) i documents compostos OLE2 (DOC i XLS) mínims però
// reals, i codis TOTP (RFC 6238) per al segon factor.

import { createHmac } from 'node:crypto';
import { deflateSync } from 'node:zlib';

const crc32 = (buf) => {
  let c, v = 0xffffffff;
  for (const b of buf) { c = (v ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; v = (v >>> 8) ^ c; }
  return (v ^ 0xffffffff) >>> 0;
};

export const pdf = (extra = '') => Buffer.from(
  `%PDF-1.4\n1 0 obj << /Type /Catalog /Pages 2 0 R ${extra} >> endobj\n2 0 obj << /Type /Pages /Kids [] /Count 0 >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`, 'latin1');

export const png = () => {
  const w = 4, h = 4;
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.alloc((w * 4 + 1) * h))), chunk('IEND', Buffer.alloc(0))]);
};

export const jpg = () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]), Buffer.from('JFIF\0'), Buffer.alloc(32), Buffer.from([0xff, 0xd9])]);

export const csv = (text = 'nom;import\nProva;12,50\n') => Buffer.from(text, 'utf8');

// ZIP sense comprimir (com un paquet Office). xifrat: marca el bit de xifratge.
export const zip = (entrades, { xifrat = false } = {}) => {
  const locals = [];
  const centrals = [];
  let desp = 0;
  for (const e of entrades) {
    const nom = Buffer.from(e.nom, 'utf8');
    const dades = Buffer.isBuffer(e.dades) ? e.dades : Buffer.from(e.dades ?? '', 'utf8');
    const crc = crc32(dades);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0); l.writeUInt16LE(20, 4); l.writeUInt16LE(xifrat ? 1 : 0, 6);
    l.writeUInt32LE(crc, 14); l.writeUInt32LE(dades.length, 18); l.writeUInt32LE(dades.length, 22); l.writeUInt16LE(nom.length, 26);
    locals.push(l, nom, dades);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(xifrat ? 1 : 0, 8);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(dades.length, 20); c.writeUInt32LE(dades.length, 24); c.writeUInt16LE(nom.length, 28);
    c.writeUInt32LE(desp, 42);
    centrals.push(c, nom);
    desp += 30 + nom.length + dades.length;
  }
  const dir = Buffer.concat(centrals);
  const fi = Buffer.alloc(22);
  fi.writeUInt32LE(0x06054b50, 0); fi.writeUInt16LE(entrades.length, 8); fi.writeUInt16LE(entrades.length, 10);
  fi.writeUInt32LE(dir.length, 12); fi.writeUInt32LE(desp, 16);
  return Buffer.concat([...locals, dir, fi]);
};

const TIPUS_XML = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>';
export const docx = (altres = []) => zip([
  { nom: '[Content_Types].xml', dades: TIPUS_XML },
  { nom: '_rels/.rels', dades: '<Relationships/>' },
  { nom: 'word/document.xml', dades: '<w:document><w:body><w:p><w:r><w:t>Prova</w:t></w:r></w:p></w:body></w:document>' },
  ...altres,
]);
export const xlsx = (altres = []) => zip([
  { nom: '[Content_Types].xml', dades: TIPUS_XML },
  { nom: '_rels/.rels', dades: '<Relationships/>' },
  { nom: 'xl/workbook.xml', dades: '<workbook><sheets><sheet name="Full1" sheetId="1"/></sheets></workbook>' },
  ...altres,
]);

// Document compost OLE2 mínim: capçalera, un sector de FAT i un de directori
// (fins a 3 entrades a més de la Root Entry)
export const ole = (noms) => {
  const S = 512;
  const cap = Buffer.alloc(512, 0);
  Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]).copy(cap, 0);
  cap.writeUInt16LE(0x3e, 0x18); cap.writeUInt16LE(3, 0x1a); cap.writeUInt16LE(0xfffe, 0x1c);
  cap.writeUInt16LE(9, 0x1e); cap.writeUInt16LE(6, 0x20);
  cap.writeUInt32LE(1, 0x2c);            // un sector de FAT
  cap.writeUInt32LE(1, 0x30);            // directori al sector 1
  cap.writeUInt32LE(4096, 0x38);
  cap.writeUInt32LE(0xfffffffe, 0x3c); cap.writeUInt32LE(0, 0x40);
  cap.writeUInt32LE(0xfffffffe, 0x44); cap.writeUInt32LE(0, 0x48);
  for (let i = 0; i < 109; i++) cap.writeUInt32LE(i === 0 ? 0 : 0xffffffff, 0x4c + i * 4);
  const fat = Buffer.alloc(S, 0xff);
  fat.writeUInt32LE(0xfffffffd, 0); fat.writeUInt32LE(0xfffffffe, 4);
  const dir = Buffer.alloc(S, 0);
  ['Root Entry', ...noms].slice(0, 4).forEach((nom, i) => {
    const o = i * 128;
    const n = Buffer.from(nom + '\0', 'utf16le');
    n.copy(dir, o);
    dir.writeUInt16LE(n.length, o + 0x40);
    dir[o + 0x42] = i === 0 ? 5 : 2;
  });
  return Buffer.concat([cap, fat, dir]);
};
export const doc = (altres = []) => ole(['WordDocument', ...altres]);
export const xls = (altres = []) => ole(['Workbook', ...altres]);

export const exe = () => Buffer.concat([Buffer.from('MZ'), Buffer.alloc(200)]);

// ─── TOTP (RFC 6238, SHA-1, 6 xifres, 30 s) ─────────────────────────────────
const deBase32 = (s) => {
  const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const c of s.replace(/=+$/, '').toUpperCase()) bits += a.indexOf(c).toString(2).padStart(5, '0');
  const out = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
};
export const totp = (secret, t = Date.now()) => {
  const c = Buffer.alloc(8);
  c.writeBigUInt64BE(BigInt(Math.floor(t / 30000)));
  const h = createHmac('sha1', deBase32(secret)).update(c).digest();
  const o = h[h.length - 1] & 15;
  return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, '0');
};
