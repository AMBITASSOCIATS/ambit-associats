// supabase/functions/portal-contracte/index.ts
//
// Funció pública del signant d'un contracte (sense compte). Només funciona
// amb un token d'enllaç vàlid; si no ho és, respon sempre el mateix ("enllaç
// no vàlid o caducat") sense dir si ha existit. Limita els intents per IP
// (com portal-signar, portal-kyc i portal-irpf). Cada signant té el seu enllaç.
//
// Accions:
//   obrir     valida el token i retorna el contracte (títol, idioma, signant)
//             i el camí signat de curta durada del PDF original per veure'l sencer
//             dins del portal. No canvia cap estat.
//   accepta   amb les caselles de lectura i d'acceptació marcades, registra
//             l'acceptació prèvia de la signatura electrònica, amb la seva data
//             i hora (anterior a la signatura).
//   signar    amb el lloc i la signatura en pantalla: calcula l'empremta, desa
//             la imatge de la firma, registra la signatura en una sola
//             transacció (el contracte passa a parcialment signat o a pendent
//             de la signatura d'ÀMBIT) i avisa ÀMBIT per Formspree sense cap
//             dada. El PDF final es genera quan signa ÀMBIT.
// Els errors porten un codi perquè la pàgina els mostri en l'idioma del contracte.

import { clientAdmin, deBase64, entrada, formatToken, ipClient, llegeixCos, serveix, sha256Hex, text } from '../_shared/portal.ts';
import T from '../_shared/text-contracte.json' with { type: 'json' };

const BUCKET = 'portal-docs';
const MAX_FIRMA = 1024 * 1024;
const SEGONS_ORIGINAL = 600;
const NEUTRE = 'Enllaç no vàlid o caducat';

// Avís a ÀMBIT per Formspree: contingut fix, sense cap dada del client, del
// signant ni cap identificador. Els detalls es consulten al portal.
const AVIS_SIGNATURA = {
  _subject: T.avis._subject,
  name: 'Portal de signatura',
  email: 'info@ambit.ad',
  message: T.avis.message,
};
// Només per a les proves locals (per defecte, Formspree)
const FORMSPREE_BASE = Deno.env.get('FORMSPREE_BASE_URL') || 'https://formspree.io/f/';

// Límits per IP (finestres de 10 minuts)
const MAX_PETICIONS = 120;
const MAX_ERRORS_TOKEN = 10;
const FINESTRA = 600;

const MAGIC_PNG = [0x89, 0x50, 0x4e, 0x47];
const comencaAmb = (b: Uint8Array, m: number[]) => m.every((v, i) => b[i] === v);

type Info = {
  token_id: string; request_id: string; template_version: string; expira_at: string;
  titol: string; idioma: 'ca' | 'ca_en';
  original: { storage_path: string; sha256: string; pagines: number; nom_fitxer: string };
  signant: { id: string; nom: string; qualitat: string; acceptat_at: string | null };
};

const avisa = async () => {
  const formspree = Deno.env.get('FORMSPREE_FORM_ID');
  if (!formspree) return;
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
};

serveix('portal-contracte', async (req) => {
  const { atura, resposta } = entrada(req);
  if (atura) return atura;

  const admin = clientAdmin();
  const portal = admin.schema('portal');
  const ip = ipClient(req);
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 500) || null;
  const clauIp = await sha256Hex(`portal-contracte:${ip || 'sense-ip'}`);

  // 1. Límit de peticions per IP
  const { data: dinsLimit } = await portal.rpc('registra_intent', {
    p_clau: `peticio:${clauIp}`, p_maxim: MAX_PETICIONS, p_segons: FINESTRA,
  });
  if (dinsLimit === false) return resposta(429, { error: 'Massa intents', codi: 'massa_intents' });

  const { data: errorsPrevis } = await portal
    .from('limit_intents')
    .select('intents')
    .eq('clau', `error:${clauIp}`)
    .gte('finestra', new Date(Date.now() - FINESTRA * 1000).toISOString());
  if ((errorsPrevis || []).reduce((s, r) => s + r.intents, 0) >= MAX_ERRORS_TOKEN) {
    return resposta(429, { error: 'Massa intents', codi: 'massa_intents' });
  }

  const tokenNoValid = async () => {
    await portal.rpc('registra_intent', { p_clau: `error:${clauIp}`, p_maxim: MAX_ERRORS_TOKEN, p_segons: FINESTRA });
    return resposta(404, { error: NEUTRE, codi: 'invalid' });
  };

  // 2. Token
  const cos = await llegeixCos<Record<string, unknown>>(req);
  if (!cos) return resposta(400, { error: 'Cos de la petició no vàlid', codi: 'error' });
  const token = String(cos.token || '');
  if (!formatToken.test(token)) return tokenNoValid();

  const { data: info, error: errInfo } = await portal.rpc('obre_contracte_per_token', { p_token_hash: await sha256Hex(token) });
  if (errInfo) {
    console.error('obre_contracte_per_token', errInfo.code);
    return resposta(500, { error: 'Error intern', codi: 'error' });
  }
  if (!info) return tokenNoValid();
  const sol = info as Info;
  if (sol.template_version !== T.versio) {
    return resposta(409, { error: 'Aquest document no està disponible. Contacteu amb ÀMBIT Associats.', codi: 'invalid' });
  }

  const errorRpc = (e: { code?: string }, accio: string) => {
    console.error(accio, e.code);
    if (e.code === '42501') return resposta(404, { error: NEUTRE, codi: 'invalid' });
    if (e.code === '40001') return resposta(409, { error: 'Les dades han canviat', codi: 'dades_canviades' });
    if (e.code === '22023' || e.code === '23514') return resposta(400, { error: 'Dades no vàlides', codi: 'error' });
    return resposta(500, { error: 'Error intern', codi: 'error' });
  };

  // ─── obrir ───
  if (cos.accio === 'obrir') {
    const { data: url } = await admin.storage.from(BUCKET).createSignedUrl(sol.original.storage_path, SEGONS_ORIGINAL);
    // Només el camí signat (/storage/v1/...): la pàgina hi posa l'adreça pública de Supabase
    const ruta = url?.signedUrl?.slice(url.signedUrl.indexOf('/storage/v1/'));
    if (!ruta?.startsWith('/storage/v1/')) return resposta(500, { error: 'Error intern', codi: 'error' });
    return resposta(200, {
      ok: true,
      titol: sol.titol,
      idioma: sol.idioma,
      expira_at: sol.expira_at,
      signant: { nom: sol.signant.nom, qualitat: sol.signant.qualitat, acceptat_at: sol.signant.acceptat_at },
      original: { pagines: sol.original.pagines, sha256: sol.original.sha256, ruta },
    });
  }

  // ─── accepta ───
  if (cos.accio === 'accepta') {
    if (cos.llegit !== true || cos.accepta !== true) return resposta(400, { error: 'Cal marcar les dues caselles', codi: 'error' });
    const { data: at, error } = await portal.rpc('contracte_accepta', {
      p_token_id: sol.token_id, p_llegit: true, p_accepta: true, p_ip: ip, p_user_agent: userAgent,
    });
    if (error) return errorRpc(error, 'contracte_accepta');
    return resposta(200, { ok: true, acceptat_at: at });
  }

  if (cos.accio !== 'signar') return resposta(400, { error: 'Acció no vàlida', codi: 'error' });

  // ─── signar ───
  if (!sol.signant.acceptat_at) return resposta(400, { error: 'Falta l\'acceptació prèvia', codi: 'error' });
  const lloc = text(cos.lloc, 100);
  if (!lloc) return resposta(400, { error: 'Falta el lloc', codi: 'falta_lloc' });
  let firma: Uint8Array | null = null;
  try {
    const b = deBase64(String(cos.signatura || '').replace(/^data:image\/png;base64,/, ''));
    firma = b.length >= 100 && b.length <= MAX_FIRMA && comencaAmb(b, MAGIC_PNG) ? b : null;
  } catch {
    firma = null;
  }
  if (!firma) return resposta(400, { error: 'Falta la signatura', codi: 'falta_firma' });

  // a) Empremta de les dades que se signen (contracte, original, signant, lloc i acceptació)
  const { data: empremta, error: errEmp } = await portal.rpc('empremta_contracte', { p_signant_id: sol.signant.id, p_lloc: lloc });
  if (errEmp || !empremta) return resposta(500, { error: 'Error intern', codi: 'error' });

  // b) Imatge de la firma (camí nou, sense sobreescriure)
  const signatAt = new Date();
  const firmaSha = await sha256Hex(firma);
  const firmaPath = `requests/${sol.request_id}/evidencies/${crypto.randomUUID()}-signatura.png`;
  const { error: errFirma } = await admin.storage.from(BUCKET).upload(firmaPath, firma, { contentType: 'image/png', upsert: false });
  if (errFirma) return resposta(500, { error: 'No s\'ha pogut desar la signatura', codi: 'error' });

  // c) Registrar la signatura (una sola transacció a la base)
  const { data: r, error: errSig } = await portal.rpc('contracte_registra_signatura', {
    p_token_id: sol.token_id,
    p_signat_at: signatAt.toISOString(),
    p_ip: ip,
    p_user_agent: userAgent,
    p: { empremta, lloc, imatge_path: firmaPath, imatge_sha256: firmaSha, imatge_mida: firma.length },
  });
  if (errSig) return errorRpc(errSig, 'contracte_registra_signatura');

  // d) Avís a ÀMBIT (sense cap dada). Si falla, la signatura ja és vàlida.
  await avisa();

  return resposta(200, { ok: true, estat: r?.estat ?? null });
});
