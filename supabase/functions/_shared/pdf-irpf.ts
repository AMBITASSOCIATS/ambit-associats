// supabase/functions/_shared/pdf-irpf.ts
//
// PDF de la comunicació de dades personals i familiars al pagador (IRPF).
// Mateix format ÀMBIT que l'autorització de càrrec i el KYC, amb la mateixa
// maquetació (Maqueta de pdf-kyc.ts): Carlito, cos de 12 punts, barres verdes
// #009B9C amb el català a l'esquerra i l'anglès en cursiva a la dreta, camps
// en requadre, barres que mai queden soles al peu i full d'evidències.
// Diferències que demana la comunicació:
//  · sense logotip d'ÀMBIT: a dalt a l'esquerra, la denominació social i
//    l'NRT del pagador en verd; el títol a la dreta;
//  · peu "Document gestionat per DEL SOTO – PALEARI & ASSOCIATS, SL per compte
//    de [pagador]", amb les dades de contacte d'ÀMBIT i "n/N".
// Versions:
//  · perceptor: el que signa i descarrega el perceptor (la recepció pel
//    pagador, buida si encara no l'ha signada el representant);
//  · copia: la còpia final per al perceptor, amb la recepció signada;
//  · intern: el PDF d'ÀMBIT, amb el full intern del càlcul del percentatge
//    (mai a cap de les còpies del perceptor).
// Tots els textos de la comunicació surten de text-irpf.json (còpia literal
// de la plantilla).

import { PDFDocument, PDFPage } from 'npm:pdf-lib@1.17.1';
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1';
import T from './text-irpf.json' with { type: 'json' };
import {
  ALT, AMPLE_UTIL, DRE, ESQ, Fonts, GRIS, GRIS_CLAR, VERD, VERD_FOSC, dataLocal, dataUtc, linies, llegeixActiu,
} from './pdf.ts';
import { Bi, Disseny, Maqueta, Signatura, accelera } from './pdf-kyc.ts';
import { euros, percent } from './irpf-calcul.js';
import { requereixConsentiment } from './irpf-regles.js';

type Json = Record<string, any>;

export type Pagador = { denominacio: string; nrt: string; domicili: string };

export type Recepcio = {
  nom: string;
  carrec: string;
  signatAt: Date;
  ip: string | null;
  userAgent: string | null;
  empremtaDades: string;
  png: Uint8Array;
  sha256: string;
  mateixaSessio: boolean;
};

export type Calcul = {
  exercici: number;
  dataEfectes: string;
  mode: 'comunicacio' | 'sense_comunicacio';
  retribucions: string;
  cotitzacions: string;
  percentatge: string;
  percentatgeAplicat: string;
  parametres: Json;
  detall: Json;          // sortida de calcula() (irpf-calcul.js)
  creatPer: string;      // correu de qui l'ha fet
  creatAt: Date;
  pdfSignatSha256: string | null;
};

export type DadesIrpfPdf = {
  mode: 'perceptor' | 'copia' | 'intern';
  requestId: string;
  referenciaClient: string | null;
  templateVersion: string;
  pagador: Pagador;
  perceptor: { nom: string; nrt: string };
  dades: Json | null;              // null: càlcul sense comunicació (només el full intern)
  signatura: Signatura | null;
  recepcio?: Recepcio | null;
  calcul?: Calcul;
};

// ─── Formats ────────────────────────────────────────────────────────────────
const data = (s: string | null | undefined): string => {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return '';
  const [a, m, d] = s.split('-');
  return `${d}/${m}/${a}`;
};
const bi = (o: Bi) => (o.ca === o.en ? o.ca : `${o.ca} / ${o.en}`);
const siNo = (v: unknown) => (v === true ? bi(T.si_no.si) : v === false ? bi(T.si_no.no) : '');
const majuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const imp = (v: string | null | undefined) => {
  if (!v) return '';
  const [e, d = '00'] = String(v).split('.');
  return euros(Number(e) * 100 + Number((d + '00').slice(0, 2)));
};
const gestionat = (o: string, pagador: string) => o.replace('{pagador}', pagador);

// ─── Capçalera i peu ────────────────────────────────────────────────────────
const disseny = (pagador: Pagador): Disseny => ({
  // A l'esquerra, el pagador en verd; a la dreta, el títol en verd i
  // l'anglès a sota, en cursiva grisa
  capcalera: (page: PDFPage, f: Fonts) => {
    const ampleEsq = 190;
    const xDreta = ESQ + ampleEsq + 16;
    const ampleDreta = DRE - xDreta;
    let yE = ALT - 47;
    for (const l of linies(pagador.denominacio, f.b, 12, ampleEsq).slice(0, 3)) {
      page.drawText(l, { x: ESQ, y: yE, size: 12, font: f.b, color: VERD });
      yE -= 14;
    }
    page.drawText(`NRT ${pagador.nrt}`, { x: ESQ, y: yE - 1, size: 10, font: f.r, color: VERD });
    yE -= 14;

    let yD = ALT - 47;
    for (const l of linies(T.titol.ca, f.b, 11.5, ampleDreta)) {
      page.drawText(l, { x: DRE - f.b.widthOfTextAtSize(l, 11.5), y: yD, size: 11.5, font: f.b, color: VERD });
      yD -= 13.5;
    }
    yD -= 1;
    for (const l of linies(T.titol.en, f.i, 8.8, ampleDreta)) {
      page.drawText(l, { x: DRE - f.i.widthOfTextAtSize(l, 8.8), y: yD, size: 8.8, font: f.i, color: GRIS });
      yD -= 10.5;
    }
    const yLinia = Math.min(yE, yD) - 2;
    page.drawLine({ start: { x: ESQ, y: yLinia }, end: { x: DRE, y: yLinia }, thickness: 1.2, color: VERD });
    return yLinia - 11;
  },
  peu: (page: PDFPage, f: Fonts, num: number, total: number) => {
    const mida = 7.2;
    const ajusta = (t: string, font: any) => {
      let m = mida;
      while (m > 5.5 && font.widthOfTextAtSize(t, m) > AMPLE_UTIL) m -= 0.2;
      return m;
    };
    page.drawLine({ start: { x: ESQ, y: 64 }, end: { x: DRE, y: 64 }, thickness: 0.6, color: VERD });
    const ca = gestionat(T.pdf.gestionat.ca, pagador.denominacio);
    const en = gestionat(T.pdf.gestionat.en, pagador.denominacio);
    page.drawText(ca, { x: ESQ, y: 54, size: ajusta(ca, f.r), font: f.r, color: GRIS });
    page.drawText(en, { x: ESQ, y: 44.5, size: ajusta(en, f.i), font: f.i, color: GRIS });
    page.drawText(T.peu[0], { x: ESQ, y: 33, size: ajusta(T.peu[0], f.r), font: f.r, color: GRIS });
    page.drawText(T.peu[1], { x: ESQ, y: 22, size: mida, font: f.r, color: GRIS });
    const pag = `${num}/${total}`;
    page.drawText(pag, { x: DRE - f.r.widthOfTextAtSize(pag, mida), y: 22, size: mida, font: f.r, color: GRIS });
  },
  baix: 80,
});

const nouDocument = async (d: DadesIrpfPdf, data: Date, clau: string) => {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`${T.titol.ca} · ${d.perceptor.nom}`);
  pdf.setAuthor('DEL SOTO – PALEARI & ASSOCIATS, SL');
  pdf.setSubject(T.titol.en);
  pdf.setKeywords([clau]);
  pdf.setCreator(`Portal de signatura ÀMBIT · ${d.templateVersion}`);
  pdf.setProducer('Portal de signatura ÀMBIT');
  pdf.setCreationDate(data);
  pdf.setModificationDate(data);
  // Només els tipus de lletra: aquest document no porta el logotip d'ÀMBIT
  pdf.registerFontkit(fontkit);
  const [reg, neg, cur] = await Promise.all([
    llegeixActiu('Carlito-Regular.ttf'), llegeixActiu('Carlito-Bold.ttf'), llegeixActiu('Carlito-Italic.ttf'),
  ]);
  const f: Fonts = {
    r: await pdf.embedFont(reg, { subset: true }),
    b: await pdf.embedFont(neg, { subset: true }),
    i: await pdf.embedFont(cur, { subset: true }),
  };
  accelera(f.r);
  accelera(f.b);
  accelera(f.i);
  const m = new Maqueta(pdf, f, null, T.titol, disseny(d.pagador));
  m.nova();
  return { pdf, m };
};

// ─── Blocs ──────────────────────────────────────────────────────────────────
const noEscau = (m: Maqueta) => m.bilingue(T.pdf.no_escau.ca, T.pdf.no_escau.en);

const subtitolDocument = (m: Maqueta) => {
  const { f } = m;
  m.cal(40);
  m.espai(2);
  m.text(T.subtitol.ca, { font: f.b, mida: 11, color: VERD_FOSC, interlinia: 13.5, justifica: false });
  m.espai(1);
  m.text(T.subtitol.en, { font: f.i, mida: 8.8, color: GRIS, interlinia: 10.5, justifica: false });
  m.espai(4);
};

const persones = (m: Maqueta, tipus: 'descendents' | 'ascendents' | 'tutelats', llista: Json[]) => {
  const S5 = T.s5;
  llista.forEach((x, i) => {
    m.subtitol(`${i + 1}. ${x.nom || '—'}`);
    m.camp(S5.nom.ca, S5.nom.en, x.nom);
    m.camp(majuscula(S5.nrt.ca), S5.nrt.en, x.nrt, { obligatori: false });
    m.camp(majuscula(S5.document.ca), majuscula(S5.document.en), x.document, { obligatori: false });
    m.camp(majuscula(S5.any_naixement.ca), majuscula(S5.any_naixement.en), x.any_naixement);
    m.siNo(S5.conviu.ca, S5.conviu.en, x.conviu);
    m.siNo(S5.rendes.ca, S5.rendes.en, x.rendes_superiors);
    m.siNo(S5.discapacitat.ca, S5.discapacitat.en, x.discapacitat);
    if (tipus === 'ascendents') m.siNo(T.s6.dependencia.ca, T.s6.dependencia.en, x.dependencia);
    const P = tipus === 'descendents' ? S5.persones : T.persones_dret;
    m.camp(majuscula(P.ca), P.en, x.persones);
    if (tipus === 'descendents') m.camp(S5.matricules.ca, S5.matricules.en, imp(x.matricules), { obligatori: false });
  });
};

const comunicacio = (m: Maqueta, d: DadesIrpfPdf) => {
  const dd = d.dades || {};
  const c = dd.comunicacio || {};
  const p = dd.perceptor || {};

  subtitolDocument(m);
  T.introduccio.ca.forEach((t, i) => m.bilingue(t, T.introduccio.en[i]));

  // 0
  m.barra(`0. ${T.s0.titol.ca}`, T.s0.titol.en);
  m.opcions(T.s0.titol.ca, T.s0.titol.en, [
    { ...T.s0.inicial, marcada: c.tipus === 'inicial' },
    { ...T.s0.modificacio, marcada: c.tipus === 'modificacio' },
  ]);
  if (c.tipus === 'modificacio') {
    m.opcions(majuscula(T.s0.modifica.ca), majuscula(T.s0.modifica.en),
      (['perceptor', 'familiars', 'economiques'] as const).map((k) => ({ ...T.s0.opcions[k], marcada: (c.modifica || []).includes(k) })));
  }

  // 1
  const S1 = T.s1;
  m.barra(`1. ${S1.titol.ca}`, S1.titol.en);
  m.camp(S1.nom.ca, S1.nom.en, p.nom);
  m.camp(S1.nrt.ca, S1.nrt.en, p.nrt);
  m.camp(S1.document.ca, S1.document.en, p.document);
  m.camp(S1.domicili.ca, S1.domicili.en, p.domicili);
  m.camp(S1.contacte.ca, S1.contacte.en, [p.email, p.telefon].filter(Boolean).join(' · '), { obligatori: false });
  m.camp(S1.representant.ca, S1.representant.en,
    [p.representant_nom, p.representant_nrt && `NRT ${p.representant_nrt}`].filter(Boolean).join(' · '), { obligatori: false });
  m.siNo(S1.incapacitat.ca, S1.incapacitat.en, p.incapacitat);

  // 2
  const S2 = T.s2;
  m.barra(`2. ${S2.titol.ca}`, S2.titol.en);
  m.camp(S2.denominacio.ca, S2.denominacio.en, d.pagador.denominacio);
  m.camp(S2.nrt.ca, S2.nrt.en, d.pagador.nrt);
  m.camp(S2.domicili.ca, S2.domicili.en, d.pagador.domicili);

  // 3
  const S3 = T.s3;
  const ec = dd.estat_civil || {};
  m.barra(`3. ${S3.titol.ca}`, S3.titol.en);
  m.opcions(S3.titol.ca, S3.titol.en, Object.entries(S3.opcions).map(([k, o]) => ({ ...(o as Bi), marcada: ec.estat === k })));
  m.camp(S3.des_de.ca, S3.des_de.en, data(ec.des_de), { obligatori: false });

  // 4 (només si està casat/ada o en parella estable)
  const S4 = T.s4;
  m.barra(`4. ${S4.titol.ca}`, S4.titol.en);
  if (ec.estat === 'casat') {
    const cj = dd.conjuge || {};
    m.camp(S4.nom.ca, S4.nom.en, cj.nom);
    m.camp(majuscula(S4.nrt.ca), S4.nrt.en, cj.nrt, { obligatori: false });
    m.camp(majuscula(S4.document.ca), majuscula(S4.document.en), cj.document);
    m.opcions(S4.situacio.ca, S4.situacio.en, (['a', 'b', 'c'] as const).map((k) => ({
      ca: `${k}) ${S4.opcions[k].ca}`, en: S4.opcions[k].en, marcada: cj.situacio === k,
    })));
    if (cj.situacio === 'c') m.camp(S4.import.ca.replace(/:$/, ''), S4.import.en.replace(/:$/, ''), imp(cj.rendes));
    m.avis(S4.ajuda);
  } else {
    noEscau(m);
  }

  // 5, 6 i 7
  const blocs: [number, 'descendents' | 'ascendents' | 'tutelats', Json][] = [[5, 'descendents', T.s5], [6, 'ascendents', T.s6], [7, 'tutelats', T.s7]];
  for (const [n, k, S] of blocs) {
    m.barra(`${n}. ${S.titol.ca}`, S.titol.en);
    const llista: Json[] = dd[k] || [];
    if (!llista.length) { noEscau(m); continue; }
    if (S.ajuda) m.avis(S.ajuda);
    persones(m, k, llista);
  }

  // 8
  const S8 = T.s8;
  const a = dd.altres || {};
  m.barra(`8. ${S8.titol.ca}`, S8.titol.en);
  const ambImport = (['habitatge', 'pensions', 'plans'] as const).filter((k) => a[k]?.import && Number(a[k].import) > 0);
  if (!ambImport.length) {
    noEscau(m);
  } else {
    m.avis(S8.ajuda);
    for (const k of ambImport) {
      const x = a[k];
      const parts = [imp(x.import), `${S8.any.ca} / ${S8.any.en}: ${x.any || '—'}`];
      if (k === 'pensions' && x.origen) parts.push(`${S8.origen.ca} / ${S8.origen.en}: ${bi((S8.origens as Json)[x.origen])}`);
      m.camp(S8[k].ca, S8[k].en, parts.join(' · '), { obligatori: false });
    }
  }

  // 9
  m.barra(`9. ${T.s9.titol.ca}`, T.s9.titol.en);
  m.bilingue(T.s9.text.ca, T.s9.text.en);
  m.camp(T.s9.titol.ca, T.s9.titol.en, data(dd.data_efectes));

  // 10
  m.barra(`10. ${T.s10.titol.ca}`, T.s10.titol.en);
  T.s10.punts.forEach((pt, i) => m.declaracio(pt.ca, pt.en, dd.declaracions?.[`d${i + 1}`] === true));
  if (requereixConsentiment(dd)) m.declaracio(T.s10.consentiment.ca, T.s10.consentiment.en, dd.declaracions?.consentiment === true);
};

const signatures = async (m: Maqueta, d: DadesIrpfPdf) => {
  const s = d.signatura!;
  const S11 = T.s11;
  m.cal(250);
  m.barra(`11. ${S11.titol.ca}`, S11.titol.en);
  m.camp(S11.lloc.ca, S11.lloc.en, s.lloc);
  m.camp(S11.data.ca, S11.data.en, dataLocal(s.signatAt));
  await m.firma(S11.signatura.ca, S11.signatura.en, s.png, s.signatariNom);

  const S12 = T.s12;
  const r = d.recepcio || null;
  m.cal(250);
  m.barra(`12. ${S12.titol.ca}`, S12.titol.en);
  m.bilingue(S12.text.ca, S12.text.en);
  m.camp(S12.representant.ca, S12.representant.en, r ? `${r.nom} · ${r.carrec}` : null);
  m.camp(S11.data.ca, S11.data.en, r ? dataLocal(r.signatAt) : null);
  await m.firma(S11.signatura.ca, S11.signatura.en, r ? r.png : null, r ? r.nom : undefined);

  m.cal(30);
  m.page.drawText('Signat electrònicament al portal de signatura d’ÀMBIT Associats', { x: ESQ, y: m.y - 11, size: 11.5, font: m.f.b, color: VERD_FOSC });
  m.page.drawText('Signed electronically through the ÀMBIT Associats signing portal', { x: ESQ, y: m.y - 24, size: 8.2, font: m.f.i, color: GRIS });
  m.espai(32);
};

const proteccioDades = (m: Maqueta) => {
  const S13 = T.s13;
  m.barra(`13. ${S13.titol.ca}`, S13.titol.en);
  S13.paragrafs.ca.forEach((t, i) => m.bilingue(t, S13.paragrafs.en[i], { abans: i ? 0 : 2, despres: 4 }));
};

const notaEmpremta = (m: Maqueta, ca: string, en: string) => {
  m.cal(90);   // la nota no es parteix entre dues pàgines
  m.espai(10);
  m.text(ca, { mida: 9.5, interlinia: 12.5 });
  m.espai(2);
  m.text(en, { font: m.f.i, mida: 8.2, color: GRIS, interlinia: 10.5 });
};

const evidencies = (m: Maqueta, d: DadesIrpfPdf) => {
  const s = d.signatura!;
  const r = d.recepcio || null;
  m.nova();
  m.espai(-8);
  m.evidencies({ ca: 'Full d’evidències de la signatura', en: 'Signature evidence sheet' }, [
    ['Data i hora de la signatura', 'Date and time of signature', dataUtc(s.signatAt)],
    ['Adreça IP', 'IP address', s.ip || 'No disponible / Not available'],
    ['Navegador', 'Browser', s.userAgent || 'No disponible / Not available'],
    ['Referència de la sol·licitud', 'Request reference', d.requestId],
    ['Referència del client', 'Client reference', d.referenciaClient || 'Pendent d’assignar / To be assigned'],
    ['Pagador', 'Payer', `${d.pagador.denominacio} · NRT ${d.pagador.nrt}`],
    ['Perceptor', 'Recipient', `${d.perceptor.nom} · NRT ${d.perceptor.nrt}`],
    ['Signant', 'Signatory', s.signatariNom],
    ['Versió de la plantilla', 'Template version', d.templateVersion],
    ['Empremta de les dades (SHA-256)', 'Data fingerprint (SHA-256)', s.empremtaDades],
    ['Empremta de la firma (SHA-256)', 'Signature image fingerprint (SHA-256)', s.sha256],
  ]);
  if (r) {
    m.espai(6);
    m.evidencies({ ca: 'Recepció pel pagador', en: 'Receipt by the payer' }, [
      ['Representant del pagador', 'Payer’s representative', `${r.nom} · ${r.carrec}`],
      ['Data i hora de la recepció', 'Date and time of receipt', dataUtc(r.signatAt)],
      ['Signada en la mateixa sessió', 'Signed in the same session',
        r.mateixaSessio ? 'Sí: el perceptor és el representant del pagador / Yes: the recipient is the payer’s representative' : 'No / No'],
      ['Adreça IP', 'IP address', r.ip || 'No disponible / Not available'],
      ['Navegador', 'Browser', r.userAgent || 'No disponible / Not available'],
      ['Empremta de la recepció (SHA-256)', 'Receipt fingerprint (SHA-256)', r.empremtaDades],
      ['Empremta de la firma (SHA-256)', 'Signature image fingerprint (SHA-256)', r.sha256],
    ]);
  }
  notaEmpremta(m,
    'L’empremta de les dades és el resum SHA-256 de les respostes de la comunicació, de les dades del pagador i del signant, desats en el moment de signar. ' +
    'L’empremta de la recepció inclou la de la comunicació signada pel perceptor. Qualsevol canvi posterior donaria una empremta diferent. ' +
    'L’empremta d’aquest PDF queda registrada a ÀMBIT Associats en el moment de la signatura.',
    'The data fingerprint is the SHA-256 digest of the answers of the communication, of the payer’s details and of the signatory, stored at the time of signing. ' +
    'The receipt fingerprint includes that of the communication signed by the recipient. Any later change would produce a different fingerprint. ' +
    'The fingerprint of this PDF is recorded by ÀMBIT Associats at the time of signing.');
};

// ─── Full intern del càlcul (només al PDF d'ÀMBIT) ──────────────────────────
const PARAMS: [string, string, string, 'eur' | 'pc' | 'n' | 'coef'][] = [
  ['minim_personal', 'Mínim personal', 'Personal allowance', 'eur'],
  ['minim_incapacitat', 'Mínim per incapacitat', 'Allowance for incapacity', 'eur'],
  ['limit_conjuge', 'Límit conjunt amb cònjuge', 'Joint limit with spouse', 'eur'],
  ['reduccio_familiar', 'Reducció per persona', 'Allowance per person', 'eur'],
  ['coeficient_discapacitat', 'Coeficient per discapacitat o dependència', 'Disability or dependency coefficient', 'coef'],
  ['max_matricules', 'Matrícules (màxim per descendent)', 'Tuition fees (maximum per descendant)', 'eur'],
  ['salari_minim', 'Salari mínim interprofessional', 'Minimum wage', 'eur'],
  ['habitatge_percentatge', 'Habitatge (percentatge)', 'Main residence (rate)', 'pc'],
  ['habitatge_maxim', 'Habitatge (màxim)', 'Main residence (maximum)', 'eur'],
  ['plans_percentatge', 'Plans de pensions (percentatge dels rendiments)', 'Pension plans (rate of income)', 'pc'],
  ['plans_maxim', 'Plans de pensions (màxim)', 'Pension plans (maximum)', 'eur'],
  ['tipus', 'Tipus de gravamen', 'Tax rate', 'pc'],
  ['bonificacio_percentatge', 'Bonificació (percentatge)', 'Tax credit (rate)', 'pc'],
  ['bonificacio_maxim', 'Bonificació (màxim)', 'Tax credit (maximum)', 'eur'],
  ['despeses_percentatge', 'Despeses del treball (percentatge)', 'Employment expenses (rate)', 'pc'],
  ['despeses_maxim', 'Despeses del treball (màxim)', 'Employment expenses (maximum)', 'eur'],
  ['edat_descendents', 'Edat dels descendents (menors de)', 'Age of descendants (under)', 'n'],
  ['edat_ascendents', 'Edat dels ascendents (majors de)', 'Age of ascendants (over)', 'n'],
  ['regularitzacio_llindar', 'Regularització: variació mínima', 'Adjustment: minimum variation', 'pc'],
  ['regularitzacio_maxim', 'Regularització: percentatge màxim', 'Adjustment: maximum rate', 'pc'],
];
const valorParam = (v: unknown, t: 'eur' | 'pc' | 'n' | 'coef') => {
  const n = Number(v);
  if (t === 'n') return String(n);
  if (t === 'coef') return String(n).replace('.', ',');
  const c = Math.round(n * 100);
  return t === 'eur' ? euros(c) : percent(c);
};
const percentText = (v: string) => percent(Math.round(Number(v) * 100));

// Amb comunicació, en una pàgina nova després de les evidències; sense
// comunicació, és l'únic contingut del document
const fullIntern = (m: Maqueta, d: DadesIrpfPdf, paginaNova: boolean) => {
  const c = d.calcul!;
  const det = c.detall || {};
  const { f } = m;
  if (paginaNova) m.nova();
  m.espai(-8);
  m.barra('Full intern · càlcul del percentatge de retenció', 'Internal sheet · withholding rate calculation');
  m.cal(30);
  m.text('Ús intern de DEL SOTO – PALEARI & ASSOCIATS, SL. Aquest full no forma part de la comunicació ni de la còpia del perceptor.',
    { font: f.b, mida: 9.5, color: VERD_FOSC, interlinia: 12, justifica: false });
  m.text('For internal use of DEL SOTO – PALEARI & ASSOCIATS, SL. This sheet is not part of the communication nor of the recipient’s copy.',
    { font: f.i, mida: 8, color: GRIS, interlinia: 10, justifica: false });
  m.espai(4);

  const reg = det.regularitzacio;
  m.evidencies({ ca: 'Resultat', en: 'Result' }, [
    ['Perceptor', 'Recipient', `${d.perceptor.nom} · NRT ${d.perceptor.nrt}`],
    ['Exercici', 'Tax year', String(c.exercici)],
    ['Data d’efectes del percentatge', 'Effective date of the rate', data(c.dataEfectes)],
    ['Dades', 'Data', c.mode === 'comunicacio'
      ? 'Comunicació signada pel perceptor i rebuda pel pagador / Communication signed by the recipient and received by the payer'
      : 'Sense comunicació (art. 24.4 del Reglament) / No communication (Art. 24.4 of the Regulation)'],
    ['Retribucions anuals estimades', 'Estimated annual remuneration', imp(c.retribucions)],
    ['Cotitzacions a càrrec del perceptor', 'Contributions borne by the recipient', imp(c.cotitzacions)],
    ['Percentatge calculat', 'Calculated rate', percentText(c.percentatge)],
    ['Percentatge aplicat', 'Rate applied', percentText(c.percentatgeAplicat)],
    ['Regularització (art. 25)', 'Adjustment (Art. 25)', !reg ? 'Primer càlcul de l’exercici / First calculation of the tax year'
      : reg.aplica ? `Sí: variació de ${percent(reg.variacio)} respecte de ${percent(reg.anterior)} / Yes`
        : `No: variació de ${percent(reg.variacio)}; es manté ${percent(reg.anterior_aplicat)} / No`],
    ...(det.data_coneixement ? [['Variació coneguda pel pagador el', 'Change known to the payer on',
      `${data(det.data_coneixement)} (s'aplica des del mes següent, art. 27.1.b / applies from the following month)`] as [string, string, string]] : []),
    ['Calculat per', 'Calculated by', `${c.creatPer} · ${dataUtc(c.creatAt)}`],
    ...(c.pdfSignatSha256 ? [['PDF de la comunicació (SHA-256)', 'Communication PDF (SHA-256)', c.pdfSignatSha256] as [string, string, string]] : []),
  ]);

  // Avisos que no bloquegen (p. ex. la situació del cònjuge fora de termini)
  for (const a of (det.avisos || []) as Bi[]) {
    m.cal(28);
    m.espai(6);
    m.text(a.ca, { font: f.b, mida: 9.5, color: VERD_FOSC, interlinia: 12, justifica: false });
    m.text(a.en, { font: f.i, mida: 8, color: GRIS, interlinia: 10, justifica: false });
  }

  // Passos del càlcul
  m.barra('Passos del càlcul (art. 24.1 del Reglament)', 'Calculation steps (Art. 24.1 of the Regulation)');
  m.taula([
    { ca: 'pas', en: 'step', w: 0.6 }, { ca: 'concepte', en: 'item', w: 3 }, { ca: 'fórmula', en: 'formula', w: 5.4 }, { ca: 'import', en: 'amount', w: 1.8 },
  ], (det.passos || []).map((p: Json) => [
    p.num, p.ca, p.formula, typeof p.valor === 'number' ? euros(p.valor) : (p.valor || ''),
  ]));

  // Persones dels apartats 5, 6 i 7
  if ((det.persones || []).length) {
    m.barra('Reduccions familiars per persona', 'Family allowances per person');
    m.taula([
      { ca: 'persona', en: 'person', w: 3 }, { ca: 'edat a 31/12', en: 'age at 31/12', w: 1.2 },
      { ca: 'càlcul', en: 'calculation', w: 4.6 }, { ca: 'import', en: 'amount', w: 1.6 },
    ], det.persones.map((p: Json) => [
      `${p.nom} (${p.tipus === 'descendents' ? 'descendent' : p.tipus === 'ascendents' ? 'ascendent' : 'tutela o acolliment'})`,
      p.edat === null || p.edat === undefined ? '—' : String(p.edat),
      p.formula,
      euros((p.reduccio || 0) + (p.matricules || 0)),
    ]));
  }

  // Paràmetres de l'exercici aplicats
  m.barra(`Paràmetres de l’exercici ${c.exercici}`, `Parameters for tax year ${c.exercici}`);
  m.taula([{ ca: 'paràmetre', en: 'parameter', w: 4 }, { ca: '', en: '', w: 2.4 }, { ca: 'valor', en: 'value', w: 1.6 }],
    PARAMS.map(([k, ca, en, t]) => [ca, en, valorParam(c.parametres?.[k], t)]));

  // Separació final
  m.cal(4);
  m.page.drawLine({ start: { x: ESQ, y: m.y }, end: { x: DRE, y: m.y }, thickness: 0.5, color: GRIS_CLAR });
};

// ─── Document ───────────────────────────────────────────────────────────────
export const generaPdfIrpf = async (d: DadesIrpfPdf): Promise<Uint8Array> => {
  const quan = d.mode === 'intern' && d.calcul ? d.calcul.creatAt
    : d.mode === 'copia' && d.recepcio ? d.recepcio.signatAt : d.signatura?.signatAt || new Date();
  const { pdf, m } = await nouDocument(d, quan, `irpf-${d.mode}`);

  const ambComunicacio = !!(d.dades && d.signatura);
  if (ambComunicacio) {
    comunicacio(m, d);
    await signatures(m, d);
    proteccioDades(m);
    evidencies(m, d);
  }
  // El full intern del càlcul només va al PDF d'ÀMBIT
  if (d.mode === 'intern' && d.calcul) fullIntern(m, d, ambComunicacio);

  m.tanca();
  return await pdf.save({ useObjectStreams: false });
};
