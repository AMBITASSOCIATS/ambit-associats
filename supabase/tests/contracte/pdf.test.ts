// Proves del PDF del contracte (Deno): comprovació de l'original, original
// intacte dins del PDF final, pàgines idèntiques, idioma de les pàgines
// afegides i textos literals. Genera també els PDF d'exemple.
//
// Execució:
//   deno run -A supabase/tests/contracte/pdf.test.ts [carpeta-per-als-pdf]
// Requisits opcionals (si hi són, es fan servir): qpdf, pdftoppm, pdftotext.
// Totes les dades són fictícies.

import { PDFDocument, StandardFonts, rgb } from 'npm:pdf-lib@1.17.1';
import { comprovaOriginal, MAX_ORIGINAL } from '../../functions/_shared/contracte-regles.ts';
import { generaPdfContracte, VERSIO_CONTRACTE, type DadesContractePdf } from '../../functions/_shared/pdf-contracte.ts';
import T from '../../functions/_shared/text-contracte.json' with { type: 'json' };

const CARPETA = Deno.args[0] || null;
const TMP = await Deno.makeTempDir({ prefix: 'contracte-pdf-' });

let fallades = 0;
let total = 0;
const comprova = (cond: boolean, nom: string) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t: string) => console.log(`\n── ${t} ──`);
const sha256 = async (b: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', b)), (x) => x.toString(16).padStart(2, '0')).join('');
const hiHa = async (eina: string) => {
  try { return (await new Deno.Command('which', { args: [eina], stdout: 'null', stderr: 'null' }).output()).success; } catch { return false; }
};
const executa = async (eina: string, args: string[]) => {
  const r = await new Deno.Command(eina, { args, stdout: 'piped', stderr: 'piped' }).output();
  return { ok: r.success, codi: r.code, out: new TextDecoder().decode(r.stdout), err: new TextDecoder().decode(r.stderr) };
};
const normal = (s: string) => s.replace(/\s+/g, ' ').trim();

// ─── PNG d'una firma de prova (traç blau sobre fons transparent) ────────────
const crc32 = (() => {
  const taula = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; taula[n] = c >>> 0; }
  return (b: Uint8Array) => { let c = 0xffffffff; for (const x of b) c = taula[(c ^ x) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();
const deflate = async (b: Uint8Array) => new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
const firmaPng = async (llavor: number): Promise<Uint8Array> => {
  const w = 600, h = 200;
  const px = new Uint8Array(h * (1 + w * 4));
  const punt = (x: number, y: number) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = Math.round(x + dx), yy = Math.round(y + dy);
      if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
      const o = yy * (1 + w * 4) + 1 + xx * 4;
      px[o] = 0x1a; px[o + 1] = 0x2b; px[o + 2] = 0x5a; px[o + 3] = 255;
    }
  };
  for (let x = 40; x < 560; x += 0.5) punt(x, 100 + 45 * Math.sin((x + llavor * 37) / (28 + llavor * 3)) * Math.cos(x / 90));
  const chunk = (tipus: string, dades: Uint8Array) => {
    const out = new Uint8Array(12 + dades.length);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, dades.length);
    out.set(new TextEncoder().encode(tipus), 4);
    out.set(dades, 8);
    dv.setUint32(8 + dades.length, crc32(out.subarray(4, 8 + dades.length)));
    return out;
  };
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, w); dv.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 6;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', await deflate(px)), chunk('IEND', new Uint8Array())];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

// ─── Contracte de prova de 3 pàgines ────────────────────────────────────────
const contracteProva = async (): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  pdf.setTitle('Contracte de prestació de serveis (prova)');
  const f = await pdf.embedFont(StandardFonts.TimesRoman);
  const b = await pdf.embedFont(StandardFonts.TimesRomanBold);
  const clausules = [
    ['CONTRACTE DE PRESTACIÓ DE SERVEIS (DOCUMENT DE PROVA)', 'A Andorra la Vella. REUNITS, d’una part, Client de Prova, SL, i, de l’altra, DEL SOTO – PALEARI & ASSOCIATS, SL. Les parts es reconeixen capacitat per signar aquest contracte.'],
    ['Primera. Objecte', 'L’objecte d’aquest contracte de prova és la prestació de serveis d’assessorament comptable i fiscal. Totes les dades són fictícies i només serveixen per comprovar el portal de signatura.'],
    ['Segona. Durada i honoraris', 'El contracte té una durada d’un any. Els honoraris de prova són de 100 euros mensuals. Pàgina final del contracte de prova.'],
  ];
  clausules.forEach(([titol, text], i) => {
    const p = pdf.addPage([595.28, 841.89]);
    p.drawText(titol, { x: 60, y: 770, size: 14, font: b });
    let y = 740;
    const paraules = text.split(' ');
    let linia = '';
    for (const w of paraules) {
      if (f.widthOfTextAtSize(`${linia} ${w}`, 12) > 470) { p.drawText(linia, { x: 60, y, size: 12, font: f }); y -= 18; linia = w; } else linia = linia ? `${linia} ${w}` : w;
    }
    p.drawText(linia, { x: 60, y, size: 12, font: f });
    p.drawRectangle({ x: 60, y: 100, width: 470, height: 1, color: rgb(0.5, 0.5, 0.5) });
    p.drawText(`Pàgina ${i + 1} de 3`, { x: 480, y: 80, size: 9, font: f });
  });
  return await pdf.save({ useObjectStreams: true });
};

const original = await contracteProva();
const shaOriginal = await sha256(original);

// ═══ 1. Comprovació del PDF original ════════════════════════════════════════
seccio('Comprovació del PDF original');
{
  const r = await comprovaOriginal(original);
  comprova(r.ok && r.pagines === 3, 'Un PDF vàlid de 3 pàgines s\'accepta (3 pàgines)');
  const noPdf = await comprovaOriginal(new TextEncoder().encode('Això no és cap PDF, és un fitxer de text.'));
  comprova(!noPdf.ok && noPdf.codi === 'no_pdf', 'Un fitxer que no és PDF es rebutja');
  const malmes = await comprovaOriginal(new TextEncoder().encode('%PDF-1.7\n1 0 obj << /Type /Catalog >> endobj\nbrossa sense xref'));
  comprova(!malmes.ok && malmes.codi === 'no_valid', 'Un PDF malmès (sense estructura vàlida) es rebutja');
  const truncat = await comprovaOriginal(original.subarray(0, Math.floor(original.length / 2)));
  comprova(!truncat.ok, 'Un PDF tallat per la meitat es rebutja');
  const buit = await comprovaOriginal(new Uint8Array());
  comprova(!buit.ok && buit.codi === 'buit', 'Un fitxer buit es rebutja');
  const gran = new Uint8Array(MAX_ORIGINAL + 1);
  gran.set(original);
  const massa = await comprovaOriginal(gran);
  comprova(!massa.ok && massa.codi === 'mida', 'Un PDF de més de 20 MB es rebutja');
  if (await hiHa('qpdf')) {
    Deno.writeFileSync(`${TMP}/net.pdf`, original);
    await executa('qpdf', ['--encrypt', 'usuari', 'propietari', '256', '--', `${TMP}/net.pdf`, `${TMP}/contrasenya.pdf`]);
    await executa('qpdf', ['--encrypt', '', 'propietari', '256', '--', `${TMP}/net.pdf`, `${TMP}/xifrat.pdf`]);
    await executa('qpdf', ['--allow-weak-crypto', '--encrypt', '', 'propietari', '128', '--use-aes=n', '--', `${TMP}/net.pdf`, `${TMP}/xifrat-rc4.pdf`]);
    const c1 = await comprovaOriginal(Deno.readFileSync(`${TMP}/contrasenya.pdf`));
    comprova(!c1.ok && c1.codi === 'xifrat', 'Un PDF amb contrasenya d\'obertura es rebutja');
    const c2 = await comprovaOriginal(Deno.readFileSync(`${TMP}/xifrat.pdf`));
    comprova(!c2.ok && c2.codi === 'xifrat', 'Un PDF xifrat sense contrasenya d\'obertura (només de permisos, AES-256) es rebutja');
    const c3 = await comprovaOriginal(Deno.readFileSync(`${TMP}/xifrat-rc4.pdf`));
    comprova(!c3.ok && c3.codi === 'xifrat', 'Un PDF xifrat amb RC4 de 128 bits es rebutja');
    // Altres estructures de PDF habituals: taula clàssica, linealitzat i amb fluxos d'objectes
    await executa('qpdf', ['--object-streams=disable', `${TMP}/net.pdf`, `${TMP}/classic.pdf`]);
    await executa('qpdf', ['--linearize', `${TMP}/net.pdf`, `${TMP}/linealitzat.pdf`]);
    for (const n of ['classic', 'linealitzat']) {
      const r2 = await comprovaOriginal(Deno.readFileSync(`${TMP}/${n}.pdf`));
      comprova(r2.ok && r2.pagines === 3, `PDF ${n === 'classic' ? 'amb taula de referències clàssica' : 'linealitzat'}: s'accepta`);
    }
  } else {
    console.log('       (sense qpdf: no es proven els PDF xifrats)');
  }
}

// ═══ 2. PDF final ═══════════════════════════════════════════════════════════
const [f1, f2, fAmbit] = await Promise.all([firmaPng(1), firmaPng(2), firmaPng(3)]);
const ara = Date.now();
const signant = async (ordre: number, nom: string, qualitat: string, lloc: string, png: Uint8Array, desfase: number) => ({
  ordre, nom, qualitat, lloc,
  acceptatAt: new Date(ara - desfase - 60_000), signatAt: new Date(ara - desfase),
  ip: `198.51.100.${10 + ordre}`, userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15',
  empremtaDades: await sha256(new TextEncoder().encode(`dades-${ordre}-${nom}`)), png, sha256: await sha256(png),
});
const comuns = {
  titol: 'Contracte de prestació de serveis 2026 (prova)',
  templateVersion: VERSIO_CONTRACTE,
  original: { nomFitxer: 'Contracte-serveis-prova.pdf', pagines: 3, sha256: shaOriginal, mida: original.length },
  ambit: { nom: 'Martín Paleari', carrec: 'Administrador solidari', signatAt: new Date(ara), imatge: fAmbit, sha256: await sha256(fAmbit) },
};
const dadesCa: DadesContractePdf = {
  ...comuns, requestId: '0e8f5a52-4c1d-4b8e-9a51-1f0d6b2c3a01', idioma: 'ca', clientNom: 'Client de Prova Persona', partyType: 'pf',
  signants: [await signant(1, 'Carla Prova Exemple', 'En nom propi', 'Andorra la Vella', f1, 3_600_000)],
};
const dadesBi: DadesContractePdf = {
  ...comuns, requestId: '7b3c2d10-9e4f-4a6b-8c7d-2e1f0a9b8c02', idioma: 'ca_en', clientNom: 'Client de Prova, SL', partyType: 'pj',
  signants: [
    await signant(1, 'Anna Prova Primera', 'En nom i representació de Client de Prova, SL, com a administradora', 'Escaldes-Engordany', f1, 7_200_000),
    await signant(2, 'Bernat Prova Segon', 'En nom propi', 'Andorra la Vella', f2, 3_600_000),
  ],
};

const pdfCa = await generaPdfContracte(original, dadesCa);
const pdfBi = await generaPdfContracte(original, dadesBi);
Deno.writeFileSync(`${TMP}/original.pdf`, original);
Deno.writeFileSync(`${TMP}/ca.pdf`, pdfCa);
Deno.writeFileSync(`${TMP}/bi.pdf`, pdfBi);
if (CARPETA) {
  await Deno.mkdir(CARPETA, { recursive: true });
  Deno.writeFileSync(`${CARPETA}/contracte-prova-original.pdf`, original);
  Deno.writeFileSync(`${CARPETA}/contracte-prova-1-signant-catala.pdf`, pdfCa);
  Deno.writeFileSync(`${CARPETA}/contracte-prova-2-signants-bilingue.pdf`, pdfBi);
}

for (const [nom, pdf, d] of [['Català, 1 signant', pdfCa, dadesCa], ['Català i anglès, 2 signants', pdfBi, dadesBi]] as const) {
  seccio(`PDF final · ${nom}`);
  const prefix = pdf.subarray(0, original.length);
  comprova(prefix.every((v, i) => v === original[i]), 'Els bytes del PDF original són intactes al principi del PDF final');
  comprova(await sha256(prefix) === shaOriginal, 'Els primers N bytes tenen la mateixa empremta SHA-256 que l\'original');
  comprova(await sha256(original) === shaOriginal, 'L\'original no s\'ha modificat en generar el PDF final');
  const doc = await PDFDocument.load(pdf, { updateMetadata: false });
  const afegides = doc.getPageCount() - 3;
  comprova(afegides >= 3, `Pàgines: les 3 de l'original i ${afegides} d'afegides (clàusula, signatures i evidències)`);
  comprova(doc.getTitle() === 'Contracte de prestació de serveis (prova)', 'Les metadades de l\'original es conserven');
  const fitxer = `${TMP}/${d.idioma}.pdf`;
  Deno.writeFileSync(fitxer, pdf);
  if (await hiHa('qpdf')) {
    const q = await executa('qpdf', ['--check', fitxer]);
    comprova(q.ok && !/WARNING/.test(q.out + q.err), 'qpdf --check: estructura del PDF final correcta, sense avisos');
  }
  if (await hiHa('pdftoppm')) {
    let iguals = true;
    for (let p = 1; p <= 3; p++) {
      await executa('pdftoppm', ['-r', '60', '-f', String(p), '-l', String(p), `${TMP}/original.pdf`, `${TMP}/o${p}`]);
      await executa('pdftoppm', ['-r', '60', '-f', String(p), '-l', String(p), fitxer, `${TMP}/f${d.idioma}${p}`]);
      const a = [...Deno.readDirSync(TMP)].find((e) => e.name.startsWith(`o${p}`) && e.name.endsWith('.ppm'))!.name;
      const b = [...Deno.readDirSync(TMP)].find((e) => e.name.startsWith(`f${d.idioma}${p}`) && e.name.endsWith('.ppm'))!.name;
      if (await sha256(Deno.readFileSync(`${TMP}/${a}`)) !== await sha256(Deno.readFileSync(`${TMP}/${b}`))) iguals = false;
    }
    comprova(iguals, 'Les 3 pàgines de l\'original es veuen idèntiques dins del PDF final (renderitzat píxel a píxel)');
  }
  if (await hiHa('pdftotext')) {
    const afegit = normal((await executa('pdftotext', ['-f', '4', '-l', String(3 + afegides), fitxer, '-'])).out);
    const textOriginal = normal((await executa('pdftotext', ['-f', '1', '-l', '3', fitxer, '-'])).out);
    comprova(textOriginal.includes('Pàgina final del contracte de prova'), 'El text de l\'original hi és sencer');
    comprova(afegit.includes(normal(T.clausula.titol.ca)), 'Títol de la clàusula addicional en català');
    comprova(T.clausula.punts.every((p, i) => afegit.includes(normal(`${i + 1}. ${p.ca}`)) || afegit.includes(normal(p.ca))),
      'Els 4 punts de la clàusula addicional en català, amb el text exacte');
    comprova(afegit.includes(shaOriginal), 'El full d\'evidències porta l\'empremta SHA-256 de l\'original');
    comprova(afegit.includes('Contracte-serveis-prova.pdf') && afegit.includes(d.titol), 'Nom del fitxer original i títol del contracte');
    comprova(d.signants.every((s) => afegit.includes(s.nom) && afegit.includes(s.qualitat) && afegit.includes(s.lloc)),
      'Cada signant: nom, qualitat i lloc');
    comprova(d.signants.every((s) => afegit.includes(s.acceptatAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'))
      && afegit.includes(s.signatAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC'))),
      'Cada signant: data i hora (UTC) de l\'acceptació prèvia i de la signatura');
    comprova(d.signants.every((s) => afegit.includes(s.ip!) && afegit.includes(s.sha256)), 'Cada signant: IP i empremta de la imatge de la firma');
    comprova(afegit.includes('Martín Paleari · Administrador solidari') && afegit.includes('DEL SOTO – PALEARI & ASSOCIATS, SL'),
      'Signatura d\'ÀMBIT: Martín Paleari · Administrador solidari, en nom de DEL SOTO – PALEARI & ASSOCIATS, SL');
    comprova(afegit.includes(d.ambit.signatAt.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC')), 'Data i hora de la signatura d\'ÀMBIT');
    comprova(afegit.includes('CONTRACTE v1'), 'Versió CONTRACTE v1');

    // Paraules angleses dels textos que no surten mai als textos catalans
    const paraules = (s: string) => (s.toLowerCase().match(/[a-zà-ÿ’']{4,}/g) || []);
    const catala = new Set<string>();
    const angles = new Set<string>();
    const recorre = (v: unknown, idioma: string | null) => {
      if (typeof v === 'string') { for (const w of paraules(v)) (idioma === 'en' ? angles : catala).add(w); return; }
      if (Array.isArray(v)) { v.forEach((x) => recorre(x, idioma)); return; }
      if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) recorre(x, k === 'en' ? 'en' : k === 'ca' ? 'ca' : idioma);
    };
    recorre(T, null);
    const nomesAngles = [...angles].filter((w) => !catala.has(w) && !paraules(`${d.titol} ${d.clientNom} ${d.signants.map((s) => `${s.nom} ${s.qualitat} ${s.lloc} ${s.userAgent}`).join(' ')}`).includes(w));
    const trobades = nomesAngles.filter((w) => paraules(afegit).includes(w));
    if (d.idioma === 'ca') {
      comprova(nomesAngles.length > 100 && trobades.length === 0, `Català: cap text en anglès a les pàgines afegides (${nomesAngles.length} paraules comprovades)`);
      if (trobades.length) console.log('       ·', trobades.slice(0, 20).join(', '));
    } else {
      comprova(T.clausula.punts.every((p) => afegit.includes(normal(p.en))), 'Català i anglès: els 4 punts de la clàusula també en anglès, amb el text exacte');
      comprova(afegit.includes(T.clausula.titol.en), 'Català i anglès: títol de la clàusula en anglès');
      comprova(trobades.length > 50, 'Català i anglès: l\'anglès hi és present');
    }
  }
}

seccio('Fitxers');
console.log(`       carpeta temporal: ${TMP}`);
if (CARPETA) console.log(`       PDF d'exemple a: ${CARPETA}`);
console.log(`\n${total - fallades}/${total} correctes`);
Deno.exit(fallades ? 1 : 0);
