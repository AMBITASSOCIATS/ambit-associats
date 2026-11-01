// Proves locals de l'àrea de client: Edge Functions portal-client-acces,
// portal-client-area, portal-client-personal i la part de l'àrea de client de
// portal-purga, amb Auth (hook del rol portal_client i segon factor TOTP),
// PostgREST, Storage i un receptor local en lloc de Formspree.
//
// Requisits: `supabase start` (config.toml amb el hook i el TOTP actius) i
//   supabase functions serve --env-file <fitxer>
// on <fitxer> és supabase/functions/.env més aquestes línies (no s'envia res a fora):
//   FORMSPREE_FORM_ID=prova-local
//   FORMSPREE_BASE_URL=http://host.docker.internal:54399/f/
//   FORMSPREE_FORM_ID_INFO=prova-info
//   FORMSPREE_FORM_ID_MPALEARI=prova-mpaleari
// (sense FORMSPREE_FORM_ID_MDELSOTO: es comprova que fa servir el general)
// Execució: node supabase/tests/edge/area-client.test.mjs
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.
// Les contrasenyes, tokens i codis que surten aquí són de prova.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import http from 'node:http';
import { createClient } from '@supabase/supabase-js';
import * as F from '../client/fabrica-fitxers.mjs';

const env = Object.fromEntries(
  execSync('supabase status -o env', { encoding: 'utf8' })
    .split('\n')
    .map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2]]),
);
const URL = env.API_URL;
const ANON = env.ANON_KEY;
const admin = createClient(URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const adminPortal = admin.schema('portal');
const nouClient = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const sql = (q) => execSync('docker exec -i supabase_db_ambit-associats psql -U postgres -d postgres -X -A -t -q -v ON_ERROR_STOP=1',
  { input: q, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
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
const claims = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString());

const crida = async (funcio, cos, { jwt = ANON, origen = 'https://www.ambit.ad', capcaleres = {} } = {}) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: { ...(origen ? { Origin: origen } : {}), Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json', ...capcaleres },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})) };
};
const acces = (cos, jwt) => crida('portal-client-acces', cos, { jwt });
const area = (cos, jwt) => crida('portal-client-area', cos, { jwt });
const personalCrida = (cos, jwt) => crida('portal-client-personal', cos, { jwt });

// ─── Receptor local que fa de Formspree ─────────────────────────────────────
const rebuts = [];
const receptor = http.createServer((req, res) => {
  let cos = '';
  req.on('data', (c) => { cos += c; });
  req.on('end', () => {
    rebuts.push({ ruta: req.url, cos });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
await new Promise((r) => receptor.listen(54399, '0.0.0.0', r));

// ─── Usuaris i clients ──────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const PASS_CLIENT = 'Contrasenya-client-prova-1';
const usuariAuth = async (email, password = PASS) => {
  const { data: l } = await admin.auth.admin.listUsers({ perPage: 1000 });
  const ja = l.users.find((u) => u.email === email);
  if (ja) {
    await admin.auth.admin.updateUserById(ja.id, { password, ban_duration: 'none' });
    return ja.id;
  }
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw error;
  return data.user.id;
};
const sessio = async (email, password = PASS) => {
  const c = nouClient();
  const { data, error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { c, jwt: data.session.access_token };
};

const idInfo = await usuariAuth('info@ambit.ad');
const idMpaleari = await usuariAuth('mpaleari@ambit.ad');
const idGestorX = await usuariAuth(`gestor-ac-${sufix}@test.local`);
sql(`insert into portal.staff_profiles (user_id, role) values ('${idInfo}', 'gestor'), ('${idMpaleari}', 'ocic'), ('${idGestorX}', 'gestor')
     on conflict (user_id) do update set actiu = true;`);
const info = await sessio('info@ambit.ad');
const ocic = await sessio('mpaleari@ambit.ad');
const gestorX = await sessio(`gestor-ac-${sufix}@test.local`);

// Usuari de la Zona Professionals (actiu)
const emailPro = `pro-ac-${sufix}@test.local`;
const idPro = await usuariAuth(emailPro);
await admin.from('profiles').insert({ id: idPro, email: emailPro, nom: 'Pro', rol: 'individual', estat: 'actiu', eines: ['irpf'] });
const pro = await sessio(emailPro);

// Clients
const nousClients = await info.c.schema('portal').from('clients').insert([
  { nom_mostrat: `Client Àrea A ${sufix}`, party_type: 'pj' },
  { nom_mostrat: `Client Àrea B ${sufix}`, party_type: 'pf' },
  { nom_mostrat: `Client Àrea C ${sufix}`, party_type: 'pj' },
]).select('id, nom_mostrat');
const [CA, CB, CC] = nousClients.data;

// ─── Documents de prova del client A (directament a la base, sense triggers) ─
const docs = {};
const ruta = (rid, k) => `requests/${rid}/${k}/${crypto.randomUUID()}.pdf`;
const creaDoc = async (clientId, tipus, kind, status = 'signat') => {
  const rid = crypto.randomUUID();
  const did = crypto.randomUUID();
  const cami = ruta(rid, kind);
  const cos = F.pdf(`/Title (${tipus}-${kind})`);
  await admin.storage.from('portal-docs').upload(cami, cos, { contentType: 'application/pdf' });
  sql(`set session_replication_role = replica;
       insert into portal.requests (id, client_id, document_type, template_version, idioma, status)
         values ('${rid}', '${clientId}', '${tipus}', 'PROVA', 'ca', '${status}');
       insert into portal.documents (id, request_id, kind, storage_path, sha256, mida_bytes, mime)
         values ('${did}', '${rid}', '${kind}', '${cami}', '${sha256(cos)}', ${cos.length}, 'application/pdf');
       ${tipus === 'contracte' ? `insert into portal.contractes (request_id, titol, idioma) values ('${rid}', 'Contracte de prova', 'ca');` : ''}`);
  return { did, sha: sha256(cos) };
};
docs.contracte = await creaDoc(CA.id, 'contracte', 'signat');
docs.contracteOriginal = await creaDoc(CA.id, 'contracte', 'original');
docs.kycCopia = await creaDoc(CA.id, 'kyc_pj', 'copia_client', 'actiu');
docs.kycValidat = await creaDoc(CA.id, 'kyc_pj', 'validat', 'actiu');
docs.kycSignat = await creaDoc(CA.id, 'kyc_pj', 'signat', 'actiu');
docs.kycEvidencies = await creaDoc(CA.id, 'kyc_pj', 'evidencies', 'actiu');
docs.pdp = await creaDoc(CA.id, 'pdp', 'signat');
docs.autoritzacio = await creaDoc(CA.id, 'autoritzacio_carrec', 'signat', 'actiu');
docs.irpfSignat = await creaDoc(CA.id, 'irpf_comunicacio', 'signat', 'actiu');
docs.irpfIntern = await creaDoc(CA.id, 'irpf_comunicacio', 'intern', 'actiu');
docs.irpfCopia = await creaDoc(CA.id, 'irpf_comunicacio', 'copia_client', 'actiu');
docs.anullada = await creaDoc(CA.id, 'autoritzacio_carrec', 'signat', 'anullat');
docs.altreClient = await creaDoc(CC.id, 'pdp', 'signat');

// ─── Activació completa d'un usuari de client (amb TOTP) ────────────────────
const activa = async (enllac, password = PASS_CLIENT) => {
  const token = enllac.split('#')[1];
  const r = await acces({ accio: 'activa', token, contrasenya: password, versio: 'CONDICIONS-AREA v1' });
  if (r.status !== 200) return { r };
  const c = nouClient();
  await c.auth.setSession({ access_token: r.cos.access_token, refresh_token: r.cos.refresh_token });
  const { data: en } = await c.auth.mfa.enroll({ factorType: 'totp' });
  const { data: v } = await c.auth.mfa.challengeAndVerify({ factorId: en.id, code: F.totp(en.totp.secret) });
  const fi = await acces({ accio: 'completa' }, v.access_token);
  return { r, c, secret: en.totp.secret, jwt: v.access_token, fi };
};
// Accés normal: contrasenya + codi
const entra = async (email, secret, password = PASS_CLIENT) => {
  const r1 = await acces({ accio: 'entra', email, contrasenya: password });
  if (r1.status !== 200) return { r1 };
  const r2 = await acces({ accio: 'verifica', codi: F.totp(secret) }, r1.cos.access_token);
  return { r1, r2, jwt: r2.cos.access_token };
};
const puja = async (pujada, bytes) => {
  const r = await fetch(publica(pujada.url), { method: 'PUT', headers: { 'Content-Type': pujada.mime, apikey: ANON }, body: bytes });
  return r.status;
};
const envia = async (jwt, { client = CA.id, destinatari, assumpte = 'Factures d\'octubre', comentari = 'Prova', fitxers }) => {
  const p = await area({ accio: 'prepara', client_id: client, destinatari_id: destinatari, assumpte, comentari,
    fitxers: fitxers.map((f) => ({ nom: f.nom, mida: f.dades.length })) }, jwt);
  if (p.status !== 200) return { p };
  for (let i = 0; i < fitxers.length; i++) await puja(p.cos.pujades[i], fitxers[i].dades);
  const c = await area({ accio: 'confirma', enviament_id: p.cos.enviament_id }, jwt);
  return { p, c, id: p.cos.enviament_id };
};

try {
  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Destinataris');
  const { data: dests } = await info.c.schema('portal').from('client_destinataris').select('id, email, actiu').order('ordre');
  const D = Object.fromEntries(dests.map((d) => [d.email.split('@')[0], d]));
  comprova(dests.map((d) => d.email).join(',') === 'info@ambit.ad,mpaleari@ambit.ad,mdelsoto@ambit.ad', 'info@, mpaleari@ i mdelsoto@ a la llista');
  const errGestor = await info.c.schema('portal').rpc('client_destinatari_actualitza', { p_id: D.info.id, p_actiu: true, p_email_personal: 'info@ambit.ad' });
  comprova(errGestor.error?.code === '42501', 'Un gestor no pot configurar els destinataris (només l\'OCIC)');
  for (const k of ['info', 'mpaleari']) {
    const { error } = await ocic.c.schema('portal').rpc('client_destinatari_actualitza', { p_id: D[k].id, p_actiu: true, p_email_personal: `${k}@ambit.ad` });
    comprova(!error, `L'OCIC activa ${k}@ amb el seu usuari del portal`);
  }
  const errMds = await ocic.c.schema('portal').rpc('client_destinatari_actualitza', { p_id: D.mdelsoto.id, p_actiu: true });
  comprova(errMds.error?.code === '23514', 'mdelsoto@ no es pot activar: no té usuari al portal (ho exigeix la base)');
  const errMds2 = await ocic.c.schema('portal').rpc('client_destinatari_actualitza', { p_id: D.mdelsoto.id, p_actiu: true, p_email_personal: 'mdelsoto@ambit.ad' });
  comprova(errMds2.error && sql(`select actiu::text || coalesce(user_id::text, '') from portal.client_destinataris where id = '${D.mdelsoto.id}'`) === 'false',
    'mdelsoto@ no es pot associar a cap usuari: no en té cap al portal');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Alta d\'usuaris des de la fitxa del client');
  const E1 = `client1-${sufix}@test.local`;
  const E2 = `client2-${sufix}@test.local`;
  const a1 = await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'Usuària U1', email: E1 }, info.jwt);
  comprova(a1.status === 200 && a1.cos.usuari_id, 'El personal afegeix un usuari (nom i correu)');
  const U1 = a1.cos.usuari_id;
  const a1b = await personalCrida({ accio: 'afegeix', client_id: CB.id, nom: 'Usuària U1', email: E1.toUpperCase() }, gestorX.jwt);
  comprova(a1b.status === 200 && a1b.cos.usuari_id === U1, 'El mateix usuari es vincula a un segon client (un usuari, diversos clients)');
  comprova((await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'U1', email: E1 }, info.jwt)).status === 409, 'No es pot vincular dues vegades al mateix client');
  const a2 = await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'Usuari U2', email: E2 }, info.jwt);
  comprova(a2.status === 200, 'Un client pot tenir diversos usuaris');
  const U2 = a2.cos.usuari_id;
  const aPro = await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'Pro', email: emailPro }, info.jwt);
  comprova(aPro.status === 409, 'El correu d\'un usuari de la Zona Professionals no pot ser usuari de client');
  const aStaff = await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'Info', email: 'info@ambit.ad' }, info.jwt);
  comprova(aStaff.status === 409, 'El correu del personal no pot ser usuari de client');
  comprova((await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'X', email: `x-${sufix}@test.local` }, pro.jwt)).status === 403,
    'Un usuari de la Zona Professionals no pot gestionar usuaris de client');
  const llista = await personalCrida({ accio: 'llista', client_id: CA.id }, info.jwt);
  comprova(llista.status === 200 && llista.cos.usuaris.length === 2 && llista.cos.usuaris.every((u) => u.estat === 'pendent'), 'Llista d\'usuaris del client A (pendents)');
  const userU1 = sql(`select user_id from portal.client_usuaris where id = '${U1}'`);
  comprova(sql(`select count(*) from public.profiles where id = '${userU1}'`) === '0'
    && sql(`select count(*) from portal.staff_profiles where user_id = '${userU1}'`) === '0', 'L\'usuari de client no té fila a profiles ni a staff_profiles');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Invitació i activació');
  const inv1 = await personalCrida({ accio: 'convida', usuari_id: U1 }, info.jwt);
  comprova(inv1.status === 200 && /^https:\/\/www\.ambit\.ad\/client\/activar#[A-Za-z0-9_-]{43}$/.test(inv1.cos.enllac), 'Enllaç d\'activació (token al fragment)');
  const dies = (new Date(inv1.cos.expira_at) - Date.now()) / 86400000;
  comprova(dies > 6.9 && dies <= 7, 'Caduca als 7 dies');
  comprova(inv1.cos.nom === 'Usuària U1' && inv1.cos.email === E1, 'Retorna el nom i el correu per a la finestra del correu');
  const tok1 = inv1.cos.enllac.split('#')[1];
  const obre = await acces({ accio: 'obre', token: tok1 });
  comprova(obre.status === 200 && obre.cos.motiu === 'invitacio' && obre.cos.versio === 'CONDICIONS-AREA v1', 'L\'enllaç s\'obre (invitació, condicions v1)');
  comprova((await acces({ accio: 'obre', token: 'x'.repeat(43) })).status === 404, 'Token inexistent: missatge neutre');
  const inv1b = await personalCrida({ accio: 'convida', usuari_id: U1 }, info.jwt);
  comprova((await acces({ accio: 'obre', token: tok1 })).status === 404, 'Un enllaç nou revoca l\'anterior');
  const tok1b = inv1b.cos.enllac.split('#')[1];
  comprova((await acces({ accio: 'activa', token: tok1b, contrasenya: 'curta-11chr', versio: 'CONDICIONS-AREA v1' })).status === 400,
    'Contrasenya de menys de 12 caràcters: rebutjada');
  comprova((await acces({ accio: 'activa', token: tok1b, contrasenya: PASS_CLIENT })).status === 400, 'Sense acceptar les condicions: rebutjada');
  comprova((await acces({ accio: 'activa', token: tok1b, contrasenya: PASS_CLIENT, versio: 'CONDICIONS-AREA v0' })).status === 400, 'Versió de les condicions incorrecta: rebutjada');
  comprova((await acces({ accio: 'obre', token: tok1b })).status === 200, 'Els intents rebutjats no consumeixen l\'enllaç');

  const act = await acces({ accio: 'activa', token: tok1b, contrasenya: PASS_CLIENT, versio: 'CONDICIONS-AREA v1' });
  comprova(act.status === 200 && act.cos.access_token, 'Contrasenya i condicions: sessió per configurar el segon factor');
  const c1 = claims(act.cos.access_token);
  comprova(c1.role === 'portal_client' && c1.aal === 'aal1', 'El JWT del client porta el rol portal_client (no authenticated) i aal1');
  comprova((await acces({ accio: 'obre', token: tok1b })).status === 404 && (await acces({ accio: 'activa', token: tok1b, contrasenya: PASS_CLIENT, versio: 'CONDICIONS-AREA v1' })).status === 404,
    'L\'enllaç és d\'un sol ús');
  comprova(sql(`select versio from portal.client_acceptacions where usuari_id = '${U1}'`) === 'CONDICIONS-AREA v1'
    && sql(`select condicions_at is not null from portal.client_usuaris where id = '${U1}'`) === 't', 'Es registren la versió acceptada i la data');
  comprova((await area({ accio: 'inici' }, act.cos.access_token)).status === 401, 'Sense segon factor (aal1): cap accés a l\'àrea');
  comprova((await acces({ accio: 'completa' }, act.cos.access_token)).status === 400, 'No es pot completar l\'activació sense segon factor');
  const cU1 = nouClient();
  await cU1.auth.setSession({ access_token: act.cos.access_token, refresh_token: act.cos.refresh_token });
  const { data: en1 } = await cU1.auth.mfa.enroll({ factorType: 'totp' });
  const { data: v1 } = await cU1.auth.mfa.challengeAndVerify({ factorId: en1.id, code: F.totp(en1.totp.secret) });
  comprova(claims(v1.access_token).aal === 'aal2', 'Segon factor TOTP configurat (aal2)');
  comprova((await area({ accio: 'inici' }, v1.access_token)).status === 403, 'Amb aal2 però sense completar l\'activació: cap accés');
  const fi1 = await acces({ accio: 'completa' }, v1.access_token);
  comprova(fi1.status === 200, 'Activació completa');
  let SECRET_U1 = en1.totp.secret;
  let JWT_U1 = v1.access_token;
  const ini = await area({ accio: 'inici' }, JWT_U1);
  comprova(ini.status === 200 && ini.cos.usuari.email === E1, 'L\'usuari actiu entra a l\'àrea');
  comprova(ini.cos.clients.map((c) => c.id).sort().join() === [CA.id, CB.id].sort().join(), 'Veu els seus dos clients (A i B), no el C');
  const dd = Object.fromEntries(ini.cos.destinataris.map((d) => [d.email, d.disponible]));
  comprova(dd['info@ambit.ad'] === true && dd['mpaleari@ambit.ad'] === true && dd['mdelsoto@ambit.ad'] === false,
    'Destinataris: info@ i mpaleari@ disponibles; mdelsoto@ visible però no disponible');

  // Activació d'U2 sense configurar el segon factor
  const inv2 = await personalCrida({ accio: 'convida', usuari_id: U2 }, info.jwt);
  const act2 = await acces({ accio: 'activa', token: inv2.cos.enllac.split('#')[1], contrasenya: 'Contrasenya-U2-prova', versio: 'CONDICIONS-AREA v1' });
  comprova(act2.status === 200, 'U2 fixa la contrasenya però no configura el segon factor');
  comprova((await acces({ accio: 'entra', email: E2, contrasenya: 'Contrasenya-U2-prova' })).status === 401, 'Sense segon factor no pot entrar mai');

  // Enllaç caducat
  const E3 = `client3-${sufix}@test.local`;
  const a3 = await personalCrida({ accio: 'afegeix', client_id: CB.id, nom: 'Usuari U3', email: E3 }, info.jwt);
  const U3 = a3.cos.usuari_id;
  const inv3 = await personalCrida({ accio: 'convida', usuari_id: U3 }, info.jwt);
  sql(`update portal.client_tokens set expira_at = now() - interval '1 minute' where usuari_id = '${U3}' and usat_at is null and revocat_at is null;`);
  comprova((await acces({ accio: 'obre', token: inv3.cos.enllac.split('#')[1] })).status === 404, 'Enllaç caducat: missatge neutre');
  comprova((await acces({ accio: 'activa', token: inv3.cos.enllac.split('#')[1], contrasenya: PASS_CLIENT, versio: 'CONDICIONS-AREA v1' })).status === 404, 'Enllaç caducat: no activa');
  comprova((await personalCrida({ accio: 'restableix', usuari_id: U3 }, info.jwt)).status === 403, '«Restablir l\'accés» no és per a un usuari que encara no s\'ha activat');
  comprova((await personalCrida({ accio: 'convida', usuari_id: U1 }, info.jwt)).status === 403, 'No es convida un usuari ja activat');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Accés: contrasenya, segon factor, bloqueig i inactivitat');
  for (let i = 1; i <= 4; i++) {
    const r = await acces({ accio: 'entra', email: E1, contrasenya: `incorrecta-${i}-xxxx` });
    if (i === 4) comprova(r.status === 401, '4 contrasenyes incorrectes: 401');
  }
  const r5 = await acces({ accio: 'entra', email: E1, contrasenya: 'incorrecta-5-xxxx' });
  comprova(r5.status === 423 && r5.cos.bloquejat_fins, 'A la 5a, accés bloquejat');
  comprova((await acces({ accio: 'entra', email: E1, contrasenya: PASS_CLIENT })).status === 423, 'Bloquejat: tampoc entra amb la contrasenya correcta');
  comprova((await area({ accio: 'inici' }, JWT_U1)).status === 423, 'Mentre està bloquejat, tampoc amb la sessió oberta');
  comprova(sql(`select count(*) from portal.audit_log where accio = 'ACCES_FALLIT' and entitat_id = '${U1}'`) === '5', 'Els intents fallits queden a audit_log');
  sql(`update portal.client_usuaris set bloquejat_fins = now() - interval '1 second' where id = '${U1}';`);
  comprova((await acces({ accio: 'entra', email: `noexisteix-${sufix}@test.local`, contrasenya: PASS_CLIENT })).status === 401, 'Correu desconegut: el mateix missatge');
  comprova((await acces({ accio: 'entra', email: emailPro, contrasenya: PASS })).status === 401, 'Un usuari de la Zona Professionals no entra a l\'àrea');
  comprova((await acces({ accio: 'entra', email: 'info@ambit.ad', contrasenya: PASS })).status === 401, 'El personal no entra a l\'àrea');
  const e1 = await acces({ accio: 'entra', email: E1, contrasenya: PASS_CLIENT });
  comprova(e1.status === 200 && claims(e1.cos.access_token).aal === 'aal1', 'Contrasenya correcta: sessió aal1');
  comprova((await area({ accio: 'inici' }, e1.cos.access_token)).status === 401, 'Sessió sense segon factor: cap accés');
  comprova((await acces({ accio: 'verifica', codi: '000000' }, e1.cos.access_token)).status === 401, 'Codi incorrecte: 401');
  const v2 = await acces({ accio: 'verifica', codi: F.totp(SECRET_U1) }, e1.cos.access_token);
  comprova(v2.status === 200 && claims(v2.cos.access_token).aal === 'aal2', 'Codi correcte: aal2');
  JWT_U1 = v2.cos.access_token;
  comprova((await area({ accio: 'inici' }, JWT_U1)).status === 200, 'Amb els dos factors: accés');
  for (let i = 0; i < 5; i++) await acces({ accio: 'verifica', codi: '111111' }, e1.cos.access_token);
  comprova(sql(`select bloquejat_fins > now() from portal.client_usuaris where id = '${U1}'`) === 't', '5 codis incorrectes també bloquegen');
  sql(`update portal.client_usuaris set bloquejat_fins = null, intents_fallits = 0 where id = '${U1}';`);

  // Sessió oberta sense passar per l'Edge Function d'accés (directament contra Auth)
  const directe = nouClient();
  await directe.auth.signInWithPassword({ email: E1, password: PASS_CLIENT });
  const { data: fs } = await directe.auth.mfa.listFactors();
  const { data: vd } = await directe.auth.mfa.challengeAndVerify({ factorId: fs.totp[0].id, code: F.totp(SECRET_U1) });
  comprova(claims(vd.access_token).aal === 'aal2', 'Sessió aal2 obtinguda directament d\'Auth, saltant-se el bloqueig');
  comprova((await area({ accio: 'inici' }, vd.access_token)).status === 401, '… no dona accés a l\'àrea (sessió no registrada)');
  const dirRpc = await directe.schema('portal').rpc('client_inici');
  comprova(dirRpc.error?.code === '42501', '… ni directament a la base (client_inici)');

  // Inactivitat
  const sidU1 = claims(JWT_U1).session_id;
  sql(`update portal.client_sessions set ultima_activitat = now() - interval '31 minutes' where session_id = '${sidU1}';`);
  const inact = await area({ accio: 'inici' }, JWT_U1);
  comprova(inact.status === 401 && inact.cos.motiu === 'inactivitat', '31 minuts sense activitat: sessió tancada');
  comprova(sql(`select motiu_tancament from portal.client_sessions where session_id = '${sidU1}'`) === 'inactivitat', 'Queda registrat el tancament per inactivitat');
  comprova((await area({ accio: 'inici' }, JWT_U1)).status === 401, 'La sessió tancada ja no serveix');
  ({ jwt: JWT_U1 } = await entra(E1, SECRET_U1));
  comprova((await area({ accio: 'inici' }, JWT_U1)).status === 200, 'Torna a entrar amb contrasenya i codi');
  const sortida = await acces({ accio: 'surt' }, JWT_U1);
  comprova(sortida.status === 200 && (await area({ accio: 'inici' }, JWT_U1)).status === 401, 'Tancar la sessió: ja no serveix');
  ({ jwt: JWT_U1 } = await entra(E1, SECRET_U1));

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Separació de comptes: el client no arriba a res fora de l\'àrea');
  const cli = nouClient();
  await cli.auth.setSession({ access_token: JWT_U1, refresh_token: 'x' }).catch(() => {});
  const rest = (taula, esquema = 'portal') => fetch(`${URL}/rest/v1/${taula}?select=*&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Accept-Profile': esquema },
  }).then(async (r) => ({ status: r.status, cos: await r.json().catch(() => null) }));
  const taulesPublic = sql(`select string_agg(tablename, ',') from pg_tables where schemaname = 'public'`).split(',');
  const taulesPortal = sql(`select string_agg(tablename, ',') from pg_tables where schemaname = 'portal'`).split(',');
  const permeses = ['client_vincles', 'clients', 'client_destinataris', 'client_enviaments', 'client_condicions'];
  let fuites = [];
  for (const t of taulesPublic) {
    const r = await rest(t, 'public');
    if (r.status === 200 && r.cos?.length) fuites.push(`public.${t}`);
    else if (r.status === 200) fuites.push(`public.${t} (200 buit)`);
  }
  for (const t of taulesPortal) {
    const r = await rest(t);
    if (permeses.includes(t)) continue;
    if (r.status === 200) fuites.push(`portal.${t}`);
  }
  comprova(fuites.length === 0, `Cap taula de public ni de portal (${taulesPublic.length + taulesPortal.length - permeses.length}) no respon al client: permís denegat${fuites.length ? ` (${fuites.join(', ')})` : ''}`);
  const permesesBuides = [];
  for (const t of ['client_vincles', 'clients', 'client_enviaments']) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=id`, { headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Accept-Profile': 'portal' } });
    const files = await r.json();
    permesesBuides.push(`${t}:${files.length}`);
  }
  const clientsVisibles = await (await fetch(`${URL}/rest/v1/clients?select=id,nom_mostrat`, { headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Accept-Profile': 'portal' } })).json();
  comprova(clientsVisibles.length === 2 && clientsVisibles.every((c) => [CA.id, CB.id].includes(c.id)), 'portal.clients: només els seus dos clients (RLS)');
  const ambCamps = await fetch(`${URL}/rest/v1/clients?select=referencia_client`, { headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Accept-Profile': 'portal' } });
  comprova(ambCamps.status === 401 || ambCamps.status === 403, 'portal.clients: cap altra columna que el nom');
  const ins = await fetch(`${URL}/rest/v1/profiles`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: claims(JWT_U1).sub, email: E1, nom: 'x' }) });
  comprova(ins.status === 401 || ins.status === 403, 'No pot crear-se una fitxa a public.profiles');
  const sol = await fetch(`${URL}/rest/v1/solicituds`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ nom: 'x', email: `sol-${sufix}@test.local` }) });
  comprova(sol.status === 401 || sol.status === 403, 'Ni escriure a public.solicituds');
  const fnsAuth = sql(`select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                       where n.nspname in ('portal', 'public') and has_function_privilege('authenticated', p.oid, 'EXECUTE')`).split(',');
  let fnsObertes = [];
  for (const f of fnsAuth) {
    const esquema = sql(`select n.nspname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where p.proname = '${f}' limit 1`);
    const r = await fetch(`${URL}/rest/v1/rpc/${f}`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Content-Type': 'application/json', 'Content-Profile': esquema }, body: '{}' });
    const cos = await r.json().catch(() => ({}));
    // 401/403 = permís denegat; 404 amb PGRST202 = la funció no existeix per a aquest rol
    if (!(r.status === 401 || r.status === 403 || (r.status === 404 && cos.code === 'PGRST202') || cos.code === '42501')) fnsObertes.push(`${f}:${r.status}`);
  }
  comprova(fnsObertes.length === 0, `Cap de les ${fnsAuth.length} funcions de portal i public que pot cridar authenticated no la pot cridar el client${fnsObertes.length ? ` (${fnsObertes.join(', ')})` : ''}`);
  const st = await cli.storage.from('portal-docs').list('requests', { limit: 5 });
  comprova(!st.data?.length, 'Storage portal-docs: el client no hi veu res');
  const stS = await cli.storage.from('portal-docs').createSignedUrl(sql(`select storage_path from portal.documents where id = '${docs.pdp.did}'`), 60);
  comprova(!stS.data?.signedUrl, 'Storage portal-docs: el client no pot generar URL signades');
  const stE = await cli.storage.from('client-enviaments').list('enviaments', { limit: 5 });
  comprova(!stE.data?.length, 'Storage client-enviaments: el client no hi llista res');
  const gql = await fetch(`${URL}/graphql/v1`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: '{ __typename }' }) });
  comprova(gql.status !== 200 || !(await gql.json()).data, 'GraphQL: sense accés');
  for (const [f, cos] of [['portal-enllac', { request_id: crypto.randomUUID() }], ['portal-personal', { accio: 'llistar' }], ['portal-remesa', {}],
    ['portal-kyc-personal', { accio: 'crea', client_id: CA.id }], ['portal-irpf-personal', {}], ['portal-contracte-personal', {}],
    ['portal-requeriment', {}], ['portal-client-personal', { accio: 'llista', client_id: CA.id }], ['aprovar-solicitud', { solicitud_id: crypto.randomUUID() }]]) {
    const r = await crida(f, cos, { jwt: JWT_U1 });
    comprova(r.status === 401 || r.status === 403, `${f}: el client no hi té accés (${r.status})`);
  }
  // Ni amb el rol authenticated (si el hook fallés): no pot ser personal ni Zona Professionals
  const errAlta = await crida('portal-personal', { accio: 'alta', email: E1 }, { jwt: ocic.jwt });
  comprova(errAlta.status === 403 && /àrea de client/.test(errAlta.cos.error || ''), 'L\'OCIC no pot donar d\'alta com a gestor un usuari de client');
  let errProf = null;
  try { sql(`insert into public.profiles (id, email, nom) values ('${claims(JWT_U1).sub}', '${E1}', 'x');`); } catch (e) { errProf = e.message; }
  comprova(/àrea de client/.test(errProf || ''), 'Ni la base (com a postgres) no deixa crear-li una fitxa de la Zona Professionals');

  seccio('Separació de comptes: el personal i la Zona Professionals no fan servir l\'àrea');
  for (const [nom, jwt] of [['El personal (gestor)', info.jwt], ['L\'OCIC', ocic.jwt], ['Un usuari de la Zona Professionals', pro.jwt]]) {
    comprova((await area({ accio: 'inici' }, jwt)).status === 403, `${nom}: portal-client-area → 403`);
    const r = await fetch(`${URL}/rest/v1/rpc/client_inici`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', 'Content-Profile': 'portal' }, body: '{}' });
    comprova(r.status !== 200, `${nom}: no pot cridar client_inici (${r.status})`);
    comprova(claims(jwt).role === 'authenticated', `${nom}: el hook no li canvia el rol`);
  }
  comprova((await acces({ accio: 'completa' }, pro.jwt)).status === 401, 'La Zona Professionals no pot completar cap activació');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Enviar documents');
  const fx = {
    pdf: { nom: 'Factura.pdf', dades: F.pdf() },
    docx: { nom: 'Contracte.docx', dades: F.docx() },
    png: { nom: 'Rebut.png', dades: F.png() },
    csv: { nom: 'Moviments.csv', dades: F.csv() },
    xlsx: { nom: 'Balanç.xlsx', dades: F.xlsx() },
    doc: { nom: 'Antic.doc', dades: F.doc() },
    xls: { nom: 'Antic.xls', dades: F.xls() },
    jpg: { nom: 'Foto.jpg', dades: F.jpg() },
  };
  rebuts.length = 0;
  const ok1 = await envia(JWT_U1, { destinatari: D.info.id, fitxers: Object.values(fx) });
  comprova(ok1.c?.status === 200, 'Enviament a info@ amb PDF, DOCX, PNG, CSV, XLSX, DOC, XLS i JPG');
  const env1 = ok1.id;
  comprova(sql(`select estat from portal.client_enviaments where id = '${env1}'`) === 'enviat', 'Estat: enviat');
  comprova(sql(`select bool_and(sha256 is not null) from portal.client_enviament_fitxers where enviament_id = '${env1}'`) === 't', 'Empremta SHA-256 de cada fitxer');
  await espera(300);
  comprova(rebuts.length === 1 && rebuts[0].ruta === '/f/prova-info', 'Avís pel formulari d\'info@ (FORMSPREE_FORM_ID_INFO)');
  const cosAvis = JSON.parse(rebuts[0]?.cos || '{}');
  comprova(JSON.stringify(cosAvis) === JSON.stringify({ _subject: 'Nou enviament de documents al portal',
    message: 'Heu rebut un enviament de documents al portal d\'ÀMBIT Associats. Podeu consultar-lo a https://www.ambit.ad/portal' }),
  'Avís amb el text exacte del fitxer i res més');
  const avisText = rebuts[0]?.cos || '';
  comprova(![E1, 'Usuària', CA.nom_mostrat, 'Factures', 'Factura.pdf', env1, CA.id, U1].some((x) => avisText.includes(x)), 'L\'avís no porta cap dada (ni client, ni usuari, ni assumpte, ni fitxers, ni identificadors)');
  rebuts.length = 0;
  const ok2 = await envia(JWT_U1, { destinatari: D.mpaleari.id, assumpte: 'Per a mpaleari', fitxers: [fx.pdf] });
  await espera(300);
  comprova(ok2.c?.status === 200 && rebuts.length === 1 && rebuts[0].ruta === '/f/prova-mpaleari', 'Enviament a mpaleari@: avís pel seu formulari');
  const env2 = ok2.id;
  const ok3 = await envia(JWT_U1, { client: CB.id, destinatari: D.info.id, assumpte: 'Del client B', fitxers: [fx.csv] });
  comprova(ok3.c?.status === 200, 'Enviament en nom del client B (segon client)');

  const mds = await envia(JWT_U1, { destinatari: D.mdelsoto.id, fitxers: [fx.pdf] });
  comprova(mds.p.status === 400 && mds.p.cos.error === 'No disponible temporalment / Temporarily unavailable', 'mdelsoto@ (inactiu): no seleccionable, amb «No disponible temporalment / Temporarily unavailable»');
  comprova((await envia(JWT_U1, { client: CC.id, destinatari: D.info.id, fitxers: [fx.pdf] })).p.status === 403, 'No es pot enviar en nom d\'un client no vinculat');
  comprova((await envia(JWT_U1, { destinatari: D.info.id, assumpte: '', fitxers: [fx.pdf] })).p.status === 400, 'Assumpte obligatori');
  comprova((await envia(JWT_U1, { destinatari: D.info.id, assumpte: 'x'.repeat(121), fitxers: [fx.pdf] })).p.status === 400, 'Assumpte de més de 120 caràcters: rebutjat');
  comprova((await envia(JWT_U1, { destinatari: D.info.id, assumpte: 'x'.repeat(120), fitxers: [fx.pdf] })).c?.status === 200, 'Assumpte de 120 caràcters: acceptat');
  comprova((await envia(JWT_U1, { destinatari: D.info.id, fitxers: [] })).p.status === 400, 'Sense fitxers: rebutjat');
  for (const nom of ['dades.zip', 'programa.exe', 'macro.xlsm', 'web.html', 'sense-extensio']) {
    comprova((await envia(JWT_U1, { destinatari: D.info.id, fitxers: [{ nom, dades: F.pdf() }] })).p.status === 400, `Tipus no admès: ${nom}`);
  }
  const gran = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.info.id, assumpte: 'Gran', fitxers: [{ nom: 'gran.pdf', mida: 20 * 1024 * 1024 + 1 }] }, JWT_U1);
  comprova(gran.status === 400, 'Fitxer de més de 20 MB: rebutjat');
  const massa = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.info.id, assumpte: 'Massa',
    fitxers: Array.from({ length: 6 }, (_, i) => ({ nom: `f${i}.pdf`, mida: 18 * 1024 * 1024 })) }, JWT_U1);
  comprova(massa.status === 400, 'Enviament de més de 100 MB: rebutjat');
  const massa2 = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.info.id, assumpte: 'Massa fitxers',
    fitxers: Array.from({ length: 21 }, (_, i) => ({ nom: `f${i}.pdf`, mida: 10 })) }, JWT_U1);
  comprova(massa2.status === 400, 'Més de 20 fitxers: rebutjat');

  // Contingut real
  const falsos = [
    ['PNG amb extensió .pdf', { nom: 'fals.pdf', dades: F.png() }],
    ['ZIP amb extensió .docx', { nom: 'fals.docx', dades: F.zip([{ nom: 'a.txt', dades: 'a' }]) }],
    ['DOCX amb macros', { nom: 'macros.docx', dades: F.docx([{ nom: 'word/vbaProject.bin', dades: 'x' }]) }],
    ['Executable amb extensió .pdf', { nom: 'virus.pdf', dades: F.exe() }],
    ['PDF amb /Launch', { nom: 'accio.pdf', dades: F.pdf('/OpenAction << /S /Launch >>') }],
    ['XLS que és un DOC', { nom: 'fals.xls', dades: F.doc() }],
  ];
  for (const [nom, f] of falsos) {
    const r = await envia(JWT_U1, { destinatari: D.info.id, assumpte: `Fals ${nom}`, fitxers: [fx.png, f] });
    const id = r.id;
    comprova(r.c?.status === 422 && sql(`select estat from portal.client_enviaments where id = '${id}'`) === 'rebutjat', `${nom}: rebutjat en comprovar el contingut`);
    const restants = sql(`select count(*) from storage.objects where bucket_id = 'client-enviaments' and name like 'enviaments/${id}/%'`);
    comprova(restants === '0', `${nom}: cap fitxer de l'enviament no queda al bucket`);
  }
  // Pujar més del que s'havia declarat (o un fitxer diferent) no passa
  const p21 = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.info.id, assumpte: 'Mida', fitxers: [{ nom: 'a.pdf', mida: 100 }] }, JWT_U1);
  const st21 = await puja(p21.cos.pujades[0], Buffer.concat([F.pdf(), Buffer.alloc(20 * 1024 * 1024)]));
  comprova(st21 >= 400, `Storage rebutja un fitxer de més de 20 MB (${st21})`);
  comprova((await area({ accio: 'confirma', enviament_id: p21.cos.enviament_id }, JWT_U1)).status === 422, 'Sense el fitxer: enviament rebutjat');
  const pNo = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.info.id, assumpte: 'Sense pujar', fitxers: [{ nom: 'a.pdf', mida: 100 }] }, JWT_U1);
  comprova((await area({ accio: 'confirma', enviament_id: pNo.cos.enviament_id }, JWT_U1)).status === 422, 'Confirmar sense pujar res: rebutjat');
  comprova((await area({ accio: 'confirma', enviament_id: env1 }, JWT_U1)).status === 404, 'Un enviament ja enviat no es torna a confirmar');
  const pPend = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.info.id, assumpte: 'Pujada no acabada', fitxers: [{ nom: 'a.pdf', mida: F.pdf().length }] }, JWT_U1);
  await puja(pPend.cos.pujades[0], F.pdf());
  const envPend = pPend.cos.enviament_id;

  // Destinatari que es desactiva entre preparar i confirmar
  const pDes = await area({ accio: 'prepara', client_id: CA.id, destinatari_id: D.mpaleari.id, assumpte: 'Desactivat', fitxers: [{ nom: 'a.pdf', mida: F.pdf().length }] }, JWT_U1);
  await puja(pDes.cos.pujades[0], F.pdf());
  await ocic.c.schema('portal').rpc('client_destinatari_actualitza', { p_id: D.mpaleari.id, p_actiu: false });
  const cDes = await area({ accio: 'confirma', enviament_id: pDes.cos.enviament_id }, JWT_U1);
  comprova(cDes.status === 422 && /No disponible temporalment/.test(cDes.cos.error), 'Destinatari desactivat abans de confirmar: rebutjat');
  await ocic.c.schema('portal').rpc('client_destinatari_actualitza', { p_id: D.mpaleari.id, p_actiu: true });

  // Un altre usuari de client no pot confirmar l'enviament d'U1
  // (U4: usuari actiu del client A)
  const E4 = `client4-${sufix}@test.local`;
  const a4 = await personalCrida({ accio: 'afegeix', client_id: CA.id, nom: 'Usuari U4', email: E4 }, info.jwt);
  const U4 = a4.cos.usuari_id;
  const act4 = await activa((await personalCrida({ accio: 'convida', usuari_id: U4 }, info.jwt)).cos.enllac);
  comprova(act4.fi?.status === 200, 'U4 activat (segon usuari del client A)');
  const JWT_U4 = act4.jwt;
  comprova((await area({ accio: 'confirma', enviament_id: envPend }, JWT_U4)).status === 404, 'Un altre usuari no pot confirmar l\'enviament d\'U1');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Els meus enviaments');
  const me1 = await area({ accio: 'enviaments', client_id: CA.id }, JWT_U1);
  comprova(me1.status === 200 && me1.cos.enviaments.length === 3, `U1 veu els seus 3 enviaments enviats del client A (${me1.cos.enviaments?.length})`);
  const fila = me1.cos.enviaments.find((e) => e.id === env1);
  comprova(fila && fila.assumpte === 'Factures d\'octubre' && fila.destinatari === 'info@ambit.ad' && fila.n_fitxers === 8 && fila.estat === 'enviat' && fila.data,
    'Data, assumpte, destinatari, nombre de fitxers i estat «Enviat»');
  comprova(!('fitxers' in fila) && !JSON.stringify(me1.cos).includes('storage_path'), 'Sense descàrrega dels fitxers enviats');
  comprova((await area({ accio: 'enviaments', client_id: CB.id }, JWT_U1)).cos.enviaments.length === 1, 'Del client B, només el del client B');
  comprova((await area({ accio: 'enviaments', client_id: CA.id }, JWT_U4)).cos.enviaments.length === 0, 'U4 (mateix client) no veu els enviaments d\'U1');
  comprova((await area({ accio: 'enviaments', client_id: CC.id }, JWT_U1)).status === 403, 'Client no vinculat: 403');
  const dirEnv = await (await fetch(`${URL}/rest/v1/client_enviaments?select=id,comentari`, { headers: { apikey: ANON, Authorization: `Bearer ${JWT_U1}`, 'Accept-Profile': 'portal' } })).status;
  comprova(dirEnv === 401 || dirEnv === 403, 'Directament: no pot llegir el comentari ni altres columnes');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Panell del personal: documents rebuts (opció B)');
  const veu = async (s) => (await s.c.schema('portal').from('client_enviaments').select('id').in('id', [env1, env2])).data.map((x) => x.id);
  comprova((await veu(info)).join() === env1, 'info@ veu el seu enviament i no el de mpaleari@');
  comprova((await veu(ocic)).sort().join() === [env1, env2].sort().join(), 'L\'OCIC (mpaleari@) veu tots dos');
  comprova((await veu(gestorX)).length === 0, 'Un gestor que no és destinatari no en veu cap');
  const { data: fitxersInfo } = await info.c.schema('portal').from('client_enviament_fitxers').select('id, nom_fitxer, sha256').eq('enviament_id', env1).order('ordre');
  comprova(fitxersInfo.length === 8, 'info@ veu els 8 fitxers del seu enviament');
  const { data: fitxersX } = await gestorX.c.schema('portal').from('client_enviament_fitxers').select('id').eq('enviament_id', env1);
  comprova(fitxersX.length === 0, '… i el gestor no destinatari, cap');
  const desc = await personalCrida({ accio: 'descarrega', fitxer_id: fitxersInfo[0].id }, info.jwt);
  comprova(desc.status === 200 && desc.cos.nom_fitxer === 'Factura.pdf', 'Descàrrega per info@ (URL signada)');
  const baixat = Buffer.from(await (await fetch(publica(desc.cos.url))).arrayBuffer());
  comprova(sha256(baixat) === fitxersInfo[0].sha256 && sha256(baixat) === sha256(fx.pdf.dades), 'El fitxer descarregat és idèntic (SHA-256)');
  comprova(/[?&]token=/.test(desc.cos.url) && sql(`select count(*) from portal.audit_log where accio = 'DESCARREGA' and entitat_id = '${fitxersInfo[0].id}'`) === '1', 'URL signada i descàrrega registrada a audit_log');
  comprova((await personalCrida({ accio: 'descarrega', fitxer_id: fitxersInfo[0].id }, gestorX.jwt)).status === 404, 'El gestor no destinatari no la pot descarregar');
  const { data: f2 } = await ocic.c.schema('portal').from('client_enviament_fitxers').select('id').eq('enviament_id', env2);
  comprova((await personalCrida({ accio: 'descarrega', fitxer_id: f2[0].id }, info.jwt)).status === 404, 'info@ no pot descarregar el de mpaleari@');
  comprova((await personalCrida({ accio: 'descarrega', fitxer_id: f2[0].id }, ocic.jwt)).status === 200, 'L\'OCIC sí');
  comprova((await personalCrida({ accio: 'descarrega', fitxer_id: fitxersInfo[0].id }, JWT_U1)).status === 403, 'El client no pot fer servir el panell');
  const arxX = await gestorX.c.schema('portal').rpc('client_enviament_arxiva', { p_enviament_id: env1 });
  comprova(arxX.error?.code === '42501', 'El gestor no destinatari no el pot arxivar');
  const arx = await info.c.schema('portal').rpc('client_enviament_arxiva', { p_enviament_id: env1 });
  comprova(!arx.error && sql(`select estat || ' ' || (arxivat_per = '${idInfo}') from portal.client_enviaments where id = '${env1}'`) === 'arxivat true', '«Descarregat i arxivat» per info@ (consta qui i quan)');
  comprova((await info.c.schema('portal').rpc('client_enviament_arxiva', { p_enviament_id: env1 })).error?.code === '42501', 'No s\'arxiva dues vegades');
  const me2 = await area({ accio: 'enviaments', client_id: CA.id }, JWT_U1);
  comprova(me2.cos.enviaments.find((e) => e.id === env1)?.estat === 'rebut' && me2.cos.enviaments.find((e) => e.id === env2)?.estat === 'enviat',
    'El client el veu com «Rebut per ÀMBIT»; l\'altre continua «Enviat»');
  const upd = await info.c.schema('portal').from('client_enviaments').update({ assumpte: 'canviat' }).eq('id', env2).select();
  comprova(upd.error || !upd.data?.length, 'El personal no modifica cap enviament directament');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Els meus documents');
  const dl = await area({ accio: 'documents', client_id: CA.id }, JWT_U1);
  const ids = (dl.cos.documents || []).map((d) => d.id);
  const esperats = [docs.contracte.did, docs.kycCopia.did, docs.pdp.did, docs.autoritzacio.did];
  comprova(dl.status === 200 && ids.length === 4 && esperats.every((x) => ids.includes(x)),
    'Només: contracte final signat, còpia per al client del KYC, protecció de dades i autorització de càrrec signades');
  for (const [nom, k] of [['versió interna del KYC (validat)', 'kycValidat'], ['KYC signat pel client', 'kycSignat'], ['evidències', 'kycEvidencies'],
    ['original del contracte', 'contracteOriginal'], ['comunicació IRPF signada', 'irpfSignat'], ['full intern de l\'IRPF', 'irpfIntern'],
    ['còpia IRPF', 'irpfCopia'], ['autorització anul·lada', 'anullada'], ['document d\'un altre client', 'altreClient']]) {
    comprova(!ids.includes(docs[k].did), `Mai: ${nom}`);
    comprova((await area({ accio: 'descarrega', document_id: docs[k].did }, JWT_U1)).status === 404, `Tampoc es pot descarregar: ${nom}`);
  }
  const dd1 = await area({ accio: 'descarrega', document_id: docs.contracte.did }, JWT_U1);
  comprova(dd1.status === 200 && /^Contracte-\d{4}-\d{2}-\d{2}\.pdf$/.test(dd1.cos.nom_fitxer), 'Descàrrega del contracte (URL signada)');
  const bDoc = Buffer.from(await (await fetch(publica(dd1.cos.url))).arrayBuffer());
  comprova(sha256(bDoc) === docs.contracte.sha, 'El document descarregat és el correcte');
  const exp = Number(new globalThis.URL(publica(dd1.cos.url)).searchParams.get('token') ? claims(new globalThis.URL(publica(dd1.cos.url)).searchParams.get('token')).exp : 0);
  comprova(exp && exp - Date.now() / 1000 <= 61, 'L\'URL caduca en 60 segons');
  comprova(sql(`select count(*) from portal.audit_log where accio = 'DESCARREGA_CLIENT' and entitat_id = '${docs.contracte.did}'`) === '1', 'Descàrrega registrada a audit_log');
  comprova((await area({ accio: 'documents', client_id: CB.id }, JWT_U1)).cos.documents.length === 0, 'Client B: cap document');
  comprova((await area({ accio: 'documents', client_id: CC.id }, JWT_U1)).status === 403, 'Client C (no vinculat): 403');
  sql(`set session_replication_role = replica; update portal.requests set bloquejat_at = now(), destruir_despres_de = now() + interval '3 years' where id = (select request_id from portal.documents where id = '${docs.pdp.did}');`);
  comprova(!(await area({ accio: 'documents', client_id: CA.id }, JWT_U1)).cos.documents.some((d) => d.id === docs.pdp.did), 'Un document bloquejat per conservació ja no hi surt');
  sql(`set session_replication_role = replica; update portal.requests set bloquejat_at = null, destruir_despres_de = null where id = (select request_id from portal.documents where id = '${docs.pdp.did}');`);
  comprova(sql(`select count(*) from portal.documents d join portal.requests r on r.id = d.request_id
                where portal.client_document_permes(r.document_type, d.kind) and (r.document_type = 'irpf_comunicacio' or d.kind in ('intern', 'validat'))`) === '0'
    && sql(`select portal.client_document_permes('irpf_comunicacio', k) from unnest(enum_range(null::portal.doc_kind)) k group by 1`) === 'f'
    && sql(`select portal.client_document_permes(t, 'intern') or portal.client_document_permes(t, 'validat') from unnest(enum_range(null::portal.document_type)) t group by 1`) === 'f',
  'Cap combinació de tipus permet mai l\'IRPF, el document intern ni el validat');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Condicions d\'ús: versió nova');
  sql(`update portal.client_condicions set vigent = false where vigent;
       insert into portal.client_condicions (versio, vigent) values ('CONDICIONS-AREA v2-prova', true);`);
  const iniV2 = await area({ accio: 'inici' }, JWT_U1);
  comprova(iniV2.status === 200 && iniV2.cos.cal_condicions === true && iniV2.cos.versio === 'CONDICIONS-AREA v2-prova', 'En el següent accés es demanen de nou');
  comprova((await area({ accio: 'enviaments', client_id: CA.id }, JWT_U1)).status === 409, 'Fins que no les accepta, cap accés a la informació');
  comprova((await area({ accio: 'documents', client_id: CA.id }, JWT_U1)).status === 409, '… ni als documents');
  comprova((await acces({ accio: 'accepta', versio: 'CONDICIONS-AREA v1' }, JWT_U1)).status === 400, 'Acceptar una versió que no és la vigent: rebutjat');
  comprova((await acces({ accio: 'accepta', versio: 'CONDICIONS-AREA v2-prova' }, JWT_U1)).status === 200, 'Accepta la versió nova');
  comprova((await area({ accio: 'documents', client_id: CA.id }, JWT_U1)).status === 200, 'Torna a tenir accés');
  comprova(sql(`select string_agg(versio, ',' order by acceptada_at) from portal.client_acceptacions where usuari_id = '${U1}'`) === 'CONDICIONS-AREA v1,CONDICIONS-AREA v2-prova', 'Historial de versions acceptades');
  sql(`update portal.client_condicions set vigent = false where vigent;
       update portal.client_condicions set vigent = true where versio = 'CONDICIONS-AREA v1';
       update portal.client_usuaris set condicions_versio = 'CONDICIONS-AREA v1' where condicions_versio = 'CONDICIONS-AREA v2-prova';`);

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Restablir l\'accés');
  const res1 = await personalCrida({ accio: 'restableix', usuari_id: U1 }, info.jwt);
  comprova(res1.status === 200 && (await acces({ accio: 'obre', token: res1.cos.enllac.split('#')[1] })).cos.motiu === 'restabliment', 'Enllaç de restabliment');
  comprova((await area({ accio: 'inici' }, JWT_U1)).status === 200, 'Mentre no es fa servir, l\'accés actual continua');
  const ra = await activa(res1.cos.enllac, 'Contrasenya-nova-U1-ok');
  comprova(ra.r.status === 200 && ra.fi.status === 200, 'Nova contrasenya i nou segon factor');
  comprova((await area({ accio: 'inici' }, JWT_U1)).status === 401, 'La sessió anterior queda tancada');
  comprova((await acces({ accio: 'entra', email: E1, contrasenya: PASS_CLIENT })).status === 401, 'La contrasenya anterior ja no serveix');
  const vellCodi = await entra(E1, SECRET_U1, 'Contrasenya-nova-U1-ok');
  comprova(vellCodi.r2?.status === 401, 'El segon factor anterior ja no serveix');
  sql(`update portal.client_usuaris set intents_fallits = 0 where id = '${U1}';`);
  SECRET_U1 = ra.secret;
  const nouAcc = await entra(E1, SECRET_U1, 'Contrasenya-nova-U1-ok');
  comprova(nouAcc.r2?.status === 200, 'Entra amb la contrasenya i el segon factor nous');
  JWT_U1 = nouAcc.jwt;
  comprova(sql(`select count(*) from auth.mfa_factors where user_id = '${userU1}'`) === '1', 'Només hi ha el factor nou');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Suspendre i revocar');
  comprova((await personalCrida({ accio: 'suspen', usuari_id: U4 }, info.jwt)).status === 200, 'Suspendre U4');
  comprova([401, 403].includes((await area({ accio: 'inici' }, JWT_U4)).status), 'Suspès: la sessió oberta ja no serveix');
  comprova((await acces({ accio: 'entra', email: E4, contrasenya: PASS_CLIENT })).status === 401, 'Suspès: no pot entrar');
  const userU4 = sql(`select user_id from portal.client_usuaris where id = '${U4}'`);
  comprova(sql(`select banned_until > now() from auth.users where id = '${userU4}'`) === 't', 'El compte d\'Auth queda bloquejat');
  comprova((await personalCrida({ accio: 'restableix', usuari_id: U4 }, info.jwt)).status === 403, 'Un usuari suspès no es pot restablir');
  comprova((await personalCrida({ accio: 'reactiva', usuari_id: U4 }, info.jwt)).status === 200, 'Reactivar U4');
  comprova((await entra(E4, act4.secret)).r2?.status === 200, 'Reactivat: torna a entrar');
  comprova((await personalCrida({ accio: 'revoca', usuari_id: U4 }, info.jwt)).status === 200, 'Revocar U4');
  comprova((await acces({ accio: 'entra', email: E4, contrasenya: PASS_CLIENT })).status === 401, 'Revocat: no pot entrar');
  comprova((await personalCrida({ accio: 'reactiva', usuari_id: U4 }, info.jwt)).status === 403, 'Un usuari revocat no es reactiva');
  comprova((await personalCrida({ accio: 'afegeix', client_id: CB.id, nom: 'U4', email: E4 }, info.jwt)).status === 403, 'Ni es torna a vincular');
  comprova(sql(`select count(*) from portal.client_vincles where usuari_id = '${U4}' and baixa_at is null`) === '0', 'Revocat: sense vincles actius');
  comprova(sql(`select string_agg(accio || ':' || coalesce(detalls -> 'canvis' -> 'estat' ->> 'despres', ''), ',' order by at) from portal.audit_log where entitat = 'client_usuaris' and entitat_id = '${U4}' and accio = 'UPDATE' and detalls -> 'canvis' ? 'estat'`)
    .includes('UPDATE:suspes'), 'Suspensió i revocació a audit_log');
  // Desvincular U1 del client B
  comprova((await personalCrida({ accio: 'desvincula', usuari_id: U1, client_id: CB.id }, info.jwt)).status === 200, 'Desvincular U1 del client B');
  comprova((await area({ accio: 'inici' }, JWT_U1)).cos.clients.length === 1, 'U1 ja només veu el client A');
  comprova((await area({ accio: 'enviaments', client_id: CB.id }, JWT_U1)).status === 403, 'i ja no hi té accés');

  // ═══════════════════════════════════════════════════════════════════════════
  seccio('Conservació (portal-purga)');
  const purga = (cos) => crida('portal-purga', cos, { origen: null, capcaleres: { 'x-portal-purga': SECRET_PURGA } });
  // env1: arxivat fa 31 dies → es destrueix; env2: rebut fa 91 dies → es destrueix;
  // env3 (client B): rebut fa 89 dies, no arxivat → es manté; envPend: pujada no acabada fa 2 dies → es destrueix
  const env3 = ok3.id;
  sql(`set session_replication_role = replica;
       update portal.client_enviaments set arxivat_at = now() - interval '31 days', created_at = now() - interval '40 days' where id = '${env1}';
       update portal.client_enviaments set created_at = now() - interval '91 days' where id = '${env2}';
       update portal.client_enviaments set created_at = now() - interval '89 days' where id = '${env3}';
       update portal.client_enviaments set created_at = now() - interval '2 days' where id = '${envPend}';`);
  // Arxivat fa 29 dies: es manté
  const ok4 = await envia(JWT_U1, { destinatari: D.info.id, assumpte: 'Arxivat fa 29 dies', fitxers: [fx.pdf] });
  await info.c.schema('portal').rpc('client_enviament_arxiva', { p_enviament_id: ok4.id });
  sql(`set session_replication_role = replica; update portal.client_enviaments set arxivat_at = now() - interval '29 days' where id = '${ok4.id}';`);
  // U4 revocat fa més de 3 anys
  sql(`set session_replication_role = replica; update portal.client_usuaris set revocat_at = now() - interval '3 years 1 day' where id = '${U4}';`);
  const sim = await purga({ simulacio: true });
  const aDest = (sim.cos.area_client?.enviaments_a_destruir || []).map((x) => x.enviament_id);
  comprova(sim.status === 200 && [env1, env2, envPend].every((x) => aDest.includes(x)) && ![env3, ok4.id].some((x) => aDest.includes(x)),
    'Simulació: arxivat fa 31 dies, rebut fa 91 dies i pujada no acabada; no els de 29 i 89 dies');
  comprova((sim.cos.area_client?.usuaris_a_destruir || []).some((u) => u.usuari_id === U4), 'Simulació: l\'usuari revocat fa més de 3 anys');
  const fitxersEnv1 = sql(`select count(*) from storage.objects where bucket_id = 'client-enviaments' and name like 'enviaments/${env1}/%'`);
  const p = await purga({ simulacio: false });
  comprova(p.status === 200 && [env1, env2, envPend].every((x) => p.cos.area_client.enviaments.includes(x)), `Destrucció executada (${p.status})`);
  for (const [nom, id] of [['arxivat fa 31 dies', env1], ['rebut fa 91 dies', env2], ['pujada no acabada', envPend]]) {
    comprova(sql(`select count(*) from storage.objects where bucket_id = 'client-enviaments' and name like 'enviaments/${id}/%'`) === '0', `${nom}: fitxers esborrats del bucket`);
    comprova(sql(`select estat || '|' || coalesce(usuari_id::text, '') || '|' || coalesce(client_id::text, '') || '|' || coalesce(assumpte, '') || '|' || coalesce(comentari, '') from portal.client_enviaments where id = '${id}'`) === 'destruit||||',
      `${nom}: registre sense usuari, client, assumpte ni comentari`);
  }
  comprova(fitxersEnv1 === '8', 'env1 tenia 8 fitxers al bucket');
  comprova(sql(`select count(*) || '|' || bool_and(nom_fitxer is null and storage_path is null and sha256 ~ '^[0-9a-f]{64}$' and destruit_at is not null) from portal.client_enviament_fitxers where enviament_id = '${env1}'`) === '8|true',
    'Registre mínim: 8 fitxers amb la seva empremta, sense nom ni camí');
  const destr = JSON.parse(sql(`select detalls from portal.audit_log where accio = 'DESTRUCCIO' and entitat = 'client_enviaments' and entitat_id = '${env1}'`));
  comprova(destr.n_fitxers === 8 && destr.fitxers.length === 8 && destr.rebut_at && destr.arxivat_at, 'Entrada DESTRUCCIO amb dates, nombre de fitxers i empremtes');
  const textDestr = JSON.stringify(destr);
  comprova(![E1, 'Usuària', 'Factures', 'Factura.pdf', CA.id, U1, userU1].some((x) => textDestr.includes(x)), '… sense cap dada personal');
  comprova(sql(`select count(*) from portal.audit_log where entitat in ('client_enviaments', 'client_enviament_fitxers') and entitat_id in (select '${env1}'::uuid union all select id from portal.client_enviament_fitxers where enviament_id = '${env1}') and accio <> 'DESTRUCCIO' and detalls is distinct from '{"purgat": true}'::jsonb`) === '0',
    'A audit_log, els detalls de l\'enviament i dels fitxers queden purgats');
  comprova(sql(`select string_agg(estat::text, ',' order by id) from portal.client_enviaments where id in ('${env3}', '${ok4.id}')`).split(',').every((x) => x !== 'destruit')
    && sql(`select count(*) from storage.objects where bucket_id = 'client-enviaments' and name like 'enviaments/${env3}/%'`) === '1', 'Els de 29 i 89 dies es mantenen, amb els fitxers');
  comprova(!(await area({ accio: 'enviaments', client_id: CA.id }, JWT_U1)).cos.enviaments.some((e) => [env1, env2].includes(e.id)), 'El client ja no els veu');
  comprova(sql(`select count(*) from portal.client_usuaris where id = '${U4}'`) === '0' && sql(`select count(*) from auth.users where id = '${userU4}'`) === '0',
    'Usuari revocat fa més de 3 anys: dades, registre d\'accessos i compte d\'Auth esborrats');
  comprova(sql(`select count(*) from portal.client_sessions s where s.usuari_id = '${U4}'`) === '0' && sql(`select count(*) from portal.audit_log where actor = '${userU4}' and entitat in ('client_usuaris', 'client_sessions') and detalls is distinct from '{"purgat": true}'::jsonb`) === '0',
    'Registre d\'accessos de l\'usuari: esborrat i purgat a audit_log');
  comprova(sql(`select count(*) from portal.client_comptes_a_esborrar`) === '0', 'Cap compte pendent d\'esborrar');
  const p2 = await purga({ simulacio: false });
  comprova(p2.status === 200 && p2.cos.area_client.enviaments.length === 0 && p2.cos.area_client.usuaris.length === 0, 'Segona execució: res més (idempotent)');
} finally {
  receptor.close();
}

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
