// supabase/functions/portal-irpf/index.ts
//
// Funció pública de la comunicació de dades personals i familiars al pagador
// (IRPF). Sense compte: només funciona amb un token vàlid; si no ho és, respon
// sempre el mateix ("enllaç no vàlid o caducat") sense dir si ha existit.
// Limita els intents per IP (com portal-signar i portal-kyc).
//
// El mateix enllaç /irpf/<token> serveix per a dues persones, segons l'estat:
//  · el perceptor (comunicació enviada o en curs):
//      obrir     valida el token, passa a en_curs i retorna les respostes desades;
//      desa      desada automàtica (es pot continuar més tard amb el mateix enllaç);
//      signar    comprova els camps obligatoris, genera el PDF amb la signatura
//                del perceptor (apartat 11) i, si és el representant del
//                pagador, també la recepció (apartat 12, segona signatura en
//                la mateixa sessió), ho registra tot en una sola transacció,
//                avisa ÀMBIT per Formspree (sense cap dada) i retorna una URL
//                de descàrrega de curta durada;
//  · el representant del pagador (comunicació signada pel perceptor):
//      obrir     retorna la comunicació signada, per llegir-la;
//      signar_recepcio  nom i càrrec del representant i signatura de
//                l'apartat 12; genera la còpia final i la registra.
// El PDF d'ÀMBIT amb el càlcul del percentatge no es lliura mai per aquí.

import { clientAdmin, deBase64, entrada, formatToken, ipClient, llegeixCos, provaFalla, serveix, sha256Hex, text } from '../_shared/portal.ts';
import { generaPdfIrpf } from '../_shared/pdf-irpf.ts';
import { VERSIONS_ACCEPTADES, campsPendents, netejaDades } from '../_shared/irpf-regles.js';

const BUCKET = 'portal-docs';
const MAX_FIRMA = 1024 * 1024;
const SEGONS_DESCARREGA = 300;
const NEUTRE = 'Enllaç no vàlid o caducat';

// Avisos a ÀMBIT per Formspree: contingut fix, sense cap dada del perceptor ni
// del pagador ni cap identificador. Els detalls es consulten al portal.
const AVIS_SIGNATURA = {
  _subject: 'Nova comunicació de dades IRPF signada al portal',
  name: 'Portal de signatura',
  email: 'info@ambit.ad',
  message: 'S\'ha signat una nova comunicació de dades personals i familiars al pagador al portal de signatura d\'ÀMBIT Associats.\n\n' +
    'Podeu consultar-la a https://www.ambit.ad/portal',
};
const AVIS_RECEPCIO = {
  _subject: 'Recepció d\'una comunicació de dades IRPF signada al portal',
  name: 'Portal de signatura',
  email: 'info@ambit.ad',
  message: 'S\'ha signat la recepció pel pagador d\'una comunicació de dades personals i familiars al portal de signatura d\'ÀMBIT Associats.\n\n' +
    'Podeu consultar-la a https://www.ambit.ad/portal',
};
// Només per a les proves locals (per defecte, Formspree)
const FORMSPREE_BASE = Deno.env.get('FORMSPREE_BASE_URL') || 'https://formspree.io/f/';

// Límits per IP (finestres de 10 minuts), com portal-kyc
const MAX_PETICIONS = 300;
const MAX_ERRORS_TOKEN = 10;
const FINESTRA = 600;

const MAGIC_PNG = [0x89, 0x50, 0x4e, 0x47];
const comencaAmb = (b: Uint8Array, m: number[]) => m.every((v, i) => b[i] === v);

type Info = {
  token_id: string; request_id: string; mode: 'perceptor' | 'recepcio'; template_version: string; idioma: string;
  expira_at: string; client_id: string; referencia_client: string | null; party_type: 'pf' | 'pj';
  perceptor_id: string; perceptor_nom: string; pagador: { denominacio: string; nrt: string; domicili: string };
  doble_signatura: boolean; dades: Record<string, any>; desat_at: string | null;
  signatura: null | { signatari_nom: string; lloc: string; signat_at: string; imatge_path: string; ip: string | null; user_agent: string | null; empremta_dades: string };
};

const avuiAndorra = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

const avisa = async (cos: Record<string, string>) => {
  const formspree = Deno.env.get('FORMSPREE_FORM_ID');
  if (!formspree) return;
  try {
    const r = await fetch(`${FORMSPREE_BASE}${formspree}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(cos),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) console.warn('Formspree ha respost', r.status);
  } catch (e) {
    console.warn('Formspree no disponible', (e as Error).name);
  }
};

serveix('portal-irpf', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const ip = ipClient(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500) || null;
  const clauIp = await sha256Hex(`portal-irpf:${ip || 'sense-ip'}`);

  // 1. Límit de peticions per IP
  const { data: dinsLimit } = await portal.rpc('registra_intent', {
    p_clau: `peticio:${clauIp}`, p_maxim: MAX_PETICIONS, p_segons: FINESTRA,
  });
  if (dinsLimit === false) return resposta(429, { error: 'Massa intents. Torneu-ho a provar d\'aquí a uns minuts.' });

  const { data: errorsPrevis } = await portal
    .from('limit_intents')
    .select('intents')
    .eq('clau', `error:${clauIp}`)
    .gte('finestra', new Date(Date.now() - FINESTRA * 1000).toISOString());
  if ((errorsPrevis || []).reduce((s, r) => s + r.intents, 0) >= MAX_ERRORS_TOKEN) {
    return resposta(429, { error: 'Massa intents. Torneu-ho a provar d\'aquí a uns minuts.' });
  }

  const tokenNoValid = async () => {
    await portal.rpc('registra_intent', { p_clau: `error:${clauIp}`, p_maxim: MAX_ERRORS_TOKEN, p_segons: FINESTRA });
    return resposta(404, { error: NEUTRE });
  };

  // 2. Token
  const cos = await llegeixCos<Record<string, unknown>>(req);
  if (!cos) return resposta(400, { error: 'Cos de la petició no vàlid' });
  const token = String(cos.token || '');
  if (!formatToken.test(token)) return tokenNoValid();

  const { data: info, error: errInfo } = await portal.rpc('obre_irpf_per_token', { p_token_hash: await sha256Hex(token) });
  if (errInfo) {
    console.error('obre_irpf_per_token', errInfo.code);
    return resposta(500, { error: 'Error intern' });
  }
  if (!info) return tokenNoValid();
  const sol = info as Info;
  if (!VERSIONS_ACCEPTADES.includes(sol.template_version)) {
    return resposta(409, { error: 'Aquest document no està disponible. Contacteu amb ÀMBIT Associats.' });
  }

  const errorRpc = (e: { code?: string }, accio: string) => {
    console.error(accio, e.code);
    if (e.code === '42501') return resposta(404, { error: NEUTRE });
    if (e.code === '22023' || e.code === 'P0002') return resposta(400, { error: 'No s\'ha pogut desar. Reviseu les dades.' });
    return resposta(500, { error: 'Error intern' });
  };

  const llegeixFirma = (v: unknown): Uint8Array | null => {
    try {
      const b = deBase64(String(v || '').replace(/^data:image\/png;base64,/, ''));
      return b.length >= 100 && b.length <= MAX_FIRMA && comencaAmb(b, MAGIC_PNG) ? b : null;
    } catch {
      return null;
    }
  };
  const puja = async (path: string, bytes: Uint8Array, contentType: string) => {
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
    return !error;
  };
  const urlDescarrega = async (path: string, nom: string) => {
    const { data } = await admin.storage.from(BUCKET).createSignedUrl(path, SEGONS_DESCARREGA, { download: nom });
    return data?.signedUrl ?? null;
  };
  const perceptorPdf = (dades: Record<string, any>) => ({
    nom: dades?.perceptor?.nom || sol.perceptor_nom, nrt: dades?.perceptor?.nrt || '',
  });

  // ─── obrir ───
  if (cos.accio === 'obrir') {
    return resposta(200, {
      ok: true,
      mode: sol.mode,
      pagador: sol.pagador,
      perceptor_nom: sol.perceptor_nom,
      doble_signatura: sol.doble_signatura,
      expira_at: sol.expira_at,
      dades: sol.dades,
      desat_at: sol.desat_at,
      signatura: sol.signatura ? { signatari_nom: sol.signatura.signatari_nom, signat_at: sol.signatura.signat_at } : null,
    });
  }

  // ─── Perceptor ───────────────────────────────────────────────────────────
  if (cos.accio === 'desa' || cos.accio === 'signar') {
    if (sol.mode !== 'perceptor') return resposta(404, { error: NEUTRE });
    const dades = netejaDades(cos.dades);

    if (cos.accio === 'desa') {
      const { error } = await portal.rpc('irpf_desa', { p_token_id: sol.token_id, p_dades: dades });
      if (error) return errorRpc(error, 'irpf_desa');
      return resposta(200, { ok: true, desat_at: new Date().toISOString() });
    }

    // a) Camps obligatoris
    const pendents = campsPendents(dades, avuiAndorra());
    if (pendents.length > 0) {
      return resposta(400, {
        error: 'Falten camps obligatoris o n\'hi ha que no són vàlids. / Some required fields are missing or invalid.',
        pendents,
      });
    }
    const lloc = text(cos.lloc, 100);
    if (!lloc) return resposta(400, { error: 'Falta el lloc de signatura. / The place of signature is missing.' });

    // b) Signatura del perceptor i, si és el representant del pagador, la de la recepció
    const firma = llegeixFirma(cos.signatura);
    if (!firma) return resposta(400, { error: 'Falta la signatura. / The signature is missing.' });
    const shaFirma = await sha256Hex(firma);
    let firmaRec: Uint8Array | null = null;
    let shaRec = '';
    const carrec = text(cos.carrec_recepcio, 200);
    if (sol.doble_signatura) {
      firmaRec = llegeixFirma(cos.signatura_recepcio);
      if (!carrec) return resposta(400, { error: 'Falta el càrrec al pagador. / Your position at the payer is missing.' });
      if (!firmaRec) return resposta(400, { error: 'Falta la signatura de la recepció pel pagador. / The receipt signature is missing.' });
      shaRec = await sha256Hex(firmaRec);
      if (shaRec === shaFirma) {
        return resposta(400, { error: 'Cal signar la recepció pel pagador a part. / Please sign the receipt separately.' });
      }
    }

    // c) Desar les respostes definitives
    const { error: errDesa } = await portal.rpc('irpf_desa', { p_token_id: sol.token_id, p_dades: dades });
    if (errDesa) return errorRpc(errDesa, 'irpf_desa');

    // d) Empremtes de les dades desades
    const nom = dades.perceptor.nom;
    const { data: emp, error: e1 } = await portal.rpc('empremta_irpf', {
      p_request_id: sol.request_id, p_signatari_nom: nom, p_lloc: lloc,
    });
    if (e1 || !emp) return resposta(500, { error: 'Error intern' });

    // e) Generar el PDF i, només si s'ha generat, pujar les firmes i el PDF
    //    (sempre camins nous). Un error en generar-lo no deixa cap fitxer.
    const signatAt = new Date();
    const firmaPath = `requests/${sol.request_id}/evidencies/${crypto.randomUUID()}-signatura.png`;
    let recepcio = null;
    let pRecepcio = null;
    let recPath = '';
    if (sol.doble_signatura && firmaRec) {
      // L'empremta de la recepció inclou la de la comunicació signada
      const { data: empRecepcio, error: e2 } = await portal.rpc('empremta_irpf_recepcio_de', {
        p_request_id: sol.request_id, p_empremta_perceptor: emp, p_nom: nom, p_carrec: carrec,
      });
      if (e2 || !empRecepcio) return resposta(500, { error: 'Error intern' });
      recPath = `requests/${sol.request_id}/evidencies/${crypto.randomUUID()}-recepcio.png`;
      recepcio = {
        nom, carrec: carrec!, signatAt, ip, userAgent, empremtaDades: empRecepcio as string, png: firmaRec, sha256: shaRec, mateixaSessio: true,
      };
      pRecepcio = { empremta: empRecepcio, nom, carrec, imatge_path: recPath, imatge_sha256: shaRec, imatge_mida: firmaRec.length };
    }

    provaFalla(req, 'pdf');
    const pdf = await generaPdfIrpf({
      mode: 'perceptor',
      requestId: sol.request_id,
      referenciaClient: sol.referencia_client,
      templateVersion: sol.template_version,
      pagador: sol.pagador,
      perceptor: perceptorPdf(dades),
      dades,
      signatura: { signatariNom: nom, signatariCarrec: null, lloc, signatAt, ip, userAgent, empremtaDades: emp as string, png: firma, sha256: shaFirma },
      recepcio,
    });
    const shaPdf = await sha256Hex(pdf);
    const pdfPath = `requests/${sol.request_id}/signat/${crypto.randomUUID()}.pdf`;
    if (!(await puja(firmaPath, firma, 'image/png'))) return resposta(500, { error: 'No s\'ha pogut desar la signatura' });
    if (recepcio && !(await puja(recPath, firmaRec!, 'image/png'))) return resposta(500, { error: 'No s\'ha pogut desar la signatura' });
    if (!(await puja(pdfPath, pdf, 'application/pdf'))) return resposta(500, { error: 'No s\'ha pogut desar el document' });

    // f) Registrar-ho tot (una sola transacció a la base)
    const { error: errSig } = await portal.rpc('registra_signatura_irpf', {
      p_token_id: sol.token_id,
      p_signat_at: signatAt.toISOString(),
      p_ip: ip,
      p_user_agent: userAgent,
      p_perceptor: {
        empremta: emp, signatari_nom: nom, lloc, imatge_path: firmaPath, imatge_sha256: shaFirma, imatge_mida: firma.length,
        pdf_path: pdfPath, pdf_sha256: shaPdf, pdf_mida: pdf.length,
      },
      p_recepcio: pRecepcio,
    });
    if (errSig) {
      console.error('registra_signatura_irpf', errSig.code);
      if (errSig.code === '40001') return resposta(409, { error: 'Les dades han canviat mentre se signava. Torneu a carregar la pàgina.' });
      if (errSig.code === '42501') return resposta(404, { error: NEUTRE });
      if (errSig.code === '23514') return resposta(400, { error: 'Falten dades obligatòries.' });
      return resposta(500, { error: 'No s\'ha pogut registrar la signatura' });
    }

    // g) Avís a ÀMBIT (sense cap dada). Si falla, la signatura ja és vàlida.
    await avisa(AVIS_SIGNATURA);

    const nomFitxer = `Comunicacio-dades-IRPF-${signatAt.toISOString().slice(0, 10)}.pdf`;
    return resposta(200, {
      ok: true,
      rebuda: sol.doble_signatura,
      pdf: { url: await urlDescarrega(pdfPath, nomFitxer), nom_fitxer: nomFitxer, sha256: shaPdf },
    });
  }

  // ─── Representant del pagador: recepció (apartat 12) ─────────────────────
  if (cos.accio === 'signar_recepcio') {
    if (sol.mode !== 'recepcio' || !sol.signatura) return resposta(404, { error: NEUTRE });
    const nom = text(cos.nom, 200);
    const carrec = text(cos.carrec, 200);
    if (!nom || !carrec) return resposta(400, { error: 'Falten el nom i el càrrec del representant. / The representative\'s name and position are missing.' });
    const firma = llegeixFirma(cos.signatura);
    if (!firma) return resposta(400, { error: 'Falta la signatura. / The signature is missing.' });
    const shaFirma = await sha256Hex(firma);

    const { data: emp, error: e1 } = await portal.rpc('empremta_irpf_recepcio', { p_request_id: sol.request_id, p_nom: nom, p_carrec: carrec });
    if (e1 || !emp) return resposta(500, { error: 'Error intern' });

    // Firma del perceptor (per a la còpia final)
    const { data: fitxer, error: errBaixa } = await admin.storage.from(BUCKET).download(sol.signatura.imatge_path);
    if (errBaixa || !fitxer) return resposta(500, { error: 'Error intern' });
    const firmaPerceptor = new Uint8Array(await fitxer.arrayBuffer());

    // Primer el PDF; després, la firma i el PDF (cap fitxer si no es genera)
    const signatAt = new Date();
    const firmaPath = `requests/${sol.request_id}/evidencies/${crypto.randomUUID()}-recepcio.png`;
    const s = sol.signatura;
    provaFalla(req, 'pdf');
    const pdf = await generaPdfIrpf({
      mode: 'copia',
      requestId: sol.request_id,
      referenciaClient: sol.referencia_client,
      templateVersion: sol.template_version,
      pagador: sol.pagador,
      perceptor: perceptorPdf(sol.dades),
      dades: sol.dades,
      signatura: {
        signatariNom: s.signatari_nom, signatariCarrec: null, lloc: s.lloc, signatAt: new Date(s.signat_at), ip: s.ip,
        userAgent: s.user_agent, empremtaDades: s.empremta_dades, png: firmaPerceptor, sha256: await sha256Hex(firmaPerceptor),
      },
      recepcio: { nom, carrec, signatAt, ip, userAgent, empremtaDades: emp as string, png: firma, sha256: shaFirma, mateixaSessio: false },
    });
    const shaPdf = await sha256Hex(pdf);
    const pdfPath = `requests/${sol.request_id}/copia-client/${crypto.randomUUID()}.pdf`;
    if (!(await puja(firmaPath, firma, 'image/png'))) return resposta(500, { error: 'No s\'ha pogut desar la signatura' });
    if (!(await puja(pdfPath, pdf, 'application/pdf'))) return resposta(500, { error: 'No s\'ha pogut desar el document' });

    const { error: errRec } = await portal.rpc('registra_recepcio_irpf', {
      p_token_id: sol.token_id,
      p_signat_at: signatAt.toISOString(),
      p_ip: ip,
      p_user_agent: userAgent,
      p: {
        empremta: emp, nom, carrec, imatge_path: firmaPath, imatge_sha256: shaFirma, imatge_mida: firma.length,
        pdf_path: pdfPath, pdf_sha256: shaPdf, pdf_mida: pdf.length,
      },
    });
    if (errRec) {
      console.error('registra_recepcio_irpf', errRec.code);
      if (errRec.code === '40001') return resposta(409, { error: 'Les dades han canviat mentre se signava. Torneu a carregar la pàgina.' });
      if (errRec.code === '42501') return resposta(404, { error: NEUTRE });
      return resposta(500, { error: 'No s\'ha pogut registrar la signatura' });
    }

    await avisa(AVIS_RECEPCIO);

    const nomFitxer = `Comunicacio-dades-IRPF-rebuda-${signatAt.toISOString().slice(0, 10)}.pdf`;
    return resposta(200, { ok: true, pdf: { url: await urlDescarrega(pdfPath, nomFitxer), nom_fitxer: nomFitxer, sha256: shaPdf } });
  }

  return resposta(400, { error: 'Acció no vàlida' });
});
