// supabase/functions/_shared/pdf-kyc.ts
//
// PDF del formulari d'identificació del client (KYC, persona física i
// jurídica), de la informació sobre protecció de dades (PDP) i del KYC final
// validat per l'OCIC. Mateix format ÀMBIT que l'autorització de càrrec: es
// fan servir les peces de pdf.ts (Carlito, capçalera amb logotip, barres
// verdes #009B9C, camps en requadre, caselles, peu amb "n/N" i full
// d'evidències). Cos de 12 punts; l'anglès a sota, en cursiva i més petit.
// Tots els textos surten de text-kyc.json (còpia literal de la plantilla).

import { PDFDocument, PDFFont, PDFImage, PDFPage, rgb, RGB } from 'npm:pdf-lib@1.17.1';
import T from './text-kyc.json' with { type: 'json' };
import PAISOS from './paisos.json' with { type: 'json' };
import { IDIOMES, LLISTES_SANCIONS } from './kyc-regles.js';
import {
  ALT, AMPLE, AMPLE_UTIL, BLANC, CAMP_FONS, CAMP_VORA, DRE, ESQ, Fonts, GRIS, GRIS_CLAR, NEGRE, VERD, VERD_FOSC, X_CAMP,
  alcadaEvidencia, capcalera, carregaRecursos, casella, dataLocal, dataUtc, filaEvidencia, linies, peu, rectArrodonit, seccio,
} from './pdf.ts';

// Variant clara per a vores i detalls
const VERD_CLAR = rgb(0x4d / 255, 0xb6 / 255, 0xb7 / 255);

const MIDA = 12;        // cos (català)
const MIDA_EN = 9;      // anglès
const MIDA_ETQ = 11;    // etiquetes
const MIDA_ETQ_EN = 8;
const MIDA_VALOR = 11.5;
const BAIX = 58;        // per sota d'aquí hi va el peu

type Bi = { ca: string; en: string };
type Json = Record<string, any>;

export type Adjunt = { tipus: string; persona: string | null; nom_fitxer: string | null; sha256: string };

export type Signatura = {
  signatariNom: string;
  signatariCarrec: string | null;
  lloc: string;
  signatAt: Date;
  ip: string | null;
  userAgent: string | null;
  empremtaDades: string;
  png: Uint8Array;
  sha256: string;
};

export type Validacio = {
  nivell: 'simplificada' | 'normal' | 'reforcada';
  justificacio: string;
  verificacio_via: 'presencial' | 'copia_notarial' | 'certificat_qualificat';
  verificacio_data: string;
  verificacio_persona: string;
  sancions_data: string;
  sancions_llistes: string;
  sancions_llistes_marcades: string[];
  sancions_altres: string | null;
  sancions_resultat: string;
  sancions_evidencia_sha256: string;
  rbe_data: string | null;
  rbe_resultat: string | null;
  alta_direccio_nom: string | null;
  alta_direccio_data: string | null;
  marques: { codi: string; detall: string }[];
  llistes: Json;
  propera_revisio: string;
  validat_at: Date;
  ocicNom: string;
  firmaOcic: Uint8Array;
  firmaOcicSha256: string;
  pdfSignatSha256: string;      // PDF signat pel client (es conserva intacte)
};

export type DadesKycPdf = {
  tipus: 'kyc_pf' | 'kyc_pj';
  requestId: string;
  pdpRequestId: string;
  referenciaClient: string | null;
  clientNom: string;
  templateVersion: string;
  dades: Json;
  adjunts: Adjunt[];
  signatura: Signatura;
  validacio?: Validacio;
};

export type DadesPdpPdf = {
  requestId: string;
  kycRequestId: string;
  referenciaClient: string | null;
  clientNom: string;
  templateVersion: string;
  consentiment: boolean;
  signatura: Signatura;
};

// ─── Formats ────────────────────────────────────────────────────────────────
const NOM_PAIS = new Map((PAISOS as { codi: string; ca: string; en: string }[]).map((p) => [p.codi, p]));
const pais = (c: string | null | undefined): string => {
  if (!c) return '';
  const p = NOM_PAIS.get(c);
  if (!p) return c;
  return p.ca === p.en ? p.ca : `${p.ca} (${p.en})`;
};
const paisos = (l: unknown): string => (Array.isArray(l) ? l.map(pais).filter(Boolean).join(' · ') : '');
const data = (s: string | null | undefined): string => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
};
const bi = (o: Bi | undefined): string => (o ? (o.ca === o.en ? o.ca : `${o.ca} / ${o.en}`) : '');
const idioma = (c: string): string => (IDIOMES as Record<string, Bi>)[c] ? bi((IDIOMES as Record<string, Bi>)[c]) : '';
const curt = (sha: string) => `${sha.slice(0, 16)}…`;
const majuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const esPng = (b: Uint8Array) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47;

// ─── Rendiment ──────────────────────────────────────────────────────────────
// Un KYC té milers de paraules i les funcions d'Edge tenen un límit de temps
// de CPU per petició. pdf-lib torna a calcular la forma de cada text cada cop
// que en mesura l'amplada o el dibuixa; aquí es desa per paraula. L'amplada
// d'una línia és la suma de les paraules i els espais (pdf-lib ja la calcula
// així, sense interlletratge), i el text codificat d'una paraula és sempre el
// mateix. Només per als documents d'aquest fitxer.
const accelera = (font: PDFFont) => {
  const amples = new Map<string, number>();
  const codis = new Map<string, ReturnType<PDFFont['encodeText']>>();
  const ampleOriginal = font.widthOfTextAtSize.bind(font);
  const codiOriginal = font.encodeText.bind(font);
  const ampleParaula = (p: string) => {
    let w = amples.get(p);
    if (w === undefined) { w = ampleOriginal(p, 1000); amples.set(p, w); }
    return w;
  };
  const espai = ampleParaula(' ');
  font.widthOfTextAtSize = (text: string, mida: number) => {
    const ps = text.split(' ');
    let w = espai * (ps.length - 1);
    for (const p of ps) if (p) w += ampleParaula(p);
    return (w * mida) / 1000;
  };
  font.encodeText = (text: string) => {
    let c = codis.get(text);
    if (!c) { c = codiOriginal(text); codis.set(text, c); }
    return c;
  };
};

// ─── Maquetació amb salts de pàgina ─────────────────────────────────────────
class Maqueta {
  pages: PDFPage[] = [];
  page!: PDFPage;
  y = 0;
  // Barra de secció pendent de dibuixar: es dibuixa just abans del primer
  // element que la segueix, a la mateixa pàgina (mai sola al peu)
  private barraPendent: { ca: string; en: string; cap: boolean } | null = null;

  constructor(public pdf: PDFDocument, public f: Fonts, public logo: PDFImage, public titol: Bi) {}

  nova() {
    this.page = this.pdf.addPage([AMPLE, ALT]);
    capcalera(this.page, this.f, this.logo, this.titol);
    this.pages.push(this.page);
    this.y = ALT - 100;
  }

  // Comprova que hi cap un element d'alçada h (i, si n'hi ha, la barra
  // pendent a sobre); si no, passa a la pàgina següent. Després dibuixa la barra.
  cal(h: number) {
    const b = this.barraPendent;
    const hBarra = b ? 8 + (b.cap ? 20 : 33) + 6 : 0;
    if (this.y - h - hBarra < BAIX) this.nova();
    if (b) {
      this.barraPendent = null;
      this.dibuixaBarra(b);
    }
  }

  espai(h: number) {
    this.y -= h;
  }

  // Línia amb justificació (mateix criteri que paragraf() de pdf.ts)
  private linia(text: string, x: number, ample: number, font: any, mida: number, color: RGB, justifica: boolean) {
    const paraules = text.split(' ');
    if (!justifica || paraules.length === 1) {
      this.page.drawText(text, { x, y: this.y, size: mida, font, color });
      return;
    }
    const ampleParaules = paraules.reduce((s, p) => s + font.widthOfTextAtSize(p, mida), 0);
    const espai = (ample - ampleParaules) / (paraules.length - 1);
    let cx = x;
    for (const p of paraules) {
      this.page.drawText(p, { x: cx, y: this.y, size: mida, font, color });
      cx += font.widthOfTextAtSize(p, mida) + espai;
    }
  }

  // Paràgraf que pot continuar a la pàgina següent
  text(t: string, o: { x?: number; ample?: number; font?: any; mida?: number; color?: RGB; interlinia?: number; justifica?: boolean } = {}) {
    const { x = ESQ, ample = AMPLE_UTIL, font = this.f.r, mida = MIDA, color = NEGRE } = o;
    const interlinia = o.interlinia ?? mida * 1.25;
    const ls = linies(t, font, mida, ample);
    ls.forEach((l, i) => {
      this.cal(interlinia);
      this.y -= mida * 0.95;
      this.linia(l, x, ample, font, mida, color, (o.justifica ?? true) && i < ls.length - 1);
      this.y -= interlinia - mida * 0.95;
    });
  }

  // Text català principal i anglès a sota, en cursiva i més petit
  bilingue(ca: string, en: string, o: { x?: number; ample?: number; abans?: number; despres?: number } = {}) {
    const { x = ESQ, ample = AMPLE_UTIL } = o;
    this.cal(MIDA * 2.6);
    this.espai(o.abans ?? 2);
    this.text(ca, { x, ample, font: this.f.r, mida: MIDA, color: NEGRE });
    this.espai(1);
    this.text(en, { x, ample, font: this.f.i, mida: MIDA_EN, color: GRIS });
    this.espai(o.despres ?? 6);
  }

  // Barra verda de secció: català a l'esquerra i anglès en cursiva a la dreta.
  // Si no hi cap en una línia, l'anglès passa a una segona línia. No es
  // dibuixa fins que se sap que hi cap amb el primer element que la segueix.
  barra(ca: string, en: string) {
    if (this.barraPendent) this.cal(0);
    const { f } = this;
    const cap = f.b.widthOfTextAtSize(ca, 11) + f.i.widthOfTextAtSize(en, 9) + 28 <= AMPLE_UTIL;
    this.barraPendent = { ca, en, cap };
  }

  private dibuixaBarra({ ca, en, cap }: { ca: string; en: string; cap: boolean }) {
    const { f } = this;
    this.espai(8);
    if (cap) {
      this.y = seccio(this.page, f, this.y, ca, en);
    } else {
      this.page.drawRectangle({ x: ESQ, y: this.y - 33, width: AMPLE_UTIL, height: 33, color: VERD });
      this.page.drawText(ca, { x: ESQ + 8, y: this.y - 14, size: 11, font: f.b, color: BLANC });
      this.page.drawText(en, { x: DRE - 8 - f.i.widthOfTextAtSize(en, 9), y: this.y - 27, size: 9, font: f.i, color: BLANC });
      this.y -= 33;
    }
    this.espai(6);
  }

  // Avís en cursiva sota la barra
  avis(o: Bi) {
    this.cal(26);
    this.text(o.ca, { font: this.f.i, mida: 9.5, color: GRIS, interlinia: 11.5, justifica: false });
    this.text(o.en, { font: this.f.i, mida: 8, color: GRIS, interlinia: 10, justifica: false });
    this.espai(4);
  }

  // Subtítol (persona d'una llista, grup de camps)
  subtitol(t: string, en?: string) {
    const { f } = this;
    this.cal(100);
    this.espai(6);
    this.page.drawText(t, { x: ESQ, y: this.y - 12, size: MIDA_ETQ, font: f.b, color: VERD_FOSC });
    if (en) {
      this.page.drawText(en, { x: ESQ + f.b.widthOfTextAtSize(t, MIDA_ETQ) + 6, y: this.y - 12, size: MIDA_ETQ_EN, font: f.i, color: GRIS });
    }
    this.page.drawLine({ start: { x: ESQ, y: this.y - 16 }, end: { x: DRE, y: this.y - 16 }, thickness: 0.6, color: VERD_CLAR });
    this.y -= 22;
  }

  // Etiqueta (català en negreta, anglès en cursiva) a la columna esquerra.
  // Retorna l'alçada que ocupa.
  private alcadaEtiqueta(ca: string, en: string, ample: number) {
    return linies(ca, this.f.b, MIDA_ETQ, ample).length * 12.5 + linies(en, this.f.i, MIDA_ETQ_EN, ample).length * 9.5 + 2;
  }

  private etiqueta(ca: string, en: string, x: number, ample: number, obligatori: boolean) {
    const { f, page } = this;
    let y = this.y - 12;
    if (obligatori) page.drawText('*', { x: x - 7, y, size: MIDA_ETQ, font: f.r, color: NEGRE });
    for (const l of linies(ca, f.b, MIDA_ETQ, ample)) { page.drawText(l, { x, y, size: MIDA_ETQ, font: f.b, color: NEGRE }); y -= 12.5; }
    y += 2.5;
    for (const l of linies(en, f.i, MIDA_ETQ_EN, ample)) { page.drawText(l, { x, y, size: MIDA_ETQ_EN, font: f.i, color: GRIS }); y -= 9.5; }
  }

  // Camp amb el valor en un requadre (mateix estil que l'autorització)
  camp(ca: string, en: string, valor: string | null | undefined, o: { obligatori?: boolean; x?: number; xCamp?: number } = {}) {
    const { f } = this;
    const { obligatori = true, x = ESQ + 9 } = o;
    const xCamp = o.xCamp ?? X_CAMP;
    const ampleEtq = xCamp - x - 8;
    const ampleVal = DRE - xCamp - 12;
    const ls = valor ? linies(String(valor), f.r, MIDA_VALOR, ampleVal) : [];
    const hCaixa = Math.max(20, 7 + Math.max(1, ls.length) * 14);
    const h = Math.max(this.alcadaEtiqueta(ca, en, ampleEtq), hCaixa) + 8;
    this.cal(h);
    this.etiqueta(ca, en, x, ampleEtq, obligatori);
    this.page.drawRectangle({ x: xCamp, y: this.y - hCaixa, width: DRE - xCamp, height: hCaixa, color: CAMP_FONS, borderColor: CAMP_VORA, borderWidth: 0.6 });
    ls.forEach((l, i) => this.page.drawText(l, { x: xCamp + 6, y: this.y - 14 - i * 14, size: MIDA_VALOR, font: f.r, color: NEGRE }));
    this.y -= h;
  }

  // Opcions amb caselles (marcades segons la resposta). Les curtes, en
  // columnes; les llargues, una per línia. Català en negre i, després de
  // " / ", l'anglès en cursiva grisa.
  opcions(ca: string, en: string, items: (Bi & { marcada: boolean; detall?: string })[], o: { obligatori?: boolean; x?: number } = {}) {
    const { f } = this;
    const { obligatori = true, x = ESQ + 9 } = o;
    const ampleEtq = X_CAMP - x - 8;
    const zona = DRE - X_CAMP;
    type Tros = { t: string; en: boolean };
    // Cada opció: trossos de text (català, anglès i detall) partits en línies
    const linesOpcio = (it: Bi & { detall?: string }, ample: number): Tros[][] => {
      const paraules: Tros[] = [];
      for (const w of it.ca.split(' ').filter(Boolean)) paraules.push({ t: w, en: false });
      if (it.en !== it.ca) {
        paraules.push({ t: '/', en: true });
        for (const w of it.en.split(' ').filter(Boolean)) paraules.push({ t: w, en: true });
      }
      if (it.detall) {
        paraules[paraules.length - 1] = { ...paraules[paraules.length - 1], t: `${paraules[paraules.length - 1].t}:` };
        for (const w of it.detall.split(' ').filter(Boolean)) paraules.push({ t: w, en: false });
      }
      const font = (p: Tros) => (p.en ? f.i : f.r);
      const mida = (p: Tros) => (p.en ? 9 : 10.5);
      const out: Tros[][] = [];
      let l: Tros[] = [];
      let w = 0;
      for (const p of paraules) {
        const pw = font(p).widthOfTextAtSize(p.t, mida(p));
        const sp = l.length ? f.r.widthOfTextAtSize(' ', 10.5) : 0;
        if (l.length && w + sp + pw > ample) { out.push(l); l = []; w = 0; }
        w += (l.length ? sp : 0) + pw;
        l.push(p);
      }
      if (l.length) out.push(l);
      return out;
    };
    const ampleUn = (it: Bi & { detall?: string }) => linesOpcio(it, 10000)[0]
      .reduce((s2, p) => s2 + (p.en ? f.i : f.r).widthOfTextAtSize(p.t, p.en ? 9 : 10.5) + 3, 0);
    let cols = 1;
    for (const n of [4, 3, 2]) {
      if (items.length >= n && items.every((it) => ampleUn(it) <= zona / n - 26)) { cols = n; break; }
    }
    const ampleText = zona / cols - 22;
    const files = items.map((it) => ({ it, ls: linesOpcio(it, ampleText) }));
    const alcadaFila = (i: number) => Math.max(...files.slice(i, i + cols).map((fl) => fl.ls.length)) * 12.5 + 5;
    let hOpc = 0;
    for (let i = 0; i < files.length; i += cols) hOpc += alcadaFila(i);
    const h = Math.max(this.alcadaEtiqueta(ca, en, ampleEtq), hOpc + 2) + 6;
    this.cal(h);
    this.etiqueta(ca, en, x, ampleEtq, obligatori);
    let y = this.y - 1;
    const dibuixa = (fl: typeof files[number], cx: number, cy: number) => {
      casella(this.page, f, cx, cy, '', fl.it.marcada);
      fl.ls.forEach((l, i) => {
        let px = cx + 20;
        l.forEach((p, k) => {
          if (k) px += f.r.widthOfTextAtSize(' ', 10.5);
          const font = p.en ? f.i : f.r;
          const mida = p.en ? 9 : 10.5;
          this.page.drawText(p.t, { x: px, y: cy - 11 - i * 12.5, size: mida, font, color: p.en ? GRIS : NEGRE });
          px += font.widthOfTextAtSize(p.t, mida);
        });
      });
    };
    for (let i = 0; i < files.length; i += cols) {
      files.slice(i, i + cols).forEach((fl, c) => dibuixa(fl, X_CAMP + (c * zona) / cols, y));
      y -= alcadaFila(i);
    }
    this.y -= h;
  }

  siNo(ca: string, en: string, valor: boolean | null | undefined, o: { obligatori?: boolean; x?: number } = {}) {
    this.opcions(ca, en, [
      { ...T.si_no.si, marcada: valor === true },
      { ...T.si_no.no, marcada: valor === false },
    ], o);
  }

  // Declaració amb casella: text català i anglès a sota
  declaracio(ca: string, en: string, marcada: boolean) {
    const { f } = this;
    const ample = AMPLE_UTIL - 24;
    const h = linies(ca, f.r, MIDA, ample).length * 15 + linies(en, f.i, MIDA_EN, ample).length * 11.3 + 8;
    this.cal(h);
    casella(this.page, f, ESQ, this.y - 1, '', marcada);
    const y0 = this.y;
    this.text(ca, { x: ESQ + 24, ample, mida: MIDA, interlinia: 15 });
    this.text(en, { x: ESQ + 24, ample, font: f.i, mida: MIDA_EN, color: GRIS, interlinia: 11.3 });
    this.y = Math.min(this.y, y0 - 16) - 6;
  }

  // Taula senzilla (capçalera bilingüe i files)
  taula(cols: (Bi & { w: number })[], files: string[][]) {
    const { f } = this;
    const total = cols.reduce((s, c) => s + c.w, 0);
    const xs: number[] = [];
    let acc = ESQ;
    for (const c of cols) { xs.push(acc); acc += (c.w / total) * AMPLE_UTIL; }
    const amples = cols.map((c) => (c.w / total) * AMPLE_UTIL - 8);
    this.cal(28 + 20);
    cols.forEach((c, i) => {
      this.page.drawText(majuscula(c.ca), { x: xs[i] + 4, y: this.y - 11, size: 9.5, font: f.b, color: VERD_FOSC });
      this.page.drawText(majuscula(c.en), { x: xs[i] + 4, y: this.y - 20, size: 7.5, font: f.i, color: GRIS });
    });
    this.page.drawLine({ start: { x: ESQ, y: this.y - 24 }, end: { x: DRE, y: this.y - 24 }, thickness: 0.8, color: VERD_CLAR });
    this.y -= 26;
    if (files.length === 0) {
      this.page.drawText('—', { x: ESQ + 4, y: this.y - 12, size: 10.5, font: f.r, color: GRIS });
      this.y -= 18;
    }
    for (const fila of files) {
      const ls = fila.map((v, i) => linies(v || '—', f.r, 10.5, amples[i]));
      const h = Math.max(...ls.map((l) => l.length)) * 12.5 + 7;
      this.cal(h);
      ls.forEach((l, i) => l.forEach((t, k) => this.page.drawText(t, { x: xs[i] + 4, y: this.y - 12 - k * 12.5, size: 10.5, font: f.r, color: NEGRE })));
      this.y -= h;
      this.page.drawLine({ start: { x: ESQ, y: this.y + 2 }, end: { x: DRE, y: this.y + 2 }, thickness: 0.5, color: GRIS_CLAR });
    }
    this.espai(4);
  }

  // Requadre de signatura amb la imatge (mateix requadre arrodonit que l'autorització)
  async firma(ca: string, en: string, imatge: Uint8Array | null, peuText?: string) {
    const { f } = this;
    const caixaH = 86;
    this.cal(caixaH + 26);
    this.etiqueta(ca, en, ESQ + 9, X_CAMP - ESQ - 17, true);
    rectArrodonit(this.page, X_CAMP, this.y - caixaH, DRE - X_CAMP, caixaH, 6, VERD, 0.9);
    if (imatge) {
      const img = esPng(imatge) ? await this.pdf.embedPng(imatge) : await this.pdf.embedJpg(imatge);
      const maxW = DRE - X_CAMP - 24;
      const maxH = caixaH - 18;
      const esc = Math.min(maxW / img.width, maxH / img.height);
      const fw = img.width * esc;
      const fh = img.height * esc;
      this.page.drawImage(img, { x: X_CAMP + (DRE - X_CAMP - fw) / 2, y: this.y - caixaH + 9 + (maxH - fh) / 2, width: fw, height: fh });
    }
    this.y -= caixaH + 4;
    if (peuText) {
      this.page.drawText(peuText, { x: X_CAMP, y: this.y - 9, size: 9, font: f.i, color: GRIS });
      this.y -= 14;
    }
    this.y -= 8;
  }

  // Full d'evidències (mateixes files que l'autorització)
  evidencies(titol: Bi, files: [string, string, string][]) {
    this.cal(80);
    this.barra(titol.ca, titol.en);
    for (const fila of files) {
      this.cal(alcadaEvidencia(this.f, fila[2]));
      this.y = filaEvidencia(this.page, this.f, this.y, fila);
    }
  }

  tanca() {
    if (this.barraPendent) this.cal(0);
    const total = this.pages.length;
    this.pages.forEach((p, i) => peu(p, this.f, i + 1, total));
  }
}

const nouDocument = async (titol: Bi, subjecte: string, clientNom: string, versio: string, data: Date) => {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${titol.ca} · ${clientNom}`);
  pdf.setAuthor('DEL SOTO – PALEARI & ASSOCIATS, SL');
  pdf.setSubject(subjecte);
  pdf.setCreator(`Portal de signatura ÀMBIT · ${versio}`);
  pdf.setProducer('Portal de signatura ÀMBIT');
  pdf.setCreationDate(data);
  pdf.setModificationDate(data);
  const { f, logo } = await carregaRecursos(pdf);
  accelera(f.r);
  accelera(f.b);
  accelera(f.i);
  const m = new Maqueta(pdf, f, logo, titol);
  m.nova();
  return { pdf, m };
};

// ─── Blocs comuns ───────────────────────────────────────────────────────────
const avisLegal = (m: Maqueta) => {
  const T0 = T.avis_legal;
  m.espai(4);
  T0.ca.forEach((p, i) => m.bilingue(p, T0.en[i], { abans: i ? 2 : 4, despres: 7 }));
};

const ppe = (m: Maqueta, p: Json, x = ESQ + 9) => {
  const P = T.ppe;
  m.siNo(P.exerceix.ca, P.exerceix.en, p.exerceix, { x });
  if (p.exerceix) {
    m.camp(`${P.si_si.ca}: ${P.carrec.ca}`, `${P.si_si.en}: ${P.carrec.en}`, p.carrec, { x });
    m.camp(P.pais_institucio.ca, P.pais_institucio.en, p.pais_institucio, { x });
    m.camp(P.data_inici.ca, P.data_inici.en, data(p.data_inici), { x });
    m.camp(P.data_fi.ca, P.data_fi.en, data(p.data_fi), { x, obligatori: false });
  }
  m.siNo(P.familiar.ca, P.familiar.en, p.familiar, { x });
  if (p.familiar) {
    m.camp(`${P.si_si.ca}: ${P.relacio.ca}`, `${P.si_si.en}: ${P.relacio.en}`, p.relacio, { x });
    m.camp(P.nom_ppe.ca, P.nom_ppe.en, p.nom_ppe, { x });
    m.camp(P.carrec_ppe.ca, P.carrec_ppe.en, p.carrec_ppe, { x });
  }
  if (p.exerceix || p.familiar) {
    m.camp(`${P.alguna_si.ca}: ${P.origen_patrimoni.ca}`, `${P.alguna_si.en}: ${P.origen_patrimoni.en}`, p.origen_patrimoni, { x });
  }
};

const proposit = (m: Maqueta, num: number, p: Json) => {
  const P = T.proposit;
  m.barra(`${num}. ${P.titol.ca}`, P.titol.en);
  m.opcions(P.serveis.ca, P.serveis.en, Object.entries(P.opcions).map(([k, o]) => ({
    ...(o as Bi), marcada: (p.serveis || []).includes(k), detall: k === 'altres' && (p.serveis || []).includes(k) ? p.serveis_altres : undefined,
  })));
  m.camp(P.descripcio.ca, P.descripcio.en, p.descripcio);
};

const fons = (m: Maqueta, num: number, S: Json, f: Json) => {
  m.barra(`${num}. ${S.titol.ca}`, S.titol.en);
  m.opcions(S.origen.ca, S.origen.en, Object.entries(S.opcions).map(([k, o]) => ({
    ...(o as Bi), marcada: (f.origen || []).includes(k), detall: k === 'altres' && (f.origen || []).includes(k) ? f.origen_altres : undefined,
  })));
  m.siNo(S.andorra.ca, S.andorra.en, f.andorra);
  if (f.andorra === false) m.camp(S.paisos.ca, S.paisos.en, paisos(f.paisos));
  m.camp(S.descripcio.ca, S.descripcio.en, f.descripcio);
};

const declaracions = (m: Maqueta, num: number, S: Json, d: Json) => {
  m.barra(`${num}. ${S.titol.ca}`, S.titol.en);
  S.punts.forEach((p: Bi, i: number) => m.declaracio(p.ca, p.en, !!d?.[`d${i + 1}`]));
};

// Llista de documents: casella marcada si s'ha adjuntat, i els fitxers
const documentacio = (m: Maqueta, num: number, S: Json, adjunts: Adjunt[], persones: Map<string, string>) => {
  m.barra(`${num}. ${S.titol.ca}`, S.titol.en);
  for (const [codi, nom] of Object.entries(S.documents) as [string, Bi][]) {
    const meus = adjunts.filter((a) => a.tipus === codi);
    m.declaracio(nom.ca, nom.en, meus.length > 0);
    for (const a of meus) {
      const qui = a.persona ? `${persones.get(a.persona) || '—'}: ` : '';
      m.cal(13);
      m.text(`${qui}${a.nom_fitxer || 'document'} · SHA-256 ${curt(a.sha256)}`, { x: ESQ + 24, ample: AMPLE_UTIL - 24, font: m.f.i, mida: 8.5, color: GRIS, interlinia: 11, justifica: false });
    }
    if (meus.length) m.espai(4);
  }
};

const signaturaClient = async (m: Maqueta, num: number, titol: Bi, s: Signatura, avis?: Bi) => {
  m.cal(avis ? 300 : 270);
  m.barra(`${num}. ${titol.ca}`, titol.en);
  if (avis) m.avis(avis);
  m.camp(T.signatura.lloc.ca, T.signatura.lloc.en, s.lloc);
  m.camp(T.signatura.data.ca, T.signatura.data.en, dataLocal(s.signatAt));
  await m.firma(T.signatura.signatura.ca, T.signatura.signatura.en, s.png,
    [s.signatariNom, s.signatariCarrec].filter(Boolean).join(' · '));
  m.cal(30);
  m.page.drawText('Signat electrònicament al portal de signatura d’ÀMBIT Associats', { x: ESQ, y: m.y - 11, size: 11.5, font: m.f.b, color: VERD_FOSC });
  m.page.drawText('Signed electronically through the ÀMBIT Associats signing portal', { x: ESQ, y: m.y - 24, size: 8.2, font: m.f.i, color: GRIS });
  m.espai(32);
};

// Apartat reservat a ÀMBIT: buit al PDF que signa el client; ple al PDF validat
const apartatAmbit = async (m: Maqueta, num: number, tipus: 'kyc_pf' | 'kyc_pj', v?: Validacio) => {
  const A = T.ambit;
  m.cal(tipus === 'kyc_pj' ? 560 : 510);
  m.barra(`${num}. ${A.titol.ca}`, A.titol.en);
  m.opcions(A.risc.ca, A.risc.en, (['simplificada', 'normal', 'reforcada'] as const).map((k) => ({ ...A.nivells[k], marcada: v?.nivell === k })));
  m.camp(majuscula(A.justificacio.ca), majuscula(A.justificacio.en), v?.justificacio);
  m.opcions(A.verificacio.ca, A.verificacio.en, (['presencial', 'copia_notarial', 'certificat_qualificat'] as const).map((k) => ({ ...A.vies[k], marcada: v?.verificacio_via === k })));
  m.camp(majuscula(A.verificacio_qui.ca), majuscula(A.verificacio_qui.en), v ? `${data(v.verificacio_data)} · ${v.verificacio_persona}` : null);
  m.opcions(A.sancions.ca, A.sancions.en, LLISTES_SANCIONS.map((l: { codi: string; nom: string }) => ({
    ca: l.nom, en: l.nom, marcada: !!v && (v.sancions_llistes_marcades || []).includes(l.codi),
  })));
  m.camp('Altres llistes consultades', 'Other lists consulted', v?.sancions_altres, { obligatori: false });
  m.camp(majuscula(A.sancions_det.ca), majuscula(A.sancions_det.en), v ? `${data(v.sancions_data)} · ${v.sancions_resultat}` : null);
  if (tipus === 'kyc_pj') m.camp(A.rbe.ca, A.rbe.en, v ? `${data(v.rbe_data)} · ${v.rbe_resultat}` : null);
  m.camp(A.alta_direccio.ca, A.alta_direccio.en,
    v ? (v.alta_direccio_nom ? `${v.alta_direccio_nom} · ${data(v.alta_direccio_data)}` : '—') : null, { obligatori: false });
  await m.firma(A.ocic.ca, A.ocic.en, v ? v.firmaOcic : null,
    v ? `${v.ocicNom} · ${dataLocal(v.validat_at)}` : undefined);
};

const filesSignatura = (s: Signatura, requestId: string, referencia: string | null, clientNom: string, partyType: 'pf' | 'pj', versio: string): [string, string, string][] => [
  ['Data i hora de la signatura', 'Date and time of signature', dataUtc(s.signatAt)],
  ['Adreça IP', 'IP address', s.ip || 'No disponible / Not available'],
  ['Navegador', 'Browser', s.userAgent || 'No disponible / Not available'],
  ['Referència de la sol·licitud', 'Request reference', requestId],
  ['Referència del client', 'Client reference', referencia || 'Pendent d’assignar / To be assigned'],
  ['Client', 'Client', `${clientNom} (${partyType === 'pj' ? 'persona jurídica / legal entity' : 'persona física / individual'})`],
  ['Signant', 'Signatory', [s.signatariNom, s.signatariCarrec].filter(Boolean).join(' · ')],
  ['Versió de la plantilla', 'Template version', versio],
  ['Empremta de les dades (SHA-256)', 'Data fingerprint (SHA-256)', s.empremtaDades],
  ['Empremta de la firma (SHA-256)', 'Signature image fingerprint (SHA-256)', s.sha256],
];

const notaEmpremta = (m: Maqueta, ca: string, en: string) => {
  m.espai(10);
  m.text(ca, { mida: 9.5, interlinia: 12.5 });
  m.espai(2);
  m.text(en, { font: m.f.i, mida: 8.2, color: GRIS, interlinia: 10.5 });
};

// ─── KYC ────────────────────────────────────────────────────────────────────
const kycPf = (m: Maqueta, d: Json) => {
  const P = T.pf;
  const i = d.identificacio || {};
  const S1 = P.s1;
  m.barra(`1. ${S1.titol.ca}`, S1.titol.en);
  m.camp(S1.nom.ca, S1.nom.en, i.nom);
  m.camp(S1.data_naixement.ca, S1.data_naixement.en, data(i.data_naixement));
  m.camp(S1.lloc_naixement.ca, S1.lloc_naixement.en, i.lloc_naixement);
  m.camp(S1.nacionalitats.ca, S1.nacionalitats.en, paisos(i.nacionalitats));
  m.subtitol(S1.document.ca, S1.document.en);
  m.opcions(majuscula(S1.doc_tipus.ca), majuscula(S1.doc_tipus.en), Object.entries(S1.doc_tipus_opcions).map(([k, o]) => ({ ...(o as Bi), marcada: i.doc_tipus === k })));
  m.camp(majuscula(S1.doc_numero.ca), majuscula(S1.doc_numero.en), i.doc_numero);
  m.camp(majuscula(S1.doc_autoritat.ca), majuscula(S1.doc_autoritat.en), i.doc_autoritat);
  m.camp(majuscula(S1.doc_caducitat.ca), majuscula(S1.doc_caducitat.en), data(i.doc_caducitat));
  m.espai(4);
  m.camp(S1.nrt.ca, S1.nrt.en, i.nrt, { obligatori: false });
  m.camp(S1.nia.ca, S1.nia.en, i.nia, { obligatori: false });
  m.camp(S1.domicili.ca, S1.domicili.en, i.domicili);
  m.camp(S1.pais_residencia.ca, S1.pais_residencia.en, pais(i.pais_residencia));
  m.camp(S1.pais_anterior.ca, S1.pais_anterior.en, pais(i.pais_anterior), { obligatori: false });
  m.camp(S1.nif_estranger.ca, S1.nif_estranger.en, i.nif_estranger, { obligatori: false });
  m.opcions(S1.estat_civil.ca, S1.estat_civil.en, Object.entries(S1.estat_civil_opcions).map(([k, o]) => ({ ...(o as Bi), marcada: i.estat_civil === k })));
  m.opcions(S1.fills.ca, S1.fills.en, [
    { ...S1.fills_si, marcada: i.fills === true, detall: i.fills ? i.fills_nombre : undefined },
    { ...T.si_no.no, marcada: i.fills === false },
  ]);
  m.camp(S1.telefon.ca, S1.telefon.en, i.telefon);
  m.camp(S1.email.ca, S1.email.en, i.email);
  m.camp(S1.idioma.ca, S1.idioma.en, idioma(i.idioma));

  const r = d.representacio || {};
  const S2 = P.s2;
  m.barra(`2. ${S2.titol.ca}`, S2.titol.en);
  m.avis(S2.avis);
  m.camp(S2.nom.ca, S2.nom.en, r.actua ? r.nom : null, { obligatori: false });
  m.camp(S2.document.ca, S2.document.en, r.actua ? r.document : null, { obligatori: false });
  m.opcions(S2.tipus.ca, S2.tipus.en, Object.entries(S2.tipus_opcions).map(([k, o]) => ({
    ...(o as Bi), marcada: !!r.actua && r.tipus === k, detall: r.actua && k === 'altres' && r.tipus === k ? r.tipus_altres : undefined,
  })), { obligatori: false });

  const a = d.activitat || {};
  const S3 = P.s3;
  m.barra(`3. ${S3.titol.ca}`, S3.titol.en);
  m.avis(S3.avis);
  for (const [k, t] of Object.entries(S3.tipus) as [string, Json][]) {
    m.declaracio(t.ca, t.en, a.tipus === k);
    if (a.tipus !== k) continue;
    if (k === 'sense') {
      m.opcions('', '', Object.entries(t.opcions).map(([o, txt]) => ({
        ...(txt as Bi), marcada: a.sense === o, detall: o === 'altres' && a.sense === o ? a.sense_altres : undefined,
      })), { obligatori: false, x: ESQ + 24 });
      continue;
    }
    for (const [c, et] of Object.entries(t.camps) as [string, Bi][]) {
      let valor: string = a[c];
      if (c === 'paisos') valor = paisos(a.paisos);
      else if (c === 'data_inici') valor = data(a.data_inici);
      else if (c === 'contracte') valor = bi(S3.contracte_opcions[a.contracte as 'indefinit']);
      else if (c === 'jornada') valor = `${bi(S3.jornada_opcions[a.jornada as 'completa'])} · ${a.hores || '—'} ${S3.hores.ca} / ${S3.hores.en}`;
      else if (c === 'pais_domicili') valor = [pais(a.pais), a.domicili].filter(Boolean).join(' · ');
      m.camp(majuscula(et.ca), majuscula(et.en), valor, { x: ESQ + 30, obligatori: c !== 'web' });
    }
  }

  proposit(m, 4, d.proposit || {});
  fons(m, 5, P.s5, d.fons || {});

  m.barra(`6. ${T.ppe.titol.ca}`, T.ppe.titol.en);
  T.ppe.explicacio.ca.forEach((p, n) => m.bilingue(p, T.ppe.explicacio.en[n]));
  m.subtitol(T.ppe.preguntes.ca, T.ppe.preguntes.en);
  ppe(m, d.ppe || {});

  const s = d.sancions || {};
  m.barra(`7. ${P.s7.titol.ca}`, P.s7.titol.en);
  m.siNo(P.s7.residencia_ru_by.ca, P.s7.residencia_ru_by.en, s.residencia_ru_by);
  m.siNo(P.s7.actua_ru_by.ca, P.s7.actua_ru_by.en, s.actua_ru_by);

  declaracions(m, 8, P.s8, d.declaracions);
};

const kycPj = (m: Maqueta, d: Json) => {
  const P = T.pj;
  const so = d.societat || {};
  const S1 = P.s1;
  m.barra(`1. ${S1.titol.ca}`, S1.titol.en);
  m.camp(S1.denominacio.ca, S1.denominacio.en, so.denominacio);
  m.camp(S1.nom_comercial.ca, S1.nom_comercial.en, so.nom_comercial, { obligatori: false });
  m.camp(S1.forma.ca, S1.forma.en, so.forma);
  m.camp(S1.pais_constitucio.ca, S1.pais_constitucio.en, pais(so.pais_constitucio));
  m.camp(S1.data_constitucio.ca, S1.data_constitucio.en, data(so.data_constitucio));
  m.camp(S1.pais_activitat.ca, S1.pais_activitat.en, pais(so.pais_activitat));
  m.camp(S1.domicili_social.ca, S1.domicili_social.en, so.domicili_social);
  m.camp(S1.adreca_activitat.ca, S1.adreca_activitat.en, so.adreca_activitat, { obligatori: false });
  m.camp(S1.nrt.ca, S1.nrt.en, so.nrt);
  m.camp(S1.registrals.ca, S1.registrals.en, so.registrals);
  m.camp(S1.capital.ca, S1.capital.en, so.capital);
  m.camp(S1.objecte.ca, S1.objecte.en, so.objecte);
  m.camp(S1.paisos.ca, S1.paisos.en, paisos(so.paisos));
  m.camp(S1.telefon.ca, S1.telefon.en, so.telefon);
  m.camp(S1.email.ca, S1.email.en, so.email);
  m.camp(S1.web.ca, S1.web.en, so.web, { obligatori: false });
  m.siNo(S1.cotitza.ca, S1.cotitza.en, so.cotitza);

  const S2 = P.s2;
  m.barra(`2. ${S2.titol.ca}`, S2.titol.en);
  m.avis(S2.avis);
  (d.representants || []).forEach((p: Json, n: number) => {
    m.subtitol(`${n + 1}. ${p.nom || '—'}${n === 0 ? ` (${S2.signant.ca})` : ''}`, n === 0 ? `(${S2.signant.en})` : undefined);
    const x = ESQ + 9;
    m.camp(S2.nom.ca, S2.nom.en, p.nom, { x });
    m.camp(majuscula(S2.nacionalitat.ca), majuscula(S2.nacionalitat.en), pais(p.nacionalitat), { x });
    m.camp(majuscula(S2.data_naixement.ca), majuscula(S2.data_naixement.en), data(p.data_naixement), { x });
    m.camp(majuscula(S2.domicili.ca), majuscula(S2.domicili.en), p.domicili, { x });
    m.camp(majuscula(S2.document.ca), majuscula(S2.document.en), p.document, { x });
    m.camp(S2.nrt.ca, S2.nrt.en, p.nrt, { x, obligatori: false });
    m.camp(S2.carrec.ca, S2.carrec.en, p.carrec, { x });
    m.opcions(S2.actua.ca, S2.actua.en, Object.entries(S2.actua_opcions).map(([k, o]) => ({ ...(o as Bi), marcada: p.actua_com === k })), { x });
    m.camp(S2.telefon.ca, S2.telefon.en, p.telefon, { x, obligatori: n === 0 });
    m.camp(majuscula(S2.email.ca), majuscula(S2.email.en), p.email, { x, obligatori: n === 0 });
    m.camp(majuscula(S2.idioma.ca), majuscula(S2.idioma.en), idioma(p.idioma), { x, obligatori: n === 0 });
  });

  const S3 = P.s3;
  m.barra(`3. ${S3.titol.ca}`, S3.titol.en);
  m.avis(S3.avis);
  m.taula([{ ...S3.nom, w: 3 }, { ...S3.carrec, w: 2 }, { ...S3.nacionalitat, w: 2 }],
    (d.administradors || []).map((a: Json) => [a.nom, a.carrec, pais(a.nacionalitat)]));

  const S4 = P.s4;
  m.barra(`4. ${S4.titol.ca}`, S4.titol.en);
  m.avis(S4.avis);
  m.subtitol(S4.socis.ca, S4.socis.en);
  const socis: Json[] = d.socis || [];
  const nivell = (s: Json, prof: number) => {
    m.cal(16);
    const marge = ESQ + 6 + prof * 18;
    const tipus = s.tipus === 'pj' ? 'societat / company' : 'persona física / individual';
    m.text(`${prof ? '└ ' : '• '}${s.nom} · ${s.percentatge} % · ${tipus}`, { x: marge, ample: DRE - marge, mida: 11, interlinia: 14, justifica: false });
    if (prof < 8) socis.filter((f) => f.soci_de === s.id).forEach((f) => nivell(f, prof + 1));
  };
  socis.filter((s) => !s.soci_de).forEach((s) => nivell(s, 0));
  m.espai(4);

  const S5 = P.s5;
  m.barra(`5. ${S5.titol.ca}`, S5.titol.en);
  S5.explicacio.ca.forEach((p, n) => m.bilingue(p, S5.explicacio.en[n], { abans: n ? 0 : 2, despres: 3 }));
  m.espai(4);
  (d.beneficiaris || []).forEach((b: Json, n: number) => {
    m.subtitol(`${S5.per_cada.ca} · ${n + 1}. ${b.nom || '—'}`, S5.per_cada.en);
    m.camp(S5.nom.ca, S5.nom.en, b.nom);
    m.camp(majuscula(S5.nacionalitats.ca), majuscula(S5.nacionalitats.en), paisos(b.nacionalitats));
    m.camp(majuscula(S5.data_naixement.ca), majuscula(S5.data_naixement.en), data(b.data_naixement));
    m.camp(majuscula(S5.domicili.ca), majuscula(S5.domicili.en), b.domicili);
    m.camp(majuscula(S5.pais_residencia.ca), majuscula(S5.pais_residencia.en), pais(b.pais_residencia));
    const repIdx = (d.representants || []).findIndex((r: Json) => r.id && r.id === b.representant_id);
    m.camp(majuscula(S5.document.ca), majuscula(S5.document.en),
      repIdx >= 0 ? `${b.document} · mateixa persona que el representant ${repIdx + 1} / same person as representative ${repIdx + 1}` : b.document);
    m.camp(S5.nrt.ca, S5.nrt.en, b.nrt, { obligatori: false });
    m.camp(S5.participacio.ca, S5.participacio.en, b.participacio);
    m.opcions(S5.criteri.ca, S5.criteri.en, ['a', 'b', 'c'].map((c) => ({ ca: c, en: c, marcada: b.criteri === c })));
    m.subtitol(S5.ppe.ca, S5.ppe.en);
    ppe(m, b.ppe || {});
  });
  m.subtitol(S5.declaracio_titol.ca, S5.declaracio_titol.en);
  m.declaracio(S5.declaracio.ca, S5.declaracio.en, d.declaracio_beneficiaris === true);

  const S6 = P.s6;
  const t = d.trust || {};
  m.barra(`6. ${S6.titol.ca}`, S6.titol.en);
  m.siNo(S6.pregunta.ca, S6.pregunta.en, t.forma_part);
  if (t.forma_part) {
    m.subtitol(`${S6.si_si.ca}: ${S6.amb.ca}`, `${S6.si_si.en}: ${S6.amb.en}`);
    m.taula([{ ca: '', en: '', w: 2 }, { ...S6.nom, w: 3 }, { ...S6.nacionalitat, w: 2 }, { ...S6.residencia, w: 2 }],
      (t.parts || []).map((p: Json) => [bi(S6.rols[p.rol as 'fiduciari']), p.nom, pais(p.nacionalitat), pais(p.residencia)]));
  }

  const s = d.sancions || {};
  m.barra(`7. ${P.s7.titol.ca}`, P.s7.titol.en);
  m.siNo(P.s7.establert_ru_by.ca, P.s7.establert_ru_by.en, s.establert_ru_by);
  m.siNo(P.s7.actua_ru_by.ca, P.s7.actua_ru_by.en, s.actua_ru_by);

  proposit(m, 8, d.proposit || {});
  fons(m, 9, P.s9, d.fons || {});
  declaracions(m, 10, P.s10, d.declaracions);
};

export const generaPdfKyc = async (k: DadesKycPdf): Promise<Uint8Array> => {
  const pj = k.tipus === 'kyc_pj';
  const titol = pj ? T.pj.titol : T.pf.titol;
  const quan = k.validacio ? k.validacio.validat_at : k.signatura.signatAt;
  const { pdf, m } = await nouDocument(titol, titol.en, k.clientNom, k.templateVersion, quan);
  const d = k.dades || {};

  avisLegal(m);
  if (pj) kycPj(m, d); else kycPf(m, d);

  // Noms de les persones (documents per persona)
  const persones = new Map<string, string>();
  for (const p of (d.representants || []) as Json[]) persones.set(p.id, p.nom);
  for (const b of (d.beneficiaris || []) as Json[]) persones.set(b.id, b.nom);
  documentacio(m, pj ? 11 : 9, pj ? T.pj.s11 : T.pf.s9, k.adjunts, persones);

  await signaturaClient(m, pj ? 12 : 10, pj ? T.pj.s12.titol : T.pf.s10.titol, k.signatura, pj ? T.pj.s12.avis : undefined);
  await apartatAmbit(m, pj ? 13 : 11, k.tipus, k.validacio);

  // Full d'evidències (pàgina nova)
  m.nova();
  m.y += 8;
  const files = filesSignatura(k.signatura, k.requestId, k.referenciaClient, k.clientNom, pj ? 'pj' : 'pf', k.templateVersion);
  files.splice(4, 0, ['Protecció de dades enllaçada', 'Linked data protection request', k.pdpRequestId]);
  for (const a of k.adjunts) {
    const qui = a.persona ? ` · ${persones.get(a.persona) || a.persona}` : '';
    files.push(['Document adjunt', 'Attached document (SHA-256)', `${a.tipus}${qui} · ${a.nom_fitxer || 'document'} · ${a.sha256}`]);
  }
  m.evidencies({ ca: 'Full d’evidències de la signatura', en: 'Signature evidence sheet' }, files);
  notaEmpremta(m,
    'L’empremta de les dades és el resum SHA-256 de les respostes del formulari i de les empremtes dels documents adjunts, desats en el moment de signar. ' +
    'Qualsevol canvi posterior donaria una empremta diferent. L’empremta d’aquest PDF queda registrada a ÀMBIT Associats en el moment de la signatura.',
    'The data fingerprint is the SHA-256 digest of the form answers and of the fingerprints of the attached documents, stored at the time of signing. ' +
    'Any later change would produce a different fingerprint. The fingerprint of this PDF is recorded by ÀMBIT Associats at the time of signing.');

  if (k.validacio) {
    const v = k.validacio;
    m.espai(6);
    m.evidencies({ ca: 'Validació de l’OCIC', en: 'OCIC validation' }, [
      ['OCIC', 'OCIC', v.ocicNom],
      ['Data i hora de la validació', 'Date and time of validation', dataUtc(v.validat_at)],
      ['Nivell de diligència', 'Due diligence level', bi(T.ambit.nivells[v.nivell])],
      ['Propera revisió', 'Next review', data(v.propera_revisio)],
      ['Marques automàtiques', 'Automatic flags', v.marques.length ? v.marques.map((x) => x.detall).join(' · ') : 'Cap / None'],
      ['Llistes de països aplicades', 'Country lists applied', `UE ${(v.llistes?.UE || []).join(', ') || '—'} · GAFI ${(v.llistes?.GAFI || []).join(', ') || '—'}`],
      ['Evidència de sancions (SHA-256)', 'Sanctions evidence (SHA-256)', v.sancions_evidencia_sha256],
      ['PDF signat pel client (SHA-256)', 'PDF signed by the client (SHA-256)', v.pdfSignatSha256],
      ['Firma de l’OCIC (SHA-256)', 'OCIC signature image (SHA-256)', v.firmaOcicSha256],
    ]);
    notaEmpremta(m,
      'Aquest PDF és la versió final del KYC amb l’apartat reservat a DEL SOTO – PALEARI & ASSOCIATS, SL completat i la firma de l’OCIC, estampada en el moment de validar. ' +
      'El PDF signat pel client es conserva intacte; la seva empremta consta en aquest full.',
      'This PDF is the final version of the KYC with the section reserved for DEL SOTO – PALEARI & ASSOCIATS, SL completed and the OCIC’s signature, applied at the time of validation. ' +
      'The PDF signed by the client is kept unaltered; its fingerprint is shown on this sheet.');
  }

  m.tanca();
  return await pdf.save({ useObjectStreams: false });
};

// ─── Protecció de dades ─────────────────────────────────────────────────────
export const generaPdfPdp = async (p: DadesPdpPdf, partyType: 'pf' | 'pj'): Promise<Uint8Array> => {
  const P = T.pdp;
  const { pdf, m } = await nouDocument(P.titol, P.titol.en, p.clientNom, p.templateVersion, p.signatura.signatAt);
  const { f } = m;

  for (const s of P.seccions as Json[]) {
    m.barra(s.titol.ca, s.titol.en);
    if (s.nota) {
      m.cal(14);
      m.text(`(${s.nota.ca} · ${s.nota.en})`, { font: f.i, mida: 9, color: GRIS, interlinia: 12, justifica: false });
    }
    for (const pg of s.paragrafs || []) m.bilingue(pg.ca, pg.en);
    // Llistes: numerades (finalitats) o amb pic (destinataris, terminis); el
    // tros en negreta, com a la plantilla
    const items: Json[] = s.numerats || s.punts || [];
    items.forEach((it, n) => {
      const marca = s.numerats ? `${n + 1}.` : '•';
      const x = ESQ + 17;
      const ample = AMPLE_UTIL - 17;
      m.cal(40);
      m.page.drawText(marca, { x: ESQ, y: m.y - 13.5, size: MIDA, font: f.r, color: NEGRE });
      m.espai(2);
      negretaIText(m, it.ca_negreta || '', it.ca, x, ample, f.b, f.r, MIDA, NEGRE, 15);
      m.espai(1);
      negretaIText(m, it.en_negreta || '', it.en, x, ample, f.i, f.i, MIDA_EN, GRIS, 11.3);
      m.espai(5);
    });
  }

  // Consentiment: casella no marcada per defecte, voluntària
  m.barra(P.consentiment.titol.ca, P.consentiment.titol.en);
  m.declaracio(P.consentiment.ca, P.consentiment.en, p.consentiment);

  m.cal(300);
  m.barra(P.signatura.titol.ca, P.signatura.titol.en);
  m.bilingue(P.signatura.declaracio.ca, P.signatura.declaracio.en);
  m.camp(T.signatura.lloc.ca, T.signatura.lloc.en, p.signatura.lloc);
  m.camp(T.signatura.data.ca, T.signatura.data.en, dataLocal(p.signatura.signatAt));
  await m.firma(T.signatura.signatura.ca, T.signatura.signatura.en, p.signatura.png,
    [p.signatura.signatariNom, p.signatura.signatariCarrec].filter(Boolean).join(' · '));
  m.cal(30);
  m.page.drawText('Signat electrònicament al portal de signatura d’ÀMBIT Associats', { x: ESQ, y: m.y - 11, size: 11.5, font: f.b, color: VERD_FOSC });
  m.page.drawText('Signed electronically through the ÀMBIT Associats signing portal', { x: ESQ, y: m.y - 24, size: 8.2, font: f.i, color: GRIS });
  m.espai(32);

  m.nova();
  m.y += 8;
  const files = filesSignatura(p.signatura, p.requestId, p.referenciaClient, p.clientNom, partyType, p.templateVersion);
  files.splice(4, 0, ['KYC enllaçat', 'Linked KYC request', p.kycRequestId]);
  files.push(['Comunicacions comercials', 'Marketing communications',
    p.consentiment ? 'Autoritzades (casella marcada pel client) / Authorised (box ticked by the client)'
                   : 'No autoritzades (casella no marcada) / Not authorised (box not ticked)']);
  m.evidencies({ ca: 'Full d’evidències de la signatura', en: 'Signature evidence sheet' }, files);
  notaEmpremta(m,
    'L’empremta de les dades és el resum SHA-256 de les dades d’aquesta informació (versió de la plantilla, client, resposta sobre les comunicacions comercials i signant) desades en el moment de signar. ' +
    'Aquesta signatura és diferent de la del formulari KYC. L’empremta d’aquest PDF queda registrada a ÀMBIT Associats en el moment de la signatura.',
    'The data fingerprint is the SHA-256 digest of the data of this notice (template version, client, answer on marketing communications and signatory) stored at the time of signing. ' +
    'This signature is separate from the one on the KYC form. The fingerprint of this PDF is recorded by ÀMBIT Associats at the time of signing.');

  m.tanca();
  return await pdf.save({ useObjectStreams: false });
};

// Paràgraf amb un inici en negreta i la resta normal (llistes de la PDP)
const negretaIText = (m: Maqueta, negreta: string, resta: string, x: number, ample: number,
  fontN: any, fontR: any, mida: number, color: RGB, interlinia: number) => {
  // Es parteix tot el text en paraules marcant quines són en negreta
  const paraules: { t: string; n: boolean }[] = [
    ...negreta.split(/\s+/).filter(Boolean).map((t) => ({ t, n: true })),
    ...resta.split(/\s+/).filter(Boolean).map((t) => ({ t, n: false })),
  ];
  // Puntuació enganxada a la negreta (", inclosos..."): sense espai abans
  const enganxa = (i: number) => i > 0 && paraules[i - 1].n && !paraules[i].n && /^[,.:;]/.test(paraules[i].t);
  const amplada = (p: { t: string; n: boolean }) => (p.n ? fontN : fontR).widthOfTextAtSize(p.t, mida);
  const espai = fontR.widthOfTextAtSize(' ', mida);
  const linies2: { p: typeof paraules[number]; enganxat: boolean }[][] = [];
  let actual: { p: typeof paraules[number]; enganxat: boolean }[] = [];
  let w = 0;
  paraules.forEach((p, i) => {
    const eng = enganxa(i);
    const extra = (actual.length && !eng ? espai : 0) + amplada(p);
    if (actual.length && w + extra > ample) { linies2.push(actual); actual = []; w = 0; }
    actual.push({ p, enganxat: eng && actual.length > 0 });
    w += (actual.length > 1 && !eng ? espai : 0) + amplada(p);
  });
  if (actual.length) linies2.push(actual);
  linies2.forEach((l, idx) => {
    m.cal(interlinia);
    m.y -= mida * 0.95;
    const darrera = idx === linies2.length - 1;
    const ampleParaules = l.reduce((s, x) => s + amplada(x.p), 0);
    const forats = l.filter((x, i) => i > 0 && !x.enganxat).length;
    const sep = !darrera && forats > 0 ? (ample - ampleParaules) / forats : espai;
    let cx = x;
    l.forEach((x2, i) => {
      if (i > 0 && !x2.enganxat) cx += sep;
      m.page.drawText(x2.p.t, { x: cx, y: m.y, size: mida, font: x2.p.n ? fontN : fontR, color });
      cx += amplada(x2.p);
    });
    m.y -= interlinia - mida * 0.95;
  });
};
