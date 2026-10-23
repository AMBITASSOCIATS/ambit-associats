// supabase/functions/_shared/pdf-contracte.ts
//
// PDF final del contracte: el PDF original, intacte (els seus bytes queden
// sense tocar al principi del fitxer, vegeu pdf-incremental.ts), i a
// continuació les pàgines afegides (CONTRACTE v1):
//   1. Clàusula addicional. Signatura electrònica.
//   2. Signatures: cada signant del client i, al final, la d'ÀMBIT.
//   3. Full d'evidències.
// Mateix format ÀMBIT que el KYC (Carlito, verd #009B9C i variants, capçalera
// amb logotip, barres de secció, camps en requadre, peu amb "n/N"). Idioma:
// 'ca' (només català) o 'ca_en' (català i, a sota, l'anglès en cursiva).
// Tots els textos surten de text-contracte.json.

import { PDFDocument, PDFPage } from 'npm:pdf-lib@1.17.1';
import T from './text-contracte.json' with { type: 'json' };
import { AMPLE_UTIL, DRE, ESQ, Fonts, GRIS, GRIS_CLAR, NEGRE, VERD_FOSC, capcalera, carregaRecursos, dataLocal, dataUtc, linies, peu } from './pdf.ts';
import { Bi, MIDA, MIDA_EN, Maqueta, accelera } from './pdf-kyc.ts';
import { afegeixIncremental } from './pdf-incremental.ts';

export const VERSIO_CONTRACTE = T.versio;

export type SignantPdf = {
  ordre: number;
  nom: string;
  qualitat: string;
  lloc: string;
  acceptatAt: Date;
  signatAt: Date;
  ip: string | null;
  userAgent: string | null;
  empremtaDades: string;
  png: Uint8Array;
  sha256: string;
};

export type DadesContractePdf = {
  requestId: string;
  idioma: 'ca' | 'ca_en';
  titol: string;
  clientNom: string;
  partyType: 'pf' | 'pj';
  templateVersion: string;
  original: { nomFitxer: string; pagines: number; sha256: string; mida: number };
  signants: SignantPdf[];
  ambit: { nom: string; carrec: string; signatAt: Date; imatge: Uint8Array; sha256: string };
};

// Text en l'idioma del contracte: amb "Català", l'anglès queda buit i no es dibuixa
const textos = (idioma: 'ca' | 'ca_en') => (o: Bi): Bi => ({ ca: o.ca, en: idioma === 'ca_en' ? o.en : '' });

export const generaPdfContracte = (original: Uint8Array, d: DadesContractePdf): Promise<Uint8Array> =>
  afegeixIncremental(original, async (pdf: PDFDocument) => {
    const t = textos(d.idioma);
    const P = T.pdf;
    const { f, logo } = await carregaRecursos(pdf);
    accelera(f.r);
    accelera(f.b);
    accelera(f.i);

    const titolPagines = t(P.capcalera);
    // Les pàgines afegides es numeren a continuació de les de l'original
    const m = new Maqueta(pdf, f, logo, titolPagines, {
      capcalera: (page: PDFPage, fonts: Fonts) => { capcalera(page, fonts, logo, titolPagines); return 841.89 - 100; },
      peu: (page: PDFPage, fonts: Fonts, num: number, total: number) => peu(page, fonts, d.original.pagines + num, d.original.pagines + total),
      baix: 58,
    });

    // ── 1. Clàusula addicional ──
    m.nova();
    const C = t(P.contracte);
    m.camp(C.ca, C.en, d.titol, { obligatori: false });
    const cl = t(T.clausula.titol);
    m.barra(cl.ca, cl.en);
    T.clausula.punts.forEach((p0, n) => {
      const p = t(p0);
      m.cal(48);
      m.espai(4);
      m.page.drawText(`${n + 1}.`, { x: ESQ, y: m.y - MIDA * 0.95, size: MIDA, font: f.r, color: NEGRE });
      m.text(p.ca, { x: ESQ + 17, ample: AMPLE_UTIL - 17, mida: MIDA });
      if (p.en) {
        m.espai(1);
        m.text(p.en, { x: ESQ + 17, ample: AMPLE_UTIL - 17, font: f.i, mida: MIDA_EN, color: GRIS });
      }
      m.espai(4);
    });

    // ── 2. Signatures ──
    m.nova();
    const S = t(P.signatures);
    m.barra(S.ca, S.en);
    for (const s of d.signants) {
      const sg = t(P.signant);
      m.cal(250);
      m.subtitol(`${sg.ca} ${s.ordre}`, sg.en ? `${sg.en} ${s.ordre}` : undefined);
      m.camp(t(P.nom).ca, t(P.nom).en, s.nom);
      m.camp(t(P.qualitat).ca, t(P.qualitat).en, s.qualitat);
      m.camp(t(P.lloc).ca, t(P.lloc).en, s.lloc);
      m.camp(t(P.data).ca, t(P.data).en, dataLocal(s.signatAt));
      await m.firma(t(P.signatura).ca, t(P.signatura).en, s.png);
    }
    const pa = t(P.per_ambit);
    m.cal(250);
    m.subtitol(pa.ca, pa.en || undefined);
    m.camp(t(P.nom).ca, t(P.nom).en, `${d.ambit.nom} · ${d.ambit.carrec}`);
    m.camp(t(P.qualitat).ca, t(P.qualitat).en, t(P.en_nom_de).ca + (t(P.en_nom_de).en ? ` / ${t(P.en_nom_de).en}` : ''));
    m.camp(t(P.data).ca, t(P.data).en, dataLocal(d.ambit.signatAt));
    await m.firma(t(P.signatura).ca, t(P.signatura).en, d.ambit.imatge);
    const sp = t(P.signat_portal);
    m.cal(30);
    m.page.drawText(sp.ca, { x: ESQ, y: m.y - 11, size: 11.5, font: f.b, color: VERD_FOSC });
    if (sp.en) m.page.drawText(sp.en, { x: ESQ, y: m.y - 24, size: 8.2, font: f.i, color: GRIS });
    m.espai(32);

    // ── 3. Full d'evidències ──
    m.nova();
    m.y += 8;
    const fila = (o: Bi, valor: string): [string, string, string] => { const x = t(o); return [x.ca, x.en, valor]; };
    const nd = t(P.no_disponible);
    const noDisp = nd.en ? `${nd.ca} / ${nd.en}` : nd.ca;
    // Fila del full d'evidències (mateix format que filaEvidencia de pdf.ts),
    // amb l'etiqueta partida en línies si no cap a la columna esquerra
    const X_VALOR = 230;
    const files = (llista: [string, string, string][]) => {
      for (const [etCa, etEn, valor] of llista) {
        const lCa = linies(etCa, f.b, 10, X_VALOR - ESQ - 14);
        const lEn = etEn ? linies(etEn, f.i, 7.5, X_VALOR - ESQ - 14) : [];
        const lVal = linies(valor, f.r, 9.5, DRE - X_VALOR - 6);
        const h = Math.max(30, 12 + lCa.length * 12 + lEn.length * 9, 12 + lVal.length * 12);
        m.cal(h);
        let y = m.y - 13;
        for (const l of lCa) { m.page.drawText(l, { x: ESQ + 6, y, size: 10, font: f.b, color: NEGRE }); y -= 12; }
        y += 2;
        for (const l of lEn) { m.page.drawText(l, { x: ESQ + 6, y, size: 7.5, font: f.i, color: GRIS }); y -= 9; }
        lVal.forEach((l, i) => m.page.drawText(l, { x: X_VALOR, y: m.y - 13 - i * 12, size: 9.5, font: f.r, color: NEGRE }));
        m.y -= h;
        m.page.drawLine({ start: { x: ESQ, y: m.y + 3 }, end: { x: DRE, y: m.y + 3 }, thickness: 0.5, color: GRIS_CLAR });
      }
    };
    const ev = t(P.evidencies);
    m.barra(ev.ca, ev.en);
    files([
      fila(P.e_titol, d.titol),
      fila(P.e_fitxer, d.original.nomFitxer),
      fila(P.e_pagines, String(d.original.pagines)),
      fila(P.e_sha_original, d.original.sha256),
      fila(P.e_referencia, d.requestId),
      fila(P.e_client, d.clientNom),
    ]);
    for (const s of d.signants) {
      const sg = t(P.signant);
      m.cal(200);
      m.subtitol(`${sg.ca} ${s.ordre} · ${s.nom}`, sg.en ? `${sg.en} ${s.ordre}` : undefined);
      files([
        fila(P.qualitat, s.qualitat),
        fila(P.e_acceptacio, dataUtc(s.acceptatAt)),
        fila(P.e_signatura, dataUtc(s.signatAt)),
        fila(P.e_ip, s.ip || noDisp),
        fila(P.e_navegador, s.userAgent || noDisp),
        fila(P.e_sha_firma, s.sha256),
        fila(P.e_sha_dades, s.empremtaDades),
      ]);
    }
    const ea = t(P.e_ambit);
    m.cal(140);
    m.subtitol(ea.ca, ea.en || undefined);
    files([
      fila(P.e_signant, `${d.ambit.nom} · ${d.ambit.carrec} · ${T.ambit.societat}`),
      fila(P.e_ambit_data, dataUtc(d.ambit.signatAt)),
      fila(P.e_sha_firma, d.ambit.sha256),
      fila(P.e_versio, d.templateVersion),
    ]);
    const nota = t(P.nota);
    const omple = (s: string) => s.split('{pagines}').join(String(d.original.pagines)).split('{bytes}').join(String(d.original.mida));
    m.espai(10);
    m.text(omple(nota.ca), { mida: 9.5, interlinia: 12.5 });
    if (nota.en) {
      m.espai(2);
      m.text(omple(nota.en), { font: m.f.i, mida: 8.2, color: GRIS, interlinia: 10.5 });
    }

    m.tanca();
  });
