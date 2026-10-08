// Prova local de l'avís de Formspree que envia portal-signar en signar.
// Comprova el cos exacte i que no porta cap dada del client ni cap identificador.
//
// Requisits: `supabase start` i les funcions servides amb un receptor local en
// lloc de Formspree (no s'envia res a fora):
//   supabase functions serve --env-file <fitxer>
// on <fitxer> és supabase/functions/.env més aquestes dues línies:
//   FORMSPREE_FORM_ID=prova-local
//   FORMSPREE_BASE_URL=http://host.docker.internal:54399/f/
// Execució: node supabase/tests/edge/avis-formspree.test.mjs

import { execSync } from 'node:child_process';
import http from 'node:http';
import { deflateSync } from 'node:zlib';
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
const admin = createClient(URL, env.SERVICE_ROLE_KEY, { auth: { persistSession: false } });

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};

// ─── Receptor local que fa de Formspree ─────────────────────────────────────
const rebuts = [];
const receptor = http.createServer((req, res) => {
  let cos = '';
  req.on('data', (c) => { cos += c; });
  req.on('end', () => {
    rebuts.push({ ruta: req.url, metode: req.method, cos });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true}');
  });
});
await new Promise((r) => receptor.listen(54399, '0.0.0.0', r));

// ─── Dades de prova ─────────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const NOM = `Client Avís Prova ${sufix}`;
const REFERENCIA = `AV${String(sufix).slice(-8)}`;
const IBAN = 'AD1200012030200359100100';

const email = `gestor-avis-${sufix}@test.local`;
const { data: u } = await admin.auth.admin.createUser({ email, password: PASS, email_confirm: true });
await admin.schema('portal').from('staff_profiles').insert({ user_id: u.user.id, role: 'gestor' });
const gestor = createClient(URL, ANON, { auth: { persistSession: false } });
await gestor.auth.signInWithPassword({ email, password: PASS });
const jwt = (await gestor.auth.getSession()).data.session.access_token;

const p = gestor.schema('portal');
const { data: cli } = await p.from('clients').insert({ party_type: 'pf', nom_mostrat: NOM, referencia_client: REFERENCIA }).select('id').single();
const { data: sol } = await p.from('requests')
  .insert({ client_id: cli.id, document_type: 'autoritzacio_carrec', template_version: 'ABA-01 v1', idioma: 'ca' }).select('id').single();

const crida = async (funcio, cos, token = ANON) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: { Origin: 'https://www.ambit.ad', Authorization: `Bearer ${token}`, apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})) };
};

// Firma de prova (PNG)
const png = (() => {
  const w = 120, h = 40;
  const px = Buffer.alloc((w * 4 + 1) * h);
  for (let x = 5; x < w - 5; x++) { const o = 20 * (w * 4 + 1) + 1 + x * 4; px[o + 3] = 255; }
  const crc = (b) => { let c, v = 0xffffffff; for (const x of b) { c = (v ^ x) & 0xff; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; v = (v >>> 8) ^ c; } return (v ^ 0xffffffff) >>> 0; };
  const ch = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(w, 0); ih.writeUInt32BE(h, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ch('IHDR', ih), ch('IDAT', deflateSync(px)), ch('IEND', Buffer.alloc(0))]);
})();

try {
  const e = await crida('portal-enllac', { request_id: sol.id }, jwt);
  const token = e.cos.enllac?.split('/signar/')[1];
  const s = await crida('portal-signar', {
    accio: 'signar', token, titular_nom: NOM, titular_adreca: 'Carrer de la Prova, 9',
    titular_cp_poblacio: 'AD500 Andorra la Vella', iban: IBAN,
    signatari_nom: NOM, lloc: 'Andorra la Vella', signatura_png: `data:image/png;base64,${png.toString('base64')}`,
  });
  comprova(s.status === 200, 'La signatura de prova s\'ha registrat');

  for (let i = 0; i < 30 && rebuts.length === 0; i++) await new Promise((r) => setTimeout(r, 500));
  comprova(rebuts.length === 1, 'S\'ha enviat exactament un avís (al receptor local, no a Formspree)');
  const avis = rebuts[0] || { cos: '{}' };
  const cos = JSON.parse(avis.cos || '{}');

  comprova(avis.metode === 'POST' && avis.ruta === '/f/prova-local', 'POST al formulari configurat');
  comprova(JSON.stringify(cos) === JSON.stringify({
    _subject: 'Nova autorització signada al portal',
    name: 'Portal de signatura',
    email: 'info@ambit.ad',
    message: 'S\'ha signat una nova autorització de càrrec en compte al portal de signatura d\'ÀMBIT Associats.\n\n' +
      'Podeu consultar-la a https://www.ambit.ad/portal',
  }), 'El cos és exactament el text fix (assumpte, nom, correu i missatge)');
  comprova(!/[—–]/.test(avis.cos), 'Sense guions llargs');

  // Cap dada del client ni cap identificador
  const pla = avis.cos;
  comprova(!pla.includes(NOM) && !pla.includes('Client Avís Prova'), 'El cos no conté el nom del client');
  comprova(!pla.includes(REFERENCIA), 'El cos no conté la referència del client');
  comprova(!pla.includes(sol.id) && !pla.includes(cli.id), 'El cos no conté l\'id de la sol·licitud ni del client');
  comprova(!pla.includes(IBAN) && !pla.includes('AD12 0001') && !pla.includes('0100'), 'El cos no conté l\'IBAN ni els seus 4 últims dígits');
  comprova(!pla.includes('Carrer de la Prova') && !pla.includes(token || '---'), 'El cos no conté l\'adreça ni el token');
  comprova(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(pla), 'El cos no conté cap identificador (UUID)');
} finally {
  receptor.close();
}

console.log(`\n${total - fallades}/${total} correctes`);
console.log(fallades ? `${fallades} proves han fallat` : 'Totes les proves han passat');
process.exit(fallades ? 1 : 0);
