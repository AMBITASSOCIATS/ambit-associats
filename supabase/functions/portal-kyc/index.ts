// supabase/functions/portal-kyc/index.ts
//
// Funció pública del client per al formulari KYC i la informació de protecció
// de dades (un sol enllaç, sense compte). Només funciona amb un token vàlid;
// si no ho és, respon sempre el mateix ("enllaç no vàlid o caducat") sense dir
// si ha existit. Limita els intents per IP (com portal-signar).
//
// Accions:
//   obrir            valida el token, passa el KYC i la PDP a en_curs i retorna
//                    les respostes desades i l'estat dels documents.
//   desa             desada automàtica de les respostes (es poden continuar
//                    més tard mentre l'enllaç sigui vigent).
//   url_pujada       URL signada per pujar un document d'un tipus.
//   registra_adjunt  comprova el fitxer pujat (format, mida, empremta) i el
//                    registra amb el seu tipus.
//   retira_adjunt    treu un document abans de signar (no s'esborra).
//   signar           comprova camps i documents obligatoris, genera els dos PDF
//                    (KYC i protecció de dades) amb les dues signatures,
//                    registra-ho tot en una sola transacció, avisa ÀMBIT per
//                    Formspree (sense cap dada del client) i retorna dues URL
//                    de descàrrega de curta durada.
//
// Cap missatge al client no revela marques de risc ni motius de revisió
// (art. 26 Llei 14/2017).

import { clientAdmin, deBase64, entrada, formatToken, ipClient, llegeixCos, sha256Hex, text } from '../_shared/portal.ts';
import { generaPdfKyc, generaPdfPdp } from '../_shared/pdf-kyc.ts';
import { VERSIONS, campsPendents, netejaDades, signant } from '../_shared/kyc-regles.js';
import PAISOS from '../_shared/paisos.json' with { type: 'json' };

const BUCKET = 'portal-docs';
const MAX_ADJUNT = 20 * 1024 * 1024;   // mateixos formats i límits que el poder de l'autorització
const MAX_FIRMA = 1024 * 1024;
const SEGONS_DESCARREGA = 300;
const NEUTRE = 'Enllaç no vàlid o caducat';
const CODIS_PAISOS = new Set((PAISOS as { codi: string }[]).map((p) => p.codi));

// Avís a ÀMBIT per Formspree: contingut fix, sense cap dada del client ni cap
// identificador. Els detalls es consulten al portal.
const AVIS_KYC = {
  _subject: 'Nou KYC signat al portal',
  name: 'Portal de signatura',
  email: 'info@ambit.ad',
  message: 'S\'ha signat un nou formulari d\'identificació del client al portal de signatura d\'ÀMBIT Associats.\n\n' +
    'Podeu consultar-lo a https://www.ambit.ad/portal',
};
// Només per a les proves locals (per defecte, Formspree)
const FORMSPREE_BASE = Deno.env.get('FORMSPREE_BASE_URL') || 'https://formspree.io/f/';

// Límits per IP (finestres de 10 minuts). La desada automàtica fa més crides
// que l'autorització, per això el límit de peticions és més alt.
const MAX_PETICIONS = 300;
const MAX_ERRORS_TOKEN = 10;
const FINESTRA = 600;

const TIPUS_ADJUNT: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },  // %PDF
  'image/jpeg':      { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png':       { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
};
const MAGIC_PNG = TIPUS_ADJUNT['image/png'].magic;
const comencaAmb = (b: Uint8Array, m: number[]) => m.every((v, i) => b[i] === v);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Tipus de document per tipus de KYC (els mateixos que portal.kyc_tipus_document_valid)
const DOCS = {
  kyc_pf: { general: ['identitat', 'domicili', 'residencia', 'activitat', 'fons', 'representacio', 'patrimoni'], persona: [] as string[] },
  kyc_pj: { general: ['escriptura', 'vigencia', 'registre_be', 'nrt', 'comerc', 'fons', 'organigrama', 'trust'], persona: ['identitat', 'poder', 'patrimoni'] },
};

type Info = {
  token_id: string; request_id: string; pdp_request_id: string; document_type: 'kyc_pf' | 'kyc_pj';
  template_version: string; pdp_template_version: string; idioma: string; expira_at: string;
  client_id: string; client_nom: string; referencia_client: string | null; party_type: 'pf' | 'pj';
  dades: Record<string, unknown>; desat_at: string | null; documents: EstatDocuments;
};
type EstatDocuments = {
  requerits: { tipus: string; persona: string | null }[];
  pendents: { tipus: string; persona: string | null }[];
  adjunts: { id: string; tipus: string; persona: string | null; nom_fitxer: string | null; mime: string; mida: number; sha256: string }[];
};

const avuiAndorra = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });

// Estat dels documents per al client: sense empremtes
const perClient = (e: EstatDocuments) => ({
  requerits: e.requerits,
  pendents: e.pendents,
  adjunts: e.adjunts.map(({ id, tipus, persona, nom_fitxer, mime, mida }) => ({ id, tipus, persona, nom_fitxer, mime, mida })),
});

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const ip = ipClient(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500) || null;
  const clauIp = await sha256Hex(`portal-kyc:${ip || 'sense-ip'}`);

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

  const { data: info, error: errInfo } = await portal.rpc('obre_kyc_per_token', { p_token_hash: await sha256Hex(token) });
  if (errInfo) {
    console.error('obre_kyc_per_token', errInfo.code);
    return resposta(500, { error: 'Error intern' });
  }
  if (!info) return tokenNoValid();
  const sol = info as Info;
  const tipus = sol.document_type;

  if (sol.template_version !== VERSIONS[tipus] || sol.pdp_template_version !== VERSIONS.pdp) {
    return resposta(409, { error: 'Aquest document no està disponible. Contacteu amb ÀMBIT Associats.' });
  }

  // Errors de les funcions SQL: sense detalls interns
  const errorRpc = (e: { code?: string }, accio: string) => {
    console.error(accio, e.code);
    if (e.code === '42501') return resposta(404, { error: NEUTRE });
    if (e.code === '22023' || e.code === '54000' || e.code === 'P0002' || e.code === '23505') {
      return resposta(400, { error: 'No s\'ha pogut desar. Reviseu el fitxer o les dades.' });
    }
    return resposta(500, { error: 'Error intern' });
  };

  // ─── obrir ───
  if (cos.accio === 'obrir') {
    return resposta(200, {
      ok: true,
      tipus,
      client_nom: sol.client_nom,
      party_type: sol.party_type,
      expira_at: sol.expira_at,
      dades: sol.dades,
      desat_at: sol.desat_at,
      documents: perClient(sol.documents),
    });
  }

  // ─── desa ───
  if (cos.accio === 'desa') {
    const dades = netejaDades(cos.dades, tipus, CODIS_PAISOS);
    const { data: docs, error } = await portal.rpc('kyc_desa', { p_token_id: sol.token_id, p_dades: dades });
    if (error) return errorRpc(error, 'kyc_desa');
    return resposta(200, { ok: true, desat_at: new Date().toISOString(), documents: perClient(docs as EstatDocuments) });
  }

  // ─── url_pujada ───
  if (cos.accio === 'url_pujada') {
    const tipusDoc = String(cos.tipus || '');
    const persona = cos.persona ? String(cos.persona) : null;
    const valid = persona ? UUID.test(persona) && DOCS[tipus].persona.includes(tipusDoc) : DOCS[tipus].general.includes(tipusDoc);
    if (!valid) return resposta(400, { error: 'Tipus de document no vàlid' });
    const t = TIPUS_ADJUNT[String(cos.mime || '')];
    if (!t) return resposta(400, { error: 'Format no admès: PDF, JPG o PNG' });
    const mida = Number(cos.mida);
    if (!Number.isFinite(mida) || mida <= 0 || mida > MAX_ADJUNT) return resposta(400, { error: 'El fitxer no pot superar els 20 MB' });

    const path = `requests/${sol.request_id}/adjunts/${crypto.randomUUID()}.${t.ext}`;
    const { data: pujada, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !pujada) return resposta(500, { error: 'No s\'ha pogut preparar la pujada' });
    return resposta(200, { ok: true, path, upload_token: pujada.token });
  }

  // ─── registra_adjunt ───
  if (cos.accio === 'registra_adjunt') {
    const path = String(cos.path || '');
    const patro = new RegExp(`^requests/${sol.request_id}/adjunts/[0-9a-f-]{36}\\.(pdf|jpg|png)$`);
    if (!patro.test(path)) return resposta(400, { error: 'No s\'ha trobat el fitxer; torneu-lo a pujar' });
    const { data: fitxer, error: errBaixa } = await admin.storage.from(BUCKET).download(path);
    if (errBaixa || !fitxer) return resposta(400, { error: 'No s\'ha trobat el fitxer; torneu-lo a pujar' });
    const bytes = new Uint8Array(await fitxer.arrayBuffer());
    const ext = path.split('.').pop();
    const [mime, t] = Object.entries(TIPUS_ADJUNT).find(([, x]) => x.ext === ext)!;
    if (bytes.length === 0 || bytes.length > MAX_ADJUNT || !comencaAmb(bytes, t.magic)) {
      return resposta(400, { error: 'El fitxer no és un PDF, JPG o PNG vàlid' });
    }
    const { data: docs, error } = await portal.rpc('kyc_registra_adjunt', {
      p_token_id: sol.token_id, p_path: path, p_sha256: await sha256Hex(bytes), p_mida: bytes.length, p_mime: mime,
      p_tipus: String(cos.tipus || ''), p_persona: cos.persona ? String(cos.persona) : null,
      p_nom_fitxer: text(cos.nom_fitxer, 200),
    });
    if (error) return errorRpc(error, 'kyc_registra_adjunt');
    return resposta(200, { ok: true, documents: perClient(docs as EstatDocuments) });
  }

  // ─── retira_adjunt ───
  if (cos.accio === 'retira_adjunt') {
    const id = String(cos.adjunt_id || '');
    if (!UUID.test(id)) return resposta(400, { error: 'Document no vàlid' });
    const { data: docs, error } = await portal.rpc('kyc_retira_adjunt', { p_token_id: sol.token_id, p_adjunt_id: id });
    if (error) return errorRpc(error, 'kyc_retira_adjunt');
    return resposta(200, { ok: true, documents: perClient(docs as EstatDocuments) });
  }

  if (cos.accio !== 'signar') return resposta(400, { error: 'Acció no vàlida' });

  // ─── signar ───
  // a) Camps obligatoris (segons les respostes)
  const dades = netejaDades(cos.dades, tipus, CODIS_PAISOS);
  const pendents = campsPendents(dades, tipus, avuiAndorra());
  if (pendents.length > 0) {
    return resposta(400, {
      error: 'Falten camps obligatoris o n\'hi ha que no són vàlids. / Some required fields are missing or invalid.',
      pendents,
    });
  }
  const llocKyc = text(cos.lloc_kyc, 100);
  const llocPdp = text(cos.lloc_pdp, 100);
  if (!llocKyc || !llocPdp) return resposta(400, { error: 'Falta el lloc de signatura. / The place of signature is missing.' });
  if (typeof cos.consentiment_comercial !== 'boolean') {
    return resposta(400, { error: 'Falta la resposta sobre les comunicacions comercials.' });
  }
  const consentiment = cos.consentiment_comercial;

  // b) Dues signatures en pantalla, diferents
  const llegeixFirma = (v: unknown): Uint8Array | null => {
    try {
      const b = deBase64(String(v || '').replace(/^data:image\/png;base64,/, ''));
      return b.length >= 100 && b.length <= MAX_FIRMA && comencaAmb(b, MAGIC_PNG) ? b : null;
    } catch {
      return null;
    }
  };
  const firmaKyc = llegeixFirma(cos.signatura_kyc);
  const firmaPdp = llegeixFirma(cos.signatura_pdp);
  if (!firmaKyc) return resposta(400, { error: 'Falta la signatura del formulari KYC. / The KYC signature is missing.' });
  if (!firmaPdp) return resposta(400, { error: 'Falta la signatura de la protecció de dades. / The data protection signature is missing.' });
  const shaKyc = await sha256Hex(firmaKyc);
  const shaPdp = await sha256Hex(firmaPdp);
  if (shaKyc === shaPdp) {
    return resposta(400, { error: 'Cal signar la protecció de dades a part. / Please sign the data protection notice separately.' });
  }

  // c) Desar les respostes definitives i comprovar els documents obligatoris
  const { data: docsEstat, error: errDesa } = await portal.rpc('kyc_desa', { p_token_id: sol.token_id, p_dades: dades });
  if (errDesa) return errorRpc(errDesa, 'kyc_desa');
  const docs = docsEstat as EstatDocuments;
  if (docs.pendents.length > 0) {
    return resposta(400, {
      error: 'Falten documents obligatoris. / Some required documents are missing.',
      documents: perClient(docs),
    });
  }

  // d) Empremtes de les dades desades
  const qui = signant(dades, tipus);
  const { data: empKyc, error: e1 } = await portal.rpc('empremta_kyc', {
    p_request_id: sol.request_id, p_signatari_nom: qui.nom, p_signatari_carrec: qui.carrec, p_lloc: llocKyc,
  });
  const { data: empPdp, error: e2 } = await portal.rpc('empremta_pdp', {
    p_request_id: sol.pdp_request_id, p_signatari_nom: qui.nom, p_signatari_carrec: qui.carrec, p_lloc: llocPdp,
    p_consentiment: consentiment,
  });
  if (e1 || e2 || !empKyc || !empPdp) return resposta(500, { error: 'Error intern' });

  // e) Pujar les firmes i generar i pujar els dos PDF (sempre camins nous)
  const signatAt = new Date();
  const puja = async (path: string, bytes: Uint8Array, contentType: string) => {
    const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType, upsert: false });
    return !error;
  };
  const firmaKycPath = `requests/${sol.request_id}/evidencies/${crypto.randomUUID()}-signatura.png`;
  const firmaPdpPath = `requests/${sol.pdp_request_id}/evidencies/${crypto.randomUUID()}-signatura.png`;
  if (!(await puja(firmaKycPath, firmaKyc, 'image/png')) || !(await puja(firmaPdpPath, firmaPdp, 'image/png'))) {
    return resposta(500, { error: 'No s\'ha pogut desar la signatura' });
  }

  const comuns = { signatariNom: qui.nom, signatariCarrec: qui.carrec, signatAt, ip, userAgent };
  const pdfKyc = await generaPdfKyc({
    tipus,
    requestId: sol.request_id,
    pdpRequestId: sol.pdp_request_id,
    referenciaClient: sol.referencia_client,
    clientNom: sol.client_nom,
    templateVersion: sol.template_version,
    dades,
    adjunts: docs.adjunts.map((a) => ({ tipus: a.tipus, persona: a.persona, nom_fitxer: a.nom_fitxer, sha256: a.sha256 })),
    signatura: { ...comuns, lloc: llocKyc, empremtaDades: empKyc as string, png: firmaKyc, sha256: shaKyc },
  });
  const pdfPdp = await generaPdfPdp({
    requestId: sol.pdp_request_id,
    kycRequestId: sol.request_id,
    referenciaClient: sol.referencia_client,
    clientNom: sol.client_nom,
    templateVersion: sol.pdp_template_version,
    consentiment,
    signatura: { ...comuns, lloc: llocPdp, empremtaDades: empPdp as string, png: firmaPdp, sha256: shaPdp },
  }, sol.party_type);
  const shaPdfKyc = await sha256Hex(pdfKyc);
  const shaPdfPdp = await sha256Hex(pdfPdp);
  const pdfKycPath = `requests/${sol.request_id}/signat/${crypto.randomUUID()}.pdf`;
  const pdfPdpPath = `requests/${sol.pdp_request_id}/signat/${crypto.randomUUID()}.pdf`;
  if (!(await puja(pdfKycPath, pdfKyc, 'application/pdf')) || !(await puja(pdfPdpPath, pdfPdp, 'application/pdf'))) {
    return resposta(500, { error: 'No s\'ha pogut desar el document' });
  }

  // f) Registrar les dues signatures (una sola transacció a la base)
  const { error: errSig } = await portal.rpc('registra_signatura_kyc', {
    p_token_id: sol.token_id,
    p_signat_at: signatAt.toISOString(),
    p_ip: ip,
    p_user_agent: userAgent,
    p_kyc: {
      empremta: empKyc, signatari_nom: qui.nom, signatari_carrec: qui.carrec, lloc: llocKyc,
      imatge_path: firmaKycPath, imatge_sha256: shaKyc, imatge_mida: firmaKyc.length,
      pdf_path: pdfKycPath, pdf_sha256: shaPdfKyc, pdf_mida: pdfKyc.length,
    },
    p_pdp: {
      empremta: empPdp, signatari_nom: qui.nom, signatari_carrec: qui.carrec, lloc: llocPdp,
      imatge_path: firmaPdpPath, imatge_sha256: shaPdp, imatge_mida: firmaPdp.length,
      pdf_path: pdfPdpPath, pdf_sha256: shaPdfPdp, pdf_mida: pdfPdp.length,
      consentiment_comercial: consentiment,
    },
  });
  if (errSig) {
    console.error('registra_signatura_kyc', errSig.code);
    if (errSig.code === '40001') {
      return resposta(409, { error: 'Les dades han canviat mentre se signava. Torneu a carregar la pàgina.' });
    }
    if (errSig.code === '42501') return resposta(404, { error: NEUTRE });
    if (errSig.code === '23514') return resposta(400, { error: 'Falten dades o documents obligatoris.' });
    return resposta(500, { error: 'No s\'ha pogut registrar la signatura' });
  }

  // g) Avís a ÀMBIT per Formspree (sense cap dada del client). Si falla, la signatura ja és vàlida.
  const formspree = Deno.env.get('FORMSPREE_FORM_ID');
  if (formspree) {
    try {
      const r = await fetch(`${FORMSPREE_BASE}${formspree}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(AVIS_KYC),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) console.warn('Formspree ha respost', r.status);
    } catch (e) {
      console.warn('Formspree no disponible', (e as Error).name);
    }
  }

  // h) URL de descàrrega de curta durada (una per document)
  const dia = signatAt.toISOString().slice(0, 10);
  const nomKyc = `KYC-${dia}.pdf`;
  const nomPdp = `Proteccio-dades-${dia}.pdf`;
  const { data: urlKyc } = await admin.storage.from(BUCKET).createSignedUrl(pdfKycPath, SEGONS_DESCARREGA, { download: nomKyc });
  const { data: urlPdp } = await admin.storage.from(BUCKET).createSignedUrl(pdfPdpPath, SEGONS_DESCARREGA, { download: nomPdp });

  return resposta(200, {
    ok: true,
    kyc: { url: urlKyc?.signedUrl ?? null, nom_fitxer: nomKyc, sha256: shaPdfKyc },
    pdp: { url: urlPdp?.signedUrl ?? null, nom_fitxer: nomPdp, sha256: shaPdfPdp },
  });
});
