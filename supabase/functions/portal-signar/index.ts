// supabase/functions/portal-signar/index.ts
//
// Funció pública del client (sense compte). Només funciona amb un token
// d'enllaç vàlid; si no ho és, respon sempre el mateix ("enllaç no vàlid o
// caducat") sense dir si ha existit. Limita els intents per IP.
//
// Accions:
//   obrir       valida el token, passa enviat → en_curs i retorna les dades
//               per al formulari.
//   url_pujada  URL signada per pujar el poder (persona jurídica).
//   signar      desa les dades (IBAN xifrat), calcula l'empremta, genera el
//               PDF, el puja, registra la signatura en una sola transacció,
//               avisa ÀMBIT per Formspree (sense dades del client) i retorna
//               una URL de descàrrega.

import {
  aBytea, clientAdmin, deBase64, entrada, formatToken, ipClient, llegeixCos,
  sha256Hex, text, validaIban, xifraIban,
} from '../_shared/portal.ts';
import { generaPdf, VERSIO_PLANTILLA } from '../_shared/pdf.ts';

const BUCKET = 'portal-docs';
const MAX_ADJUNT = 20 * 1024 * 1024;
const MAX_FIRMA = 1024 * 1024;
const SEGONS_DESCARREGA = 300;
const NEUTRE = 'Enllaç no vàlid o caducat';

// Avís a ÀMBIT per Formspree: contingut fix, sense cap dada del client ni cap
// identificador (ni nom, ni referència, ni id de la sol·licitud, ni IBAN).
// Els detalls es consulten al portal.
const AVIS_SIGNATURA = {
  _subject: 'Nova autorització signada al portal',
  name: 'Portal de signatura',
  email: 'info@ambit.ad',
  message: 'S\'ha signat una nova autorització de càrrec en compte al portal de signatura d\'ÀMBIT Associats.\n\n' +
    'Podeu consultar-la a https://www.ambit.ad/portal',
};
// Només per a les proves locals (per defecte, Formspree)
const FORMSPREE_BASE = Deno.env.get('FORMSPREE_BASE_URL') || 'https://formspree.io/f/';

// Límits per IP (finestres de 10 minuts)
const MAX_PETICIONS = 60;
const MAX_ERRORS_TOKEN = 10;
const FINESTRA = 600;

const TIPUS_ADJUNT: Record<string, { ext: string; magic: number[] }> = {
  'application/pdf': { ext: 'pdf', magic: [0x25, 0x50, 0x44, 0x46] },  // %PDF
  'image/jpeg':      { ext: 'jpg', magic: [0xff, 0xd8, 0xff] },
  'image/png':       { ext: 'png', magic: [0x89, 0x50, 0x4e, 0x47] },
};
const MAGIC_PNG = TIPUS_ADJUNT['image/png'].magic;
const comencaAmb = (b: Uint8Array, m: number[]) => m.every((v, i) => b[i] === v);

type Info = {
  token_id: string; request_id: string; document_type: string; template_version: string;
  idioma: string; expira_at: string; client_nom: string; party_type: 'pf' | 'pj';
  titular_nom: string | null; titular_adreca: string | null; titular_cp_poblacio: string | null;
  client_facturat_nom: string | null;
};

Deno.serve(async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const ip = ipClient(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500) || null;
  const clauIp = await sha256Hex(`portal-signar:${ip || 'sense-ip'}`);

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

  const { data: info, error: errInfo } = await portal.rpc('obre_per_token', { p_token_hash: await sha256Hex(token) });
  if (errInfo) {
    console.error('obre_per_token', errInfo.code);
    return resposta(500, { error: 'Error intern' });
  }
  if (!info) return tokenNoValid();
  const sol = info as Info;

  if (sol.document_type !== 'autoritzacio_carrec' || sol.template_version !== VERSIO_PLANTILLA) {
    return resposta(409, { error: 'Aquest document no està disponible. Contacteu amb ÀMBIT Associats.' });
  }

  // ─── obrir ───
  if (cos.accio === 'obrir') {
    return resposta(200, {
      ok: true,
      client_nom: sol.client_nom,
      party_type: sol.party_type,
      expira_at: sol.expira_at,
      template_version: sol.template_version,
      titular_nom: sol.titular_nom,
      titular_adreca: sol.titular_adreca,
      titular_cp_poblacio: sol.titular_cp_poblacio,
      client_facturat_nom: sol.client_facturat_nom,
    });
  }

  // ─── url_pujada ───
  if (cos.accio === 'url_pujada') {
    if (sol.party_type !== 'pj') return resposta(400, { error: 'Només cal adjuntar el poder per a persones jurídiques' });
    const tipus = TIPUS_ADJUNT[String(cos.mime || '')];
    if (!tipus) return resposta(400, { error: 'Format no admès: PDF, JPG o PNG' });
    const mida = Number(cos.mida);
    if (!Number.isFinite(mida) || mida <= 0 || mida > MAX_ADJUNT) return resposta(400, { error: 'El fitxer no pot superar els 20 MB' });

    const path = `requests/${sol.request_id}/adjunts/${crypto.randomUUID()}.${tipus.ext}`;
    const { data: pujada, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !pujada) return resposta(500, { error: 'No s\'ha pogut preparar la pujada' });
    return resposta(200, { ok: true, path, upload_token: pujada.token });
  }

  if (cos.accio !== 'signar') return resposta(400, { error: 'Acció no vàlida' });

  // ─── signar ───
  // a) Validar les dades
  const d = {
    titular_nom: text(cos.titular_nom),
    titular_adreca: text(cos.titular_adreca),
    titular_cp_poblacio: text(cos.titular_cp_poblacio),
    client_facturat_nom: text(cos.client_facturat_nom),
    signatari_nom: text(cos.signatari_nom),
    signatari_carrec: text(cos.signatari_carrec),
    lloc: text(cos.lloc, 100),
  };
  if (!d.titular_nom || !d.titular_adreca || !d.titular_cp_poblacio) {
    return resposta(400, { error: 'Falten dades del titular del compte' });
  }
  if (!d.signatari_nom) return resposta(400, { error: 'Falta el nom del signant' });
  if (!d.lloc) return resposta(400, { error: 'Falta la localitat' });

  const iban = validaIban(cos.iban);
  if (!iban.ok) return resposta(400, { error: iban.error });

  let esAdministrador: boolean | null = null;
  if (sol.party_type === 'pj') {
    if (typeof cos.signant_es_administrador !== 'boolean') {
      return resposta(400, { error: 'Indiqueu si el signant és administrador de la societat' });
    }
    esAdministrador = cos.signant_es_administrador;
    if (!d.signatari_carrec) return resposta(400, { error: 'Indiqueu el càrrec del signant' });
  }

  // Firma manuscrita (PNG en base64)
  const firmaB64 = String(cos.signatura_png || '').replace(/^data:image\/png;base64,/, '');
  let firma: Uint8Array;
  try {
    firma = deBase64(firmaB64);
  } catch {
    return resposta(400, { error: 'Falta la signatura' });
  }
  if (firma.length < 100 || firma.length > MAX_FIRMA || !comencaAmb(firma, MAGIC_PNG)) {
    return resposta(400, { error: 'Falta la signatura' });
  }

  // Poder adjunt (persona jurídica amb signant que no és administrador)
  let poderId: string | null = null;
  let poderSha: string | null = null;
  if (sol.party_type === 'pj' && esAdministrador === false) {
    const path = String(cos.poder_path || '');
    const patro = new RegExp(`^requests/${sol.request_id}/adjunts/[0-9a-f-]{36}\\.(pdf|jpg|png)$`);
    if (!patro.test(path)) return resposta(400, { error: 'Cal adjuntar el poder del signant' });

    const { data: existent } = await portal.from('documents').select('id, sha256').eq('storage_path', path).maybeSingle();
    if (existent) {
      poderId = existent.id;
      poderSha = existent.sha256;
    } else {
      const { data: fitxer, error: errBaixa } = await admin.storage.from(BUCKET).download(path);
      if (errBaixa || !fitxer) return resposta(400, { error: 'No s\'ha trobat el poder adjunt; torneu-lo a pujar' });
      const bytes = new Uint8Array(await fitxer.arrayBuffer());
      const ext = path.split('.').pop();
      const [mime, tipus] = Object.entries(TIPUS_ADJUNT).find(([, t]) => t.ext === ext)!;
      if (bytes.length === 0 || bytes.length > MAX_ADJUNT || !comencaAmb(bytes, tipus.magic)) {
        return resposta(400, { error: 'El poder adjunt no és un PDF, JPG o PNG vàlid' });
      }
      poderSha = await sha256Hex(bytes);
      const { data: doc, error: errDoc } = await portal.from('documents').insert({
        request_id: sol.request_id, kind: 'adjunt', storage_path: path,
        sha256: poderSha, mida_bytes: bytes.length, mime,
      }).select('id').single();
      if (errDoc || !doc) return resposta(500, { error: 'No s\'ha pogut registrar el poder' });
      poderId = doc.id;
    }
  }

  // b) Desar les dades de l'autorització (IBAN xifrat; només els 4 últims en clar)
  const { error: errDesa } = await portal.from('autoritzacions_carrec').upsert({
    request_id: sol.request_id,
    titular_nom: d.titular_nom,
    titular_adreca: d.titular_adreca,
    titular_cp_poblacio: d.titular_cp_poblacio,
    entitat: iban.entitat,
    iban_xifrat: aBytea(await xifraIban(iban.iban, sol.request_id)),
    iban_ultims4: iban.iban.slice(-4),
    client_facturat_nom: d.client_facturat_nom,
    signant_es_administrador: esAdministrador,
    poder_adjunt_id: poderId,
  }, { onConflict: 'request_id' });
  if (errDesa) {
    console.error('desa autoritzacio', errDesa.code);
    return resposta(500, { error: 'No s\'han pogut desar les dades' });
  }

  // c) Empremta de les dades desades
  const { data: empremta, error: errEmp } = await portal.rpc('empremta_dades', {
    p_request_id: sol.request_id, p_signatari_nom: d.signatari_nom,
    p_signatari_carrec: d.signatari_carrec, p_lloc: d.lloc,
  });
  if (errEmp || !empremta) return resposta(500, { error: 'Error intern' });

  const { data: req2 } = await portal.from('requests').select('client_id').eq('id', sol.request_id).single();
  const { data: client } = await portal.from('clients').select('referencia_client').eq('id', req2!.client_id).single();

  // d) Pujar la firma i generar i pujar el PDF (sempre camins nous, sense sobreescriure)
  const signatAt = new Date();
  const firmaSha = await sha256Hex(firma);
  const firmaPath = `requests/${sol.request_id}/evidencies/${crypto.randomUUID()}-signatura.png`;
  const { error: errFirma } = await admin.storage.from(BUCKET)
    .upload(firmaPath, firma, { contentType: 'image/png', upsert: false });
  if (errFirma) return resposta(500, { error: 'No s\'ha pogut desar la signatura' });

  const pdf = await generaPdf({
    requestId: sol.request_id,
    referenciaClient: client?.referencia_client ?? null,
    clientNom: sol.client_nom,
    partyType: sol.party_type,
    titularNom: d.titular_nom,
    titularAdreca: d.titular_adreca,
    titularCpPoblacio: d.titular_cp_poblacio,
    entitat: iban.entitat,
    iban: iban.iban,
    clientFacturatNom: d.client_facturat_nom,
    signatariNom: d.signatari_nom,
    signatariCarrec: d.signatari_carrec,
    signantEsAdministrador: esAdministrador,
    lloc: d.lloc,
    signatAt,
    ip,
    userAgent,
    empremtaDades: empremta,
    signaturaPng: firma,
    signaturaSha256: firmaSha,
    poderSha256: poderSha,
    templateVersion: sol.template_version,
  });
  const pdfSha = await sha256Hex(pdf);
  const pdfPath = `requests/${sol.request_id}/signat/${crypto.randomUUID()}.pdf`;
  const { error: errPdf } = await admin.storage.from(BUCKET)
    .upload(pdfPath, pdf, { contentType: 'application/pdf', upsert: false });
  if (errPdf) return resposta(500, { error: 'No s\'ha pogut desar el document' });

  // e) Registrar la signatura (una sola transacció a la base)
  const { error: errSig } = await portal.rpc('registra_signatura', {
    p_token_id: sol.token_id,
    p_empremta: empremta,
    p_signatari_nom: d.signatari_nom,
    p_signatari_carrec: d.signatari_carrec,
    p_lloc: d.lloc,
    p_signat_at: signatAt.toISOString(),
    p_ip: ip,
    p_user_agent: userAgent,
    p_imatge_path: firmaPath,
    p_imatge_sha256: firmaSha,
    p_imatge_mida: firma.length,
    p_pdf_path: pdfPath,
    p_pdf_sha256: pdfSha,
    p_pdf_mida: pdf.length,
  });
  if (errSig) {
    console.error('registra_signatura', errSig.code);
    if (errSig.code === '40001') {
      return resposta(409, { error: 'Les dades han canviat mentre se signava. Torneu a carregar la pàgina.' });
    }
    if (errSig.code === '42501') return resposta(404, { error: NEUTRE });
    return resposta(500, { error: 'No s\'ha pogut registrar la signatura' });
  }

  // f) Avís a ÀMBIT per Formspree (sense cap dada del client). Si falla, la signatura ja és vàlida.
  const formspree = Deno.env.get('FORMSPREE_FORM_ID');
  if (formspree) {
    try {
      const r = await fetch(`${FORMSPREE_BASE}${formspree}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(AVIS_SIGNATURA),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) console.warn('Formspree ha respost', r.status);
    } catch (e) {
      console.warn('Formspree no disponible', (e as Error).name);
    }
  }

  // g) URL de descàrrega de curta durada
  const nomFitxer = `Autoritzacio-carrec-${signatAt.toISOString().slice(0, 10)}.pdf`;
  const { data: url } = await admin.storage.from(BUCKET)
    .createSignedUrl(pdfPath, SEGONS_DESCARREGA, { download: nomFitxer });

  return resposta(200, { ok: true, url: url?.signedUrl ?? null, nom_fitxer: nomFitxer, sha256: pdfSha });
});
