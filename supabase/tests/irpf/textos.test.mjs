// Comprova que tots els textos de text-irpf.json surten literalment de la
// plantilla (docs/plantilla-comunicacio-dades-irpf.md), els textos fixos del
// PDF (apartat H de l'encàrrec), que les còpies del formulari web i de les
// Edge Functions són idèntiques byte a byte i que els paràmetres del càlcul no
// són fixos al codi.
// Execució: node supabase/tests/irpf/textos.test.mjs
import fs from 'node:fs';

const arrel = new URL('../../../', import.meta.url);
const llegeix = (p) => fs.readFileSync(new URL(p, arrel));

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};

const plantilla = llegeix('docs/plantilla-comunicacio-dades-irpf.md').toString('utf8');
const T = JSON.parse(llegeix('supabase/functions/_shared/text-irpf.json'));

// Fulles de text (s'exclouen el peu, que és el de l'autorització, i els textos fixos del PDF)
const fulles = [];
const recorre = (v, cami) => {
  if (typeof v === 'string') fulles.push([cami, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => recorre(x, `${cami}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'peu' && k !== 'pdf') recorre(x, cami ? `${cami}.${k}` : k);
};
recorre(T, '');

const absents = fulles.filter(([, t]) => !plantilla.includes(t));
comprova(fulles.length > 120, `S'han trobat ${fulles.length} textos a text-irpf.json`);
comprova(absents.length === 0, 'Tots els textos surten literalment de la plantilla');
for (const [cami, t] of absents.slice(0, 20)) console.log(`       · ${cami}: ${t.slice(0, 90)}`);

const marques = fulles.filter(([, t]) => /\[(obligatori|si escau|nota)/.test(t));
comprova(marques.length === 0, 'Cap text no conté les marques [obligatori], [si escau] ni [nota]');

// Apartats 0 a 13, tots
const seccions = Object.keys(T).filter((k) => /^s\d+$/.test(k)).map((k) => Number(k.slice(1))).sort((a, b) => a - b);
comprova(seccions.join(',') === '0,1,2,3,4,5,6,7,8,9,10,11,12,13', 'Hi ha els apartats 0 a 13');

// Peu i textos fixos del PDF
const A = JSON.parse(llegeix('supabase/functions/_shared/text-autoritzacio.json'));
comprova(JSON.stringify(A.peu) === JSON.stringify(T.peu), 'Les dades de contacte del peu són les de l\'autorització i el KYC');
const pagador = 'Pagadora Prova, SL';
comprova(T.pdf.gestionat.ca.replace('{pagador}', pagador) === `Document gestionat per DEL SOTO – PALEARI & ASSOCIATS, SL per compte de ${pagador}`
  && T.pdf.gestionat.en.replace('{pagador}', pagador) === `Document managed by DEL SOTO – PALEARI & ASSOCIATS, SL on behalf of ${pagador}`,
'Peu: "Document gestionat per … per compte de [denominació del pagador]" (text exacte de l\'encàrrec)');
const K = JSON.parse(llegeix('supabase/functions/_shared/text-kyc.json'));
comprova(JSON.stringify(K.no_escau) === JSON.stringify(T.pdf.no_escau), '"No s\'escau / Not applicable" és el mateix text que al KYC');
comprova(JSON.stringify(K.si_no) === JSON.stringify(T.si_no), '"sí / yes" i "no / no" són els mateixos que al KYC');

// El PDF fa servir el mateix codi de generació que el KYC (Maqueta) i cap logotip
const pdf = llegeix('supabase/functions/_shared/pdf-irpf.ts').toString('utf8');
comprova(/import \{[^}]*Maqueta[^}]*\} from '\.\/pdf-kyc\.ts'/.test(pdf), 'El PDF IRPF fa servir la maquetació del KYC (pdf-kyc.ts)');
comprova(!/logo/i.test(pdf.replace(/\/\/.*$/gm, '').replace(/new Maqueta\(pdf, f, null/, '')), 'El PDF IRPF no carrega cap logotip');
comprova(pdf.includes("color: VERD") && /VERD = rgb\(0, 0x9b \/ 255, 0x9c \/ 255\)/.test(llegeix('supabase/functions/_shared/pdf.ts').toString('utf8')),
  'Verd #009B9C (pdf.ts)');

// Versió de la plantilla
const regles = llegeix('supabase/functions/_shared/irpf-regles.js').toString('utf8');
const sql = llegeix('supabase/migrations/20261020100100_portal_irpf.sql').toString('utf8');
comprova(plantilla.includes(`Versió de plantilla: ${T.versio}`) && regles.includes(`VERSIO = '${T.versio}'`) && sql.includes(`'${T.versio}'`),
  `Versió ${T.versio} a la plantilla, al formulari i a la base`);

// Paràmetres: cap valor fix al codi del càlcul; els de la plantilla, a la taula de l'exercici 2025
const calcul = llegeix('supabase/functions/_shared/irpf-calcul.js').toString('utf8').replace(/\/\/.*$/gm, '');
const fixos = ['24000', '30000', '40000', '17367', '2500', '5000', '800'].filter((n) => calcul.includes(n));
comprova(fixos.length === 0, `El càlcul no té cap import fix (${fixos.join(', ') || 'cap'})`);
comprova(/values \(2025, 24000, 30000, 40000, 1000, 1\.5, 300, 17367\.96, 50, 5000, 30, 5000, 10, 50, 800, 3, 2500, 25, 65, 1, 10\)/.test(sql),
  'Els paràmetres de la plantilla són a la taula (exercici 2025)');
{
  const m = calcul.match(/export const PARAMETRES = \[([\s\S]*?)\];/);
  const claus = m ? [...m[1].matchAll(/'([a-z_]+)'/g)].map((x) => x[1]) : [];
  const taula = sql.slice(sql.indexOf('create table portal.irpf_parametres'), sql.indexOf('-- Exercici 2025'));
  comprova(claus.length === 20 && claus.every((k) => new RegExp(`^\\s+${k}\\s`, 'm').test(taula)),
    'Cada paràmetre del càlcul és una columna de portal.irpf_parametres');
}

// Còpies idèntiques
for (const [a, b] of [
  ['supabase/functions/_shared/text-irpf.json', 'src/portal/irpf/text-irpf.json'],
  ['supabase/functions/_shared/irpf-regles.js', 'src/portal/irpf/irpf-regles.js'],
  ['supabase/functions/_shared/irpf-calcul.js', 'src/portal/irpf/irpf-calcul.js'],
]) {
  let igual = false;
  try { igual = llegeix(a).equals(llegeix(b)); } catch { igual = false; }
  comprova(igual, `${a.split('/').pop()}: la còpia del formulari web i la del servidor són idèntiques`);
}

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
