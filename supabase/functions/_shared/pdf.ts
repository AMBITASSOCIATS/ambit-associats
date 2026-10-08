// supabase/functions/_shared/pdf.ts
//
// Genera el PDF signat de l'autorització de càrrec en compte amb el mateix
// disseny que el PDF original "AMBIT-Autoritzacio carrec en compte" (Carlito,
// verd #009B9C, logotip) i un full final d'evidències.
// Els textos surten de text-autoritzacio.json, el mateix fitxer que el
// formulari del client.
//
// Les peces de dibuix (capçalera, peu, barres de secció, camps, caselles i
// full d'evidències) s'exporten: el KYC i la protecció de dades (pdf-kyc.ts)
// fan servir exactament les mateixes.

import { PDFDocument, PDFFont, PDFPage, PDFImage, rgb, RGB } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import T from './text-autoritzacio.json' with { type: 'json' };

export const VERSIO_PLANTILLA = T.versio;

export type DadesPdf = {
  requestId: string;
  referenciaClient: string | null;
  clientNom: string;
  partyType: 'pf' | 'pj';
  titularNom: string;
  titularAdreca: string;
  titularCpPoblacio: string;
  entitat: 'andbank' | 'creand' | 'morabanc';
  iban: string;              // en clar, només per dibuixar-lo; no es desa enlloc
  clientFacturatNom: string | null;
  signatariNom: string;
  signatariCarrec: string | null;
  signantEsAdministrador: boolean | null;
  lloc: string;
  signatAt: Date;
  ip: string | null;
  userAgent: string | null;
  empremtaDades: string;
  signaturaPng: Uint8Array;
  signaturaSha256: string;
  poderSha256: string | null;
  templateVersion: string;
};

// ─── Colors i mides (A4, punts) ─────────────────────────────────────────────
export const VERD = rgb(0, 0x9b / 255, 0x9c / 255);
export const VERD_FOSC = rgb(0, 0x7a / 255, 0x7b / 255);
export const NEGRE = rgb(0.1, 0.1, 0.1);
export const GRIS = rgb(0.42, 0.42, 0.42);
export const GRIS_CLAR = rgb(0.85, 0.88, 0.88);
export const BLANC = rgb(1, 1, 1);
export const CAMP_FONS = rgb(0.984, 0.98, 0.945);
export const CAMP_VORA = rgb(0.76, 0.74, 0.42);

export const AMPLE = 595.28;
export const ALT = 841.89;
export const ESQ = 57;
export const DRE = AMPLE - 53;
export const AMPLE_UTIL = DRE - ESQ;
export const X_CAMP = 214;
// Mida del text de l'autorització i les condicions (com l'original)
const MIDA_CA = 11.6;
const MIDA_EN = 8.7;

export type Fonts = { r: PDFFont; b: PDFFont; i: PDFFont };

export const llegeixActiu = (nom: string) => Deno.readFile(new URL(`./assets/${nom}`, import.meta.url));

// ─── Ajudes de dibuix ───────────────────────────────────────────────────────

// Parteix un text en línies que caben a l'amplada donada.
export const linies = (text: string, font: PDFFont, mida: number, ample: number): string[] => {
  const paraules = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let actual = '';
  for (const p of paraules) {
    const prova = actual ? `${actual} ${p}` : p;
    if (font.widthOfTextAtSize(prova, mida) <= ample || !actual) {
      actual = prova;
    } else {
      out.push(actual);
      actual = p;
    }
  }
  if (actual) out.push(actual);
  // Paraules molt llargues (p. ex. un hash): es tallen per caràcters
  return out.flatMap((l) => {
    if (font.widthOfTextAtSize(l, mida) <= ample) return [l];
    const trossos: string[] = [];
    let t = '';
    for (const c of l) {
      if (font.widthOfTextAtSize(t + c, mida) > ample) { trossos.push(t); t = c; } else t += c;
    }
    if (t) trossos.push(t);
    return trossos;
  });
};

// Paràgraf justificat (com l'original). Retorna la y final.
export const paragraf = (
  page: PDFPage, text: string, x: number, y: number, ample: number,
  font: PDFFont, mida: number, color: RGB, interlinia: number, justificat = true,
): number => {
  const ls = linies(text, font, mida, ample);
  ls.forEach((l, idx) => {
    const ultima = idx === ls.length - 1;
    const paraules = l.split(' ');
    if (!justificat || ultima || paraules.length === 1) {
      page.drawText(l, { x, y, size: mida, font, color });
    } else {
      const ampleParaules = paraules.reduce((s, p) => s + font.widthOfTextAtSize(p, mida), 0);
      const espai = (ample - ampleParaules) / (paraules.length - 1);
      let cx = x;
      for (const p of paraules) {
        page.drawText(p, { x: cx, y, size: mida, font, color });
        cx += font.widthOfTextAtSize(p, mida) + espai;
      }
    }
    y -= interlinia;
  });
  return y;
};

// Text que cap en una amplada: redueix la mida si cal.
export const textAjustat = (
  page: PDFPage, text: string, x: number, y: number, ample: number,
  font: PDFFont, mida: number, color: RGB,
) => {
  let m = mida;
  while (m > 6 && font.widthOfTextAtSize(text, m) > ample) m -= 0.25;
  page.drawText(text, { x, y, size: m, font, color });
};

export const rectArrodonit = (page: PDFPage, x: number, y: number, w: number, h: number, r: number, vora: RGB, gruix: number) => {
  // y és la vora inferior; drawSvgPath fa servir coordenades amb l'eix Y cap avall
  const path = `M ${r} 0 H ${w - r} A ${r} ${r} 0 0 1 ${w} ${r} V ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} ` +
    `H ${r} A ${r} ${r} 0 0 1 0 ${h - r} V ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
  page.drawSvgPath(path, { x, y: y + h, borderColor: vora, borderWidth: gruix });
};

// ─── Peces de la plantilla ──────────────────────────────────────────────────

// Títol en verd a la dreta i subtítol en anglès a sota, en cursiva grisa. Si
// el títol no hi cap al costat del logotip, es redueix la mida.
export const capcalera = (page: PDFPage, f: Fonts, logo: PDFImage, t: { ca: string; en: string } = T.titol) => {
  const h = 42;
  page.drawImage(logo, { x: ESQ + 2, y: ALT - 37 - h, width: h * 2, height: h });
  const titol = t.ca;
  const espai = DRE - (ESQ + 2 + h * 2 + 14);
  let mida = 14;
  while (mida > 9 && f.b.widthOfTextAtSize(titol, mida) > espai) mida -= 0.25;
  page.drawText(titol, { x: DRE - f.b.widthOfTextAtSize(titol, mida), y: ALT - 57, size: mida, font: f.b, color: VERD });
  const sub = t.en;
  let midaSub = 10;
  while (midaSub > 7 && f.i.widthOfTextAtSize(sub, midaSub) > espai) midaSub -= 0.25;
  page.drawText(sub, { x: DRE - f.i.widthOfTextAtSize(sub, midaSub), y: ALT - 73, size: midaSub, font: f.i, color: GRIS });
  page.drawLine({ start: { x: ESQ, y: ALT - 89 }, end: { x: DRE, y: ALT - 89 }, thickness: 1.2, color: VERD });
};

export const peu = (page: PDFPage, f: Fonts, num: number, total: number) => {
  page.drawLine({ start: { x: ESQ, y: 42 }, end: { x: DRE, y: 42 }, thickness: 0.6, color: VERD });
  page.drawText(T.peu[0], { x: ESQ, y: 31, size: 7.2, font: f.r, color: GRIS });
  page.drawText(T.peu[1], { x: ESQ, y: 20, size: 7.2, font: f.r, color: GRIS });
  const pag = `${num}/${total}`;
  page.drawText(pag, { x: DRE - f.r.widthOfTextAtSize(pag, 7.2), y: 20, size: 7.2, font: f.r, color: GRIS });
};

// Barra verda de secció. Retorna la y per sota.
export const seccio = (page: PDFPage, f: Fonts, y: number, ca: string, en: string): number => {
  page.drawRectangle({ x: ESQ, y: y - 20, width: AMPLE_UTIL, height: 20, color: VERD });
  page.drawText(ca, { x: ESQ + 8, y: y - 14, size: 11, font: f.b, color: BLANC });
  page.drawText(en, { x: DRE - 8 - f.i.widthOfTextAtSize(en, 9), y: y - 13.5, size: 9, font: f.i, color: BLANC });
  return y - 20;
};

export const avis = (page: PDFPage, f: Fonts, y: number, ca: string, en: string): number => {
  page.drawText(`${ca}  /  ${en}`, { x: ESQ, y: y - 11, size: 7.5, font: f.i, color: GRIS });
  return y - 16;
};

const filaCreditor = (page: PDFPage, f: Fonts, y: number, ca: string, en: string, valor: string): number => {
  page.drawText(ca, { x: ESQ + 6, y: y - 13, size: 10.5, font: f.r, color: NEGRE });
  page.drawText(`/ ${en}`, { x: ESQ + 10 + f.r.widthOfTextAtSize(ca, 10.5), y: y - 13, size: 8, font: f.i, color: GRIS });
  page.drawText(valor, { x: 277, y: y - 13, size: 10.5, font: f.b, color: NEGRE });
  page.drawLine({ start: { x: ESQ, y: y - 19 }, end: { x: DRE, y: y - 19 }, thickness: 0.5, color: GRIS_CLAR });
  return y - 19;
};

// Etiqueta en dues línies (català en negreta, anglès en cursiva) i camp ple.
export const camp = (
  page: PDFPage, f: Fonts, y: number, ca: string, en: string, valor: string | null,
  opts: { obligatori?: boolean; x?: number; ample?: number; negreta?: boolean } = {},
): number => {
  const { obligatori = true, x = X_CAMP, ample = DRE - X_CAMP, negreta = true } = opts;
  const etq = negreta ? f.b : f.r;
  if (obligatori) page.drawText('*', { x: ESQ + 2, y: y - 12, size: 11, font: f.r, color: NEGRE });
  page.drawText(ca, { x: ESQ + 9, y: y - 12, size: 11, font: etq, color: NEGRE });
  page.drawText(en, { x: ESQ + 9 + (obligatori ? 0 : 0), y: y - 22, size: 7.5, font: f.i, color: GRIS });
  page.drawRectangle({ x, y: y - 19.5, width: ample, height: 19.5, color: CAMP_FONS, borderColor: CAMP_VORA, borderWidth: 0.6 });
  if (valor) textAjustat(page, valor, x + 6, y - 13.5, ample - 12, f.r, 10.5, NEGRE);
  return y - 31.5;
};

export const casella = (page: PDFPage, f: Fonts, x: number, y: number, etiqueta: string, marcada: boolean) => {
  page.drawRectangle({ x, y: y - 14, width: 14, height: 14, color: BLANC, borderColor: CAMP_VORA, borderWidth: 0.8 });
  if (marcada) {
    page.drawLine({ start: { x: x + 3, y: y - 11 }, end: { x: x + 11, y: y - 3 }, thickness: 1.4, color: VERD_FOSC });
    page.drawLine({ start: { x: x + 3, y: y - 3 }, end: { x: x + 11, y: y - 11 }, thickness: 1.4, color: VERD_FOSC });
  }
  page.drawText(etiqueta, { x: x + 20, y: y - 11, size: 11, font: f.r, color: NEGRE });
};

const condicio = (page: PDFPage, f: Fonts, y: number, num: number, ca: string, en: string): number => {
  page.drawText(`${num}.`, { x: ESQ, y: y - 11, size: 11, font: f.r, color: NEGRE });
  let yy = paragraf(page, ca, ESQ + 17, y - 11, AMPLE_UTIL - 17, f.r, MIDA_CA, NEGRE, 14.5);
  yy = paragraf(page, en, ESQ + 17, yy + 2, AMPLE_UTIL - 17, f.i, MIDA_EN, GRIS, 11);
  return yy - 5;
};

// Data i hora en format del país (Andorra) i en UTC
export const dataLocal = (d: Date) =>
  new Intl.DateTimeFormat('ca-AD', { timeZone: 'Europe/Andorra', day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
export const dataUtc = (d: Date) => d.toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

// Fila del full d'evidències: etiqueta (català en negreta, anglès en cursiva)
// i valor a la dreta, amb línia de separació. Retorna la y per sota.
export const alcadaEvidencia = (f: Fonts, valor: string): number =>
  Math.max(30, 12 + linies(valor, f.r, 9.5, DRE - 230 - 6).length * 12);

export const filaEvidencia = (page: PDFPage, f: Fonts, y: number, [ca, en, valor]: [string, string, string]): number => {
  const ls = linies(valor, f.r, 9.5, DRE - 230 - 6);
  const h = Math.max(30, 12 + ls.length * 12);
  page.drawText(ca, { x: ESQ + 6, y: y - 13, size: 10, font: f.b, color: NEGRE });
  page.drawText(en, { x: ESQ + 6, y: y - 23, size: 7.5, font: f.i, color: GRIS });
  ls.forEach((l, i) => page.drawText(l, { x: 230, y: y - 13 - i * 12, size: 9.5, font: f.r, color: NEGRE }));
  y -= h;
  page.drawLine({ start: { x: ESQ, y: y + 3 }, end: { x: DRE, y: y + 3 }, thickness: 0.5, color: GRIS_CLAR });
  return y;
};

// Tipus de lletra Carlito incrustats (subconjunt) i logotip
export const carregaRecursos = async (pdf: PDFDocument): Promise<{ f: Fonts; logo: PDFImage }> => {
  pdf.registerFontkit(fontkit);
  const [reg, neg, cur, logoBytes] = await Promise.all([
    llegeixActiu('Carlito-Regular.ttf'), llegeixActiu('Carlito-Bold.ttf'),
    llegeixActiu('Carlito-Italic.ttf'), llegeixActiu('logo-ambit.jpg'),
  ]);
  return {
    f: {
      r: await pdf.embedFont(reg, { subset: true }),
      b: await pdf.embedFont(neg, { subset: true }),
      i: await pdf.embedFont(cur, { subset: true }),
    },
    logo: await pdf.embedJpg(logoBytes),
  };
};

// ─── Document ───────────────────────────────────────────────────────────────

export const generaPdf = async (d: DadesPdf): Promise<Uint8Array> => {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  pdf.setTitle(`${T.titol.ca} · ${d.clientNom}`);
  pdf.setAuthor('DEL SOTO – PALEARI & ASSOCIATS, SL');
  pdf.setSubject(T.titol.en);
  pdf.setCreator(`Portal de signatura ÀMBIT · ${d.templateVersion}`);
  pdf.setProducer('Portal de signatura ÀMBIT');
  pdf.setCreationDate(d.signatAt);
  pdf.setModificationDate(d.signatAt);

  const [reg, neg, cur, logoBytes] = await Promise.all([
    llegeixActiu('Carlito-Regular.ttf'), llegeixActiu('Carlito-Bold.ttf'),
    llegeixActiu('Carlito-Italic.ttf'), llegeixActiu('logo-ambit.jpg'),
  ]);
  const f: Fonts = {
    r: await pdf.embedFont(reg, { subset: true }),
    b: await pdf.embedFont(neg, { subset: true }),
    i: await pdf.embedFont(cur, { subset: true }),
  };
  const logo = await pdf.embedJpg(logoBytes);
  const firma = await pdf.embedPng(d.signaturaPng);
  const TOTAL = 3;

  // ── Pàgina 1 ──
  const p1 = pdf.addPage([AMPLE, ALT]);
  capcalera(p1, f, logo);
  let y = ALT - 100;

  y = seccio(p1, f, y, T.creditor.seccio.ca, T.creditor.seccio.en);
  for (const fila of T.creditor.files) y = filaCreditor(p1, f, y, fila.ca, fila.en, fila.valor);

  y -= 12;
  y = seccio(p1, f, y, T.titular.seccio.ca, T.titular.seccio.en);
  y = avis(p1, f, y, T.titular.avis.ca, T.titular.avis.en);
  y = camp(p1, f, y, T.titular.nom.ca, T.titular.nom.en, d.titularNom);
  y = camp(p1, f, y, T.titular.adreca.ca, T.titular.adreca.en, d.titularAdreca);
  y = camp(p1, f, y, T.titular.cp_poblacio.ca, T.titular.cp_poblacio.en, d.titularCpPoblacio);

  // Entitat financera: caselles
  p1.drawText('*', { x: ESQ + 2, y: y - 12, size: 11, font: f.r, color: NEGRE });
  p1.drawText(T.titular.entitat.ca, { x: ESQ + 9, y: y - 12, size: 11, font: f.b, color: NEGRE });
  p1.drawText(T.titular.entitat.en, { x: ESQ + 9, y: y - 22, size: 7.5, font: f.i, color: GRIS });
  casella(p1, f, X_CAMP, y - 2, 'Andbank', d.entitat === 'andbank');
  casella(p1, f, 328, y - 2, 'Creand', d.entitat === 'creand');
  casella(p1, f, 442, y - 2, 'MoraBanc', d.entitat === 'morabanc');
  y -= 31.5;

  y = camp(p1, f, y, T.titular.iban.ca, T.titular.iban.en, d.iban.replace(/(.{4})/g, '$1 ').trim());

  y -= 4;
  y = seccio(p1, f, y, T.facturat.seccio.ca, T.facturat.seccio.en);
  y = avis(p1, f, y, T.facturat.avis.ca, T.facturat.avis.en);
  y = camp(p1, f, y, T.facturat.nom.ca, T.facturat.nom.en, d.clientFacturatNom, { obligatori: false, negreta: false });

  y -= 6;
  y = seccio(p1, f, y, T.autoritzacio.seccio.ca, T.autoritzacio.seccio.en);
  y = paragraf(p1, T.autoritzacio.ca, ESQ, y - 16, AMPLE_UTIL, f.r, MIDA_CA, NEGRE, 14.5);
  y = paragraf(p1, T.autoritzacio.en, ESQ, y + 1, AMPLE_UTIL, f.i, MIDA_EN, GRIS, 11);

  y -= 10;
  y = seccio(p1, f, y, T.condicions.seccio.ca, T.condicions.seccio.en);
  y -= 8;
  T.condicions.punts.slice(0, 2).forEach((c, i) => { y = condicio(p1, f, y, i + 1, c.ca, c.en); });
  peu(p1, f, 1, TOTAL);

  // ── Pàgina 2 ──
  const p2 = pdf.addPage([AMPLE, ALT]);
  capcalera(p2, f, logo);
  y = ALT - 100;
  y = seccio(p2, f, y, T.condicions.continuacio.ca, T.condicions.continuacio.en);
  y -= 8;
  T.condicions.punts.slice(2).forEach((c, i) => { y = condicio(p2, f, y, i + 3, c.ca, c.en); });

  y -= 8;
  y = seccio(p2, f, y, T.signatura.seccio.ca, T.signatura.seccio.en);
  y -= 8;
  // Localitat i data en una mateixa fila
  camp(p2, f, y, T.signatura.localitat.ca, T.signatura.localitat.en, d.lloc, { ample: 359 - X_CAMP });
  p2.drawText('*', { x: 370, y: y - 12, size: 11, font: f.r, color: NEGRE });
  p2.drawText(T.signatura.data.ca, { x: 377, y: y - 12, size: 11, font: f.b, color: NEGRE });
  p2.drawText(T.signatura.data.en, { x: 377, y: y - 22, size: 7.5, font: f.i, color: GRIS });
  p2.drawRectangle({ x: 417, y: y - 19.5, width: DRE - 417, height: 19.5, color: CAMP_FONS, borderColor: CAMP_VORA, borderWidth: 0.6 });
  p2.drawText(dataLocal(d.signatAt), { x: 423, y: y - 13.5, size: 10.5, font: f.r, color: NEGRE });
  y -= 31.5;

  const signant = [d.signatariNom, d.signatariCarrec].filter(Boolean).join(' · ');
  y = camp(p2, f, y, T.signatura.signant.ca, T.signatura.signant.en, signant, { obligatori: false, negreta: false });

  // Requadre de la firma
  p2.drawText('*', { x: ESQ + 2, y: y - 12, size: 11, font: f.r, color: NEGRE });
  p2.drawText(T.signatura.firma.ca, { x: ESQ + 9, y: y - 12, size: 11, font: f.b, color: NEGRE });
  p2.drawText(T.signatura.firma.en, { x: ESQ + 9, y: y - 22, size: 7.5, font: f.i, color: GRIS });
  const caixaH = 86;
  rectArrodonit(p2, X_CAMP, y - caixaH, DRE - X_CAMP, caixaH, 6, VERD, 0.9);
  const maxW = DRE - X_CAMP - 24;
  const maxH = caixaH - 22;
  const esc = Math.min(maxW / firma.width, maxH / firma.height);
  const fw = firma.width * esc;
  const fh = firma.height * esc;
  p2.drawImage(firma, { x: X_CAMP + (DRE - X_CAMP - fw) / 2, y: y - caixaH + 14 + (maxH - fh) / 2, width: fw, height: fh });
  const signeu = `${T.signatura.signeu.ca} / ${T.signatura.signeu.en}`;
  p2.drawText(signeu, { x: DRE - 8 - f.i.widthOfTextAtSize(signeu, 7.5), y: y - caixaH + 6, size: 7.5, font: f.i, color: VERD });
  y -= caixaH + 18;

  // En lloc de "torneu aquesta autorització signada a…": signat al portal
  p2.drawText('Signada electrònicament al portal de signatura d’ÀMBIT Associats', { x: ESQ, y, size: 11.5, font: f.b, color: VERD_FOSC });
  p2.drawText('Signed electronically through the ÀMBIT Associats signing portal', { x: ESQ, y: y - 13, size: 8.2, font: f.i, color: GRIS });
  y -= 36;

  // Ús exclusiu del creditor (requadre de traç discontinu)
  const usH = 70;
  p2.drawRectangle({ x: ESQ, y: y - usH, width: AMPLE_UTIL, height: usH, borderColor: VERD, borderWidth: 0.8, borderDashArray: [3, 2] });
  p2.drawText(T.us_creditor.titol.ca, { x: ESQ + 8, y: y - 15, size: 10.5, font: f.b, color: VERD });
  p2.drawText(`/ ${T.us_creditor.titol.en}`, { x: ESQ + 12 + f.b.widthOfTextAtSize(T.us_creditor.titol.ca, 10.5), y: y - 15, size: 7.5, font: f.i, color: GRIS });
  p2.drawText(T.us_creditor.referencia.ca, { x: ESQ + 8, y: y - 36, size: 10.5, font: f.r, color: NEGRE });
  p2.drawRectangle({ x: 265, y: y - 42, width: DRE - 8 - 265, height: 17, color: CAMP_FONS, borderColor: CAMP_VORA, borderWidth: 0.6 });
  if (d.referenciaClient) p2.drawText(d.referenciaClient, { x: 271, y: y - 37, size: 10.5, font: f.r, color: NEGRE });
  p2.drawText(T.us_creditor.data_alta.ca, { x: ESQ + 8, y: y - 59, size: 10.5, font: f.r, color: NEGRE });
  p2.drawRectangle({ x: 265, y: y - 64, width: DRE - 8 - 265, height: 17, color: CAMP_FONS, borderColor: CAMP_VORA, borderWidth: 0.6 });
  peu(p2, f, 2, TOTAL);

  // ── Pàgina 3: evidències ──
  const p3 = pdf.addPage([AMPLE, ALT]);
  capcalera(p3, f, logo);
  y = ALT - 100;
  y = seccio(p3, f, y, 'Full d’evidències de la signatura', 'Signature evidence sheet');
  y -= 6;

  const files: [string, string, string][] = [
    ['Data i hora de la signatura', 'Date and time of signature', dataUtc(d.signatAt)],
    ['Adreça IP', 'IP address', d.ip || 'No disponible / Not available'],
    ['Navegador', 'Browser', d.userAgent || 'No disponible / Not available'],
    ['Referència de la sol·licitud', 'Request reference', d.requestId],
    ['Referència del client', 'Client reference', d.referenciaClient || 'Pendent d’assignar / To be assigned'],
    ['Client', 'Client', `${d.clientNom} (${d.partyType === 'pj' ? 'persona jurídica / legal entity' : 'persona física / individual'})`],
    ['Signant', 'Signatory', signant],
    ...(d.partyType === 'pj'
      ? [['El signant és administrador', 'Signatory is a director',
          d.signantEsAdministrador ? 'Sí / Yes' : 'No (s’adjunta poder / power of attorney attached)'] as [string, string, string]]
      : []),
    ['Versió de la plantilla', 'Template version', d.templateVersion],
    ['Empremta de les dades (SHA-256)', 'Data fingerprint (SHA-256)', d.empremtaDades],
    ['Empremta de la firma (SHA-256)', 'Signature image fingerprint (SHA-256)', d.signaturaSha256],
    ...(d.poderSha256 ? [['Empremta del poder (SHA-256)', 'Power of attorney fingerprint (SHA-256)', d.poderSha256] as [string, string, string]] : []),
  ];

  for (const fila of files) y = filaEvidencia(p3, f, y, fila);

  y -= 14;
  y = paragraf(p3,
    'L’empremta de les dades és el resum SHA-256 de les dades de l’autorització desades en el moment de signar. ' +
    'Qualsevol canvi posterior en aquestes dades donaria una empremta diferent. L’empremta d’aquest PDF queda ' +
    'registrada a ÀMBIT Associats en el moment de la signatura.',
    ESQ, y, AMPLE_UTIL, f.r, 9.5, NEGRE, 12.5);
  paragraf(p3,
    'The data fingerprint is the SHA-256 digest of the authorisation data stored at the time of signing. ' +
    'Any later change to that data would produce a different fingerprint. The fingerprint of this PDF is ' +
    'recorded by ÀMBIT Associats at the time of signing.',
    ESQ, y - 2, AMPLE_UTIL, f.i, 8.2, GRIS, 10.5);
  peu(p3, f, 3, TOTAL);

  return await pdf.save({ useObjectStreams: false });
};
