// Proves locals de les Edge Functions del portal de signatura.
// Requisits: `supabase start` i `supabase functions serve --env-file supabase/functions/.env`.
// Execució: node supabase/tests/edge/portal.test.mjs [carpeta-per-als-pdf]
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.
// Els tokens i IBAN que surten aquí són de prova.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  execSync('supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const URL = env.API_URL;
const ANON = env.ANON_KEY;
const SERVICE = env.SERVICE_ROLE_KEY;
const CARPETA_PDF = process.argv[2] || null;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const adminPortal = admin.schema('portal');
const nouClient = () => createClient(URL, ANON, { auth: { persistSession: false } });

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t) => console.log(`\n── ${t} ──`);
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

// ─── Dades de prova ─────────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const correus = {
  ocic: `ocic-${sufix}@test.local`,
  gestor: `gestor-${sufix}@test.local`,
  gestor2: `gestor2-${sufix}@test.local`,
  web: `web-${sufix}@test.local`,
};
const IBAN = {
  andbank: 'AD12 0001 2030 2003 5910 0100',
  creand: 'AD3600031000123456789012',
  morabanc: 'ad89 0007 0001 0000 0012 3456',
  altra: 'AD4200050001000000123456',      // vàlid però entitat 0005 no admesa
};

const creaUsuari = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (error) throw error;
  return data.user.id;
};
const sessio = async (email) => {
  const c = nouClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw error;
  return c;
};

const idOcic = await creaUsuari(correus.ocic);
const idGestor = await creaUsuari(correus.gestor);
await creaUsuari(correus.gestor2);
await creaUsuari(correus.web);
{
  const { error } = await adminPortal.from('staff_profiles').insert([
    { user_id: idOcic, role: 'ocic' },
    { user_id: idGestor, role: 'gestor' },
  ]);
  if (error) throw error;
}
const ocic = await sessio(correus.ocic);
const gestor = await sessio(correus.gestor);
const web = await sessio(correus.web);

// Firma de prova: PNG RGBA amb un traç
const pngFirma = () => {
  const w = 300, h = 100;
  const px = Buffer.alloc((w * 4 + 1) * h);
  for (let x = 10; x < w - 10; x++) {
    const y = Math.round(h / 2 + Math.sin(x / 18) * 25);
    for (let dy = -2; dy <= 2; dy++) {
      const o = (y + dy) * (w * 4 + 1) + 1 + x * 4;
      px[o] = 20; px[o + 1] = 40; px[o + 2] = 90; px[o + 3] = 255;
    }
  }
  const crc = (buf) => {
    let c, crcVal = 0xffffffff;
    for (const b of buf) { c = (crcVal ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcVal = (crcVal >>> 8) ^ c; }
    return (crcVal ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipus, dades) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dades.length);
    const td = Buffer.concat([Buffer.from(tipus), dades]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0)),
  ]);
};
const FIRMA = `data:image/png;base64,${pngFirma().toString('base64')}`;

// Crida a una funció amb fetch (per controlar Origin i llegir l'estat)
const crida = async (funcio, cos, { jwt = ANON, origen = 'https://www.ambit.ad' } = {}) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: {
      ...(origen ? { Origin: origen } : {}),
      Authorization: `Bearer ${jwt}`,
      apikey: ANON,
      'Content-Type': 'application/json',
      'User-Agent': 'Prova-local/1.0 (portal.test.mjs)',
    },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})) };
};
const jwtDe = async (c) => (await c.auth.getSession()).data.session.access_token;
const JWT_OCIC = await jwtDe(ocic);
const JWT_GESTOR = await jwtDe(gestor);
const JWT_WEB = await jwtDe(web);

// Crea client i sol·licitud amb la sessió del gestor (RLS)
const creaSolicitud = async ({ tipus, nom, referencia = null, previ = null }) => {
  const p = gestor.schema('portal');
  const { data: cli, error: e1 } = await p.from('clients')
    .insert({ party_type: tipus, nom_mostrat: nom, referencia_client: referencia }).select('id').single();
  if (e1) throw e1;
  const { data: sol, error: e2 } = await p.from('requests')
    .insert({ client_id: cli.id, document_type: 'autoritzacio_carrec', template_version: 'ABA-01 v1', idioma: 'ca' })
    .select('id').single();
  if (e2) throw e2;
  if (previ) {
    const { error: e3 } = await p.from('autoritzacions_carrec').insert({ request_id: sol.id, ...previ });
    if (e3) throw e3;
  }
  return { clientId: cli.id, requestId: sol.id };
};
const enllac = async (requestId, jwt = JWT_GESTOR) => {
  const r = await crida('portal-enllac', { request_id: requestId }, { jwt });
  return { ...r, token: r.cos.enllac?.split('/signar/')[1] };
};
const estat = async (requestId) =>
  (await adminPortal.from('requests').select('status').eq('id', requestId).single()).data.status;

const dadesPf = {
  titular_nom: 'Maria Prova Ficticia',
  titular_adreca: 'Carrer de la Prova, 1, 3r 2a',
  titular_cp_poblacio: 'AD500 Andorra la Vella',
  signatari_nom: 'Maria Prova Ficticia',
  lloc: 'Andorra la Vella',
  signatura_png: FIRMA,
};

// ═══════════════════════════════════════════════════════════════════════════
seccio('Text de l\'autorització');

{
  const pdf = fs.readFileSync(new globalThis.URL('../../functions/_shared/text-autoritzacio.json', import.meta.url));
  const web = fs.readFileSync(new globalThis.URL('../../../src/portal/signar/text-autoritzacio.json', import.meta.url));
  comprova(pdf.equals(web), 'El text del formulari i el del PDF són el mateix fitxer, byte a byte');
}

// ═══════════════════════════════════════════════════════════════════════════
seccio('Orígens i permisos');

const solA = await creaSolicitud({ tipus: 'pf', nom: 'Maria Prova Ficticia', referencia: `PF${String(sufix).slice(-8)}` });

const rOrigen = await crida('portal-enllac', { request_id: solA.requestId }, { jwt: JWT_GESTOR, origen: 'https://malicios.example' });
comprova(rOrigen.status === 403 && rOrigen.cos.error === 'Origen no permès', 'portal-enllac: origen no permès → 403');
const rOrigenS = await crida('portal-signar', { accio: 'obrir', token: 'x'.repeat(43) }, { origen: 'https://malicios.example' });
comprova(rOrigenS.status === 403, 'portal-signar: origen no permès → 403');
const rOrigenR = await crida('portal-remesa', {}, { jwt: JWT_GESTOR, origen: 'https://malicios.example' });
comprova(rOrigenR.status === 403, 'portal-remesa: origen no permès → 403');
const rOrigenP = await crida('portal-personal', { accio: 'llistar' }, { jwt: JWT_OCIC, origen: 'https://malicios.example' });
comprova(rOrigenP.status === 403, 'portal-personal: origen no permès → 403');

const rWebEnllac = await enllac(solA.requestId, JWT_WEB);
comprova(rWebEnllac.status === 403, 'Usuari de la web que no és personal no pot generar enllaços (403)');
const rWebRemesa = await crida('portal-remesa', {}, { jwt: JWT_WEB });
comprova(rWebRemesa.status === 403, 'Usuari de la web que no és personal no pot exportar la remesa (403)');
const rWebPers = await crida('portal-personal', { accio: 'llistar' }, { jwt: JWT_WEB });
comprova(rWebPers.status === 403, 'Usuari de la web que no és personal no pot gestionar personal (403)');
comprova((await estat(solA.requestId)) === 'esborrany', 'Les crides rebutjades no han canviat la sol·licitud');

const { data: rolWeb } = await web.schema('portal').rpc('el_meu_rol');
const { data: rolGestor } = await gestor.schema('portal').rpc('el_meu_rol');
comprova(rolWeb === null && rolGestor === 'gestor', 'el_meu_rol: null per a la web, gestor per al gestor');
const { data: clientsWeb } = await web.schema('portal').from('clients').select('id');
comprova((clientsWeb || []).length === 0, 'Usuari de la web no veu cap client del portal');

// ═══════════════════════════════════════════════════════════════════════════
seccio('Enllaç: generar i regenerar');

const e1 = await enllac(solA.requestId);
comprova(e1.status === 200 && /^https:\/\/www\.ambit\.ad\/signar\/[A-Za-z0-9_-]{43}$/.test(e1.cos.enllac),
  'Gestor genera l\'enllaç https://www.ambit.ad/signar/<token>');
comprova((await estat(solA.requestId)) === 'enviat', 'Generar l\'enllaç passa esborrany → enviat');
const dies = (new Date(e1.cos.expira_at) - Date.now()) / 86400000;
comprova(dies > 6.99 && dies <= 7.001, 'L\'enllaç caduca als 7 dies');

const { data: tokens1 } = await adminPortal.from('access_tokens').select('token_hash').eq('request_id', solA.requestId);
comprova(tokens1.length === 1 && tokens1[0].token_hash === sha256(e1.token) && !JSON.stringify(tokens1).includes(e1.token),
  'A la base només hi ha el hash del token, no el token');

const e2 = await enllac(solA.requestId);
comprova(e2.status === 200 && e2.token !== e1.token, 'Regenerar dona un token nou');
const oVell = await crida('portal-signar', { accio: 'obrir', token: e1.token });
comprova(oVell.status === 404 && oVell.cos.error === 'Enllaç no vàlid o caducat', 'El token anterior queda revocat (resposta neutra)');
const { data: vigents } = await adminPortal.from('access_tokens').select('id')
  .eq('request_id', solA.requestId).is('revocat_at', null).is('usat_at', null);
comprova(vigents.length === 1, 'Només hi ha un token vigent per sol·licitud');

// ═══════════════════════════════════════════════════════════════════════════
seccio('Token: vàlid, caducat, revocat, inexistent');

const oBo = await crida('portal-signar', { accio: 'obrir', token: e2.token });
comprova(oBo.status === 200 && oBo.cos.client_nom === 'Maria Prova Ficticia' && oBo.cos.party_type === 'pf',
  'Token vàlid obre el formulari');
comprova(!JSON.stringify(oBo.cos).match(/token_id|request_id|iban/i), 'La resposta al client no inclou identificadors interns ni IBAN');
comprova((await estat(solA.requestId)) === 'en_curs', 'Obrir l\'enllaç passa enviat → en_curs');
const oBo2 = await crida('portal-signar', { accio: 'obrir', token: e2.token });
comprova(oBo2.status === 200, 'L\'enllaç es pot tornar a obrir mentre no se signa');

const oInex = await crida('portal-signar', { accio: 'obrir', token: 'A'.repeat(43) });
comprova(oInex.status === 404 && oInex.cos.error === 'Enllaç no vàlid o caducat', 'Token inexistent → mateixa resposta neutra');
const oMal = await crida('portal-signar', { accio: 'obrir', token: 'curt' });
comprova(oMal.status === 404 && oMal.cos.error === 'Enllaç no vàlid o caducat', 'Token amb format dolent → mateixa resposta neutra');

const solCad = await creaSolicitud({ tipus: 'pf', nom: 'Client Caducat' });
const eCad = await enllac(solCad.requestId);
await adminPortal.from('access_tokens').update({ expira_at: new Date(Date.now() - 60000).toISOString() })
  .eq('token_hash', sha256(eCad.token));
const oCad = await crida('portal-signar', { accio: 'obrir', token: eCad.token });
comprova(oCad.status === 404 && oCad.cos.error === 'Enllaç no vàlid o caducat', 'Token caducat → resposta neutra');
const sCad = await crida('portal-signar', { accio: 'signar', token: eCad.token, ...dadesPf, iban: IBAN.andbank });
comprova(sCad.status === 404, 'Amb un token caducat no es pot signar');

const solRev = await creaSolicitud({ tipus: 'pf', nom: 'Client Anul·lat' });
const eRev = await enllac(solRev.requestId);
{
  const { error } = await gestor.schema('portal').from('requests').update({ status: 'anullat' }).eq('id', solRev.requestId);
  comprova(!error, 'El personal pot anul·lar una sol·licitud enviada');
}
const oRev = await crida('portal-signar', { accio: 'obrir', token: eRev.token });
comprova(oRev.status === 404, 'Sol·licitud anul·lada: el token ja no serveix');
const eRev2 = await enllac(solRev.requestId);
comprova(eRev2.status === 409, 'No es pot generar enllaç d\'una sol·licitud anul·lada');

// ═══════════════════════════════════════════════════════════════════════════
seccio('IBAN: validació');

const casosIban = [
  ['ES9121000418450200051332', 'IBAN d\'un altre país'],
  ['AD120001203020035910010', 'IBAN de 23 caràcters'],
  ['AD12000120302003591001000', 'IBAN de 25 caràcters'],
  ['AD12 0001 2030 2003 5910 01#0', 'IBAN amb caràcters no vàlids'],
  ['AD1300012030200359100100', 'Dígits de control incorrectes'],
  ['', 'IBAN buit'],
  [IBAN.altra, 'Entitat no admesa (0005)'],
];
for (const [iban, nom] of casosIban) {
  const r = await crida('portal-signar', { accio: 'signar', token: e2.token, ...dadesPf, iban });
  comprova(r.status === 400, `${nom} → rebutjat (${r.cos.error || r.status})`);
}
const rEnt = await crida('portal-signar', { accio: 'signar', token: e2.token, ...dadesPf, iban: IBAN.altra });
comprova(/Entitat no admesa/.test(rEnt.cos.error || ''), 'El missatge de l\'entitat no admesa és clar');
comprova((await estat(solA.requestId)) === 'en_curs', 'Els intents amb IBAN dolent no signen res');

const rSenseFirma = await crida('portal-signar', { accio: 'signar', token: e2.token, ...dadesPf, iban: IBAN.andbank, signatura_png: '' });
comprova(rSenseFirma.status === 400, 'Sense signatura → rebutjat');
const rSenseLloc = await crida('portal-signar', { accio: 'signar', token: e2.token, ...dadesPf, iban: IBAN.andbank, lloc: ' ' });
comprova(rSenseLloc.status === 400, 'Sense localitat → rebutjat');

// ═══════════════════════════════════════════════════════════════════════════
seccio('Signatura completa · persona física (Andbank)');

// En local, les URL signades que genera la funció apunten al nom intern del
// gateway (kong:8000); a producció ja són l'adreça pública.
const publica = (url) => url.replace(/^https?:\/\/kong:8000/, URL);
const desaPdf = async (url, nom) => {
  const r = await fetch(publica(url));
  const b = Buffer.from(await r.arrayBuffer());
  if (CARPETA_PDF) fs.writeFileSync(`${CARPETA_PDF}/${nom}`, b);
  return b;
};

const sA = await crida('portal-signar', { accio: 'signar', token: e2.token, ...dadesPf, iban: IBAN.andbank });
comprova(sA.status === 200 && sA.cos.ok && !!sA.cos.url, 'Signatura acceptada i URL de descàrrega retornada');
comprova(/token=/.test(sA.cos.url || '') && /\/object\/sign\/portal-docs\//.test(sA.cos.url || ''), 'La descàrrega és una URL signada del bucket privat');
const pdfA = await desaPdf(sA.cos.url, 'exemple-persona-fisica.pdf');
comprova(pdfA.subarray(0, 5).toString() === '%PDF-', 'El fitxer descarregat és un PDF');
const { data: docsA } = await adminPortal.from('documents').select('kind, sha256, mida_bytes, storage_path').eq('request_id', solA.requestId);
const docPdfA = docsA.find((d) => d.kind === 'signat');
comprova(docPdfA && docPdfA.sha256 === sha256(pdfA) && docPdfA.mida_bytes === pdfA.length,
  'SHA-256 del PDF descarregat = sha256 desat a portal.documents');
comprova(sA.cos.sha256 === sha256(pdfA), 'SHA-256 retornat al client coincideix');
comprova(docsA.some((d) => d.kind === 'evidencies'), 'La imatge de la firma queda registrada com a evidència');
comprova((await estat(solA.requestId)) === 'signat', 'La sol·licitud passa a signat');

const { data: autA } = await adminPortal.from('autoritzacions_carrec').select('*').eq('request_id', solA.requestId).single();
comprova(autA.entitat === 'andbank' && autA.iban_ultims4 === '0100', 'Entitat deduïda del codi 0001 (Andbank) i últims 4');
comprova(!JSON.stringify(autA).includes('0359100100') && autA.iban_xifrat.startsWith('\\x01'),
  'A la base l\'IBAN només hi és xifrat (versió 1) + últims 4');
const { data: sigA } = await adminPortal.from('signatures').select('*').eq('request_id', solA.requestId).single();
comprova(/^[0-9a-f]{64}$/.test(sigA.empremta_dades) && sigA.user_agent?.includes('Prova-local'),
  'La firma desa l\'empremta de les dades i el navegador');
const pdfTextA = pdfA.toString('latin1');
comprova(pdfTextA.includes('Carlito'), 'El PDF fa servir Carlito (com l\'original)');

const reus = await crida('portal-signar', { accio: 'obrir', token: e2.token });
comprova(reus.status === 404 && reus.cos.error === 'Enllaç no vàlid o caducat', 'Token ja usat → resposta neutra');
const reus2 = await crida('portal-signar', { accio: 'signar', token: e2.token, ...dadesPf, iban: IBAN.andbank });
comprova(reus2.status === 404, 'Amb un token usat no es pot tornar a signar');
const eDesp = await enllac(solA.requestId);
comprova(eDesp.status === 409, 'Un cop signada no es pot regenerar l\'enllaç');

// Immutabilitat: el personal no pot tocar les dades signades
{
  const { error } = await gestor.schema('portal').from('autoritzacions_carrec')
    .update({ titular_nom: 'Canviat' }).eq('request_id', solA.requestId);
  comprova(!!error, 'El personal no pot modificar les dades d\'una autorització signada');
}

// Descàrrega pel personal (URL signada de curta durada)
{
  const { data, error } = await gestor.storage.from('portal-docs').createSignedUrl(docPdfA.storage_path, 60);
  const b = data ? Buffer.from(await (await fetch(data.signedUrl)).arrayBuffer()) : Buffer.alloc(0);
  comprova(!error && sha256(b) === docPdfA.sha256, 'El personal descarrega el PDF amb URL signada (60 s)');
  const { data: dw } = await web.storage.from('portal-docs').createSignedUrl(docPdfA.storage_path, 60);
  comprova(!dw, 'Un usuari de la web que no és personal no pot descarregar el PDF');
}

// ═══════════════════════════════════════════════════════════════════════════
seccio('Signatura completa · persona jurídica amb administrador (Creand)');

const solB = await creaSolicitud({
  tipus: 'pj', nom: 'Prova Administrador, SL', referencia: `PJ${String(sufix).slice(-8)}`,
  previ: { titular_nom: 'Prova Administrador, SL' },
});
const eB = await enllac(solB.requestId);
const oB = await crida('portal-signar', { accio: 'obrir', token: eB.token });
comprova(oB.cos.titular_nom === 'Prova Administrador, SL', 'El formulari rep les dades preomplertes pel personal');
const dadesPj = {
  titular_nom: 'Prova Administrador, SL',
  titular_adreca: 'Avinguda Ficticia, 10',
  titular_cp_poblacio: 'AD700 Escaldes-Engordany',
  signatari_nom: 'Joan Prova',
  signatari_carrec: 'Administrador únic',
  lloc: 'Escaldes-Engordany',
  signatura_png: FIRMA,
};
const sBsense = await crida('portal-signar', { accio: 'signar', token: eB.token, ...dadesPj, iban: IBAN.creand });
comprova(sBsense.status === 400, 'Persona jurídica: cal indicar si el signant és administrador');
const sB = await crida('portal-signar', { accio: 'signar', token: eB.token, ...dadesPj, iban: IBAN.creand, signant_es_administrador: true });
comprova(sB.status === 200, 'Persona jurídica amb administrador signa sense poder');
const { data: autB } = await adminPortal.from('autoritzacions_carrec').select('entitat').eq('request_id', solB.requestId).single();
comprova(autB.entitat === 'creand', 'Entitat deduïda del codi 0003 (Creand)');

// ═══════════════════════════════════════════════════════════════════════════
seccio('Signatura completa · persona jurídica amb poder (MoraBanc)');

const solC = await creaSolicitud({ tipus: 'pj', nom: 'Prova Apoderat, SA', referencia: `PO${String(sufix).slice(-8)}` });
const eC = await enllac(solC.requestId);
const dadesPo = {
  titular_nom: 'Prova Apoderat, SA',
  titular_adreca: 'Carrer Major de la Prova, 25, baixos',
  titular_cp_poblacio: 'AD400 la Massana',
  client_facturat_nom: 'Grup Prova Holding, SL',
  signatari_nom: 'Anna Prova Apoderada',
  signatari_carrec: 'Apoderada',
  lloc: 'la Massana',
  signatura_png: FIRMA,
  signant_es_administrador: false,
};
const sCsense = await crida('portal-signar', { accio: 'signar', token: eC.token, ...dadesPo, iban: IBAN.morabanc });
comprova(sCsense.status === 400, 'Signant no administrador sense poder → rebutjat');

const upMal = await crida('portal-signar', { accio: 'url_pujada', token: eC.token, mime: 'application/zip', mida: 1000 });
comprova(upMal.status === 400, 'Pujada: format no admès → rebutjat');
const upGran = await crida('portal-signar', { accio: 'url_pujada', token: eC.token, mime: 'application/pdf', mida: 21 * 1024 * 1024 });
comprova(upGran.status === 400, 'Pujada: més de 20 MB → rebutjat');
const up = await crida('portal-signar', { accio: 'url_pujada', token: eC.token, mime: 'application/pdf', mida: 200 });
comprova(up.status === 200 && up.cos.path?.startsWith('requests/') && !!up.cos.upload_token, 'Pujada: URL signada per al poder');
const poderBytes = Buffer.from('%PDF-1.4\n% Poder de prova (fictici)\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n');
{
  const { error } = await nouClient().storage.from('portal-docs')
    .uploadToSignedUrl(up.cos.path, up.cos.upload_token, poderBytes, { contentType: 'application/pdf' });
  comprova(!error, 'El client puja el poder amb la URL signada (sense compte)');
  const { error: e2b } = await nouClient().storage.from('portal-docs')
    .uploadToSignedUrl(up.cos.path, up.cos.upload_token, Buffer.from('%PDF-altre'), { contentType: 'application/pdf', upsert: true });
  comprova(!!e2b, 'La mateixa URL no permet sobreescriure el fitxer');
}
const camiAltre = up.cos.path.replace(solC.requestId, solA.requestId);
const sCaltre = await crida('portal-signar', { accio: 'signar', token: eC.token, ...dadesPo, iban: IBAN.morabanc, poder_path: camiAltre });
comprova(sCaltre.status === 400, 'No es pot fer servir un camí d\'una altra sol·licitud');

const sC = await crida('portal-signar', { accio: 'signar', token: eC.token, ...dadesPo, iban: IBAN.morabanc, poder_path: up.cos.path });
comprova(sC.status === 200, 'Persona jurídica amb poder signa');
const pdfC = await desaPdf(sC.cos.url, 'exemple-persona-juridica-amb-poder.pdf');
const { data: docsC } = await adminPortal.from('documents').select('id, kind, sha256').eq('request_id', solC.requestId);
const { data: autC } = await adminPortal.from('autoritzacions_carrec').select('*').eq('request_id', solC.requestId).single();
const poder = docsC.find((d) => d.kind === 'adjunt');
comprova(poder && poder.sha256 === sha256(poderBytes) && autC.poder_adjunt_id === poder.id,
  'El poder queda registrat (adjunt, sha256) i vinculat a l\'autorització');
comprova(autC.entitat === 'morabanc' && autC.signant_es_administrador === false, 'Entitat 0007 (MoraBanc) i signant no administrador');
comprova(docsC.find((d) => d.kind === 'signat')?.sha256 === sha256(pdfC), 'SHA-256 del PDF amb poder coincideix');

// ═══════════════════════════════════════════════════════════════════════════
seccio('Activació, remesa i retirada');

{
  const { error: eAct } = await gestor.schema('portal').rpc('activa_autoritzacio', { p_request_id: solA.requestId, p_data_alta: '2026-10-08' });
  comprova(!eAct, 'El gestor activa l\'autorització (data_alta) amb una sola crida');
  const { error: eActWeb } = await web.schema('portal').rpc('activa_autoritzacio', { p_request_id: solB.requestId, p_data_alta: '2026-10-08' });
  comprova(!!eActWeb, 'Un usuari de la web no pot activar autoritzacions');
  await gestor.schema('portal').rpc('activa_autoritzacio', { p_request_id: solC.requestId, p_data_alta: '2026-10-08' });
}
comprova((await estat(solA.requestId)) === 'actiu' && (await estat(solC.requestId)) === 'actiu', 'Sol·licituds A i C actives');

const auditAbans = (await adminPortal.from('audit_log').select('id', { count: 'exact', head: true }).eq('entitat', 'remesa')).count;
const rem = await crida('portal-remesa', {}, { jwt: JWT_GESTOR });
comprova(rem.status === 200 && rem.cos.csv?.startsWith('﻿Referència;Titular;Entitat;IBAN'), 'El gestor exporta la remesa en CSV');
comprova(rem.cos.csv?.includes('AD1200012030200359100100') && rem.cos.csv?.includes('AD8900070001000000123456'),
  'El CSV inclou l\'IBAN complet desxifrat al servidor');
comprova(rem.cos.csv?.includes(';Andbank;') && rem.cos.csv?.includes(';MoraBanc;'), 'El CSV inclou l\'entitat');
comprova(!rem.cos.csv?.includes('AD3600031000123456789012'), 'El CSV no inclou autoritzacions que no estan actives');
const { data: audRem } = await adminPortal.from('audit_log').select('actor, accio, detalls').eq('entitat', 'remesa').order('at', { ascending: false }).limit(1);
const auditDesp = (await adminPortal.from('audit_log').select('id', { count: 'exact', head: true }).eq('entitat', 'remesa')).count;
comprova(auditDesp === auditAbans + 1 && audRem[0].actor === idGestor && audRem[0].accio === 'EXPORT',
  'L\'exportació queda a audit_log amb el gestor com a actor');
comprova(!JSON.stringify(audRem[0]).includes('AD12'), 'L\'audit_log de l\'exportació no conté cap IBAN');

{
  const { error } = await gestor.schema('portal').rpc('retira_autoritzacio', { p_request_id: solC.requestId, p_data_retirada: '2026-10-09', p_motiu: 'Prova' });
  comprova(!error && (await estat(solC.requestId)) === 'retirat', 'El gestor retira una autorització activa');
}

// Auditoria de l'enllaç: l'actor és el gestor encara que escrigui service_role
{
  const { data } = await adminPortal.from('audit_log').select('actor').eq('entitat', 'access_tokens').eq('accio', 'INSERT').limit(1);
  comprova(data?.[0]?.actor === idGestor, 'audit_log: la creació del token té el gestor com a actor');
  const { data: tokAud } = await adminPortal.from('audit_log').select('accio, detalls').eq('entitat', 'access_tokens');
  const textAud = JSON.stringify(tokAud);
  comprova(tokAud.filter((a) => a.accio === 'INSERT').every((a) => a.detalls.nou.token_hash === '[ocult]') &&
    !textAud.includes(sha256(e1.token)) && !textAud.includes(sha256(e2.token)),
    'audit_log: el hash del token surt com a [ocult] i no apareix enlloc');
  const { data: autAud } = await adminPortal.from('audit_log').select('detalls').eq('entitat', 'autoritzacions_carrec');
  comprova(!JSON.stringify(autAud).includes('\\\\x01'), 'audit_log: l\'IBAN xifrat surt com a [ocult]');
}

// ═══════════════════════════════════════════════════════════════════════════
seccio('Personal del portal (OCIC)');

const pAltaG = await crida('portal-personal', { accio: 'alta', email: correus.gestor2 }, { jwt: JWT_GESTOR });
comprova(pAltaG.status === 403, 'Un gestor no pot donar d\'alta personal');
const pLlistaG = await crida('portal-personal', { accio: 'llistar' }, { jwt: JWT_GESTOR });
comprova(pLlistaG.status === 403, 'Un gestor no pot veure la llista de personal');

const pAlta = await crida('portal-personal', { accio: 'alta', email: correus.gestor2.toUpperCase() }, { jwt: JWT_OCIC });
comprova(pAlta.status === 200, 'OCIC dona d\'alta un gestor pel correu d\'un usuari existent');
const pLlista = await crida('portal-personal', { accio: 'llistar' }, { jwt: JWT_OCIC });
const g2 = pLlista.cos.personal?.find((p) => p.email === correus.gestor2);
comprova(g2?.role === 'gestor' && g2?.actiu === true, 'El gestor nou surt a la llista, actiu');
const pInex = await crida('portal-personal', { accio: 'alta', email: `no-existeix-${sufix}@test.local` }, { jwt: JWT_OCIC });
comprova(pInex.status === 404, 'No es pot donar d\'alta un correu que no és usuari de la web');
const pJo = await crida('portal-personal', { accio: 'baixa', email: correus.ocic }, { jwt: JWT_OCIC });
comprova(pJo.status === 403, 'L\'OCIC no es pot donar de baixa a si mateix');
const pJoAlta = await crida('portal-personal', { accio: 'alta', email: correus.ocic }, { jwt: JWT_OCIC });
comprova(pJoAlta.status === 403, 'L\'OCIC no es pot gestionar a si mateix (alta)');

const gestor2 = await sessio(correus.gestor2);
const { data: rolG2 } = await gestor2.schema('portal').rpc('el_meu_rol');
comprova(rolG2 === 'gestor', 'El gestor nou ja té accés al portal');

const pBaixa = await crida('portal-personal', { accio: 'baixa', email: correus.gestor2 }, { jwt: JWT_OCIC });
comprova(pBaixa.status === 200, 'OCIC dona de baixa el gestor');
const { data: rolG2b } = await gestor2.schema('portal').rpc('el_meu_rol');
comprova(rolG2b === null, 'Després de la baixa ja no té accés al portal');
const rG2 = await crida('portal-remesa', {}, { jwt: await jwtDe(gestor2) });
comprova(rG2.status === 403, 'Un gestor donat de baixa no pot exportar la remesa');
{
  const { data } = await adminPortal.from('staff_profiles').select('actiu').eq('user_id', g2.user_id).single();
  comprova(data.actiu === false, 'La baixa no esborra la fitxa (actiu = false)');
  const { data: staffG2 } = await adminPortal.from('staff_profiles').select('id').eq('user_id', g2.user_id).single();
  const { data: audG } = await adminPortal.from('audit_log').select('actor, accio').eq('entitat', 'staff_profiles').eq('entitat_id', staffG2.id);
  comprova(audG.length === 2 && audG.every((a) => a.actor === idOcic), 'audit_log: l\'alta i la baixa tenen l\'OCIC com a actor');
}

// ═══════════════════════════════════════════════════════════════════════════
seccio('Límit d\'intents per IP');

let ultim = null;
for (let i = 0; i < 12; i++) ultim = await crida('portal-signar', { accio: 'obrir', token: 'B'.repeat(43) });
comprova(ultim.status === 429, 'Després de 10 tokens dolents, la IP rep 429 durant uns minuts');
// Neteja perquè es puguin repetir les proves
await adminPortal.from('limit_intents').delete().neq('clau', '');

console.log(`\n${total - fallades}/${total} correctes`);
console.log(fallades ? `${fallades} proves han fallat` : 'Totes les proves han passat');
process.exit(fallades ? 1 : 0);
