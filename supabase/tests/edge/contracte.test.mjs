// Proves locals del contracte (Edge Functions portal-contracte,
// portal-contracte-personal i portal-enllac) amb fitxers reals: un signant en
// català i dos signants en català i anglès, amb la signatura d'ÀMBIT.
//
// Requisits: `supabase start` i les funcions servides amb un receptor local
// en lloc de Formspree (no s'envia res a fora):
//   supabase functions serve --env-file <fitxer>
// on <fitxer> és supabase/functions/.env més aquestes línies:
//   FORMSPREE_FORM_ID=prova-local
//   FORMSPREE_BASE_URL=http://host.docker.internal:54399/f/
//   PORTAL_PROVES_FALLADA=1
// Execució: node supabase/tests/edge/contracte.test.mjs [carpeta-per-als-pdf]
// Opcionals: qpdf (PDF xifrat i comprovació d'estructura) i pdftotext (idioma).
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.
// Totes les dades són fictícies, llevat del correu del signant d'ÀMBIT
// (mpaleari@ambit.ad), que la base exigeix; a la base local és un usuari de prova.

import { execSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
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
if (CARPETA_PDF) fs.mkdirSync(CARPETA_PDF, { recursive: true });
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'contracte-edge-'));

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const adminPortal = admin.schema('portal');
const nouClient = () => createClient(URL, ANON, { auth: { persistSession: false } });
const sql = (q) => execSync('docker exec -i supabase_db_ambit-associats psql -U postgres -d postgres -X -A -t -q -v ON_ERROR_STOP=1',
  { input: q, encoding: 'utf8' }).trim();
const hiHa = (eina) => spawnSync('which', [eina]).status === 0;

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t) => console.log(`\n── ${t} ──`);
const sha256 = (b) => createHash('sha256').update(b).digest('hex');
const publica = (url) => url.replace(/^https?:\/\/kong:8000/, URL);

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
const usuari = async (email) => {
  const { data, error } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
  if (!error) return data.user.id;
  // Ja existeix (execució anterior a la mateixa base local): es reutilitza
  const id = sql(`select id from auth.users where lower(email) = lower('${email}');`);
  await admin.auth.admin.updateUserById(id, { password: PASS });
  return id;
};
const sessio = async (email) => {
  const c = nouClient();
  const { error } = await c.auth.signInWithPassword({ email, password: PASS });
  if (error) throw error;
  return c;
};
const correus = { ambit: 'mpaleari@ambit.ad', ocic: `ocic-c-${sufix}@test.local`, gestor: `gestor-c-${sufix}@test.local`, web: `web-c-${sufix}@test.local` };
const idAmbit = await usuari(correus.ambit);
const idOcic = await usuari(correus.ocic);
const idGestor = await usuari(correus.gestor);
await usuari(correus.web);
sql(`insert into portal.staff_profiles (user_id, role) values ('${idAmbit}', 'ocic'), ('${idOcic}', 'ocic'), ('${idGestor}', 'gestor')
     on conflict (user_id) do update set actiu = true;`);
const jwtDe = async (email) => (await (await sessio(email)).auth.getSession()).data.session.access_token;
const JWT_AMBIT = await jwtDe(correus.ambit);
const JWT_OCIC = await jwtDe(correus.ocic);
const JWT_GESTOR = await jwtDe(correus.gestor);
const JWT_WEB = await jwtDe(correus.web);
const ambitClient = await sessio(correus.ambit);
const ocicClient = await sessio(correus.ocic);

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

// Firma OCIC de prova de mpaleari@ambit.ad (bucket privat portal-firmes) i firma d'ÀMBIT
const firmaOcic = png(500, 170, (t) => [40 + t * 420, 85 + Math.sin(t * 14) * 40 * (1 - t) + Math.cos(t * 5) * 20]);
const firmaOcicPath = `ocic/${idAmbit}/${crypto.randomUUID()}.png`;
{
  const { error } = await admin.storage.from('portal-firmes').upload(firmaOcicPath, firmaOcic, { contentType: 'image/png' });
  if (error) throw error;
  sql(`insert into portal.firmes_ocic (user_id, nom, imatge_path, sha256) values ('${idAmbit}', 'Firma de prova (no real)', '${firmaOcicPath}', '${sha256(firmaOcic)}')
       on conflict (user_id) do update set imatge_path = excluded.imatge_path, sha256 = excluded.sha256;`);
  sql('select portal.registra_firma_ambit_des_ocic();');
}

// ─── Contracte de prova de 3 pàgines (PDF escrit a mà, fictici) ─────────────
const contractePdf = (titol) => {
  const pagines = [
    [`${titol} (document de prova)`, 'Reunits, d\'una part, Client de Prova i, de l\'altra, DEL SOTO - PALEARI & ASSOCIATS, SL.'],
    ['Primera. Objecte', 'Prestacio de serveis d\'assessorament. Totes les dades son fictícies.'],
    ['Segona. Durada', 'Un any. Pagina final del contracte de prova.'],
  ];
  const objs = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push(`<< /Type /Pages /Kids [${pagines.map((_, i) => `${4 + i * 2} 0 R`).join(' ')}] /Count ${pagines.length} >>`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  pagines.forEach(([t, cos], i) => {
    const flux = `BT /F1 16 Tf 60 770 Td (${t}) Tj ET\nBT /F1 11 Tf 60 740 Td (${cos}) Tj ET\nBT /F1 9 Tf 480 60 Td (Pagina ${i + 1} de 3) Tj ET`;
    objs.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R >> >> /Contents ${5 + i * 2} 0 R >>`);
    objs.push(`<< /Length ${Buffer.byteLength(flux, 'latin1')} >>\nstream\n${flux}\nendstream`);
  });
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offs = [];
  objs.forEach((o, i) => { offs.push(Buffer.byteLength(out, 'latin1')); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = Buffer.byteLength(out, 'latin1');
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
};

// ─── Crides ─────────────────────────────────────────────────────────────────
const crida = async (funcio, cos, { jwt = ANON, origen = 'https://www.ambit.ad', falla = null } = {}) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: {
      ...(origen ? { Origin: origen } : {}),
      ...(falla ? { 'x-portal-prova-falla': falla } : {}),
      Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json',
      'User-Agent': 'Prova-local/1.0 (contracte.test.mjs)',
    },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})) };
};
const personal = (cos, jwt = JWT_GESTOR, opts = {}) => crida('portal-contracte-personal', cos, { jwt, ...opts });
const signant = (token, cos, opts = {}) => crida('portal-contracte', { token, ...cos }, opts);
const estat = async (id) => (await adminPortal.from('requests').select('status').eq('id', id).single()).data?.status;
const pujaOriginal = async (requestId, bytes, nom = 'contracte.pdf', mime = 'application/pdf') => {
  const u = await personal({ accio: 'url_original', request_id: requestId, mime, mida: bytes.length });
  if (u.status !== 200) return u;
  const { error } = await nouClient().storage.from('portal-docs').uploadToSignedUrl(u.cos.path, u.cos.upload_token, bytes, { contentType: 'application/pdf' });
  if (error) return { status: 500, cos: { error: error.message } };
  return personal({ accio: 'registra_original', request_id: requestId, path: u.cos.path, nom_fitxer: nom });
};
const descarrega = async (url) => Buffer.from(await (await fetch(publica(url))).arrayBuffer());
const textPdf = (b, primera, darrera) => {
  const f = path.join(TMP, `${crypto.randomUUID()}.pdf`);
  fs.writeFileSync(f, b);
  return spawnSync('pdftotext', ['-f', String(primera), '-l', String(darrera), f, '-'], { encoding: 'utf8' }).stdout.replace(/\s+/g, ' ');
};

// Client
const { data: clientPj } = await adminPortal.from('clients').insert({ party_type: 'pj', nom_mostrat: `Client Contracte Prova ${sufix}, SL` }).select('id').single();
const { data: clientPf } = await adminPortal.from('clients').insert({ party_type: 'pf', nom_mostrat: `Persona Contracte Prova ${sufix}` }).select('id').single();

// ═══ 1. Permisos ════════════════════════════════════════════════════════════
seccio('Permisos');
{
  const r1 = await personal({ accio: 'crea', client_id: clientPf.id }, ANON);
  comprova(r1.status === 401, 'Sense sessió: 401');
  const r2 = await personal({ accio: 'crea', client_id: clientPf.id, titol: 'X', idioma: 'ca', signants: [{ nom: 'A', email: 'a@a.ad', qualitat: 'Q' }] }, JWT_WEB);
  comprova(r2.status === 403, 'Un usuari de la web que no és personal: 403');
  const r3 = await crida('portal-contracte-personal', { accio: 'crea' }, { jwt: JWT_GESTOR, origen: 'https://dolent.example' });
  comprova(r3.status === 403, 'Origen no permès: 403');
}

// ═══ 2. Creació i PDF original ══════════════════════════════════════════════
seccio('Creació i PDF original');
const crea = (clientId, titol, idioma, signants) => personal({ accio: 'crea', client_id: clientId, titol, idioma, signants });
const rCa = await crea(clientPf.id, 'Contracte d\'arrendament de prova', 'ca', [{ nom: 'Carla Prova Exemple', email: 'carla@test.local', qualitat: 'En nom propi' }]);
comprova(rCa.status === 200 && !!rCa.cos.request_id, 'El gestor crea un contracte en català amb un signant');
const rBi = await crea(clientPj.id, 'Contracte de prestació de serveis de prova', 'ca_en', [
  { nom: 'Anna Prova Primera', email: 'anna@test.local', qualitat: `En nom i representació de Client Contracte Prova ${sufix}, SL, com a administradora` },
  { nom: 'Bernat Prova Segon', email: 'bernat@test.local', qualitat: 'En nom propi' },
]);
comprova(rBi.status === 200, 'El gestor crea un contracte en català i anglès amb dos signants');
const ID_CA = rCa.cos.request_id;
const ID_BI = rBi.cos.request_id;
{
  const r = await crea(clientPf.id, 'X', 'en', [{ nom: 'A', email: 'a@a.ad', qualitat: 'Q' }]);
  comprova(r.status === 400, 'Idioma no admès: 400');
  const r2 = await crea(clientPf.id, 'X', 'ca', [{ nom: 'A', email: 'no-es-un-correu', qualitat: 'Q' }]);
  comprova(r2.status === 400, 'Correu del signant no vàlid: 400');
  const r3 = await crea(clientPf.id, 'X', 'ca', [{ nom: 'A', email: 'a@a.ad', qualitat: '' }]);
  comprova(r3.status === 400, 'Sense qualitat: 400');
}

const original = contractePdf('Contracte de prova');
const shaOriginal = sha256(original);
{
  const noPdf = await pujaOriginal(ID_CA, Buffer.from('Això no és cap PDF.'));
  comprova(noPdf.status === 400 && noPdf.cos.codi === 'no_pdf', 'Un fitxer que no és PDF es rebutja');
  const malmes = await pujaOriginal(ID_CA, Buffer.from('%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\nbrossa'));
  comprova(malmes.status === 400 && malmes.cos.codi === 'no_valid', 'Un PDF no vàlid es rebutja');
  const altreTipus = await personal({ accio: 'url_original', request_id: ID_CA, mime: 'image/png', mida: 100 });
  comprova(altreTipus.status === 400, 'Només application/pdf');
  const gran = await personal({ accio: 'url_original', request_id: ID_CA, mime: 'application/pdf', mida: 20 * 1024 * 1024 + 1 });
  comprova(gran.status === 400, 'Màxim 20 MB');
  if (hiHa('qpdf')) {
    fs.writeFileSync(path.join(TMP, 'net.pdf'), original);
    spawnSync('qpdf', ['--encrypt', 'clau', 'propietari', '256', '--', path.join(TMP, 'net.pdf'), path.join(TMP, 'xifrat.pdf')]);
    spawnSync('qpdf', ['--encrypt', '', 'propietari', '256', '--', path.join(TMP, 'net.pdf'), path.join(TMP, 'permisos.pdf')]);
    const x1 = await pujaOriginal(ID_CA, fs.readFileSync(path.join(TMP, 'xifrat.pdf')));
    comprova(x1.status === 400 && x1.cos.codi === 'xifrat', 'Un PDF amb contrasenya es rebutja');
    const x2 = await pujaOriginal(ID_CA, fs.readFileSync(path.join(TMP, 'permisos.pdf')));
    comprova(x2.status === 400 && x2.cos.codi === 'xifrat', 'Un PDF xifrat (només amb contrasenya de permisos) es rebutja');
  }
  comprova((await adminPortal.from('contracte_originals').select('id').eq('request_id', ID_CA)).data.length === 0, 'Cap PDF rebutjat queda registrat com a original');
  const env = await personal({ accio: 'enllac', signant_id: (await adminPortal.from('contracte_signants').select('id').eq('request_id', ID_CA).single()).data.id });
  comprova(env.status === 400 && await estat(ID_CA) === 'esborrany', 'Sense original no es pot enviar ni generar cap enllaç');

  const ok = await pujaOriginal(ID_CA, original, 'Contracte-arrendament-prova.pdf');
  comprova(ok.status === 200 && ok.cos.sha256 === shaOriginal && ok.cos.pagines === 3, 'PDF vàlid: s\'accepta, amb l\'empremta i 3 pàgines');
  const segon = await pujaOriginal(ID_CA, contractePdf('Un altre'));
  comprova(segon.status === 409, 'L\'original no se substitueix mai');
  const ok2 = await pujaOriginal(ID_BI, original, 'Contracte-serveis-prova.pdf');
  comprova(ok2.status === 200, 'Original del contracte bilingüe');
}

// ═══ 3. Enllaços ════════════════════════════════════════════════════════════
seccio('Enllaços (un per signant)');
const signantsDe = async (id) => (await adminPortal.from('contracte_signants').select('id, ordre, nom, email').eq('request_id', id).order('ordre')).data;
const [sCa] = await signantsDe(ID_CA);
const [sA, sB] = await signantsDe(ID_BI);
const enllac = async (s) => personal({ accio: 'enllac', signant_id: s.id });
const eCa = await enllac(sCa);
comprova(eCa.status === 200 && /\/contracte#[A-Za-z0-9_-]{43}$/.test(eCa.cos.enllac), 'Enllaç /contracte#<token>');
comprova(await estat(ID_CA) === 'enviat', 'Generar el primer enllaç passa esborrany → enviat');
comprova(eCa.cos.email === 'carla@test.local' && eCa.cos.idioma === 'ca' && eCa.cos.titol === 'Contracte d\'arrendament de prova',
  'La resposta porta el correu, el títol i l\'idioma per preparar el correu');
const tokenDe = (e) => e.cos.enllac.split('/contracte#')[1];
const TOK_CA = tokenDe(eCa);
{
  const { data } = await adminPortal.from('access_tokens').select('token_hash').eq('signant_id', sCa.id);
  comprova(data.every((t) => t.token_hash !== TOK_CA) && data.some((t) => t.token_hash === sha256(TOK_CA)), 'A la base només hi ha el hash del token');
  const viaSignar = await crida('portal-signar', { token: TOK_CA, accio: 'obrir' });
  comprova(viaSignar.status === 404, 'El token d\'un contracte no serveix a la pàgina de l\'autorització');
  const viaEnllac = await crida('portal-enllac', { request_id: ID_CA }, { jwt: JWT_GESTOR });
  comprova(viaEnllac.status === 409, 'portal-enllac no genera enllaços de contracte (són per signant)');
}
const eA1 = await enllac(sA);
const eA = await enllac(sA);
const eB = await enllac(sB);
const TOK_A = tokenDe(eA);
const TOK_B = tokenDe(eB);
comprova((await signant(tokenDe(eA1), { accio: 'obrir' })).status === 404, 'Regenerar revoca l\'enllaç anterior del signant');
comprova((await signant(TOK_B, { accio: 'obrir' })).status === 200, '… però no el de l\'altre signant');

// ═══ 4. Circuit del signant ═════════════════════════════════════════════════
seccio('Circuit del signant · català, un signant');
{
  const o = await signant(TOK_CA, { accio: 'obrir' });
  comprova(o.status === 200 && o.cos.idioma === 'ca' && o.cos.signant.nom === 'Carla Prova Exemple' && o.cos.original.pagines === 3,
    'Obrir: títol, idioma, signant i nombre de pàgines');
  const vist = await descarrega(`${URL}${o.cos.original.ruta}`);
  comprova(sha256(vist) === shaOriginal, 'El signant veu el contracte original complet (mateixa empremta)');
  comprova(!JSON.stringify(o.cos).includes('carla@test.local'), 'Obrir no retorna el correu del signant');
  const abans = await signant(TOK_CA, { accio: 'signar', lloc: 'Andorra la Vella', signatura: dataUrl(firma(1)) });
  comprova(abans.status === 400, 'Sense l\'acceptació prèvia no es pot signar');
  const sense = await signant(TOK_CA, { accio: 'accepta', llegit: true, accepta: false });
  comprova(sense.status === 400, 'Sense la casella d\'acceptació: 400');
  const sense2 = await signant(TOK_CA, { accio: 'accepta', llegit: false, accepta: true });
  comprova(sense2.status === 400, 'Sense la casella de lectura: 400');
  const acc = await signant(TOK_CA, { accio: 'accepta', llegit: true, accepta: true });
  comprova(acc.status === 200 && !!acc.cos.acceptat_at, 'Acceptació registrada amb data i hora');
  const senseLloc = await signant(TOK_CA, { accio: 'signar', lloc: ' ', signatura: dataUrl(firma(1)) });
  comprova(senseLloc.status === 400 && senseLloc.cos.codi === 'falta_lloc', 'Sense lloc: 400');
  const senseFirma = await signant(TOK_CA, { accio: 'signar', lloc: 'Andorra la Vella', signatura: '' });
  comprova(senseFirma.status === 400 && senseFirma.cos.codi === 'falta_firma', 'Sense signatura: 400');
  const avisosAbans = avisos.length;
  const s = await signant(TOK_CA, { accio: 'signar', lloc: 'Andorra la Vella', signatura: dataUrl(firma(1)) });
  comprova(s.status === 200 && s.cos.estat === 'pendent_ambit', 'Signa: amb un sol signant, pendent de signatura d\'ÀMBIT');
  const { data: fila } = await adminPortal.from('contracte_signants').select('acceptat_at, signat_at, ip, user_agent, imatge_sha256').eq('id', sCa.id).single();
  comprova(new Date(fila.acceptat_at) < new Date(fila.signat_at), 'L\'acceptació és anterior a la signatura');
  comprova(fila.user_agent === 'Prova-local/1.0 (contracte.test.mjs)' && fila.imatge_sha256 === sha256(firma(1)), 'Es desa el navegador i l\'empremta de la firma');
  await new Promise((r) => setTimeout(r, 1500));
  comprova(avisos.length === avisosAbans + 1, 'Un avís per Formspree en acabar');
  const avis = JSON.parse(avisos[avisos.length - 1].cos);
  comprova(avis._subject === 'Nou contracte signat al portal'
    && avis.message === 'S\'ha signat un contracte al portal de signatura d\'ÀMBIT Associats. Podeu consultar-lo a https://www.ambit.ad/portal'
    && avis.name === 'Portal de signatura' && avis.email === 'info@ambit.ad' && Object.keys(avis).length === 4,
  'Avís: assumpte i text exactes, sense cap altre camp');
  const cru = avisos[avisos.length - 1].cos;
  comprova(!/Carla|carla@|arrendament|[0-9a-f]{8}-[0-9a-f]{4}-/i.test(cru), 'L\'avís no porta cap dada del client, del signant, del contracte ni cap identificador');
  comprova((await signant(TOK_CA, { accio: 'obrir' })).status === 404, 'L\'enllaç és d\'un sol ús');
}

seccio('Circuit del signant · català i anglès, dos signants');
{
  comprova((await signant(TOK_A, { accio: 'accepta', llegit: true, accepta: true })).status === 200, 'Accepta el primer signant');
  const s1 = await signant(TOK_A, { accio: 'signar', lloc: 'Escaldes-Engordany', signatura: dataUrl(firma(2)) });
  comprova(s1.status === 200 && s1.cos.estat === 'parcialment_signat', 'Signa el primer: parcialment signat');
  const massaAviat = await personal({ accio: 'contrafirma', request_id: ID_BI }, JWT_AMBIT);
  comprova(massaAviat.status === 400 && await estat(ID_BI) === 'parcialment_signat', 'ÀMBIT no pot signar fins que hagin signat tots');
  comprova((await signant(TOK_B, { accio: 'accepta', llegit: true, accepta: true })).status === 200, 'Accepta el segon signant');
  const s2 = await signant(TOK_B, { accio: 'signar', lloc: 'Andorra la Vella', signatura: dataUrl(firma(3)) });
  comprova(s2.status === 200 && s2.cos.estat === 'pendent_ambit', 'Signa el segon: pendent de signatura d\'ÀMBIT');
}

// ═══ 5. Signatura d'ÀMBIT i PDF final ═══════════════════════════════════════
seccio('Signatura d\'ÀMBIT i PDF final');
const desaPdf = (nom, b) => { if (CARPETA_PDF) fs.writeFileSync(path.join(CARPETA_PDF, nom), b); };
const comprovaPdf = async (id, b, idioma, signants) => {
  comprova(b.subarray(0, original.length).equals(original), 'Els bytes del PDF original són intactes al principi del PDF final');
  comprova(sha256(b.subarray(0, original.length)) === shaOriginal, 'Els primers N bytes tenen l\'empremta de l\'original');
  const { data: doc } = await adminPortal.from('documents').select('sha256, storage_path').eq('request_id', id).eq('kind', 'signat').single();
  comprova(doc.sha256 === sha256(b), 'L\'empremta del PDF final queda registrada a la base');
  const { data: orig } = await adminPortal.from('documents').select('sha256, storage_path').eq('request_id', id).eq('kind', 'original').single();
  const { data: o2 } = await admin.storage.from('portal-docs').download(orig.storage_path);
  comprova(sha256(Buffer.from(await o2.arrayBuffer())) === shaOriginal && orig.sha256 === shaOriginal, 'L\'original desat continua intacte (mateixa empremta)');
  if (hiHa('qpdf')) {
    const f = path.join(TMP, `${id}.pdf`);
    fs.writeFileSync(f, b);
    const q = spawnSync('qpdf', ['--check', f], { encoding: 'utf8' });
    comprova(q.status === 0 && !/WARNING/.test(q.stdout + q.stderr), 'qpdf --check: PDF final correcte');
  }
  if (hiHa('pdftotext')) {
    const afegit = textPdf(b, 4, 99);
    comprova(afegit.includes('Clàusula addicional. Signatura electrònica'), 'Pàgines afegides: clàusula addicional');
    comprova(signants.every((s) => afegit.includes(s)), 'Pàgina de signatures i evidències amb tots els signants');
    comprova(afegit.includes('Martín Paleari · Administrador solidari') && afegit.includes(shaOriginal), 'Signatura d\'ÀMBIT i empremta de l\'original');
    const angles = ['agreement', 'parties', 'signatory', 'signature', 'evidence', 'fingerprint', 'browser', 'Place', 'Date', 'Capacity', 'Signed'];
    if (idioma === 'ca') comprova(angles.every((w) => !new RegExp(`\\b${w}\\b`).test(afegit)), 'Català: cap text en anglès a les pàgines afegides');
    else comprova(afegit.includes('Additional clause. Electronic signature') && afegit.includes('Each party receives an electronic copy'), 'Català i anglès: l\'anglès hi és');
  }
};
{
  const gestorNo = await personal({ accio: 'contrafirma', request_id: ID_CA }, JWT_GESTOR);
  comprova(gestorNo.status === 403, 'Un gestor no pot signar en nom d\'ÀMBIT');
  const ocicNo = await personal({ accio: 'contrafirma', request_id: ID_CA }, JWT_OCIC);
  comprova(ocicNo.status === 403 && await estat(ID_CA) === 'pendent_ambit', 'Una altra OCIC tampoc');
  const directe = await ocicClient.schema('portal').rpc('contrafirma_contracte', { p_request_id: ID_CA });
  comprova(!!directe.error, 'Ni cridant la base directament');

  const c = await personal({ accio: 'contrafirma', request_id: ID_CA }, JWT_AMBIT);
  comprova(c.status === 200 && !!c.cos.pdf_final?.url, 'mpaleari@ambit.ad signa amb la seva sessió i es genera el PDF final');
  comprova(await estat(ID_CA) === 'signat', 'Estat: signat');
  const pdfCa = await descarrega(c.cos.pdf_final.url);
  desaPdf('contracte-1-signant-catala.pdf', pdfCa);
  await comprovaPdf(ID_CA, pdfCa, 'ca', ['Carla Prova Exemple', 'En nom propi', 'Andorra la Vella']);
  const altre = await personal({ accio: 'pdf_final', request_id: ID_CA }, JWT_AMBIT);
  comprova(altre.status === 409, 'Un sol PDF final per contracte');

  // Fallada en generar el PDF: la signatura d'ÀMBIT queda feta i el PDF es genera després
  const f = await personal({ accio: 'contrafirma', request_id: ID_BI }, JWT_AMBIT, { falla: 'pdf' });
  comprova(f.status === 500 && await estat(ID_BI) === 'signat', 'Si falla el PDF, la signatura d\'ÀMBIT ja és registrada');
  comprova((await adminPortal.from('documents').select('id').eq('request_id', ID_BI).eq('kind', 'signat')).data.length === 0, '… i no queda cap PDF final a mitges');
  const p = await personal({ accio: 'pdf_final', request_id: ID_BI }, JWT_AMBIT);
  comprova(p.status === 200 && !!p.cos.pdf_final?.url, 'Es genera el PDF final després');
  const pdfBi = await descarrega(p.cos.pdf_final.url);
  desaPdf('contracte-2-signants-bilingue.pdf', pdfBi);
  await comprovaPdf(ID_BI, pdfBi, 'ca_en', ['Anna Prova Primera', 'Bernat Prova Segon', 'Escaldes-Engordany']);
  const ocicPdf = await personal({ accio: 'pdf_final', request_id: ID_BI }, JWT_OCIC);
  comprova(ocicPdf.status === 403, 'Només el signant d\'ÀMBIT genera el PDF final');
  desaPdf('contracte-original.pdf', original);
}

// ═══ 6. Anul·lació ══════════════════════════════════════════════════════════
seccio('Anul·lació');
{
  const r = await crea(clientPf.id, 'Contracte per anul·lar', 'ca', [{ nom: 'Dídac Prova', email: 'didac@test.local', qualitat: 'En nom propi' }]);
  await pujaOriginal(r.cos.request_id, original);
  const [s] = await signantsDe(r.cos.request_id);
  const e = await enllac(s);
  const gestor = await sessio(correus.gestor);
  const g = await gestor.schema('portal').rpc('anulla_contracte', { p_request_id: r.cos.request_id, p_motiu: 'Prova' });
  comprova(!!g.error, 'Un gestor no pot anul·lar');
  const o = await ocicClient.schema('portal').rpc('anulla_contracte', { p_request_id: r.cos.request_id, p_motiu: 'Creat per a la prova' });
  comprova(!o.error && await estat(r.cos.request_id) === 'anullat', 'L\'OCIC anul·la amb motiu');
  comprova((await signant(tokenDe(e), { accio: 'obrir' })).status === 404, 'Anul·lat: l\'enllaç ja no serveix');
  const signat = await ambitClient.schema('portal').rpc('anulla_contracte', { p_request_id: ID_CA, p_motiu: 'Prova' });
  comprova(!!signat.error && await estat(ID_CA) === 'signat', 'Un contracte signat no es pot anul·lar');
}

console.log(`\nCarpeta temporal: ${TMP}`);
if (CARPETA_PDF) console.log(`PDF d'exemple a: ${CARPETA_PDF}`);
console.log(`\n${total - fallades}/${total} correctes`);
console.log(fallades ? `${fallades} proves han fallat` : 'Totes les proves han passat');
receptor.close();
process.exit(fallades ? 1 : 0);
