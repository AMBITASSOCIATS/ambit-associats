// Proves locals del KYC i la protecció de dades (Edge Functions portal-kyc,
// portal-kyc-personal, portal-enllac i portal-purga) amb fitxers reals.
//
// Requisits: `supabase start` i les funcions servides amb un receptor local
// en lloc de Formspree (no s'envia res a fora):
//   supabase functions serve --env-file <fitxer>
// on <fitxer> és supabase/functions/.env més aquestes dues línies:
//   FORMSPREE_FORM_ID=prova-local
//   FORMSPREE_BASE_URL=http://host.docker.internal:54399/f/
// Execució: node supabase/tests/edge/kyc.test.mjs [carpeta-per-als-pdf]
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.
// Totes les dades són fictícies.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import http from 'node:http';
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
const sql = (q) => execSync('docker exec -i supabase_db_ambit-associats psql -U postgres -d postgres -X -A -t -q -v ON_ERROR_STOP=1',
  { input: q, encoding: 'utf8' }).trim();
const SECRET_PURGA = sql(`select decrypted_secret from vault.decrypted_secrets where name = 'portal_purga_secret';`);

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t) => console.log(`\n── ${t} ──`);
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const publica = (url) => url.replace(/^https?:\/\/kong:8000/, URL);
const avui = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });
const mesAnys = (n) => { const d = new Date(`${avui}T12:00:00Z`); d.setUTCFullYear(d.getUTCFullYear() + n); return d.toISOString().slice(0, 10); };

// ─── Receptor local que fa de Formspree ─────────────────────────────────────
const avisos = [];
const receptor = http.createServer((req, res) => {
  let cos = '';
  req.on('data', (c) => { cos += c; });
  req.on('end', () => {
    avisos.push({ ruta: req.url, metode: req.method, cos });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
await new Promise((r) => receptor.listen(54399, '0.0.0.0', r));

// ─── Usuaris ────────────────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const correus = { ocic: `ocic-k-${sufix}@test.local`, gestor: `gestor-k-${sufix}@test.local`, web: `web-k-${sufix}@test.local` };
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
await creaUsuari(correus.web);
await adminPortal.from('staff_profiles').insert([{ user_id: idOcic, role: 'ocic' }, { user_id: idGestor, role: 'gestor' }]);
const ocic = await sessio(correus.ocic);
const gestor = await sessio(correus.gestor);
const web = await sessio(correus.web);
const jwtDe = async (c) => (await c.auth.getSession()).data.session.access_token;
const JWT_OCIC = await jwtDe(ocic);
const JWT_GESTOR = await jwtDe(gestor);
const JWT_WEB = await jwtDe(web);

// ─── PNG de prova: traços que semblen una firma ─────────────────────────────
const png = (w, h, traç) => {
  const px = Buffer.alloc((w * 4 + 1) * h);
  const punt = (x, y, r = 1.6) => {
    for (let dx = -r; dx <= r; dx++) for (let dy = -r; dy <= r; dy++) {
      const xx = Math.round(x + dx), yy = Math.round(y + dy);
      if (xx < 0 || yy < 0 || xx >= w || yy >= h || dx * dx + dy * dy > r * r) continue;
      const o = yy * (w * 4 + 1) + 1 + xx * 4;
      px[o] = 20; px[o + 1] = 40; px[o + 2] = 95; px[o + 3] = 255;
    }
  };
  for (let t = 0; t <= 1; t += 1 / 4000) { const [x, y] = traç(t); punt(x, y); }
  const crc = (buf) => {
    let c, v = 0xffffffff;
    for (const b of buf) { c = (v ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; v = (v >>> 8) ^ c; }
    return (v ^ 0xffffffff) >>> 0;
  };
  const chunk = (tipus, dades) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(dades.length);
    const td = Buffer.concat([Buffer.from(tipus), dades]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([len, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]);
};
const firma = (llavor) => png(420, 140, (t) => {
  const x = 30 + t * 360;
  return [x, 70 + Math.sin(t * (9 + llavor)) * 28 * Math.cos(t * (3 + llavor / 2)) + Math.sin(t * 40) * 6];
});
const dataUrl = (b) => `data:image/png;base64,${b.toString('base64')}`;
const FIRMA_KYC = dataUrl(firma(1));
const FIRMA_PDP = dataUrl(firma(4));
const FIRMA_KYC_PJ = dataUrl(firma(2));
const FIRMA_PDP_PJ = dataUrl(firma(6));

// Firma manuscrita de prova de l'OCIC (al bucket privat portal-firmes)
const firmaOcic = png(500, 170, (t) => [40 + t * 420, 85 + Math.sin(t * 14) * 40 * (1 - t) + Math.cos(t * 5) * 20]);
const firmaOcicPath = `ocic/${idOcic}/${crypto.randomUUID()}.png`;
{
  const { error } = await admin.storage.from('portal-firmes').upload(firmaOcicPath, firmaOcic, { contentType: 'image/png' });
  if (error) throw error;
  const { error: e2 } = await adminPortal.from('firmes_ocic').insert({ user_id: idOcic, nom: 'OCIC · firma de prova (no real)', imatge_path: firmaOcicPath, sha256: sha256(firmaOcic) });
  if (e2) throw e2;
}

// ─── Crides ─────────────────────────────────────────────────────────────────
const crida = async (funcio, cos, { jwt = ANON, origen = 'https://www.ambit.ad' } = {}) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: {
      ...(origen ? { Origin: origen } : {}),
      Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json',
      'User-Agent': 'Prova-local/1.0 (kyc.test.mjs)',
    },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})) };
};
const kyc = (token, cos) => crida('portal-kyc', { token, ...cos });
const personal = (cos, jwt = JWT_GESTOR) => crida('portal-kyc-personal', cos, { jwt });
const estat = async (id) => (await adminPortal.from('requests').select('status').eq('id', id).single()).data?.status;
const desaPdf = async (url, nom) => {
  const b = Buffer.from(await (await fetch(publica(url))).arrayBuffer());
  if (CARPETA_PDF) fs.writeFileSync(`${CARPETA_PDF}/${nom}`, b);
  return b;
};
const desaPdfStorage = async (path, nom) => {
  const { data } = await admin.storage.from('portal-docs').download(path);
  const b = Buffer.from(await data.arrayBuffer());
  if (CARPETA_PDF) fs.writeFileSync(`${CARPETA_PDF}/${nom}`, b);
  return b;
};

// Document de prova (PDF mínim fictici, diferent per a cada tipus)
const pdfProva = (etiqueta) => Buffer.from(`%PDF-1.4\n% Document de prova (fictici): ${etiqueta}\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n`);
const pujaDoc = async (token, tipus, persona = null, nom = `${tipus}.pdf`, contingut = pdfProva(`${tipus} ${persona || ''} ${sufix}`), mime = 'application/pdf') => {
  const u = await kyc(token, { accio: 'url_pujada', tipus, persona, mime, mida: contingut.length });
  if (u.status !== 200) return u;
  const { error } = await nouClient().storage.from('portal-docs').uploadToSignedUrl(u.cos.path, u.cos.upload_token, contingut, { contentType: mime });
  if (error) return { status: 500, cos: { error: error.message } };
  return kyc(token, { accio: 'registra_adjunt', path: u.cos.path, tipus, persona, nom_fitxer: nom });
};
const nouClientPortal = async (tipus, nom, referencia) => {
  const { data, error } = await gestor.schema('portal').from('clients')
    .insert({ party_type: tipus, nom_mostrat: nom, referencia_client: referencia }).select('id').single();
  if (error) throw error;
  return data.id;
};
const pdpDe = async (kycId) => (await adminPortal.from('kyc_formularis').select('pdp_request_id').eq('request_id', kycId).single()).data.pdp_request_id;

// ─── Dades fictícies ────────────────────────────────────────────────────────
const dadesPf = {
  identificacio: {
    nom: 'Maria Prova Ficticia', data_naixement: '1980-04-12', lloc_naixement: 'Barcelona', nacionalitats: ['ES'],
    doc_tipus: 'passaport', doc_numero: 'PAA000000', doc_autoritat: 'Ministeri de l\'Interior (prova)', doc_caducitat: '2031-05-01',
    nrt: 'F-000000-X', nia: '', domicili: 'Carrer de la Prova, 1, 3r 2a, AD500 Andorra la Vella', pais_residencia: 'AD',
    pais_anterior: 'ES', nif_estranger: '00000000T', estat_civil: 'casat', fills: true, fills_nombre: '2',
    telefon: '+376 600 000', email: 'maria.prova@example.com', idioma: 'ca',
  },
  representacio: { actua: false },
  activitat: {
    tipus: 'compte_altri', empresa: 'Empresa Fictícia, SA', adreca: 'Av. Meritxell, 1, AD500 Andorra la Vella', nrt: 'A-000000-Z',
    sector: 'Serveis financers', paisos: ['AD', 'ES'], carrec: 'Analista', contracte: 'indefinit', jornada: 'completa', hores: '40', data_inici: '2015-09-01',
  },
  proposit: { serveis: ['fiscal', 'laboral'], serveis_altres: '', descripcio: 'Declaració de l\'IRPF i nòmines de la persona que treballa a la llar.' },
  fons: { origen: ['salaris', 'inversions'], origen_altres: '', andorra: true, paisos: [], descripcio: 'Salari i rendiments d\'un compte d\'inversió a Andorra.' },
  ppe: { exerceix: false, familiar: false },
  sancions: { residencia_ru_by: false, actua_ru_by: false },
  declaracions: { d1: true, d2: true, d3: true, d4: true },
};

const id = () => crypto.randomUUID();
const R1 = id(), R2 = id(), B1 = id(), B2 = id(), B3 = id(), S1 = id(), S2 = id(), S3 = id(), S4 = id();
// Llistes de sancions fixes (text exacte que s'ha de desar i sortir al PDF)
const LLISTES = [
  ['onu', 'Llista consolidada del Consell de Seguretat de l\'ONU'],
  ['cp_1_2026', 'Resolució 1/2026 de la Comissió Permanent (capítol novè de la Llei 14/2017)'],
  ['decret_182_2026', 'Decret 182/2026, annexos 1 i 2 (Llei 5/2022)'],
  ['ct_02_2016', 'Comunicat tècnic CT-02/2016, annex'],
];
const CODIS_LLISTES = LLISTES.map(([c]) => c);
// Pere Prova Inversor: 50 % d'Inversions Fictícies, SA, que té el 60 % → 30 % indirecte
const BE_PERE = { id: B3, nom: 'Pere Prova Inversor', nacionalitats: ['ES'], data_naixement: '1968-09-14', domicili: 'Carrer de l\'Assaig, 12, AD300 Ordino',
  pais_residencia: 'AD', document: 'DNI 11111111H', nrt: '', participacio: '30 % indirecte (50 % d\'Inversions Fictícies, SA)', criteri: 'a',
  ppe: { exerceix: false, familiar: false } };
const dadesPj = {
  societat: {
    denominacio: 'Prova Holding Fictícia, SL', nom_comercial: 'Prova Group', forma: 'Societat limitada', pais_constitucio: 'AD',
    data_constitucio: '2018-03-15', pais_activitat: 'AD', domicili_social: 'Av. de la Prova, 99, AD700 Escaldes-Engordany',
    adreca_activitat: '', nrt: 'L-000000-A', registrals: 'Registre de Societats Mercantils, número de prova 00000',
    capital: '100.000 EUR', objecte: 'Tinença i gestió de participacions en societats i assessorament empresarial (dades de prova).',
    paisos: ['AD', 'ES', 'FR'], telefon: '+376 800 000', email: 'info@prova-holding.example', web: 'https://prova-holding.example', cotitza: false,
  },
  representants: [
    { id: R1, nom: 'Joan Prova Administrador', nacionalitat: 'AD', data_naixement: '1975-02-03', domicili: 'Carrer Fictici, 3, AD200 Encamp',
      document: 'Passaport AD 000001', nrt: 'F-000001-B', carrec: 'Administrador únic', actua_com: 'administrador',
      telefon: '+376 600 111', email: 'joan@prova-holding.example', idioma: 'ca' },
    { id: R2, nom: 'Anna Prova Apoderada', nacionalitat: 'ES', data_naixement: '1985-07-21', domicili: 'Carrer Imaginari, 8, AD400 la Massana',
      document: 'DNI 00000000T', nrt: '', carrec: 'Directora financera', actua_com: 'apoderat', telefon: '', email: '', idioma: '' },
  ],
  administradors: [{ id: id(), nom: 'Joan Prova Administrador', carrec: 'Administrador únic', nacionalitat: 'AD' }],
  socis: [
    { id: S1, nom: 'Joan Prova Administrador', tipus: 'pf', percentatge: '40', soci_de: null },
    { id: S2, nom: 'Inversions Fictícies, SA', tipus: 'pj', percentatge: '60', soci_de: null },
    { id: S3, nom: 'Laura Prova Política', tipus: 'pf', percentatge: '50', soci_de: S2 },
    { id: S4, nom: 'Pere Prova Inversor', tipus: 'pf', percentatge: '50', soci_de: S2 },
  ],
  beneficiaris: [
    { id: B1, representant_id: R1, nom: 'Joan Prova Administrador', nacionalitats: ['AD'], data_naixement: '1975-02-03', domicili: 'Carrer Fictici, 3, AD200 Encamp',
      pais_residencia: 'AD', document: 'Passaport AD 000001', nrt: 'F-000001-B', participacio: '40 % directe', criteri: 'a',
      ppe: { exerceix: false, familiar: false } },
    { id: B2, nom: 'Laura Prova Política', nacionalitats: ['FR'], data_naixement: '1970-11-30', domicili: '1 rue de l\'Exemple, 75000 París',
      pais_residencia: 'FR', document: 'Passeport FR 00AA00000', nrt: '', participacio: '30 % indirecte (50 % d\'Inversions Fictícies, SA)', criteri: 'a',
      ppe: { exerceix: true, carrec: 'Diputada (dades de prova)', pais_institucio: 'Assemblea Nacional (França)', data_inici: '2017-06-21', data_fi: '',
             familiar: false, origen_patrimoni: 'Herència familiar i ingressos professionals com a advocada (dades de prova).' } },
  ],
  declaracio_beneficiaris: true,
  trust: { forma_part: false },
  sancions: { establert_ru_by: false, actua_ru_by: false },
  proposit: { serveis: ['comptabilitat', 'fiscal', 'mercantil'], serveis_altres: '', descripcio: 'Comptabilitat, impost de societats i secretaria societària.' },
  fons: { origen: ['activitat_societat', 'aportacions'], origen_altres: '', andorra: false, paisos: ['FR', 'ES'], descripcio: 'Dividends de filials i aportacions dels socis.' },
  declaracions: { d1: true, d2: true, d3: true, d4: true },
};

// Circuit fins a l'enllaç
const creaKyc = async (clientId) => {
  const r = await personal({ accio: 'crea', client_id: clientId });
  const e = await crida('portal-enllac', { request_id: r.cos.request_id }, { jwt: JWT_GESTOR });
  return { r, e, kycId: r.cos.request_id, token: e.cos.enllac?.split('/kyc/')[1] };
};
const signa = (token, dades, extra = {}) => kyc(token, {
  accio: 'signar', dades, lloc_kyc: 'Andorra la Vella', lloc_pdp: 'Andorra la Vella',
  signatura_kyc: FIRMA_KYC, signatura_pdp: FIRMA_PDP, consentiment_comercial: false, ...extra,
});

try {
  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Creació de la sol·licitud i enllaç');

  const cliPf = await nouClientPortal('pf', 'Maria Prova Ficticia', `KPF${String(sufix).slice(-8)}`);
  const rWeb = await personal({ accio: 'crea', client_id: cliPf }, JWT_WEB);
  comprova(rWeb.status === 403, 'Un usuari de la web que no és personal no pot crear un KYC');
  const pf = await creaKyc(cliPf);
  comprova(pf.r.status === 200 && /^[0-9a-f-]{36}$/.test(pf.kycId || ''), 'El gestor crea la sol·licitud "KYC i protecció de dades"');
  const pdpPf = await pdpDe(pf.kycId);
  {
    const { data } = await adminPortal.from('requests').select('id, document_type, template_version').in('id', [pf.kycId, pdpPf]);
    const k = data.find((x) => x.id === pf.kycId); const p = data.find((x) => x.id === pdpPf);
    comprova(k?.document_type === 'kyc_pf' && k?.template_version === 'KYC-PF v1' && p?.document_type === 'pdp' && p?.template_version === 'PDP v1',
      'Es creen dues sol·licituds enllaçades: kyc_pf (KYC-PF v1) i pdp (PDP v1)');
  }
  const dup = await personal({ accio: 'crea', client_id: cliPf });
  comprova(dup.status === 409, 'No es pot crear un segon KYC mentre n\'hi ha un de pendent');
  comprova(pf.e.status === 200 && /^https:\/\/www\.ambit\.ad\/kyc\/[A-Za-z0-9_-]{43}$/.test(pf.e.cos.enllac || ''), 'Un sol enllaç: https://www.ambit.ad/kyc/<token>');
  comprova((await estat(pf.kycId)) === 'enviat' && (await estat(pdpPf)) === 'enviat', 'Generar l\'enllaç passa el KYC i la PDP a enviat');
  {
    const { data } = await adminPortal.from('access_tokens').select('request_id').in('request_id', [pf.kycId, pdpPf]);
    comprova(data.length === 1 && data[0].request_id === pf.kycId, 'El token és un de sol, a la sol·licitud KYC');
  }
  const rSig = await crida('portal-signar', { accio: 'obrir', token: pf.token });
  comprova(rSig.status !== 200, 'El token del KYC no serveix a la funció de l\'autorització de càrrec');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Obrir, desada automàtica i continuar més tard');

  const o1 = await kyc(pf.token, { accio: 'obrir' });
  comprova(o1.status === 200 && o1.cos.tipus === 'kyc_pf' && o1.cos.client_nom === 'Maria Prova Ficticia', 'El client obre el formulari');
  comprova(!JSON.stringify(o1.cos).match(/request_id|token_id|client_id|sha256/), 'La resposta al client no porta identificadors interns ni empremtes');
  comprova((await estat(pf.kycId)) === 'en_curs' && (await estat(pdpPf)) === 'en_curs', 'Obrir passa el KYC i la PDP a en_curs');

  const parcial = { identificacio: { nom: 'Maria Prova Ficticia', nacionalitats: ['ES'], pais_residencia: 'AD' }, representacio: { actua: false } };
  const d1 = await kyc(pf.token, { accio: 'desa', dades: parcial });
  comprova(d1.status === 200 && !!d1.cos.desat_at, 'Desada automàtica de respostes parcials');
  const o2 = await kyc(pf.token, { accio: 'obrir' });
  comprova(o2.cos.dades?.identificacio?.nom === 'Maria Prova Ficticia' && !!o2.cos.desat_at, 'En tornar a obrir l\'enllaç, les respostes hi són');
  const dBrossa = await kyc(pf.token, { accio: 'desa', dades: { identificacio: { nom: 'X', nacionalitats: ['ZZ', 'ES', '<script>'] }, camp_inventat: 1 } });
  const { data: kf } = await adminPortal.from('kyc_formularis').select('dades').eq('request_id', pf.kycId).single();
  comprova(dBrossa.status === 200 && !('camp_inventat' in kf.dades) && JSON.stringify(kf.dades.identificacio.nacionalitats) === '["ES"]',
    'El servidor desa només camps coneguts i codis de país vàlids');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Documents obligatoris segons les respostes');

  const req = (r) => (r.cos.documents?.requerits || []).map((x) => x.tipus).sort().join(',');
  const dBase = await kyc(pf.token, { accio: 'desa', dades: { ...dadesPf } });
  comprova(req(dBase) === 'activitat,domicili,fons,identitat,residencia',
    `PF resident a Andorra amb nacionalitat estrangera i assalariada: ${req(dBase)}`);
  const dRep = await kyc(pf.token, { accio: 'desa', dades: { ...dadesPf, representacio: { actua: true, nom: 'R', document: 'D', tipus: 'tutela' } } });
  comprova(req(dRep).includes('representacio'), 'Si actua un representant, cal el document de representació');
  const dPpe = await kyc(pf.token, { accio: 'desa', dades: { ...dadesPf, ppe: { exerceix: false, familiar: true, relacio: 'fill', nom_ppe: 'X', carrec_ppe: 'Y', origen_patrimoni: 'Z' } } });
  comprova(req(dPpe).includes('patrimoni'), 'Si és PPE, familiar o persona afí, cal el justificant de l\'origen del patrimoni');
  const dSense = await kyc(pf.token, { accio: 'desa', dades: { ...dadesPf, activitat: { tipus: 'sense', sense: 'jubilat' },
    identificacio: { ...dadesPf.identificacio, nacionalitats: ['AD'] } } });
  comprova(!req(dSense).includes('activitat') && !req(dSense).includes('residencia'),
    'Sense activitat no cal justificant d\'activitat; amb nacionalitat andorrana no cal permís de residència');
  await kyc(pf.token, { accio: 'desa', dades: dadesPf });

  const sSenseDocs = await signa(pf.token, dadesPf);
  comprova(sSenseDocs.status === 400 && /documents obligatoris/i.test(sSenseDocs.cos.error || '') && sSenseDocs.cos.documents?.pendents?.length === 5,
    'No es pot signar si falta cap document obligatori (en falten 5)');

  const upMal = await kyc(pf.token, { accio: 'url_pujada', tipus: 'identitat', mime: 'application/zip', mida: 100 });
  comprova(upMal.status === 400, 'Pujada: format no admès → rebutjat');
  const upGran = await kyc(pf.token, { accio: 'url_pujada', tipus: 'identitat', mime: 'application/pdf', mida: 21 * 1024 * 1024 });
  comprova(upGran.status === 400, 'Pujada: més de 20 MB → rebutjat (mateix límit que el poder)');
  const upTipus = await kyc(pf.token, { accio: 'url_pujada', tipus: 'escriptura', mime: 'application/pdf', mida: 100 });
  comprova(upTipus.status === 400, 'Pujada: tipus de document de persona jurídica en un KYC de persona física → rebutjat');
  // Fitxer que diu ser PDF però no ho és
  const fals = await pujaDoc(pf.token, 'identitat', null, 'fals.pdf', Buffer.from('no sóc un pdf'));
  comprova(fals.status === 400, 'Un fitxer que no és realment PDF/JPG/PNG es rebutja');

  for (const t of ['identitat', 'domicili', 'residencia', 'activitat']) await pujaDoc(pf.token, t, null, `${t}-maria.pdf`);
  const ultim = await pujaDoc(pf.token, 'fons', null, 'irpf-2025.pdf');
  comprova(ultim.status === 200 && ultim.cos.documents.pendents.length === 0 && ultim.cos.documents.adjunts.length === 5,
    'Pujats els 5 documents obligatoris: cap pendent');
  const extra = await pujaDoc(pf.token, 'fons', null, 'extracte-banc.pdf');
  const idExtra = extra.cos.documents.adjunts.find((a) => a.nom_fitxer === 'extracte-banc.pdf')?.id;
  const ret = await kyc(pf.token, { accio: 'retira_adjunt', adjunt_id: idExtra });
  comprova(ret.status === 200 && ret.cos.documents.adjunts.length === 5, 'El client pot treure un document abans de signar (no s\'esborra)');
  {
    const { data } = await adminPortal.from('kyc_adjunts').select('retirat_at').eq('request_id', pf.kycId);
    comprova(data.length === 6 && data.filter((x) => x.retirat_at).length === 1, 'El document tret queda registrat amb data de retirada');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Camps obligatoris condicionals i dues signatures');

  const senseNom = await signa(pf.token, { ...dadesPf, identificacio: { ...dadesPf.identificacio, nom: '' } });
  comprova(senseNom.status === 400 && senseNom.cos.pendents?.some((p) => p.camp === 'identificacio.nom'), 'Sense nom → no es pot signar');
  const senseFills = await signa(pf.token, { ...dadesPf, identificacio: { ...dadesPf.identificacio, fills: true, fills_nombre: '' } });
  comprova(senseFills.status === 400 && senseFills.cos.pendents?.some((p) => p.camp === 'identificacio.fills_nombre'), 'Fills "sí" sense nombre → no es pot signar');
  const ppeSenseOrigen = await signa(pf.token, { ...dadesPf, ppe: { exerceix: true, carrec: 'Cònsol', pais_institucio: 'Comú', data_inici: '2019-01-01', familiar: false } });
  comprova(ppeSenseOrigen.status === 400 && ppeSenseOrigen.cos.pendents?.some((p) => p.camp === 'ppe.origen_patrimoni'), 'PPE sense origen del patrimoni → no es pot signar');
  const fonsSensePais = await signa(pf.token, { ...dadesPf, fons: { ...dadesPf.fons, andorra: false, paisos: [] } });
  comprova(fonsSensePais.status === 400 && fonsSensePais.cos.pendents?.some((p) => p.camp === 'fons.paisos'), 'Fons de fora d\'Andorra sense país → no es pot signar');
  const docCaducat = await signa(pf.token, { ...dadesPf, identificacio: { ...dadesPf.identificacio, doc_caducitat: '2020-01-01' } });
  comprova(docCaducat.status === 400 && docCaducat.cos.pendents?.some((p) => p.camp === 'identificacio.doc_caducitat'), 'Document d\'identitat caducat → no es pot signar');
  const senseDecl = await signa(pf.token, { ...dadesPf, declaracions: { d1: true, d2: true, d3: false, d4: true } });
  comprova(senseDecl.status === 400 && senseDecl.cos.pendents?.some((p) => p.camp === 'declaracions.d3'), 'Una declaració sense marcar → no es pot signar');
  const repSenseTipus = await signa(pf.token, { ...dadesPf, representacio: { actua: true, nom: 'Rep', document: 'X' } });
  comprova(repSenseTipus.status === 400 && repSenseTipus.cos.pendents?.some((p) => p.camp === 'representacio.tipus'), 'Representació sense tipus → no es pot signar');
  const actSenseCamps = await signa(pf.token, { ...dadesPf, activitat: { tipus: 'professional', sector: 'Advocacia' } });
  comprova(actSenseCamps.status === 400 && actSenseCamps.cos.pendents?.some((p) => p.camp === 'activitat.titol'), 'Activitat professional sense títol → no es pot signar');

  const mateixaFirma = await signa(pf.token, dadesPf, { signatura_pdp: FIRMA_KYC });
  comprova(mateixaFirma.status === 400, 'La signatura de la protecció de dades ha de ser diferent de la del KYC');
  const senseFirmaPdp = await signa(pf.token, dadesPf, { signatura_pdp: '' });
  comprova(senseFirmaPdp.status === 400, 'Sense la segona signatura (protecció de dades) no es pot signar');
  const senseConsent = await signa(pf.token, dadesPf, { consentiment_comercial: undefined });
  comprova(senseConsent.status === 400, 'Cal respondre (sí o no) sobre les comunicacions comercials');
  comprova((await estat(pf.kycId)) === 'en_curs', 'Els intents incomplets no han signat res');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Signatura completa · persona física');

  const avisosAbans = avisos.length;
  const sPf = await signa(pf.token, dadesPf);
  comprova(sPf.status === 200 && !!sPf.cos.kyc?.url && !!sPf.cos.pdp?.url, 'Signatura acceptada: dues URL de descàrrega (KYC i protecció de dades)');
  comprova(/\/object\/sign\/portal-docs\//.test(sPf.cos.kyc?.url || '') && /token=/.test(sPf.cos.pdp?.url || ''), 'Les descàrregues són URL signades del bucket privat');
  const pdfKycPf = await desaPdf(sPf.cos.kyc.url, 'kyc-pf-signat-client.pdf');
  const pdfPdpPf = await desaPdf(sPf.cos.pdp.url, 'proteccio-dades-pf-signat.pdf');
  comprova(pdfKycPf.subarray(0, 5).toString() === '%PDF-' && pdfPdpPf.subarray(0, 5).toString() === '%PDF-', 'Els dos fitxers són PDF');
  const { data: docsK } = await adminPortal.from('documents').select('kind, sha256, mida_bytes').eq('request_id', pf.kycId);
  const { data: docsP } = await adminPortal.from('documents').select('kind, sha256, mida_bytes').eq('request_id', pdpPf);
  comprova(docsK.find((d) => d.kind === 'signat')?.sha256 === sha256(pdfKycPf) && sPf.cos.kyc.sha256 === sha256(pdfKycPf),
    'SHA-256 del PDF del KYC = el desat a portal.documents i el retornat al client');
  comprova(docsP.find((d) => d.kind === 'signat')?.sha256 === sha256(pdfPdpPf) && sPf.cos.pdp.sha256 === sha256(pdfPdpPf),
    'SHA-256 del PDF de protecció de dades = el desat i el retornat');
  comprova(sha256(pdfKycPf) !== sha256(pdfPdpPf), 'Són dos PDF separats');
  comprova(docsK.some((d) => d.kind === 'evidencies') && docsP.some((d) => d.kind === 'evidencies'), 'Cada signatura té la seva imatge registrada com a evidència');
  {
    const { data: sigs } = await adminPortal.from('signatures').select('request_id, empremta_dades, imatge_path, user_agent').in('request_id', [pf.kycId, pdpPf]);
    comprova(sigs.length === 2 && sigs[0].empremta_dades !== sigs[1].empremta_dades && sigs[0].imatge_path !== sigs[1].imatge_path,
      'Dues signatures diferents, cadascuna amb la seva empremta de dades');
    comprova(sigs.every((s) => /^[0-9a-f]{64}$/.test(s.empremta_dades) && s.user_agent?.includes('Prova-local')), 'Les dues signatures desen empremta i navegador');
  }
  comprova(pdfKycPf.toString('latin1').includes('Carlito') && pdfPdpPf.toString('latin1').includes('Carlito'), 'Els dos PDF fan servir Carlito (com l\'autorització)');
  comprova((await estat(pf.kycId)) === 'signat' && (await estat(pdpPf)) === 'signat', 'KYC "pendent de validació de l\'OCIC" (signat) i PDP signada');
  {
    const { data: c } = await adminPortal.from('pdp_consentiments').select('consentiment_comercial').eq('request_id', pdpPf).single();
    const { data: cl } = await adminPortal.from('clients').select('consentiment_comercial, consentiment_comercial_at').eq('id', cliPf).single();
    comprova(c.consentiment_comercial === false && cl.consentiment_comercial === false && !!cl.consentiment_comercial_at,
      'Consentiment comercial "no" registrat a la PDP i al client');
  }
  const reobre = await kyc(pf.token, { accio: 'obrir' });
  comprova(reobre.status === 404 && reobre.cos.error === 'Enllaç no vàlid o caducat', 'Token consumit: resposta neutra');
  const reEnllac = await crida('portal-enllac', { request_id: pf.kycId }, { jwt: JWT_GESTOR });
  comprova(reEnllac.status === 409, 'Un cop signat no es pot regenerar l\'enllaç');
  {
    const { error } = await adminPortal.from('kyc_formularis').update({ dades: { manipulat: true } }).eq('request_id', pf.kycId);
    comprova(!!error, 'Ni el servei pot modificar les respostes d\'un KYC signat');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Avís de Formspree');

  for (let i = 0; i < 30 && avisos.length === avisosAbans; i++) await espera(300);
  comprova(avisos.length === avisosAbans + 1, 'S\'ha enviat exactament un avís (al receptor local, no a Formspree)');
  const avis = avisos[avisos.length - 1] || { cos: '{}' };
  comprova(avis.metode === 'POST' && avis.ruta === '/f/prova-local', 'POST al formulari configurat');
  comprova(avis.cos === JSON.stringify({
    _subject: 'Nou KYC signat al portal',
    name: 'Portal de signatura',
    email: 'info@ambit.ad',
    message: 'S\'ha signat un nou formulari d\'identificació del client al portal de signatura d\'ÀMBIT Associats.\n\n' +
      'Podeu consultar-lo a https://www.ambit.ad/portal',
  }), 'El cos és exactament el text fix (assumpte "Nou KYC signat al portal")');
  comprova(!avis.cos.includes('Maria') && !avis.cos.includes('KPF') && !avis.cos.includes(pf.kycId) && !avis.cos.includes(cliPf) &&
    !avis.cos.includes('example.com') && !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(avis.cos) && !avis.cos.includes(pf.token),
  'L\'avís no conté cap dada del client ni cap identificador');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Signatura completa · persona jurídica (dos beneficiaris efectius, un PPE)');

  const cliPj = await nouClientPortal('pj', 'Prova Holding Fictícia, SL', `KPJ${String(sufix).slice(-8)}`);
  const pj = await creaKyc(cliPj);
  const pdpPj = await pdpDe(pj.kycId);
  const oPj = await kyc(pj.token, { accio: 'obrir' });
  comprova(oPj.status === 200 && oPj.cos.tipus === 'kyc_pj', 'El KYC de persona jurídica s\'obre');
  const dPj = await kyc(pj.token, { accio: 'desa', dades: dadesPj });
  const reqPj0 = (dPj.cos.documents?.requerits || []).map((x) => `${x.tipus}${x.persona ? `:${x.persona}` : ''}`);
  comprova(reqPj0.length === 10 && reqPj0.includes(`identitat:${R1}`) && !reqPj0.includes(`identitat:${B1}`),
    'Representant i beneficiari efectiu que són la mateixa persona: un sol document d\'identitat');

  // Més del 25 % (directe + indirecte) sense declarar com a beneficiari efectiu
  const s25 = await kyc(pj.token, { accio: 'signar', dades: dadesPj, lloc_kyc: 'Escaldes', lloc_pdp: 'Escaldes',
    signatura_kyc: FIRMA_KYC_PJ, signatura_pdp: FIRMA_PDP_PJ, consentiment_comercial: true });
  const p25 = (s25.cos.pendents || []).filter((p) => p.motiu === 'supera_25');
  comprova(s25.status === 400 && p25.length === 1 && p25[0].nom === 'Pere Prova Inversor' && p25[0].percentatge === 30,
    'Pere Prova Inversor (30 % indirecte) no declarat com a beneficiari efectiu → no es pot signar');
  {
    const regles = fs.readFileSync(new globalThis.URL('../../functions/_shared/kyc-regles.js', import.meta.url), 'utf8');
    comprova(regles.includes('Aquesta persona supera el 25 % i s\\\'ha de declarar com a beneficiari efectiu') &&
      regles.includes('This person holds more than 25% and must be declared as a beneficial owner'),
    'El client veu l\'avís literal "Aquesta persona supera el 25 %… / This person holds more than 25%…"');
    const m25 = (await ocic.schema('portal').rpc('kyc_marques', { p_request_id: pj.kycId })).data || [];
    comprova(m25.some((m) => m.codi === 'be_no_declarat' && m.detall.startsWith('Pere Prova Inversor: 30 %')),
      'Marca automàtica per a l\'OCIC: Pere Prova Inversor, 30 %, no declarat');
  }
  dadesPj.beneficiaris.push(BE_PERE);
  const dPj2 = await kyc(pj.token, { accio: 'desa', dades: dadesPj });
  const reqPj = (dPj2.cos.documents?.requerits || []).map((x) => `${x.tipus}${x.persona ? `:${x.persona.slice(0, 4)}` : ''}`);
  comprova(reqPj.length === 11 && reqPj.includes(`poder:${R2.slice(0, 4)}`) && reqPj.includes(`patrimoni:${B2.slice(0, 4)}`) &&
    reqPj.filter((x) => x.startsWith('identitat:')).length === 4,
  'Amb Pere declarat: documents de la societat, identitat (4 persones), poder de l\'apoderat i patrimoni del PPE (11)');
  const pjMalSocis = await kyc(pj.token, { accio: 'signar', dades: { ...dadesPj, socis: dadesPj.socis.filter((s) => s.soci_de !== S2) },
    lloc_kyc: 'Escaldes', lloc_pdp: 'Escaldes', signatura_kyc: FIRMA_KYC_PJ, signatura_pdp: FIRMA_PDP_PJ, consentiment_comercial: true });
  comprova(pjMalSocis.status === 400 && pjMalSocis.cos.pendents?.some((p) => p.camp.endsWith('.socis')),
    'Un soci que és societat sense els seus socis → no es pot signar');
  const pjSenseDecl = await kyc(pj.token, { accio: 'signar', dades: { ...dadesPj, declaracio_beneficiaris: false },
    lloc_kyc: 'Escaldes', lloc_pdp: 'Escaldes', signatura_kyc: FIRMA_KYC_PJ, signatura_pdp: FIRMA_PDP_PJ, consentiment_comercial: true });
  comprova(pjSenseDecl.status === 400 && pjSenseDecl.cos.pendents?.some((p) => p.camp === 'declaracio_beneficiaris'),
    'Sense la declaració de beneficiaris efectius → no es pot signar');
  const pjTrust = await kyc(pj.token, { accio: 'desa', dades: { ...dadesPj, trust: { forma_part: true, parts: [] } } });
  comprova((pjTrust.cos.documents?.requerits || []).some((x) => x.tipus === 'trust'), 'Amb trust, cal la documentació del fideïcomís');
  await kyc(pj.token, { accio: 'desa', dades: dadesPj });

  for (const t of ['escriptura', 'vigencia', 'registre_be', 'nrt', 'fons']) await pujaDoc(pj.token, t, null, `${t}-prova-holding.pdf`);
  await pujaDoc(pj.token, 'identitat', R1, 'passaport-joan.pdf');
  await pujaDoc(pj.token, 'identitat', R2, 'dni-anna.pdf');
  await pujaDoc(pj.token, 'poder', R2, 'poder-anna.pdf');
  await pujaDoc(pj.token, 'identitat', B3, 'dni-pere.pdf');
  const penult = await pujaDoc(pj.token, 'identitat', B2, 'passeport-laura.pdf');
  comprova(penult.cos.documents.pendents.length === 1 && penult.cos.documents.pendents[0].tipus === 'patrimoni', 'Només falta l\'origen del patrimoni del PPE');
  const pjFalta = await kyc(pj.token, { accio: 'signar', dades: dadesPj, lloc_kyc: 'Escaldes-Engordany', lloc_pdp: 'Escaldes-Engordany',
    signatura_kyc: FIRMA_KYC_PJ, signatura_pdp: FIRMA_PDP_PJ, consentiment_comercial: true });
  comprova(pjFalta.status === 400, 'Amb un document obligatori pendent no es pot signar');
  await pujaDoc(pj.token, 'patrimoni', B2, 'patrimoni-laura.pdf');
  await pujaDoc(pj.token, 'organigrama', null, 'organigrama.pdf');

  const sPj = await kyc(pj.token, { accio: 'signar', dades: dadesPj, lloc_kyc: 'Escaldes-Engordany', lloc_pdp: 'Escaldes-Engordany',
    signatura_kyc: FIRMA_KYC_PJ, signatura_pdp: FIRMA_PDP_PJ, consentiment_comercial: true });
  comprova(sPj.status === 200, 'La persona jurídica signa el KYC i la protecció de dades');
  const pdfKycPj = await desaPdf(sPj.cos.kyc.url, 'kyc-pj-signat-client.pdf');
  await desaPdf(sPj.cos.pdp.url, 'proteccio-dades-pj-signat.pdf');
  {
    const { data: sig } = await adminPortal.from('signatures').select('signatari_nom, signatari_carrec').eq('request_id', pj.kycId).single();
    comprova(sig.signatari_nom === 'Joan Prova Administrador' && sig.signatari_carrec === 'Administrador únic', 'El signant és el primer representant, amb el seu càrrec');
    const { data: cl } = await adminPortal.from('clients').select('consentiment_comercial').eq('id', cliPj).single();
    comprova(cl.consentiment_comercial === true, 'Consentiment comercial "sí" registrat al client');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Marques automàtiques');

  const marques = async (kid) => (await ocic.schema('portal').rpc('kyc_marques', { p_request_id: kid })).data || [];
  const mPj = await marques(pj.kycId);
  comprova(mPj.some((m) => m.codi === 'ppe' && m.detall.includes('Laura')), 'PJ: marca PPE pel beneficiari efectiu');
  comprova(!mPj.some((m) => m.codi === 'be_no_declarat'), 'PJ: un cop declarat Pere, ja no hi ha la marca de beneficiari no declarat');
  const mPf = await marques(pf.kycId);
  comprova(mPf.length === 0, 'PF sense cap marca');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Validació de l\'OCIC');

  const pujaEvidencia = async (kid, jwt = JWT_OCIC) => {
    const contingut = pdfProva(`evidencia sancions ${kid}`);
    const u = await personal({ accio: 'url_evidencia', request_id: kid, mime: 'application/pdf', mida: contingut.length }, jwt);
    if (u.status !== 200) return u;
    await nouClient().storage.from('portal-docs').uploadToSignedUrl(u.cos.path, u.cos.upload_token, contingut, { contentType: 'application/pdf' });
    return personal({ accio: 'registra_evidencia', request_id: kid, path: u.cos.path }, jwt);
  };
  const evGestor = await pujaEvidencia(pj.kycId, JWT_GESTOR);
  comprova(evGestor.status === 403, 'Un gestor no pot adjuntar l\'evidència de sancions');
  const validacioPj = {
    accio: 'valida', request_id: pj.kycId, nivell: 'reforcada',
    justificacio: 'Beneficiari efectiu PPE estranger; estructura amb una societat interposada.',
    verificacio_via: 'presencial', verificacio_data: avui, verificacio_persona: 'OCIC (prova)',
    sancions_data: avui, sancions_llistes_marcades: CODIS_LLISTES, sancions_altres: 'OFAC (prova)', sancions_resultat: 'Sense coincidències',
    rbe_data: avui, rbe_resultat: 'Coincideix amb els beneficiaris declarats',
    alta_direccio_nom: 'Direcció d\'ÀMBIT Associats (prova)', alta_direccio_data: avui,
  };
  const vGestor = await personal({ ...validacioPj, sancions_evidencia_id: '00000000-0000-0000-0000-000000000000' }, JWT_GESTOR);
  comprova(vGestor.status === 403, 'Un gestor no pot validar');
  const vSenseEv = await personal(validacioPj, JWT_OCIC);
  comprova(vSenseEv.status === 400 && /evidència/.test(vSenseEv.cos.error || ''), 'Sense adjunt d\'evidència de sancions no es pot validar');
  const ev = await pujaEvidencia(pj.kycId);
  comprova(ev.status === 200 && !!ev.cos.document_id, 'L\'OCIC adjunta l\'evidència de la comprovació de sancions');
  const vSimpl = await personal({ ...validacioPj, nivell: 'simplificada', sancions_evidencia_id: ev.cos.document_id }, JWT_OCIC);
  comprova(vSimpl.status === 400 && /simplificada/.test(vSimpl.cos.error || ''), 'Diligència simplificada impossible amb marques');
  const vSenseAlta = await personal({ ...validacioPj, alta_direccio_nom: '', alta_direccio_data: '', sancions_evidencia_id: ev.cos.document_id }, JWT_OCIC);
  comprova(vSenseAlta.status === 400 && /alta direcció/.test(vSenseAlta.cos.error || ''), 'Amb PPE cal l\'autorització de l\'alta direcció');
  const vSenseLlista = await personal({ ...validacioPj, sancions_llistes_marcades: CODIS_LLISTES.slice(1), sancions_evidencia_id: ev.cos.document_id }, JWT_OCIC);
  comprova(vSenseLlista.status === 400 && /llistes de sancions/.test(vSenseLlista.cos.error || ''), 'Totes les llistes de sancions fixes s\'han de marcar');
  const vSenseRbe = await personal({ ...validacioPj, rbe_data: '', sancions_evidencia_id: ev.cos.document_id }, JWT_OCIC);
  comprova(vSenseRbe.status === 400 && /beneficiaris efectius/.test(vSenseRbe.cos.error || ''), 'Persona jurídica: cal la verificació al Registre de beneficiaris efectius');
  const vSenseJust = await personal({ ...validacioPj, justificacio: '', sancions_evidencia_id: ev.cos.document_id }, JWT_OCIC);
  comprova(vSenseJust.status >= 400, 'La justificació del nivell de diligència és obligatòria');
  {
    const { error } = await adminPortal.rpc('valida_kyc', { p_request_id: pj.kycId, p: { nivell: 'normal' } });
    comprova(!!error, 'El servei (service_role) no pot validar');
    const { error: e2 } = await adminPortal.from('kyc_validacions').insert({ request_id: pj.kycId, nivell: 'normal', justificacio: 'x',
      verificacio_via: 'presencial', verificacio_data: avui, verificacio_persona: 'x', sancions_data: avui, sancions_llistes: 'x',
      sancions_resultat: 'x', sancions_evidencia_id: ev.cos.document_id });
    comprova(!!e2, 'El servei no pot inserir una validació directament');
    const { error: e3 } = await gestor.schema('portal').rpc('valida_kyc', { p_request_id: pj.kycId, p: { nivell: 'normal' } });
    comprova(!!e3, 'Un gestor amb la seva sessió no pot validar');
  }
  comprova((await estat(pj.kycId)) === 'signat', 'Després dels intents rebutjats, el KYC continua pendent de validació');

  const vPj = await personal({ ...validacioPj, sancions_evidencia_id: ev.cos.document_id }, JWT_OCIC);
  comprova(vPj.status === 200 && !!vPj.cos.pdf_final?.url, 'L\'OCIC valida amb la seva sessió i es genera el PDF final');
  comprova((await estat(pj.kycId)) === 'actiu', 'El KYC queda validat (actiu)');
  const pdfFinalPj = await desaPdf(vPj.cos.pdf_final.url, 'kyc-pj-validat-ocic.pdf');
  {
    const { data: docs } = await adminPortal.from('documents').select('kind, sha256, storage_path').eq('request_id', pj.kycId);
    const fin = docs.find((d) => d.kind === 'validat');
    comprova(fin?.sha256 === sha256(pdfFinalPj), 'SHA-256 del PDF final = el desat (tipus validat)');
    comprova(docs.find((d) => d.kind === 'signat')?.sha256 === sha256(pdfKycPj), 'El PDF signat pel client es conserva intacte');
    const imatges = (b) => (b.toString('latin1').match(/\/Subtype \/Image/g) || []).length;
    // La firma de l'OCIC és un PNG amb transparència: imatge + màscara (2 objectes més)
    comprova(sha256(pdfFinalPj) !== sha256(pdfKycPj) && imatges(pdfFinalPj) === imatges(pdfKycPj) + 2,
      `El PDF final és un document nou amb la firma de l'OCIC estampada (objectes d'imatge: ${imatges(pdfKycPj)} → ${imatges(pdfFinalPj)})`);
    const { data: v } = await adminPortal.from('kyc_validacions').select('*').eq('request_id', pj.kycId).single();
    comprova(v.validat_per === idOcic && v.propera_revisio === mesAnys(1) && v.marques.some((m) => m.codi === 'ppe'),
      `Validació desada amb l'OCIC, les marques i la propera revisió a 1 any (risc alt): ${v.propera_revisio}`);
    comprova(JSON.stringify(v.llistes).includes('CT-01/2026') && JSON.stringify(v.llistes).includes('CT-03/2026'), 'La validació desa les referències de les llistes aplicades');
    comprova(v.sancions_llistes === `${LLISTES.map(([, n]) => n).join('; ')}; OFAC (prova)` && JSON.stringify(v.sancions_llistes_marcades) === JSON.stringify(CODIS_LLISTES),
      'Llistes de sancions desades amb el text fix (el mateix que surt al PDF final) i les altres llistes');
    const { error } = await adminPortal.from('kyc_validacions').update({ nivell: 'normal' }).eq('request_id', pj.kycId);
    comprova(!!error, 'La validació no es pot modificar');
    const repetit = await personal({ accio: 'pdf_final', request_id: pj.kycId }, JWT_OCIC);
    comprova(repetit.status === 409, 'No es genera un segon PDF final');
  }
  {
    // La firma de l'OCIC: ni el personal ni la web la poden llegir
    const { data: dG } = await gestor.storage.from('portal-firmes').download(firmaOcicPath);
    const { data: dO } = await ocic.storage.from('portal-firmes').download(firmaOcicPath);
    const { data: lO } = await ocic.schema('portal').from('firmes_ocic').select('*');
    comprova(!dG && !dO && (lO || []).length === 0, 'La imatge de la firma de l\'OCIC només és accessible al servei');
  }

  // PF: sense marques, diligència normal (3 anys)
  const evPf = await pujaEvidencia(pf.kycId);
  const vPf = await personal({
    accio: 'valida', request_id: pf.kycId, nivell: 'normal', justificacio: 'Client resident, assalariat, sense marques de risc.',
    verificacio_via: 'copia_notarial', verificacio_data: avui, verificacio_persona: 'OCIC (prova)',
    sancions_data: avui, sancions_llistes_marcades: CODIS_LLISTES, sancions_resultat: 'Sense coincidències', sancions_evidencia_id: evPf.cos.document_id,
  }, JWT_OCIC);
  comprova(vPf.status === 200, 'Persona física validada (diligència normal, sense alta direcció perquè no hi ha marques)');
  await desaPdf(vPf.cos.pdf_final.url, 'kyc-pf-validat-ocic.pdf');
  {
    const { data: v } = await adminPortal.from('kyc_validacions').select('propera_revisio').eq('request_id', pf.kycId).single();
    comprova(v.propera_revisio === mesAnys(3), `Propera revisió a 3 anys (risc normal): ${v.propera_revisio}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Prohibició total (CT-03/2026)');

  const cliIr = await nouClientPortal('pf', 'Client Prova Prohibició', `KIR${String(sufix).slice(-8)}`);
  const ir = await creaKyc(cliIr);
  const dadesIr = { ...dadesPf, identificacio: { ...dadesPf.identificacio, nom: 'Client Prova Prohibició', nacionalitats: ['IR'] } };
  await kyc(ir.token, { accio: 'desa', dades: dadesIr });
  for (const t of ['identitat', 'domicili', 'residencia', 'activitat', 'fons']) await pujaDoc(ir.token, t, null, `${t}.pdf`, pdfProva(`${t} IR ${sufix}`));
  const sIr = await kyc(ir.token, { accio: 'signar', dades: dadesIr, lloc_kyc: 'Andorra la Vella', lloc_pdp: 'Andorra la Vella',
    signatura_kyc: FIRMA_KYC, signatura_pdp: FIRMA_PDP, consentiment_comercial: false });
  comprova(sIr.status === 200 && !JSON.stringify(sIr.cos).match(/risc|prohibi|Iran|marca/i), 'El client signa amb normalitat: cap missatge no revela cap marca (art. 26)');
  const mIr = await marques(ir.kycId);
  comprova(mIr.some((m) => m.codi === 'prohibicio_total' && m.pais === 'IR' && m.referencia === 'CT-03/2026') &&
    mIr.some((m) => m.codi === 'pais_risc' && m.referencia === 'CT-01/2026'), 'Marques: Iran és prohibició total (CT-03/2026) i país de risc (CT-01/2026)');
  const evIr = await pujaEvidencia(ir.kycId);
  const vIr = await personal({ accio: 'valida', request_id: ir.kycId, nivell: 'reforcada', justificacio: 'Prova', verificacio_via: 'presencial',
    verificacio_data: avui, verificacio_persona: 'OCIC', sancions_data: avui, sancions_llistes_marcades: CODIS_LLISTES, sancions_resultat: 'Prova',
    sancions_evidencia_id: evIr.cos.document_id, alta_direccio_nom: 'Direcció', alta_direccio_data: avui }, JWT_OCIC);
  comprova(vIr.status === 403 && vIr.cos.motiu === 'prohibicio_total', 'L\'OCIC no pot validar un KYC amb un país de prohibició total');
  comprova((await estat(ir.kycId)) === 'signat', 'El KYC continua sense validar');
  {
    const { data } = await adminPortal.from('audit_log').select('actor, detalls').eq('accio', 'VALIDACIO_DENEGADA').eq('entitat_id', ir.kycId);
    comprova(data.length === 1 && data[0].actor === idOcic && JSON.stringify(data[0].detalls).includes('IR'), 'L\'intent queda registrat (VALIDACIO_DENEGADA)');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Llistes de països (versionades, editables per l\'OCIC)');

  {
    const { error: eG } = await gestor.schema('portal').rpc('afegeix_pais_risc', { p_llista: 'UE', p_referencia: 'CT-99/2026', p_pais: 'ES', p_nom: 'Espanya', p_categoria: 'risc' });
    comprova(!!eG, 'Un gestor no pot modificar les llistes');
    const { data: idEs, error: eO } = await ocic.schema('portal').rpc('afegeix_pais_risc', { p_llista: 'UE', p_referencia: 'CT-99/2026 (prova)', p_pais: 'ES', p_nom: 'Espanya (prova)', p_categoria: 'risc' });
    comprova(!eO, 'L\'OCIC afegeix un país a una llista');
    const mAmb = await marques(pf.kycId);
    comprova(mAmb.some((m) => m.codi === 'pais_risc' && m.pais === 'ES'), 'Les marques es recalculen amb la llista vigent');
    const { error: eT } = await ocic.schema('portal').rpc('treu_pais_risc', { p_id: idEs, p_motiu: 'Prova finalitzada' });
    const { data: fila } = await adminPortal.from('paisos_risc').select('baixa_at, baixa_per').eq('id', idEs).single();
    comprova(!eT && !!fila.baixa_at && fila.baixa_per === idOcic, 'Treure un país en registra la baixa (no s\'esborra)');
    const { error: eD } = await adminPortal.from('paisos_risc').delete().eq('id', idEs);
    comprova(!!eD, 'Les files de les llistes no es poden esborrar');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Revisió periòdica');

  {
    const { data: rv, error } = await ocic.schema('portal').rpc('revisions_kyc', { p_dies: 400 });
    comprova(!error && rv.some((x) => x.request_id === pj.kycId) && !rv.some((x) => x.request_id === pf.kycId),
      'Revisions KYC (OCIC): surt la PJ (venç en 1 any); la PF (3 anys) no, en 400 dies');
    const { error: eG } = await gestor.schema('portal').rpc('revisions_kyc', {});
    comprova(!!eG, 'Un gestor no veu la pestanya de revisions');
  }
  const rev = await personal({ accio: 'crea', client_id: cliPf, revisio_de: pf.kycId, motiu: 'Revisió periòdica (prova)' });
  comprova(rev.status === 200 && rev.cos.documents_copiats === 3, `Revisió creada a partir del KYC validat, amb ${rev.cos.documents_copiats} documents copiats`);
  {
    const { data: f } = await adminPortal.from('kyc_formularis').select('dades, revisio_de').eq('request_id', rev.cos.request_id).single();
    comprova(f.revisio_de === pf.kycId && f.dades.identificacio.nom === 'Maria Prova Ficticia' && !('declaracions' in f.dades),
      'Formulari preomplert amb les dades del KYC validat, sense les declaracions (cal tornar-les a fer)');
  }
  const eRev = await crida('portal-enllac', { request_id: rev.cos.request_id }, { jwt: JWT_GESTOR });
  const tRev = eRev.cos.enllac?.split('/kyc/')[1];
  const oRev = await kyc(tRev, { accio: 'obrir' });
  const pendRev = (oRev.cos.documents?.pendents || []).map((x) => x.tipus).sort().join(',');
  comprova(oRev.status === 200 && oRev.cos.dades.identificacio.email === 'maria.prova@example.com' && pendRev === 'domicili,fons',
    `El client veu les dades preomplertes; només falten els documents caducats: ${pendRev}`);
  {
    const { data } = await adminPortal.from('documents').select('kind').eq('request_id', pf.kycId);
    comprova(data.filter((d) => d.kind === 'signat').length === 1 && data.filter((d) => d.kind === 'validat').length === 1,
      'El KYC anterior es conserva intacte');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Consentiment comercial: retirada');

  {
    const { error } = await gestor.schema('portal').rpc('anota_retirada_consentiment', { p_client_id: cliPj, p_data: avui, p_nota: 'Ho ha demanat per correu' });
    const { data: cl } = await adminPortal.from('clients').select('consentiment_comercial, consentiment_retirat_el').eq('id', cliPj).single();
    comprova(!error && cl.consentiment_retirat_el === avui, 'El personal anota la retirada del consentiment');
    const { error: e2 } = await gestor.schema('portal').from('clients').update({ consentiment_comercial: true, consentiment_retirat_el: null, consentiment_comercial_at: new Date().toISOString() }).eq('id', cliPj);
    comprova(!!e2, 'El personal no pot donar un consentiment en nom del client');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Conservació (fi de la relació)');

  {
    const { error: eG } = await gestor.schema('portal').rpc('fixa_fi_relacio', { p_client_id: cliPj, p_data: '2015-01-01' });
    comprova(!!eG, 'Un gestor no pot fixar la data de fi de la relació');
    const { error: eF } = await ocic.schema('portal').rpc('fixa_fi_relacio', { p_client_id: cliPj, p_data: '2099-01-01' });
    comprova(!!eF, 'La data de fi de la relació no pot ser futura');
    // Retenció per una ampliació de la UIFAND (art. 37.2), abans que venci
    const { error: eR } = await ocic.schema('portal').rpc('activa_retencio', { p_request_id: pj.kycId, p_motiu: 'Ampliació del termini per la UIFAND (prova)' });
    comprova(!eR, 'L\'OCIC pot retenir un KYC signat abans que venci');
    await ocic.schema('portal').rpc('fixa_fi_relacio', { p_client_id: cliPj, p_data: '2015-01-01' });
    await ocic.schema('portal').rpc('fixa_fi_relacio', { p_client_id: cliIr, p_data: '2015-01-01' });
  }
  const simula = await fetch(`${URL}/functions/v1/portal-purga`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-portal-purga': SECRET_PURGA, Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify({ simulacio: true }),
  }).then((r) => r.json());
  const aBloq = (simula.a_bloquejar || []).map((x) => x.request_id);
  comprova([pj.kycId, pdpPj, ir.kycId].every((x) => aBloq.includes(x)), 'Simulació: el KYC i la PDP vencen (fi de la relació 2015 + 5 / + 6 anys)');
  comprova(!aBloq.includes(pf.kycId) && !aBloq.includes(pdpPf), 'Simulació: el client sense fi de relació no venç');

  const fitxersIr = (await adminPortal.rpc('kyc_estat_documents', { p_request_id: ir.kycId })).data?.adjunts?.length;
  const purga = await fetch(`${URL}/functions/v1/portal-purga`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-portal-purga': SECRET_PURGA, Authorization: `Bearer ${ANON}`, apikey: ANON },
    body: JSON.stringify({ simulacio: false }),
  }).then((r) => r.json());
  comprova(purga.destruides?.includes(ir.kycId), 'KYC vençut (fi de relació + 5 anys) i sense retenció: destruït el mateix dia (sense bloqueig)');
  {
    const { data: r } = await adminPortal.from('requests').select('id').eq('id', ir.kycId).maybeSingle();
    const { data: objs } = await admin.storage.from('portal-docs').list(`requests/${ir.kycId}/adjunts`);
    comprova(!r && (objs || []).length === 0 && fitxersIr === 5, 'Files i fitxers del KYC destruïts');
    const { data: dest } = await adminPortal.from('audit_log').select('detalls').eq('accio', 'DESTRUCCIO').eq('entitat_id', ir.kycId).single();
    comprova(dest?.detalls?.files_esborrades?.kyc_formularis === 1 && !JSON.stringify(dest.detalls).includes('Prohibició'),
      'Entrada DESTRUCCIO sense dades personals, amb el recompte de les taules del KYC');
    const { data: kyPj } = await adminPortal.from('requests').select('bloquejat_at, destruir_despres_de').eq('id', pj.kycId).single();
    comprova(!!kyPj?.bloquejat_at && kyPj.bloquejat_at === kyPj.destruir_despres_de, 'KYC amb retenció: bloquejat sense termini de bloqueig, però no destruït');
    const { data: pdP } = await adminPortal.from('requests').select('bloquejat_at, destruir_despres_de').eq('id', pdpPj).single();
    const anys = (new Date(pdP.destruir_despres_de) - new Date(pdP.bloquejat_at)) / (365.25 * 86400000);
    comprova(!!pdP.bloquejat_at && anys > 2.99 && anys < 3.01, 'PDP vençuda (fi de relació + 6 anys): bloquejada 3 anys abans de destruir-la');
  }

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Totes les dades signades són immutables');

  {
    const { error } = await adminPortal.from('documents').delete().eq('request_id', pf.kycId);
    comprova(!!error, 'Ningú no pot esborrar els documents del KYC');
    const { error: e2 } = await adminPortal.from('pdp_consentiments').update({ consentiment_comercial: true }).eq('request_id', pdpPf);
    comprova(!!e2, 'El consentiment signat no es pot modificar');
  }
} finally {
  receptor.close();
  await adminPortal.from('limit_intents').delete().neq('clau', '');
}

console.log(`\n${total - fallades}/${total} correctes`);
console.log(fallades ? `${fallades} proves han fallat` : 'Totes les proves han passat');
process.exit(fallades ? 1 : 0);
