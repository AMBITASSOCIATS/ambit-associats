// Proves locals de la comunicació de dades personals i familiars al pagador
// (IRPF): Edge Functions portal-irpf, portal-irpf-personal i portal-enllac,
// amb fitxers reals, PDF i avís de Formspree.
//
// Requisits: `supabase start` i les funcions servides amb un receptor local
// en lloc de Formspree (no s'envia res a fora):
//   supabase functions serve --env-file <fitxer>
// on <fitxer> és supabase/functions/.env més aquestes dues línies:
//   FORMSPREE_FORM_ID=prova-local
//   FORMSPREE_BASE_URL=http://host.docker.internal:54399/f/
// i, per provocar una fallada en generar el PDF (capçalera x-portal-prova-falla):
//   PORTAL_PROVES_FALLADA=1
// Execució: node supabase/tests/edge/irpf.test.mjs [carpeta-per-als-pdf]
// Les claus locals es llegeixen de `supabase status -o env` i no s'imprimeixen.
// Totes les dades són fictícies.

import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { deflateSync } from 'node:zlib';
import http from 'node:http';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';

const env = Object.fromEntries(
  execSync('supabase status -o env', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
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

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const adminPortal = admin.schema('portal');
const nouClient = () => createClient(URL, ANON, { auth: { persistSession: false } });
const T = JSON.parse(fs.readFileSync(new globalThis.URL('../../functions/_shared/text-irpf.json', import.meta.url)));

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
const AVUI = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });
const ANY = Number(AVUI.slice(0, 4));
const mesSeguent = (s) => { const [a, m] = s.split('-').map(Number); return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`; };

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
const esperaAvisos = async (n) => { for (let i = 0; i < 40 && avisos.length < n; i++) await espera(250); };

// ─── Usuaris ────────────────────────────────────────────────────────────────
const sufix = Date.now();
const PASS = 'Prova-1234-local';
const correus = { ocic: `ocic-i-${sufix}@test.local`, gestor: `gestor-i-${sufix}@test.local`, web: `web-i-${sufix}@test.local` };
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
const gestor = await sessio(correus.gestor);
const web = await sessio(correus.web);
const jwtDe = async (c) => (await c.auth.getSession()).data.session.access_token;
const JWT_GESTOR = await jwtDe(gestor);
const JWT_WEB = await jwtDe(web);
const gp = gestor.schema('portal');

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

// ─── Crides ─────────────────────────────────────────────────────────────────
const crida = async (funcio, cos, { jwt = ANON, origen = 'https://www.ambit.ad', falla = null } = {}) => {
  const r = await fetch(`${URL}/functions/v1/${funcio}`, {
    method: 'POST',
    headers: {
      ...(origen ? { Origin: origen } : {}),
      ...(falla ? { 'x-portal-prova-falla': falla } : {}),
      Authorization: `Bearer ${jwt}`, apikey: ANON, 'Content-Type': 'application/json',
      'User-Agent': 'Prova-local/1.0 (irpf.test.mjs)',
    },
    body: JSON.stringify(cos),
  });
  return { status: r.status, cos: await r.json().catch(() => ({})), cors: r.headers.get('access-control-allow-origin'), metodes: r.headers.get('access-control-allow-methods') };
};
const irpf = (token, cos, opts = {}) => crida('portal-irpf', { token, ...cos }, opts);
const personal = (cos, jwt = JWT_GESTOR, opts = {}) => crida('portal-irpf-personal', cos, { jwt, ...opts });
// Missatge de qualsevol error no previst (mai l'error real)
const ERROR_DOCUMENT = 'No s\'ha pogut generar el document. Torneu-ho a provar més tard. / The document could not be generated. Please try again later.';
// En local el gateway (Kong) posa sempre Access-Control-Allow-Origin: *; es comprova que hi són
// les capçaleres CORS de la mateixa funció (a producció, l'origen permès)
const errorNet = (r) => r.status === 500 && r.cos.error === ERROR_DOCUMENT && Object.keys(r.cos).length === 1 && r.cors !== null && r.metodes === 'POST, OPTIONS';
// Fitxers d'una sol·licitud al bucket (totes les carpetes)
const fitxers = async (requestId) => {
  let n = 0;
  for (const c of ['evidencies', 'signat', 'copia-client', 'intern', 'adjunts', 'validat']) {
    const { data } = await admin.storage.from('portal-docs').list(`requests/${requestId}/${c}`, { limit: 1000 });
    n += (data || []).filter((f) => f.id).length;
  }
  return n;
};
const enllac = async (requestId) => {
  const r = await crida('portal-enllac', { request_id: requestId }, { jwt: JWT_GESTOR });
  return { ...r, token: r.cos.enllac?.split('/irpf#')[1] };
};
const estat = async (id) => (await adminPortal.from('requests').select('status').eq('id', id).single()).data?.status;
const desa = (b, nom) => { if (CARPETA_PDF) fs.writeFileSync(`${CARPETA_PDF}/${nom}`, b); return b; };
const baixaUrl = async (url, nom) => desa(Buffer.from(await (await fetch(publica(url))).arrayBuffer()), nom);
const baixaDoc = async (requestId, kind, nom) => {
  const { data: d } = await adminPortal.from('documents').select('storage_path, sha256').eq('request_id', requestId).eq('kind', kind)
    .order('created_at', { ascending: false }).limit(1).single();
  const { data } = await admin.storage.from('portal-docs').download(d.storage_path);
  const b = Buffer.from(await data.arrayBuffer());
  return { b: desa(b, nom), sha: d.sha256 };
};

// Paraula clau del PDF (irpf-perceptor, irpf-copia o irpf-intern)
const clauPdf = (b) => {
  const m = b.toString('latin1').match(/\/Keywords\s*<([0-9A-Fa-f]+)>/);
  if (!m) return null;
  const buf = Buffer.from(m[1], 'hex');
  let t = '';
  for (let i = 2; i + 1 < buf.length; i += 2) t += String.fromCharCode(buf.readUInt16BE(i));
  return t;
};
// Imatges del PDF: cada firma PNG porta la imatge i la seva màscara de transparència (SMask)
const imatges = (b) => {
  const t = b.toString('latin1');
  return (t.match(/\/Subtype\s*\/Image/g) || []).length - (t.match(/\/SMask\s+\d+\s+0\s+R/g) || []).length;
};
const teJpeg = (b) => /\/DCTDecode/.test(b.toString('latin1'));   // el logotip d'ÀMBIT és un JPEG
const fontsPdf = (b) => [...new Set((b.toString('latin1').match(/\/BaseFont\s*\/([A-Za-z0-9+_-]+)/g) || []).map((x) => x.split('/').pop()))];

// Text de cada pàgina amb la posició i la mida (pdf.js)
const llegeixPdf = async (b) => {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(b), useSystemFonts: false, isEvalSupported: false }).promise;
  const pagines = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    const c = await p.getTextContent();
    const items = c.items.filter((x) => x.str.trim()).map((x) => ({ t: x.str, y: x.transform[5], x: x.transform[4], mida: Math.round(Math.abs(x.transform[0]) * 10) / 10, font: x.fontName }));
    pagines.push({ items, text: items.map((x) => x.t).join(' ').replace(/\s+/g, ' ') });
  }
  return { pagines, text: pagines.map((p) => p.text).join(' ') };
};

// Barres de secció: català dels títols dels apartats i de les barres fixes
const BARRES = [
  ...Object.keys(T).filter((k) => /^s\d+$/.test(k)).map((k) => `${k.slice(1)}. ${T[k].titol.ca}`),
  'Full d’evidències de la signatura', 'Recepció pel pagador', 'Full intern · càlcul del percentatge de retenció', 'Resultat',
  'Passos del càlcul (art. 24.1 del Reglament)', 'Reduccions familiars per persona',
];
// Una barra és "sola al peu" si no hi ha cap text per sota seu abans del peu (y > 80)
const barresSoles = (pdf) => {
  let n = 0;
  for (const p of pdf.pagines) {
    const cos = p.items.filter((x) => x.y > 80);
    const darrer = cos.reduce((a, x) => (!a || x.y < a.y ? x : a), null);
    if (!darrer) continue;
    const barra = cos.find((x) => (BARRES.includes(x.t) || /^Paràmetres de l’exercici \d{4}$/.test(x.t)) && Math.abs(x.y - darrer.y) < 16);
    if (barra && cos.filter((x) => x.y < barra.y - 4).length === 0) n++;
  }
  return n;
};

// Format comú (apartat H): capçalera del pagador sense logotip, títol, peu i n/N
const comprovaFormat = async (b, nom, pagador, nSignatures) => {
  const pdf = await llegeixPdf(b);
  const N = pdf.pagines.length;
  const peuCa = `Document gestionat per DEL SOTO – PALEARI & ASSOCIATS, SL per compte de ${pagador.denominacio}`;
  const peuEn = `Document managed by DEL SOTO – PALEARI & ASSOCIATS, SL on behalf of ${pagador.denominacio}`;
  comprova(pdf.pagines.every((p) => p.text.includes(pagador.denominacio) && p.text.includes(`NRT ${pagador.nrt}`)),
    `${nom}: a cada pàgina, la denominació i l'NRT del pagador a la capçalera`);
  comprova(pdf.pagines.every((p) => p.text.includes('COMUNICACIÓ DE DADES PERSONALS I FAMILIARS AL PAGADOR') && p.text.includes('COMMUNICATION OF PERSONAL AND FAMILY DATA')),
    `${nom}: títol a la dreta i subtítol en anglès a cada pàgina`);
  comprova(pdf.pagines.every((p, i) => p.text.includes(peuCa) && p.text.includes(peuEn) && p.text.includes(`${i + 1}/${N}`)
    && p.text.includes('info@ambit.ad · +376 655 382') && p.text.includes('NRT L-720543-P')),
  `${nom}: peu "Document gestionat per … per compte de ${pagador.denominacio}", contacte d'ÀMBIT i n/N (${N} pàgines)`);
  comprova(!teJpeg(b) && imatges(b) === nSignatures, `${nom}: cap logotip; només les imatges de les ${nSignatures} signatures`);
  const fonts = fontsPdf(b);
  // pdf-lib anomena els subconjunts "Carlito-NNNN", "Carlito-Bold-NNNN" i "Carlito-Italic-NNNN"
  comprova(fonts.length === 3 && fonts.every((f) => /^Carlito(-Bold|-Italic)?-\d+$/.test(f)),
    `${nom}: només Carlito incrustat, regular, negreta i cursiva (${fonts.map((f) => f.replace(/-\d+$/, '')).join(', ')})`);
  comprova(barresSoles(pdf) === 0, `${nom}: cap barra de secció sola al peu d'una pàgina`);
  return pdf;
};

const nouClientPortal = async (tipus, nom) => {
  const { data, error } = await gp.from('clients').insert({ party_type: tipus, nom_mostrat: nom, referencia_client: `IR${String(sufix).slice(-6)}${tipus}` }).select('id').single();
  if (error) throw error;
  return data.id;
};

// Respostes del perceptor
const resp = (nom, nrt, extra = {}) => ({
  comunicacio: { tipus: 'inicial', modifica: [] },
  perceptor: { nom, nrt, document: 'Passaport X1234567', domicili: 'Carrer de la Prova, 3, AD500 Andorra la Vella', email: 'perceptor@test.local', telefon: '+376 600 000', incapacitat: false },
  estat_civil: { estat: 'solter', des_de: '' },
  descendents: [], ascendents: [], tutelats: [],
  altres: {},
  data_efectes: `${ANY}-01-01`,
  declaracions: { d1: true, d2: true, d3: true, d4: true },
  ...extra,
});

// ════════════════════════════════════════════════════════════════════════════
try {
  const PAGADOR = { denominacio: 'Pagadora Prova Andorra, SL', nrt: 'L-799999-Z', domicili: 'Av. Meritxell, 100, AD500 Andorra la Vella' };
  const clientId = await nouClientPortal('pj', 'Pagadora Prova Andorra, SL');
  // Per defecte, perceptors nous que comencen avui (la comunicació inicial es rep dins del termini de l'art. 31.a)
  const crea = async (perceptor, pagador = PAGADOR) => {
    const p = perceptor.id ? perceptor : { inici_relacio: AVUI, ...perceptor };
    const { data, error } = await gp.rpc('irpf_crea', { p_client_id: clientId, p_perceptor: p, p_pagador: pagador });
    if (error) throw error;
    return data;
  };
  const PDF = {};

  // ─── 1. Perceptor solter ─────────────────────────────────────────────────
  seccio('Perceptor solter: comunicació inicial, signatura i recepció pel pagador');
  const idSolter = await crea({ nom: 'Jordi Solter Prova', nrt: 'F-100001-A', email: 'jordi.solter@test.local' });
  comprova(await estat(idSolter) === 'esborrany', 'El personal crea la comunicació des del client pagador');
  const e1 = await enllac(idSolter);
  comprova(e1.status === 200 && e1.cos.destinatari === 'perceptor' && /\/irpf#[A-Za-z0-9_-]{43}$/.test(e1.cos.enllac), 'Enllaç del perceptor /irpf#<token>');
  comprova(await estat(idSolter) === 'enviat', 'Enviada');
  const tok = e1.token;

  const ob = await irpf(tok, { accio: 'obrir' });
  comprova(ob.status === 200 && ob.cos.mode === 'perceptor' && ob.cos.pagador.nrt === PAGADOR.nrt, 'Obrir: mode perceptor, amb les dades del pagador');
  comprova(ob.cos.dades?.perceptor?.nom === 'Jordi Solter Prova' && ob.cos.dades?.comunicacio?.tipus === 'inicial', 'Preomplerta: nom del perceptor i comunicació inicial');
  comprova(await estat(idSolter) === 'en_curs', 'En curs');
  comprova(!JSON.stringify(ob.cos).includes(idSolter), 'La resposta al perceptor no conté l\'identificador de la sol·licitud');

  // Lògica condicional al servidor: sense estat casat no es desa el cònjuge
  const d1 = await irpf(tok, { accio: 'desa', dades: resp('Jordi Solter Prova', 'F-100001-A', { conjuge: { nom: 'No hauria de quedar', situacio: 'a' } }) });
  comprova(d1.status === 200, 'Desada automàtica');
  const { data: k1 } = await adminPortal.from('irpf_comunicacions').select('dades').eq('request_id', idSolter).single();
  comprova(k1.dades.conjuge === undefined, 'Solter: no es desa cap dada del cònjuge (apartat 4 només si està casat/ada)');

  const incomplet = await irpf(tok, { accio: 'signar', dades: { ...resp('Jordi Solter Prova', 'F-100001-A'), perceptor: { nom: 'Jordi Solter Prova' } },
    lloc: 'Andorra la Vella', signatura: dataUrl(firma(1)) });
  comprova(incomplet.status === 400 && incomplet.cos.pendents?.some((p) => p.camp === 'perceptor.document'), 'Signar amb camps obligatoris pendents → 400 amb la llista');
  const senseLloc = await irpf(tok, { accio: 'signar', dades: resp('Jordi Solter Prova', 'F-100001-A'), signatura: dataUrl(firma(1)) });
  comprova(senseLloc.status === 400, 'Sense lloc de signatura → 400');

  const s1 = await irpf(tok, { accio: 'signar', dades: resp('Jordi Solter Prova', 'F-100001-A'), lloc: 'Andorra la Vella', signatura: dataUrl(firma(1)) });
  comprova(s1.status === 200 && s1.cos.rebuda === false && s1.cos.pdf?.url, 'Signa el perceptor; queda pendent de la recepció');
  comprova(await estat(idSolter) === 'signat', 'Estat: signat (pendent de recepció pel pagador)');
  const pdfSolterSignat = await baixaUrl(s1.cos.pdf.url, 'irpf-1-solter-signat-perceptor.pdf');
  comprova(sha256(pdfSolterSignat) === s1.cos.pdf.sha256, 'El PDF descarregat té l\'empremta registrada');
  comprova(clauPdf(pdfSolterSignat) === 'irpf-perceptor', 'Versió del perceptor');
  PDF.solterSignat = await comprovaFormat(pdfSolterSignat, 'PDF signat (solter)', PAGADOR, 1);
  {
    const cos = PDF.solterSignat.pagines[0].items.find((x) => x.t === 'D\'acord');
    const en = PDF.solterSignat.pagines[0].items.find((x) => x.t === 'Under');
    comprova(cos?.mida === 12 && en?.mida < 12, `Cos de 12 punts en català (${cos?.mida}) i l'anglès a sota, més petit (${en?.mida})`);
  }
  comprova((await irpf(tok, { accio: 'obrir' })).status === 404, 'L\'enllaç del perceptor queda consumit');

  // Aviso de Formspree: text fix, sense cap dada
  await esperaAvisos(1);
  comprova(avisos.length === 1 && avisos[0].ruta === '/f/prova-local', 'Un sol avís a ÀMBIT, al receptor local (no a Formspree)');
  comprova(JSON.stringify(JSON.parse(avisos[0]?.cos || '{}')) === JSON.stringify({
    _subject: 'Nova comunicació de dades IRPF signada al portal',
    name: 'Portal de signatura',
    email: 'info@ambit.ad',
    message: 'S\'ha signat una nova comunicació de dades personals i familiars al pagador al portal de signatura d\'ÀMBIT Associats.\n\n' +
      'Podeu consultar-la a https://www.ambit.ad/portal',
  }), 'L\'avís és exactament el text fix');

  // Recepció pel representant del pagador
  const e2 = await enllac(idSolter);
  comprova(e2.status === 200 && e2.cos.destinatari === 'recepcio', 'Enllaç del representant del pagador (comunicació signada)');
  const ob2 = await irpf(e2.token, { accio: 'obrir' });
  comprova(ob2.status === 200 && ob2.cos.mode === 'recepcio' && ob2.cos.signatura?.signatari_nom === 'Jordi Solter Prova', 'El representant veu la comunicació signada');
  comprova((await irpf(e2.token, { accio: 'desa', dades: resp('Altre', 'X') })).status === 404, 'Amb l\'enllaç de recepció no es poden canviar les respostes');
  comprova((await irpf(e2.token, { accio: 'signar_recepcio', nom: 'Gerent Prova', signatura: dataUrl(firma(2)) })).status === 400, 'Sense càrrec → 400');
  const r1 = await irpf(e2.token, { accio: 'signar_recepcio', nom: 'Marta Gerent Prova', carrec: 'Gerent', signatura: dataUrl(firma(2)) });
  comprova(r1.status === 200 && r1.cos.pdf?.url, 'El representant signa la recepció (apartat 12)');
  comprova(await estat(idSolter) === 'actiu', 'Estat: rebuda pel pagador');
  const pdfSolterCopia = await baixaUrl(r1.cos.pdf.url, 'irpf-1-solter-copia-perceptor.pdf');
  comprova(clauPdf(pdfSolterCopia) === 'irpf-copia', 'Còpia final per al perceptor');
  PDF.solterCopia = await comprovaFormat(pdfSolterCopia, 'Còpia (solter)', PAGADOR, 2);
  comprova(PDF.solterCopia.text.includes('Marta Gerent Prova · Gerent') && PDF.solterCopia.text.includes('Recepció pel pagador'),
    'La còpia porta la recepció signada i les seves evidències');
  await esperaAvisos(2);
  const av2 = JSON.parse(avisos[1]?.cos || '{}');
  comprova(av2._subject === 'Recepció d\'una comunicació de dades IRPF signada al portal' && av2.email === 'info@ambit.ad', 'Segon avís (recepció), també fix');

  // Cap dada a cap avís
  for (const a of avisos) {
    const pla = a.cos;
    if ([PAGADOR.denominacio, PAGADOR.nrt, 'Jordi', 'F-100001-A', 'Marta', 'test.local', idSolter, clientId, tok, e2.token].some((x) => pla.includes(x))
      || /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(pla)) {
      comprova(false, 'Un avís conté dades');
    }
  }
  comprova(true, 'Formspree: cap avís conté noms, NRT, correus, identificadors ni tokens');

  // ─── 2. Càlcul i PDF intern ──────────────────────────────────────────────
  seccio('Càlcul del percentatge (exemple de la plantilla) i PDF intern d\'ÀMBIT');
  // Paràmetres de l'exercici en curs, a partir dels de 2025 (el personal els crea)
  {
    const { data: p25 } = await gp.from('irpf_parametres').select('*').eq('exercici', 2025).single();
    const fila = { ...p25 };
    for (const k of ['id', 'actualitzat_per', 'created_at', 'updated_at']) delete fila[k];
    if (ANY !== 2025) await gp.from('irpf_parametres').insert({ ...fila, exercici: ANY });
  }
  const web403 = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY}-01-01`, retribucions: '60000' }, JWT_WEB);
  comprova(web403.status === 403, 'Un usuari de la web no pot calcular');
  const prev = await personal({ accio: 'calcula', request_id: idSolter, previsualitza: true, data_efectes: `${ANY}-01-01`, retribucions: '60.000,00', cotitzacions: '0' });
  comprova(prev.status === 200 && prev.cos.percentatge === '4.37' && !prev.cos.calcul_id, `Previsualització: 4,37 % (${prev.cos.percentatge}), sense desar`);
  const sense = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY + 5}-01-01`, retribucions: '60000' });
  comprova(sense.status === 409 && sense.cos.error === `Cal crear els paràmetres de l'exercici ${ANY + 5}`,
    `Exercici sense paràmetres → "Cal crear els paràmetres de l'exercici ${ANY + 5}" (no es calcula)`);
  const senseP = await personal({ accio: 'calcula', request_id: idSolter, previsualitza: true, data_efectes: `${ANY + 5}-01-01`, retribucions: '60000' });
  comprova(senseP.status === 409 && !senseP.cos.percentatge, 'Tampoc no es pot previsualitzar');
  const c1 = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY}-01-01`, retribucions: '60000', cotitzacions: '0' });
  comprova(c1.status === 200 && c1.cos.calcul_id && c1.cos.percentatge_aplicat === '4.37', 'Desa el càlcul: 4,37 %');
  const { data: fc1 } = await adminPortal.from('irpf_calculs').select('percentatge, percentatge_aplicat, detall, parametres, creat_per').eq('id', c1.cos.calcul_id).single();
  comprova(Number(fc1.percentatge) === 4.37 && fc1.detall.passos.length >= 11 && fc1.parametres.minim_personal == 24000 && fc1.creat_per === idGestor,
    'Desat amb la comunicació: percentatge, detall de cada pas, paràmetres aplicats i qui l\'ha fet');
  const pdfSolterIntern = await baixaUrl(c1.cos.pdf_intern.url, 'irpf-1-solter-intern-ambit.pdf');
  comprova(clauPdf(pdfSolterIntern) === 'irpf-intern', 'PDF intern d\'ÀMBIT');
  PDF.solterIntern = await comprovaFormat(pdfSolterIntern, 'PDF intern (solter)', PAGADOR, 2);
  comprova(PDF.solterIntern.text.includes('Full intern · càlcul del percentatge de retenció') && PDF.solterIntern.text.includes('4,37 %')
    && PDF.solterIntern.text.includes('Quota de liquidació'), 'El PDF intern porta el full del càlcul amb el detall de cada pas');
  const { data: docInt } = await adminPortal.from('documents').select('sha256').eq('request_id', idSolter).eq('kind', 'intern').single();
  comprova(docInt.sha256 === c1.cos.pdf_intern.sha256 && docInt.sha256 === sha256(pdfSolterIntern), 'El PDF intern queda registrat amb la seva empremta');

  seccio('La còpia del perceptor no conté mai el detall intern');
  for (const [nom, p] of [['PDF signat pel perceptor', PDF.solterSignat], ['Còpia amb la recepció', PDF.solterCopia]]) {
    comprova(!/Full intern|Passos del càlcul|Percentatge calculat|Paràmetres de l’exercici|Quota de liquidació/.test(p.text), `${nom}: sense el full intern ni cap pas del càlcul`);
  }
  comprova(!/4,37/.test(PDF.solterCopia.text), 'La còpia no conté el percentatge');
  // El perceptor no té cap via per obtenir el PDF intern
  comprova((await irpf(tok, { accio: 'obrir' })).status === 404 && (await irpf(e2.token, { accio: 'obrir' })).status === 404,
    'Els enllaços del perceptor i del representant ja no donen accés a res');

  // ─── 3. Casat amb dos fills i cònjuge en l'opció c ───────────────────────
  seccio('Perceptor casat, dos fills i cònjuge en l\'opció c)');
  const idCasat = await crea({ nom: 'Pere Casat Prova', nrt: 'F-100002-B', email: 'pere.casat@test.local' });
  const e3 = await enllac(idCasat);
  await irpf(e3.token, { accio: 'obrir' });
  const dadesCasat = resp('Pere Casat Prova', 'F-100002-B', {
    estat_civil: { estat: 'casat', des_de: '2015-06-20' },
    conjuge: { nom: 'Anna Cònjuge Prova', nrt: 'F-100012-C', document: 'Passaport Y7654321', situacio: 'c', rendes: '10.000,00' },
    descendents: [
      { id: crypto.randomUUID(), nom: 'Laia Casat Prova', any_naixement: String(ANY - 10), conviu: true, rendes_superiors: false, discapacitat: false, persones: '2' },
      { id: crypto.randomUUID(), nom: 'Marc Casat Prova', any_naixement: String(ANY - 20), conviu: true, rendes_superiors: false, discapacitat: false, persones: '2', matricules: '450' },
    ],
  });
  const sc = await irpf(e3.token, { accio: 'signar', dades: { ...dadesCasat, conjuge: { ...dadesCasat.conjuge, rendes: '' } }, lloc: 'Escaldes-Engordany', signatura: dataUrl(firma(3)) });
  comprova(sc.status === 400 && sc.cos.pendents?.some((p) => p.camp === 'conjuge.rendes'), 'Opció c) sense l\'import de les rendes del cònjuge → pendent');
  const sc2 = await irpf(e3.token, { accio: 'signar', dades: dadesCasat, lloc: 'Escaldes-Engordany', signatura: dataUrl(firma(3)) });
  comprova(sc2.status === 200, 'Signa el perceptor casat');
  PDF.casatSignat = await comprovaFormat(await baixaUrl(sc2.cos.pdf.url, 'irpf-2-casat-2fills-c-signat-perceptor.pdf'), 'PDF signat (casat)', PAGADOR, 1);
  comprova(PDF.casatSignat.text.includes('Anna Cònjuge Prova') && PDF.casatSignat.text.includes('10.000,00 €')
    && PDF.casatSignat.text.includes('Laia Casat Prova') && PDF.casatSignat.text.includes('Marc Casat Prova'), 'El PDF porta el cònjuge (opció c) i els dos fills');
  const e4 = await enllac(idCasat);
  const r4 = await irpf(e4.token, { accio: 'signar_recepcio', nom: 'Marta Gerent Prova', carrec: 'Gerent', signatura: dataUrl(firma(4)) });
  comprova(r4.status === 200 && await estat(idCasat) === 'actiu', 'Rebuda pel pagador');
  PDF.casatCopia = await comprovaFormat(await baixaUrl(r4.cos.pdf.url, 'irpf-2-casat-2fills-c-copia-perceptor.pdf'), 'Còpia (casat)', PAGADOR, 2);
  // Perceptor nou (inici de la relació avui) que comunica dins dels 10 dies: tot compta des de la data d'efectes
  const c3 = await personal({ accio: 'calcula', request_id: idCasat, data_efectes: `${ANY}-01-01`, retribucions: '60000', cotitzacions: '0' });
  // Mínim 24.000 + increment 6.000 (40.000 − 24.000 − 10.000); fills 500 + 500 + matrícules 300 ÷ 2 = 150; BL 27.050; QT 2.705 − 800
  comprova(c3.status === 200 && c3.cos.percentatge === '3.18' && c3.cos.detall.avisos.length === 0,
    `Càlcul: mínim 30.000 €, reduccions familiars 1.150 € (matrícules prorratejades: 150 €), 3,18 % (${c3.cos.percentatge}), sense avís`);
  comprova(c3.cos.detall.persones.find((x) => x.nom === 'Marc Casat Prova')?.matricules === 15000, 'Matrícules de 450 € → 300 € ÷ 2 persones amb dret = 150 €');
  const c3pdf = c3.cos.pdf_intern.url;
  PDF.casatIntern = await comprovaFormat(await baixaUrl(c3pdf, 'irpf-2-casat-2fills-c-intern-ambit.pdf'), 'PDF intern (casat)', PAGADOR, 2);
  comprova(PDF.casatIntern.text.includes('Reduccions familiars per persona') && PDF.casatIntern.text.includes('Marc Casat Prova'),
    'El full intern detalla la reducció de cada fill');
  comprova(!/Full intern|Passos del càlcul/.test(PDF.casatCopia.text + PDF.casatSignat.text), 'Les còpies del perceptor casat no porten el detall intern');

  seccio('Comunicació inicial rebuda fora del termini de l\'art. 31.a');
  const idTard = await crea({ nom: 'Pau Tard Prova', nrt: 'F-100006-F', email: 'pau@test.local', inici_relacio: `${ANY}-01-01` });
  const { data: kTard } = await adminPortal.from('irpf_comunicacions').select('irpf_perceptors(inici_relacio, relacio_laboral)').eq('request_id', idTard).single();
  const pTard = kTard.irpf_perceptors;
  comprova(pTard.inici_relacio === `${ANY}-01-01` && pTard.relacio_laboral === true, 'El personal indica l\'inici de la relació laboral en crear el perceptor');
  const e9 = await enllac(idTard);
  await irpf(e9.token, { accio: 'obrir' });
  const s9 = await irpf(e9.token, { accio: 'signar', lloc: 'Andorra la Vella', signatura: dataUrl(firma(10)), dades: resp('Pau Tard Prova', 'F-100006-F', {
    estat_civil: { estat: 'casat' }, conjuge: { nom: 'Lia Cònjuge Prova', document: 'Passaport T1', situacio: 'a' } }) });
  const r9 = await irpf((await enllac(idTard)).token, { accio: 'signar_recepcio', nom: 'Marta Gerent Prova', carrec: 'Gerent', signatura: dataUrl(firma(11)) });
  comprova(s9.status === 200 && r9.status === 200, 'Comunicació inicial (efectes 1/1, inici de la relació 1/1) rebuda avui');
  if (AVUI > `${ANY}-01-11` && mesSeguent(AVUI).startsWith(String(ANY))) {
    const t1 = await personal({ accio: 'calcula', request_id: idTard, previsualitza: true, data_efectes: `${ANY}-01-01`, retribucions: '60000' });
    comprova(t1.status === 200 && t1.cos.percentatge === '4.37' && /fora del termini/.test(t1.cos.detall.avisos[0]?.ca || ''),
      `Fora dels 10 dies: amb efectes l'1/1 es calcula sense comunicació (${t1.cos.percentatge} %), amb avís`);
    const t2 = await personal({ accio: 'calcula', request_id: idTard, previsualitza: true, data_efectes: mesSeguent(AVUI), retribucions: '60000' });
    comprova(t2.status === 200 && t2.cos.percentatge === '1.70' && /es té en compte/.test(t2.cos.detall.avisos[0]?.ca || ''),
      `Des del ${mesSeguent(AVUI)} (mes següent a la recepció) compta tot, també el cònjuge: ${t2.cos.percentatge} %, amb avís`);
  } else {
    comprova(true, 'Primers dies de l\'any o desembre: comprovació de dates omesa (la cobreixen les proves del càlcul)');
  }

  seccio('Cònjuge: sense la comunicació anual de l\'exercici, des de l\'1 de gener no es té en compte');
  const idVell = await crea({ nom: 'Rosa Casada Prova', nrt: 'F-100005-E', email: 'rosa@test.local' });
  const e8 = await enllac(idVell);
  await irpf(e8.token, { accio: 'obrir' });
  const s8 = await irpf(e8.token, { accio: 'signar', lloc: 'Andorra la Vella', signatura: dataUrl(firma(8)), dades: resp('Rosa Casada Prova', 'F-100005-E', {
    estat_civil: { estat: 'casat' }, conjuge: { nom: 'Joan Cònjuge Prova', document: 'Passaport V1', situacio: 'a' }, data_efectes: `${ANY - 1}-01-01` }) });
  const r8 = await irpf((await enllac(idVell)).token, { accio: 'signar_recepcio', nom: 'Marta Gerent Prova', carrec: 'Gerent', signatura: dataUrl(firma(9)) });
  comprova(s8.status === 200 && r8.status === 200, `Comunicació de l'exercici ${ANY - 1} (cònjuge en l'opció a) signada i rebuda`);
  const c8 = await personal({ accio: 'calcula', request_id: idVell, previsualitza: true, data_efectes: `${ANY}-01-01`, retribucions: '60000' });
  comprova(c8.status === 200 && c8.cos.percentatge === '4.37' && /No s'ha rebut la comunicació anual/.test(c8.cos.detall.avisos[0]?.ca || ''),
    `Exercici ${ANY}: la situació del cònjuge de ${ANY - 1} no es té en compte (4,37 % en lloc d'1,70 %), amb avís al personal`);

  // ─── 4. Administradora única: doble signatura ────────────────────────────
  seccio('Administradora única: signa la comunicació i la recepció en la mateixa sessió');
  const idAdmin = await crea({ nom: 'Núria Administradora Prova', nrt: 'F-100003-C', email: 'nuria.admin@test.local', es_representant: true });
  const e5 = await enllac(idAdmin);
  const ob5 = await irpf(e5.token, { accio: 'obrir' });
  comprova(ob5.cos.doble_signatura === true, 'El formulari sap que el perceptor és el representant del pagador');
  const dadesAdmin = resp('Núria Administradora Prova', 'F-100003-C');
  const sa1 = await irpf(e5.token, { accio: 'signar', dades: dadesAdmin, lloc: 'Andorra la Vella', signatura: dataUrl(firma(5)) });
  comprova(sa1.status === 400, 'Sense el càrrec ni la segona signatura → 400');
  const sa2 = await irpf(e5.token, { accio: 'signar', dades: dadesAdmin, lloc: 'Andorra la Vella', signatura: dataUrl(firma(5)), carrec_recepcio: 'Administradora única', signatura_recepcio: dataUrl(firma(5)) });
  comprova(sa2.status === 400 && /a part/.test(sa2.cos.error), 'La recepció s\'ha de signar a part (dues signatures diferents)');
  const sa3 = await irpf(e5.token, { accio: 'signar', dades: dadesAdmin, lloc: 'Andorra la Vella', signatura: dataUrl(firma(5)), carrec_recepcio: 'Administradora única', signatura_recepcio: dataUrl(firma(6)) });
  comprova(sa3.status === 200 && sa3.cos.rebuda === true, 'Signa els dos blocs en la mateixa sessió');
  comprova(await estat(idAdmin) === 'actiu', 'Directament rebuda pel pagador');
  const pdfAdmin = await baixaUrl(sa3.cos.pdf.url, 'irpf-3-administradora-unica-doble-signatura.pdf');
  PDF.admin = await comprovaFormat(pdfAdmin, 'PDF doble signatura', PAGADOR, 2);
  comprova(PDF.admin.text.includes('Núria Administradora Prova · Administradora única') && PDF.admin.text.includes('Signada en la mateixa sessió'),
    'Apartat 12 signat pel mateix perceptor, amb la seva evidència');
  comprova((await enllac(idAdmin)).status === 409, 'Ja no admet cap enllaç (ni de recepció)');
  const { data: recA } = await adminPortal.from('irpf_recepcions').select('mateixa_sessio, representant_carrec').eq('request_id', idAdmin).single();
  comprova(recA.mateixa_sessio === true && recA.representant_carrec === 'Administradora única', 'Recepció desada en la mateixa sessió');
  const c5 = await personal({ accio: 'calcula', request_id: idAdmin, data_efectes: `${ANY}-01-01`, retribucions: '85000', cotitzacions: '0' });
  comprova(c5.status === 200, `Càlcul de l'administradora (${c5.cos.percentatge_aplicat ?? `${c5.status} ${c5.cos.error}`} %)`);
  await baixaUrl(c5.cos.pdf_intern.url, 'irpf-3-administradora-unica-intern-ambit.pdf');
  await esperaAvisos(9);
  comprova(avisos.length === 9, 'Un avís per signatura i un per recepció (9 en total: solter 2, casat 2, fora de termini 2, cònjuge sense comunicació anual 2, administradora 1)');

  // ─── 5. Lògica condicional: consentiment i avisos d'edat ─────────────────
  seccio('Consentiment de l\'art. 9.2.a i avisos d\'edat');
  const idD = await crea({ nom: 'Eva Discapacitat Prova', nrt: 'F-100004-D', email: 'eva@test.local' });
  const e6 = await enllac(idD);
  await irpf(e6.token, { accio: 'obrir' });
  const dadesD = resp('Eva Discapacitat Prova', 'F-100004-D', {
    descendents: [{ nom: 'Fill Gran Prova', any_naixement: String(ANY - 27), conviu: true, rendes_superiors: false, discapacitat: true, persones: '1' }],
    ascendents: [{ nom: 'Mare Prova', any_naixement: String(ANY - 60), conviu: true, rendes_superiors: false, discapacitat: false, dependencia: false, persones: '1' }],
    altres: { habitatge: { import: '6000' } },
  });
  const sd1 = await irpf(e6.token, { accio: 'signar', dades: dadesD, lloc: 'Andorra la Vella', signatura: dataUrl(firma(7)) });
  comprova(sd1.status === 400 && sd1.cos.pendents.some((p) => p.camp === 'declaracions.consentiment'), 'Amb una discapacitat, el consentiment és obligatori');
  comprova(sd1.cos.pendents.some((p) => p.camp === 'altres.habitatge.any'), 'Import de l\'apartat 8 sense any d\'aplicació → pendent');
  comprova(!sd1.cos.pendents.some((p) => /ascendents|descendents/.test(p.camp)), 'Els avisos d\'edat (descendent de 27 i ascendent de 60) no bloquegen');
  const sd2 = await irpf(e6.token, { accio: 'signar', dades: { ...dadesD, altres: { habitatge: { import: '6000', any: String(ANY) } }, declaracions: { ...dadesD.declaracions, consentiment: true } },
    lloc: 'Andorra la Vella', signatura: dataUrl(firma(7)) });
  comprova(sd2.status === 200, 'Amb el consentiment i l\'any, es pot signar');
  const csc = await personal({ accio: 'calcula', request_id: idD, mode: 'sense_comunicacio', data_efectes: `${ANY}-01-01`, retribucions: '60000' });
  comprova(csc.status === 200 && csc.cos.percentatge === '4.37', `Sense comunicació (art. 24.4), només el mínim personal: 4,37 % (${csc.cos.percentatge})`);
  comprova(csc.cos.detall.imports.familiars === 0 && csc.cos.detall.imports.habitatge === 0,
    'Sense comunicació no compten ni el descendent amb discapacitat ni l\'habitatge comunicats');
  const pdfSense = await baixaUrl(csc.cos.pdf_intern.url, 'irpf-4-sense-comunicacio-intern-ambit.pdf');
  const ps = await comprovaFormat(pdfSense, 'PDF intern sense comunicació', PAGADOR, 0);
  comprova(ps.text.includes('Full intern · càlcul del percentatge de retenció') && !ps.text.includes(`1. ${T.s1.titol.ca}`)
    && !ps.text.includes('Full d’evidències'), `Sense comunicació, el PDF intern és només el full del càlcul (${ps.pagines.length} pàgina)`);
  comprova((await personal({ accio: 'calcula', request_id: idD, data_efectes: `${ANY}-01-01`, retribucions: '60000' })).status === 409,
    'Amb comunicació, cal que l\'hagi rebuda el pagador');

  // ─── 6. Versions i revisió anual ─────────────────────────────────────────
  seccio('Versions i revisió anual');
  const c2 = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY}-07-01`, retribucions: '90000', cotitzacions: '0', data_coneixement: `${ANY}-01-10` });
  comprova(c2.status === 400 && /retribucions satisfetes/.test(c2.cos.error), 'Variació de més d\'un punt: cal indicar el que ja s\'ha satisfet i retingut');
  const c2c = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY}-07-01`, retribucions: '90000', cotitzacions: '0',
    retribucions_satisfetes: '30000', retencions_practicades: '1311' });
  comprova(c2c.status === 400 && /coneix la variació/.test(c2c.cos.error), 'Una variació necessita la data en què el pagador la coneix');
  const c2d = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY}-07-01`, retribucions: '90000', cotitzacions: '0',
    retribucions_satisfetes: '30000', retencions_practicades: '1311', data_coneixement: `${ANY}-07-01` });
  comprova(c2d.status === 400 && /mes següent/.test(c2d.cos.error), 'Coneguda l\'1/07: no es pot aplicar amb efectes l\'1/07 (art. 27.1.b)');
  const c2b = await personal({ accio: 'calcula', request_id: idSolter, data_efectes: `${ANY}-07-01`, retribucions: '90000', cotitzacions: '0',
    retribucions_satisfetes: '30000', retencions_practicades: '1311', data_coneixement: `${ANY}-01-10` });
  comprova(c2b.status === 200 && c2b.cos.regularitzat === true && c2b.cos.data_coneixement === `${ANY}-01-10`,
    `Regularització des del mes següent a la data de coneixement: ${c2b.cos.percentatge} % anual, ${c2b.cos.percentatge_aplicat} % la resta del període`);
  const { data: perc } = await adminPortal.from('irpf_comunicacions').select('perceptor_id').eq('request_id', idSolter).single();
  const vig = async (d) => (await gp.rpc('irpf_vigent', { p_perceptor_id: perc.perceptor_id, p_data: d })).data;
  comprova((await vig(`${ANY}-03-01`))?.calcul?.percentatge_aplicat === 4.37, 'El 1 de març s\'aplicava el 4,37 %');
  comprova(Number((await vig(`${ANY}-08-01`))?.calcul?.percentatge_aplicat) === Number(c2b.cos.percentatge_aplicat), 'L\'1 d\'agost, el regularitzat');
  comprova((await vig(`${ANY - 1}-12-31`))?.comunicacio === null, 'Abans de la data d\'efectes, cap comunicació');
  const { data: idRev, error: errRev } = await gp.rpc('irpf_revisio_anual', { p_perceptor_id: perc.perceptor_id });
  comprova(!errRev && idRev, 'Enviar revisió anual: nova comunicació');
  const e7 = await enllac(idRev);
  const ob7 = await irpf(e7.token, { accio: 'obrir' });
  comprova(ob7.cos.dades?.comunicacio?.tipus === 'modificacio' && ob7.cos.dades?.perceptor?.domicili === 'Carrer de la Prova, 3, AD500 Andorra la Vella'
    && !ob7.cos.dades?.declaracions && ob7.cos.dades?.data_efectes === `${ANY + 1}-01-01`,
  'Preomplerta amb la vigent, de modificació, sense declaracions i amb efectes l\'1 de gener següent');
  comprova(await estat(idSolter) === 'actiu', 'La comunicació anterior es manté (no s\'esborra)');

  // ─── 7. Seguretat ────────────────────────────────────────────────────────
  seccio('Seguretat');
  comprova((await irpf('A'.repeat(43), { accio: 'obrir' })).status === 404, 'Token inexistent → resposta neutra');
  comprova((await crida('portal-kyc', { token: e7.token, accio: 'obrir' })).status === 404, 'L\'enllaç IRPF no obre el formulari KYC');
  comprova((await crida('portal-irpf', { token: e7.token, accio: 'obrir' }, { origen: 'https://maliciosa.example' })).status === 403, 'Origen no permès → 403');
  const { data: alienes } = await web.schema('portal').from('irpf_comunicacions').select('id');
  comprova((alienes || []).length === 0, 'Un usuari de la web no veu cap comunicació');
  const { error: errDel } = await admin.schema('portal').from('irpf_calculs').delete().eq('id', c1.cos.calcul_id);
  comprova(!!errDel, 'Ningú no pot esborrar un càlcul (tampoc el servei)');

  // ─── 6. Error en generar el PDF: cap fitxer i resposta JSON neta ─────────
  seccio('Error en generar el PDF: cap fitxer pujat, JSON amb CORS i missatge únic');
  {
    // Perceptor: doble signatura (dues firmes i el PDF)
    const id = await crea({ nom: 'Eva Fallada Prova', nrt: 'F-100020-K', email: 'eva@test.local', es_representant: true });
    const tk = (await enllac(id)).token;
    await irpf(tk, { accio: 'obrir' });
    const cos = { accio: 'signar', dades: resp('Eva Fallada Prova', 'F-100020-K'), lloc: 'Andorra la Vella', signatura: dataUrl(firma(20)),
      carrec_recepcio: 'Administradora única', signatura_recepcio: dataUrl(firma(21)) };
    const f1 = await irpf(tk, cos, { falla: 'pdf' });
    comprova(errorNet(f1), `Signatura: 500 amb "${ERROR_DOCUMENT.slice(0, 40)}…", JSON i capçalera CORS (${f1.status}, ${f1.cors})`);
    comprova(!/provocada|Error:|stack|at /.test(JSON.stringify(f1.cos)), 'L\'error real no arriba mai a qui crida');
    comprova(await fitxers(id) === 0, 'No s\'ha pujat cap fitxer (ni les firmes ni el PDF)');
    const { count: nSig } = await adminPortal.from('signatures').select('id', { count: 'exact', head: true }).eq('request_id', id);
    comprova(await estat(id) === 'en_curs' && nSig === 0, 'Res registrat: segueix en curs, sense signatura');
    const f2 = await irpf(tk, cos);
    comprova(f2.status === 200 && f2.cos.rebuda === true && await fitxers(id) === 3, 'Reintent amb el mateix enllaç: signat (2 firmes i el PDF)');

    // Representant del pagador: recepció (firma i còpia)
    const id2 = await crea({ nom: 'Lluc Fallada Prova', nrt: 'F-100021-L', email: 'lluc@test.local' });
    const tk2 = (await enllac(id2)).token;
    await irpf(tk2, { accio: 'obrir' });
    await irpf(tk2, { accio: 'signar', dades: resp('Lluc Fallada Prova', 'F-100021-L'), lloc: 'Andorra la Vella', signatura: dataUrl(firma(22)) });
    const abans = await fitxers(id2);
    const tkRec = (await enllac(id2)).token;
    const cosRec = { accio: 'signar_recepcio', nom: 'Marta Gerent Prova', carrec: 'Gerent', signatura: dataUrl(firma(23)) };
    const f3 = await irpf(tkRec, cosRec, { falla: 'pdf' });
    comprova(errorNet(f3), 'Recepció: 500, JSON, CORS i el missatge únic');
    comprova(await fitxers(id2) === abans && await estat(id2) === 'signat', 'Cap fitxer nou i segueix pendent de recepció');
    const f4 = await irpf(tkRec, cosRec);
    comprova(f4.status === 200 && await estat(id2) === 'actiu' && await fitxers(id2) === abans + 2, 'Reintent: rebuda (firma i còpia)');

    // Personal: càlcul i PDF intern
    const f5 = await personal({ accio: 'calcula', request_id: id2, data_efectes: `${ANY}-01-01`, retribucions: '60000' }, JWT_GESTOR, { falla: 'pdf' });
    comprova(errorNet(f5), 'Càlcul: 500, JSON, CORS i el missatge únic');
    const { count: nCalc } = await adminPortal.from('irpf_calculs').select('id', { count: 'exact', head: true }).eq('request_id', id2);
    comprova(nCalc === 0 && await fitxers(id2) === abans + 2, 'Cap càlcul desat ni cap PDF intern pujat');
    const f6 = await personal({ accio: 'calcula', request_id: id2, data_efectes: `${ANY}-01-01`, retribucions: '60000' });
    comprova(f6.status === 200 && f6.cos.calcul_id, 'Reintent: càlcul desat');
  }

  // ─── 7. Cas de producció: inicial no laboral fora de termini ─────────────
  seccio('Inicial no laboral fora de termini: el segon càlcul fa servir la comunicació (cas 138d9033)');
  if (mesSeguent(AVUI).startsWith(String(ANY))) {
    const INICI = `${AVUI.slice(0, 7)}-01`;
    const dadesCas = (nom, nrt) => resp(nom, nrt, {
      estat_civil: { estat: 'casat', des_de: '2015-06-20' }, conjuge: { nom: 'Cònjuge Cas Prova', document: 'Passaport C1', situacio: 'a' }, data_efectes: INICI,
    });
    const nouCas = async (nom, nrt, llavor) => {
      const id = await crea({ nom, nrt, email: `${nrt.toLowerCase()}@test.local`, inici_relacio: INICI, relacio_laboral: false, es_representant: true });
      const tk = (await enllac(id)).token;
      await irpf(tk, { accio: 'obrir' });
      const r = await irpf(tk, { accio: 'signar', dades: dadesCas(nom, nrt), lloc: 'Andorra la Vella', signatura: dataUrl(firma(llavor)),
        carrec_recepcio: 'Administradora única', signatura_recepcio: dataUrl(firma(llavor + 1)) });
      return r.status === 200 ? id : null;
    };
    // a) Mode per defecte del panell (comunicació rebuda): el primer càlcul ja la fa servir
    const idA = await nouCas('Clara Cas Prova', 'F-100030-M', 30);
    comprova(!!idA && await estat(idA) === 'actiu', `Comunicació inicial (no laboral, inici ${INICI}) signada i rebuda avui: fora del termini de l'art. 31.b`);
    const a1 = await personal({ accio: 'calcula', request_id: idA, mode: 'comunicacio', data_efectes: INICI, retribucions: '60000', cotitzacions: '0' });
    comprova(a1.status === 200 && a1.cos.percentatge === '4.37' && a1.cos.mode === 'comunicacio' && a1.cos.detall.mode === 'sense_comunicacio'
      && /fora del termini/.test(a1.cos.detall.avisos[0]?.ca || ''), `Efectes ${INICI}: encara sense comunicació, 4,37 % (${a1.cos.percentatge}), amb avís`);
    const a2 = await personal({ accio: 'calcula', request_id: idA, mode: 'comunicacio', data_efectes: mesSeguent(AVUI), retribucions: '60000', cotitzacions: '0',
      retribucions_satisfetes: '5000', retencions_practicades: '218.50' });
    comprova(a2.status === 200 && a2.cos.calcul_id && a2.cos.detall.mode === 'comunicacio' && a2.cos.percentatge === '1.70'
      && a2.cos.detall.imports.QL === 102000 && a2.cos.detall.imports.minimTotal === 4000000,
    `Efectes ${mesSeguent(AVUI)} sense indicar la data: amb la comunicació i el cònjuge, quota 1.020 €, 1,70 % (${a2.cos.percentatge ?? `${a2.status} ${a2.cos.error}`})`);
    comprova(a2.cos.regularitzat === true && a2.cos.percentatge_aplicat === '1.46', `Regularització (art. 25): aplicat ${a2.cos.percentatge_aplicat} %`);
    const { data: fa2 } = await adminPortal.from('irpf_calculs').select('data_coneixement, mode').eq('id', a2.cos.calcul_id).single();
    comprova(fa2?.data_coneixement === AVUI && fa2?.mode === 'comunicacio', `Desat amb la data de coneixement per defecte: la de recepció (${fa2?.data_coneixement})`);

    // b) Com a producció: primer càlcul sense comunicació (avís), segon amb la comunicació
    const idB = await nouCas('Biel Cas Prova', 'F-100031-N', 32);
    const b1 = await personal({ accio: 'calcula', request_id: idB, mode: 'sense_comunicacio', data_efectes: INICI, retribucions: '60000', cotitzacions: '0' });
    comprova(b1.status === 200 && b1.cos.mode === 'sense_comunicacio' && /no la fa servir/.test(b1.cos.detall.avisos[0]?.ca || ''),
      'Sense comunicació amb una de rebuda: avís al resultat');
    const { data: fb1 } = await adminPortal.from('irpf_calculs').select('detall').eq('id', b1.cos.calcul_id).single();
    comprova(/no la fa servir/.test(fb1?.detall?.avisos?.[0]?.ca || ''), 'L\'avís queda desat amb el càlcul');
    const pdfB1 = await llegeixPdf(await baixaUrl(b1.cos.pdf_intern.url, 'irpf-4-sense-comunicacio-amb-avis-intern-ambit.pdf'));
    comprova(pdfB1.text.includes('aquest càlcul no la fa servir'), 'I surt al PDF intern');
    const b2 = await personal({ accio: 'calcula', request_id: idB, previsualitza: true, mode: 'comunicacio', data_efectes: mesSeguent(AVUI), retribucions: '60000',
      cotitzacions: '0', retribucions_satisfetes: '5000', retencions_practicades: '218.50' });
    comprova(b2.status === 200 && b2.cos.percentatge === '1.70' && b2.cos.data_coneixement === AVUI && !b2.cos.detall.avisos.some((x) => /no la fa servir/.test(x.ca)),
      `Segon càlcul amb la comunicació, sense indicar la data: 1,70 % (${b2.cos.percentatge ?? b2.cos.error}), coneixement ${b2.cos.data_coneixement}`);

    // c) Data de coneixement futura: rebutjada també en previsualitzar
    const dema = new Date(Date.now() + 86400000).toLocaleDateString('sv-SE', { timeZone: 'Europe/Andorra' });
    const b3 = await personal({ accio: 'calcula', request_id: idB, previsualitza: true, mode: 'comunicacio', data_efectes: mesSeguent(dema), retribucions: '60000',
      cotitzacions: '0', retribucions_satisfetes: '5000', retencions_practicades: '218.50', data_coneixement: dema });
    comprova(b3.status === 400 && b3.cos.error === 'Cal la data (no futura) en què el pagador coneix la variació',
      'Previsualitzar amb una data de coneixement futura → 400, amb el mateix criteri que la base');
  } else {
    comprova(true, 'Desembre: el mes següent és d\'un altre exercici; comprovació omesa (la cobreix calcul.test.mjs)');
  }
} catch (e) {
  comprova(false, `Error inesperat: ${e.message}`);
  console.error(e);
} finally {
  receptor.close();
}

console.log(`\n${total - fallades}/${total} correctes`);
console.log(fallades ? `${fallades} proves han fallat` : 'Totes les proves han passat');
process.exit(fallades ? 1 : 0);
