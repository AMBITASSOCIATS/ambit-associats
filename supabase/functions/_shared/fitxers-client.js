// supabase/functions/_shared/fitxers-client.js
//
// Àrea de client · fitxers dels enviaments: tipus admesos, mides i
// comprovació del contingut real (no només l'extensió ni el tipus que diu el
// navegador). Sense ZIP ni executables.
//
//   PDF   %PDF-, sense accions d'executar (/Launch) ni fitxers incrustats
//   JPG   FF D8 FF
//   PNG   89 50 4E 47 0D 0A 1A 0A
//   DOCX  paquet Office (ZIP) amb [Content_Types].xml i word/document.xml
//   XLSX  paquet Office (ZIP) amb [Content_Types].xml i xl/workbook.xml
//         (tots dos: sense macros, ActiveX, objectes OLE ni fitxers executables o comprimits a dins, ni xifrats)
//   DOC   document compost OLE2 amb el flux WordDocument
//   XLS   document compost OLE2 amb el flux Workbook (o Book)
//         (tots dos: sense macros ni paquets OLE incrustats)
//   CSV   text (UTF-8 o Windows-1252), sense caràcters de control binaris
// Cap fitxer pot començar amb la signatura d'un executable (MZ, ELF, Mach-O, #!).
//
// Mòdul JavaScript sense dependències: el fan servir l'Edge Function
// portal-client-area i les proves (Node).

export const TIPUS = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  csv: 'text/csv',
};

export const MAX_FITXER = 20 * 1024 * 1024;      // 20 MB per fitxer
export const MAX_ENVIAMENT = 100 * 1024 * 1024;  // 100 MB per enviament
export const MAX_FITXERS = 20;

export const extensio = (nom) => {
  const m = String(nom || '').toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m && TIPUS[m[1]] ? m[1] : null;
};

// Nom per mostrar: sense camins ni caràcters de control, màxim 200 caràcters
// (conservant l'extensió).
export const nomNet = (nom) => {
  const net = String(nom || '').split(/[\\/]/).pop()
    .replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim();
  if (net.length <= 200) return net;
  const ext = net.match(/\.[A-Za-z0-9]{1,5}$/)?.[0] || '';
  return net.slice(0, 200 - ext.length) + ext;
};

const comenca = (b, sig, des = 0) => sig.every((x, i) => b[des + i] === x);
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

const EXECUTABLE = [
  [0x4d, 0x5a],                 // MZ (Windows)
  [0x7f, 0x45, 0x4c, 0x46],     // ELF
  [0xfe, 0xed, 0xfa, 0xce], [0xfe, 0xed, 0xfa, 0xcf], [0xce, 0xfa, 0xed, 0xfe], [0xcf, 0xfa, 0xed, 0xfe],
  [0xca, 0xfe, 0xba, 0xbe],     // Mach-O
  [0x23, 0x21],                 // #! (script)
];

const ZIP = [0x50, 0x4b, 0x03, 0x04];
const OLE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

// ─── ZIP (paquets Office): noms del directori central ───────────────────────
const entradesZip = (b) => {
  const inici = Math.max(0, b.length - 65557);
  let eocd = -1;
  for (let i = b.length - 22; i >= inici; i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const total = u16(b, eocd + 10);
  let o = u32(b, eocd + 16);
  if (total === 0xffff || o === 0xffffffff || total > 20000) return null;  // ZIP64 o massa entrades
  const noms = [];
  for (let n = 0; n < total; n++) {
    if (o + 46 > b.length || u32(b, o) !== 0x02014b50) return null;
    const flags = u16(b, o + 8);
    const lNom = u16(b, o + 28);
    const lExtra = u16(b, o + 30);
    const lComent = u16(b, o + 32);
    if (o + 46 + lNom > b.length) return null;
    const nom = new TextDecoder('utf-8').decode(b.subarray(o + 46, o + 46 + lNom));
    noms.push({ nom, xifrat: (flags & 1) === 1 });
    o += 46 + lNom + lExtra + lComent;
  }
  return noms;
};

const PROHIBITS_OFFICE = [
  /(^|\/)vbaProject\.bin$/i,
  /(^|\/)vbaData\.xml$/i,
  /(^|\/)activeX\//i,
  /(^|\/)oleObject[^/]*\.bin$/i,
  /\.(exe|dll|com|bat|cmd|scr|pif|cpl|msi|msp|jar|js|jse|vbs|vbe|wsf|wsh|ps1|psm1|hta|lnk|sh|app|dmg|zip|rar|7z|gz|tar|iso)$/i,
];

const comprovaOffice = (b, principal) => {
  const entrades = entradesZip(b);
  if (!entrades) return 'El fitxer no és un document Office vàlid / The file is not a valid Office document';
  if (entrades.some((e) => e.xifrat)) return 'El fitxer està xifrat / The file is encrypted';
  const noms = entrades.map((e) => e.nom);
  if (!noms.includes('[Content_Types].xml') || !noms.includes(principal)) return 'El fitxer no és un document Office vàlid / The file is not a valid Office document';
  if (noms.some((n) => PROHIBITS_OFFICE.some((r) => r.test(n)))) return 'El fitxer conté macros, objectes o fitxers no admesos / The file contains macros, objects or files that are not accepted';
  return null;
};

// ─── OLE2 (DOC i XLS): noms del directori ───────────────────────────────────
const nomsOle = (b) => {
  if (b.length < 512) return null;
  const desplSector = u16(b, 0x1e);
  if (desplSector !== 9 && desplSector !== 12) return null;
  const mida = 1 << desplSector;
  const sector = (n) => 512 + n * mida;  // inici del sector n
  // Taula FAT: sectors llistats al DIFAT (109 a la capçalera i la resta encadenats)
  const sectorsFat = [];
  for (let i = 0; i < 109; i++) {
    const s = u32(b, 0x4c + i * 4);
    if (s < 0xfffffffa) sectorsFat.push(s);
  }
  let difat = u32(b, 0x44);
  for (let guarda = 0; difat < 0xfffffffa && guarda < 1000; guarda++) {
    const o = sector(difat);
    if (o + mida > b.length) return null;
    for (let i = 0; i < mida / 4 - 1; i++) {
      const s = u32(b, o + i * 4);
      if (s < 0xfffffffa) sectorsFat.push(s);
    }
    difat = u32(b, o + mida - 4);
  }
  const seguent = (s) => {
    const perSector = mida / 4;
    const f = sectorsFat[Math.floor(s / perSector)];
    if (f === undefined) return 0xfffffffe;
    const o = sector(f) + (s % perSector) * 4;
    return o + 4 <= b.length ? u32(b, o) : 0xfffffffe;
  };
  const noms = [];
  let s = u32(b, 0x30);
  for (let guarda = 0; s < 0xfffffffa && guarda < 10000; guarda++) {
    const o = sector(s);
    if (o + mida > b.length) return null;
    for (let e = 0; e < mida / 128; e++) {
      const oe = o + e * 128;
      const l = u16(b, oe + 0x40);
      if (l >= 2 && l <= 64) {
        let nom = '';
        for (let i = 0; i < l - 2; i += 2) nom += String.fromCharCode(u16(b, oe + i));
        noms.push(nom);
      }
    }
    s = seguent(s);
  }
  return noms;
};

const PROHIBITS_OLE = ['_VBA_PROJECT_CUR', '_VBA_PROJECT', 'VBA', 'Macros', '\u0001Ole10Native'];

const comprovaOle = (b, fluxos) => {
  if (!comenca(b, OLE)) return 'El fitxer no és un document vàlid / The file is not a valid document';
  const noms = nomsOle(b);
  if (!noms) return 'El fitxer no és un document vàlid / The file is not a valid document';
  if (!fluxos.some((f) => noms.includes(f))) return 'El fitxer no és un document vàlid / The file is not a valid document';
  if (noms.some((n) => PROHIBITS_OLE.includes(n))) return 'El fitxer conté macros o objectes no admesos / The file contains macros or objects that are not accepted';
  return null;
};

// ─── PDF ────────────────────────────────────────────────────────────────────
const comprovaPdf = (b) => {
  if (!comenca(b, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'El fitxer no és un PDF vàlid / The file is not a valid PDF';
  const text = new TextDecoder('latin1').decode(b);
  if (/\/Launch\b/.test(text) || /\/EmbeddedFiles?\b/.test(text)) return 'El PDF conté accions o fitxers incrustats no admesos / The PDF contains actions or embedded files that are not accepted';
  return null;
};

// ─── CSV ────────────────────────────────────────────────────────────────────
const comprovaCsv = (b) => {
  if (comenca(b, ZIP) || comenca(b, OLE) || comenca(b, [0x25, 0x50, 0x44, 0x46])) return 'El fitxer no és un CSV / The file is not a CSV';
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return 'El fitxer no és un CSV de text / The file is not a text CSV';
  }
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    // Windows-1252: qualsevol byte ≥ 0x20 és vàlid (els de control ja s'han rebutjat)
  }
  return null;
};

// Retorna null si el contingut correspon a l'extensió, o el motiu del rebuig (català / anglès).
export const comprovaContingut = (ext, bytes) => {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (b.length === 0) return 'El fitxer és buit / The file is empty';
  if (b.length > MAX_FITXER) return 'El fitxer supera els 20 MB / The file exceeds 20 MB';
  if (EXECUTABLE.some((sig) => comenca(b, sig))) return 'Els fitxers executables no s\'admeten / Executable files are not accepted';
  switch (ext) {
    case 'pdf': return comprovaPdf(b);
    case 'jpg':
    case 'jpeg': return comenca(b, [0xff, 0xd8, 0xff]) ? null : 'El fitxer no és una imatge JPG vàlida / The file is not a valid JPG image';
    case 'png': return comenca(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? null : 'El fitxer no és una imatge PNG vàlida / The file is not a valid PNG image';
    case 'docx': return comenca(b, ZIP) ? comprovaOffice(b, 'word/document.xml') : 'El fitxer no és un document Word vàlid / The file is not a valid Word document';
    case 'xlsx': return comenca(b, ZIP) ? comprovaOffice(b, 'xl/workbook.xml') : 'El fitxer no és un full Excel vàlid / The file is not a valid Excel workbook';
    case 'doc': return comprovaOle(b, ['WordDocument']);
    case 'xls': return comprovaOle(b, ['Workbook', 'Book']);
    case 'csv': return comprovaCsv(b);
    default: return 'Tipus de fitxer no admès / File type not accepted';
  }
};
