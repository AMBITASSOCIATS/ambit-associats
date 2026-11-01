// Proves per l'API (PostgREST) de les funcions SECURITY DEFINER del portal:
// un usuari de la Zona Professionals no n'obté cap dada; el personal, igual que abans.
// Requisits: `supabase start`.
// Execució: node supabase/tests/edge/funcions-personal.test.mjs
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.

import { execSync } from 'node:child_process';
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

// ─── Dades de prova ─────────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const correus = { gestor: `gestor-fp-${sufix}@test.local`, pro: `pro-fp-${sufix}@test.local` };

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

const idGestor = await creaUsuari(correus.gestor);
const idPro = await creaUsuari(correus.pro);
{
  const { error } = await adminPortal.from('staff_profiles').insert({ user_id: idGestor, role: 'gestor' });
  if (error) throw error;
  const { error: e2 } = await admin.from('profiles').insert({ id: idPro, email: correus.pro, nom: 'Pro', rol: 'individual', estat: 'actiu' });
  if (e2) throw e2;
}
const gestor = (await sessio(correus.gestor)).schema('portal');
const pro = await sessio(correus.pro);
const proPortal = pro.schema('portal');

const { data: client, error: errClient } = await gestor.from('clients')
  .insert({ party_type: 'pj', nom_mostrat: `Client FP ${sufix}`, referencia_client: `FP-${sufix % 1e9}` }).select('id').single();
if (errClient) throw errClient;
const { data: idKyc, error: errKyc } = await gestor.rpc('crea_kyc', { p_client_id: client.id });
if (errKyc) throw errKyc;

// ─── 1. Zona Professionals ──────────────────────────────────────────────────
seccio('Zona Professionals: cap dada');
const r = { p_request_id: idKyc };
const denegades = [
  ['kyc_participacions', r], ['kyc_be_no_declarats', r], ['kyc_paisos', r], ['kyc_marques', r],
  ['kyc_estat_documents', r], ['kyc_documents_requerits', r], ['kyc_documents_pendents', r],
  ['kyc_declaracions_completes', r], ['irpf_declaracions_completes', r], ['irpf_parametres_json', { p_exercici: 2025 }],
  ['contracte_recompte', r], ['llistes_vigents', {}],
  ['empremta_contrafirma', { ...r, p_nom: 'x', p_carrec: 'x', p_firma_sha256: 'a'.repeat(64), p_signat_at: new Date().toISOString() }],
];
for (const [f, args] of denegades) {
  const { data, error } = await proPortal.rpc(f, args);
  comprova(data == null && error?.code === '42501', `${f}: denegat (42501)`);
}
const bloqueig = [
  ['request_bloquejada', r], ['client_bloquejat', { p_client_id: client.id }],
  ['perceptor_bloquejat', { p_perceptor_id: client.id }], ['cami_bloquejat', { p_cami: `requests/${idKyc}/original/x.pdf` }],
  ['auditoria_bloquejada', { p_entitat: 'requests', p_entitat_id: idKyc, p_accio: 'UPDATE' }],
];
for (const [f, args] of bloqueig) {
  const { data, error } = await proPortal.rpc(f, args);
  comprova(!error && data === true, `${f}: sempre «bloquejat»`);
}
{
  const { data, error } = await proPortal.rpc('es_signant_ambit', { p_user: idGestor });
  comprova(!error && data === false, 'es_signant_ambit d\'un altre usuari: false');
  const { data: rol } = await proPortal.rpc('el_meu_rol');
  comprova(rol == null, 'el_meu_rol: cap rol');
  const { data: reqs, error: e2 } = await proPortal.from('requests').select('id');
  comprova(!e2 && reqs.length === 0, 'portal.requests: zero files, sense error');
  const { data: cli, error: e3 } = await proPortal.from('clients').select('id');
  comprova(!e3 && cli.length === 0, 'portal.clients: zero files, sense error');
  const { data: perfil, error: e4 } = await pro.from('profiles').select('estat').eq('id', idPro).single();
  comprova(!e4 && perfil.estat === 'actiu', 'La Zona Professionals continua funcionant (el seu perfil)');
}

// ─── 2. Personal ────────────────────────────────────────────────────────────
seccio('Personal: tot igual');
{
  const { data: m, error: e1 } = await gestor.rpc('kyc_marques', r);
  comprova(!e1 && Array.isArray(m), 'kyc_marques (fitxa del KYC)');
  const { data: d, error: e2 } = await gestor.rpc('kyc_estat_documents', r);
  comprova(!e2 && Array.isArray(d?.pendents), 'kyc_estat_documents (fitxa del KYC)');
  const { data: rol } = await gestor.rpc('el_meu_rol');
  comprova(rol === 'gestor', 'el_meu_rol');
  const { data: s, error: e3 } = await gestor.rpc('es_signant_ambit');
  comprova(!e3 && s === false, 'es_signant_ambit (un gestor no és el signant)');
  const { data: b, error: e4 } = await gestor.rpc('request_bloquejada', r);
  comprova(!e4 && b === false, 'request_bloquejada: la sol·licitud oberta no està bloquejada');
  const { data: reqs } = await gestor.from('requests').select('id').eq('id', idKyc);
  comprova(reqs?.length === 1, 'Veu la sol·licitud');
  const { data: cli } = await gestor.from('clients').select('id').eq('id', client.id);
  comprova(cli?.length === 1, 'Veu el client');
}

// ─── 3. Servidor ────────────────────────────────────────────────────────────
seccio('Servidor (service_role): tot igual');
{
  const { data, error } = await adminPortal.rpc('kyc_estat_documents', r);
  comprova(!error && Array.isArray(data?.requerits), 'kyc_estat_documents');
  const { data: l, error: e2 } = await adminPortal.rpc('llistes_vigents');
  comprova(!e2 && Array.isArray(l?.UE), 'llistes_vigents');
}

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
