// Proves locals de conservació: Edge Functions portal-purga i portal-requeriment.
// Requisits: `supabase start` i `supabase functions serve --env-file supabase/functions/.env`.
// Execució: node supabase/tests/edge/conservacio.test.mjs
// Les claus i el secret de purga es llegeixen sense imprimir-los.
// Per provar la destrucció avui, el termini de bloqueig es posa a 0 durant
// la prova (només a la base local) i es restaura en acabar.

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
const SECRET_PURGA = fs.readFileSync(new globalThis.URL('../../functions/.env', import.meta.url), 'utf8')
  .split('\n').find((l) => l.startsWith('PORTAL_PURGA_SECRET='))?.split('=')[1]?.trim();

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const adminPortal = admin.schema('portal');
const nouClient = () => createClient(URL, ANON, { auth: { persistSession: false } });

// SQL directe a la base local (com a postgres)
const sql = (q) => execSync('docker exec -i supabase_db_ambit-associats psql -U postgres -d postgres -X -A -t -q -v ON_ERROR_STOP=1',
  { input: q, encoding: 'utf8' }).trim();

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

// ─── Usuaris ────────────────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const correus = { ocic: `ocic-c-${sufix}@test.local`, gestor: `gestor-c-${sufix}@test.local` };
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
await adminPortal.from('staff_profiles').insert([{ user_id: idOcic, role: 'ocic' }, { user_id: idGestor, role: 'gestor' }]);
const ocic = await sessio(correus.ocic);
const gestor = await sessio(correus.gestor);
const jwtDe = async (c) => (await c.auth.getSession()).data.session.access_token;
const JWT_OCIC = await jwtDe(ocic);
const JWT_GESTOR = await jwtDe(gestor);

// ─── Firma de prova (PNG) ───────────────────────────────────────────────────
const pngFirma = () => {
  const w = 200, h = 60;
  const px = Buffer.alloc((w * 4 + 1) * h);
  for (let x = 10; x < w - 10; x++) {
    const y = Math.round(h / 2 + Math.sin(x / 12) * 15);
    const o = y * (w * 4 + 1) + 1 + x * 4;
    px[o] = 20; px[o + 1] = 40; px[o + 2] = 90; px[o + 3] = 255;
  }
  const crc = (buf) => {
    let c, v = 0xffffffff;
    for (const b of buf) { c = (v ^ b) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; v = (v >>> 8) ^ c; }
    return (v ^ 0xffffffff) >>> 0;
  };
  const chunk = (t, d) => {
    const l = Buffer.alloc(4); l.writeUInt32BE(d.length);
    const td = Buffer.concat([Buffer.from(t), d]);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
    return Buffer.concat([l, td, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(px)), chunk('IEND', Buffer.alloc(0))]);
};
const FIRMA = `data:image/png;base64,${pngFirma().toString('base64')}`;

const crida = async (funcio, cos, { jwt = ANON, origen = 'https://www.ambit.ad', capcaleres = {} } = {}) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: {
      ...(origen ? { Origin: origen } : {}),
      Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json', ...capcaleres,
    },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})) };
};
// secret = null: sense capçalera
const purga = (cos, secret = SECRET_PURGA, origen = null) =>
  crida('portal-purga', cos, { origen, capcaleres: secret === null ? {} : { 'x-portal-purga': secret } });

// Autorització signada (sense activar)
const autoritzacioSignada = async (nom, referencia) => {
  const p = gestor.schema('portal');
  const { data: cli } = await p.from('clients').insert({ party_type: 'pf', nom_mostrat: nom, referencia_client: referencia }).select('id').single();
  const { data: sol } = await p.from('requests')
    .insert({ client_id: cli.id, document_type: 'autoritzacio_carrec', template_version: 'ABA-01 v1', idioma: 'ca' }).select('id').single();
  const e = await crida('portal-enllac', { request_id: sol.id }, { jwt: JWT_GESTOR });
  const token = e.cos.enllac.split('/signar/')[1];
  const s = await crida('portal-signar', {
    accio: 'signar', token, titular_nom: nom, titular_adreca: 'Carrer de la Prova, 3',
    titular_cp_poblacio: 'AD500 Andorra la Vella', iban: 'AD1200012030200359100100',
    signatari_nom: nom, lloc: 'Andorra la Vella', signatura_png: FIRMA,
  });
  if (s.status !== 200) throw new Error(`signatura ${s.status} ${s.cos.error}`);
  return { requestId: sol.id, clientId: cli.id, token };
};

// Autorització signada, activada i retirada fa temps (conservar_fins ja passat)
const autoritzacioRetirada = async (nom, referencia) => {
  const p = gestor.schema('portal');
  const { requestId, clientId, token } = await autoritzacioSignada(nom, referencia);
  const sol = { id: requestId }, cli = { id: clientId };
  const { error: e1 } = await p.rpc('activa_autoritzacio', { p_request_id: sol.id, p_data_alta: '2023-06-01' });
  const { error: e2 } = await p.rpc('retira_autoritzacio', { p_request_id: sol.id, p_data_retirada: '2024-01-01', p_motiu: 'Prova' });
  if (e1 || e2) throw e1 || e2;
  return { requestId: sol.id, clientId: cli.id, token };
};
const fitxersDe = async (requestId) => {
  const out = [];
  for (const sub of ['signat', 'evidencies', 'adjunts', 'altres']) {
    const { data } = await admin.storage.from('portal-docs').list(`requests/${requestId}/${sub}`);
    for (const f of data || []) out.push(`requests/${requestId}/${sub}/${f.name}`);
  }
  return out;
};
const termini = (interval) => sql(`update portal.config_conservacio set termini_bloqueig = interval '${interval}';`);
const terminiNoSignades = (interval) => sql(`update portal.config_conservacio set termini_no_signades = interval '${interval}';`);

try {
  // ═════════════════════════════════════════════════════════════════════════
  seccio('Preparació');
  const A = await autoritzacioRetirada('Titular Destruccio A', `CA${String(sufix).slice(-8)}`);
  const B = await autoritzacioRetirada('Titular Retencio B', `CB${String(sufix).slice(-8)}`);
  comprova(true, 'Dues autoritzacions signades, activades i retirades el 01/01/2024');
  const fitxersA = await fitxersDe(A.requestId);
  comprova(fitxersA.length === 2, 'A té 2 fitxers a portal-docs (PDF i firma)');
  // Fitxer sense registrar (com si una signatura hagués fallat a mitges)
  await admin.storage.from('portal-docs').upload(`requests/${B.requestId}/altres/orfe.pdf`, Buffer.from('%PDF-orfe'), { contentType: 'application/pdf' });
  comprova((await fitxersDe(B.requestId)).length === 3, 'B té 3 fitxers (un sense registrar)');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('portal-purga: accés');
  comprova(!!SECRET_PURGA && SECRET_PURGA.length >= 32, 'Hi ha secret de purga local (no es mostra)');
  comprova((await purga({ simulacio: true }, null)).status === 401, 'Sense secret → 401');
  comprova((await purga({ simulacio: true }, 'x'.repeat(64))).status === 401, 'Secret incorrecte → 401');
  comprova((await purga({ simulacio: true }, SECRET_PURGA, 'https://malicios.example')).status === 403, 'Origen no permès → 403');
  comprova((await crida('portal-purga', { simulacio: false }, { jwt: JWT_OCIC })).status === 401, 'La sessió d\'un OCIC no serveix: cal el secret');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Simulació');
  const sim = await purga({});
  const idsSim = (sim.cos.a_bloquejar || []).map((x) => x.request_id);
  comprova(sim.status === 200 && sim.cos.simulacio === true, 'Sense indicar res, és una simulació');
  comprova(idsSim.includes(A.requestId) && idsSim.includes(B.requestId), 'La simulació llista A i B per bloquejar');
  comprova(!JSON.stringify(sim.cos).includes('Titular'), 'La simulació no inclou noms');
  const { data: despresSim } = await adminPortal.from('requests').select('bloquejat_at').in('id', [A.requestId, B.requestId]);
  comprova(despresSim.every((r) => r.bloquejat_at === null), 'La simulació no ha canviat res');
  comprova((await fitxersDe(A.requestId)).length === 2, 'La simulació no ha esborrat cap fitxer');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Bloqueig');
  termini('0');  // destruïbles avui mateix (només en aquesta prova local)
  sql(`begin; set local role service_role; select count(*) from portal.bloqueja_vencudes(false); commit;`);
  const { data: bloq } = await adminPortal.from('requests').select('id, bloquejat_at, destruir_despres_de').in('id', [A.requestId, B.requestId]);
  comprova(bloq.every((r) => r.bloquejat_at && r.destruir_despres_de), 'A i B bloquejades');

  const { data: vistaGestor } = await gestor.schema('portal').from('requests').select('id').in('id', [A.requestId, B.requestId]);
  comprova(vistaGestor.length === 0, 'El gestor ja no les veu');
  const { data: vistaOcic } = await ocic.schema('portal').from('requests').select('id').in('id', [A.requestId, B.requestId]);
  comprova(vistaOcic.length === 0, 'L\'OCIC tampoc les veu al panell normal');
  const { data: urlG } = await gestor.storage.from('portal-docs').createSignedUrl(fitxersA[0], 60);
  comprova(!urlG, 'El personal ja no pot descarregar-ne els fitxers');
  const rem = await crida('portal-remesa', {}, { jwt: JWT_GESTOR });
  comprova(!rem.cos.csv?.includes('Titular Destruccio A'), 'No surten a la remesa');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Accés per requeriment d\'autoritat');
  const rq1 = await crida('portal-requeriment', { request_id: A.requestId, motiu: 'x', autoritat: 'Batllia' }, { jwt: JWT_GESTOR });
  comprova(rq1.status === 403, 'Un gestor no hi té accés');
  const rq2 = await crida('portal-requeriment', { request_id: A.requestId, motiu: '', autoritat: 'Batllia' }, { jwt: JWT_OCIC });
  comprova(rq2.status === 400, 'Sense motiu → rebutjat');
  const rq3 = await crida('portal-requeriment', { request_id: A.requestId, motiu: 'Diligències 7/2026', autoritat: '' }, { jwt: JWT_OCIC });
  comprova(rq3.status === 400, 'Sense autoritat → rebutjat');
  const rq = await crida('portal-requeriment', { request_id: A.requestId, motiu: 'Diligències 7/2026', autoritat: 'Batllia d\'Andorra' }, { jwt: JWT_OCIC });
  comprova(rq.status === 200 && rq.cos.dades?.autoritzacio?.titular_nom === 'Titular Destruccio A', 'L\'OCIC accedeix a les dades amb motiu i autoritat');
  const docPdf = rq.cos.dades?.documents?.find((d) => d.kind === 'signat');
  const baixat = docPdf?.url ? Buffer.from(await (await fetch(publica(docPdf.url))).arrayBuffer()) : Buffer.alloc(0);
  comprova(baixat.length > 0 && sha256(baixat) === docPdf.sha256, 'Pot descarregar el PDF (URL de 60 s) i l\'empremta coincideix');
  const { data: audReq } = await adminPortal.from('audit_log').select('actor, detalls').eq('accio', 'ACCES_REQUERIMENT').eq('entitat_id', A.requestId);
  comprova(audReq.length === 1 && audReq[0].actor === idOcic && audReq[0].detalls.autoritat === 'Batllia d\'Andorra', 'L\'accés queda a audit_log');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Retenció');
  const { error: errRet } = await ocic.schema('portal').rpc('activa_retencio', { p_request_id: B.requestId, p_motiu: 'Reclamació de prova' });
  comprova(!errRet, 'L\'OCIC activa una retenció sobre B');
  const { error: errRetG } = await gestor.schema('portal').rpc('activa_retencio', { p_request_id: A.requestId, p_motiu: 'x' });
  comprova(!!errRetG, 'Un gestor no pot activar retencions');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Destrucció (amb una execució interrompuda a mitges)');
  // Simula una execució anterior que va esborrar els fitxers d'A i es va aturar
  await admin.storage.from('portal-docs').remove(fitxersA);
  comprova((await fitxersDe(A.requestId)).length === 0, 'Fitxers d\'A esborrats, files encara presents (execució interrompuda)');
  const { data: encara } = await adminPortal.from('requests').select('id').eq('id', A.requestId);
  comprova(encara.length === 1, 'La sol·licitud A encara existeix');

  const p1 = await purga({ simulacio: false });
  comprova(p1.status === 200 && p1.cos.destruides?.includes(A.requestId), 'L\'execució següent acaba la destrucció d\'A');
  comprova(!p1.cos.destruides?.includes(B.requestId), 'B no es destrueix: té una retenció activa');

  const taules = ['autoritzacions_carrec', 'signatures', 'documents', 'access_tokens', 'otps'];
  let queda = 0;
  for (const t of taules) queda += (await adminPortal.from(t).select('id').eq('request_id', A.requestId)).data.length;
  queda += (await adminPortal.from('requests').select('id').eq('id', A.requestId)).data.length;
  queda += (await adminPortal.from('clients').select('id').eq('id', A.clientId)).data.length;
  comprova(queda === 0, 'A: cap fila a cap taula del portal (ni el client)');
  comprova((await fitxersDe(A.requestId)).length === 0, 'A: cap fitxer a portal-docs');
  const { data: audA } = await adminPortal.from('audit_log').select('accio, detalls').in('entitat_id', [A.requestId, A.clientId]).neq('accio', 'DESTRUCCIO');
  comprova(audA.length > 0 && audA.every((x) => JSON.stringify(x.detalls) === '{"purgat":true}'), 'A: auditoria amb {"purgat": true}');
  const { data: des } = await adminPortal.from('audit_log').select('detalls').eq('accio', 'DESTRUCCIO').eq('entitat_id', A.requestId);
  const textDes = JSON.stringify(des?.[0]?.detalls || {});
  comprova(des.length === 1, 'A: una entrada DESTRUCCIO');
  comprova(!/Titular|Carrer|Andorra la Vella|AD12|0100|CA\d{8}|requests\//.test(textDes), 'DESTRUCCIO sense dades personals');
  comprova(des[0].detalls.fitxers?.length === 2 && des[0].detalls.fitxers.every((f) => /^[0-9a-f]{64}$/.test(f.sha256)),
    'DESTRUCCIO amb les empremtes SHA-256 dels 2 fitxers');
  const { data: totAudit } = await adminPortal.from('audit_log').select('detalls');
  comprova(!JSON.stringify(totAudit).includes('Titular Destruccio A'), 'Cap entrada d\'audit_log conserva el nom de A');

  const p2 = await purga({ simulacio: false });
  const { data: des2 } = await adminPortal.from('audit_log').select('id').eq('accio', 'DESTRUCCIO').eq('entitat_id', A.requestId);
  comprova(p2.status === 200 && p2.cos.destruides.length === 0 && des2.length === 1, 'Idempotent: una nova execució no fa res ni duplica DESTRUCCIO');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Retirar la retenció');
  const { error: errRetira } = await ocic.schema('portal').rpc('retira_retencio', { p_request_id: B.requestId, p_motiu: 'Reclamació resolta' });
  comprova(!errRetira, 'L\'OCIC retira la retenció de B');
  const p3 = await purga({ simulacio: false });
  comprova(p3.cos.destruides?.includes(B.requestId), 'Sense retenció, B es destrueix');
  comprova((await fitxersDe(B.requestId)).length === 0, 'B: també s\'ha esborrat el fitxer sense registrar');
  const { data: desB } = await adminPortal.from('audit_log').select('detalls').eq('accio', 'DESTRUCCIO').eq('entitat_id', B.requestId);
  comprova(desB?.[0]?.detalls?.fitxers_destruits === 3, 'DESTRUCCIO de B compta els 3 fitxers');
  const { data: retB } = await adminPortal.from('audit_log').select('detalls').eq('entitat', 'retencions');
  comprova(retB.length > 0 && retB.every((x) => JSON.stringify(x.detalls) === '{"purgat":true}'), 'Les retencions de B també queden purgades a audit_log');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Signada i mai activada: anul·lació per l\'OCIC');
  const C = await autoritzacioSignada('PROVA · NO VÀLIDA (local)', `PV${String(sufix).slice(-8)}`);
  const anulla = (c, cos) => c.schema('portal').from('requests').update(cos).eq('id', C.requestId);
  const a1 = await anulla(gestor, { status: 'anullat', motiu_anullacio: 'Motiu' });
  comprova(!!a1.error, 'Un gestor no la pot anul·lar');
  const a2 = await anulla(ocic, { status: 'anullat' });
  comprova(!!a2.error && /motiu/.test(a2.error.message), 'L\'OCIC sense motiu no la pot anul·lar');
  const a3 = await anulla(ocic, { status: 'anullat', motiu_anullacio: 'Prova del circuit, no vàlida' });
  comprova(!a3.error, 'L\'OCIC amb motiu sí');
  const { data: cAnul } = await adminPortal.from('requests').select('status, anullat_at, motiu_anullacio').eq('id', C.requestId).single();
  comprova(cAnul.status === 'anullat' && !!cAnul.anullat_at && cAnul.motiu_anullacio === 'Prova del circuit, no vàlida', 'Anul·lada amb data del sistema i motiu');
  const simC = await purga({});
  comprova(!(simC.cos.a_bloquejar || []).some((x) => x.request_id === C.requestId), 'Avui encara no venç (12 mesos)');
  terminiNoSignades('0');  // només en aquesta prova local
  const pC = await purga({ simulacio: false });
  comprova(pC.cos.destruides?.includes(C.requestId), 'Passat el termini, es bloqueja i es destrueix com les altres anul·lades');
  comprova((await fitxersDe(C.requestId)).length === 0, 'Sense fitxers a portal-docs');

  // ═════════════════════════════════════════════════════════════════════════
  seccio('Execució diària (pg_cron → pg_net → portal-purga)');
  comprova(sql(`select count(*) from cron.job where jobname = 'portal-purga-diaria'`) === '1', 'Tasca programada cada dia a les 03:30 UTC');
  // Secrets a Vault només en local, per provar el camí complet; s'esborren en acabar
  sql(`select vault.create_secret('http://kong:8000/functions/v1/portal-purga', 'portal_purga_url');`);
  execSync('docker exec -i supabase_db_ambit-associats psql -U postgres -d postgres -X -A -t -q -v ON_ERROR_STOP=1 -v s="$S"',
    { env: { ...process.env, S: SECRET_PURGA }, input: "select vault.create_secret(:'s', 'portal_purga_secret');", encoding: 'utf8', stdio: ['pipe', 'ignore', 'inherit'] });
  const idPeticio = sql(`select portal.llanca_purga();`);
  comprova(/^\d+$/.test(idPeticio), 'portal.llanca_purga() envia la petició (pg_net)');
  let estat = '';
  for (let i = 0; i < 30 && !estat; i++) {
    await espera(1000);
    estat = sql(`select status_code from net._http_response where id = ${idPeticio}`);
  }
  comprova(estat === '200', `La crida de pg_cron arriba a portal-purga i respon 200 (${estat || 'sense resposta'})`);
} finally {
  termini('3 years');
  terminiNoSignades('12 months');
  sql(`delete from vault.secrets where name in ('portal_purga_url', 'portal_purga_secret');`);
  await adminPortal.from('limit_intents').delete().neq('clau', '');
}

console.log(`\n${total - fallades}/${total} correctes`);
console.log(fallades ? `${fallades} proves han fallat` : 'Totes les proves han passat');
process.exit(fallades ? 1 : 0);
