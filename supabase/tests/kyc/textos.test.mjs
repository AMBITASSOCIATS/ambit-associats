// Comprova que tots els textos de text-kyc.json surten literalment de la
// plantilla (docs/plantilles-kyc-proteccio-dades.md) i que les còpies del
// formulari web i de les Edge Functions són idèntiques byte a byte.
// Execució: node supabase/tests/kyc/textos.test.mjs
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

const plantilla = llegeix('docs/plantilles-kyc-proteccio-dades.md').toString('utf8').replace(/\*\*/g, '');
const T = JSON.parse(llegeix('supabase/functions/_shared/text-kyc.json'));

// Fulles de text (s'exclou el peu, que és el mateix de l'autorització de càrrec)
const fulles = [];
const recorre = (v, cami) => {
  if (typeof v === 'string') fulles.push([cami, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => recorre(x, `${cami}[${i}]`));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) if (k !== 'peu') recorre(x, cami ? `${cami}.${k}` : k);
};
recorre(T, '');

const absents = fulles.filter(([, t]) => !plantilla.includes(t));
comprova(fulles.length > 300, `S'han trobat ${fulles.length} textos a text-kyc.json`);
comprova(absents.length === 0, 'Tots els textos surten literalment de la plantilla');
for (const [cami, t] of absents.slice(0, 20)) console.log(`       · ${cami}: ${t.slice(0, 90)}`);

const marques = fulles.filter(([, t]) => /\[(obligatori|si escau|ÀMBIT)/.test(t));
comprova(marques.length === 0, 'Cap text no conté les marques [obligatori], [si escau] ni [ÀMBIT]');

// Peu = el de l'autorització (mateixes dades de la societat)
const A = JSON.parse(llegeix('supabase/functions/_shared/text-autoritzacio.json'));
comprova(JSON.stringify(A.peu) === JSON.stringify(T.peu), 'El peu és el mateix que el de l\'autorització de càrrec');

// Textos fixos demanats fora de la plantilla (avís del 25 % i llistes de sancions)
{
  const regles = llegeix('supabase/functions/_shared/kyc-regles.js').toString('utf8');
  const fixos = [
    "Aquesta persona supera el 25 % i s\\'ha de declarar com a beneficiari efectiu",
    'This person holds more than 25% and must be declared as a beneficial owner',
    "Llista consolidada del Consell de Seguretat de l\\'ONU",
    'Resolució 1/2026 de la Comissió Permanent (capítol novè de la Llei 14/2017)',
    'Decret 182/2026, annexos 1 i 2 (Llei 5/2022)',
    'Comunicat tècnic CT-02/2016, annex',
  ];
  comprova(fixos.every((t) => regles.includes(t)), 'Avís del 25 % i llistes de sancions amb el text exacte demanat');
  const sql = llegeix('supabase/migrations/20261011100100_portal_kyc.sql').toString('utf8');
  comprova(fixos.slice(2).every((t) => sql.includes(t.replace("\\'", "''"))), 'Les llistes de sancions de la base tenen el mateix text');
}

// Còpies idèntiques
for (const [a, b] of [
  ['supabase/functions/_shared/text-kyc.json', 'src/portal/kyc/text-kyc.json'],
  ['supabase/functions/_shared/kyc-regles.js', 'src/portal/kyc/kyc-regles.js'],
  ['supabase/functions/_shared/paisos.json', 'src/portal/kyc/paisos.json'],
]) {
  let igual = false;
  try { igual = llegeix(a).equals(llegeix(b)); } catch { igual = false; }
  comprova(igual, `${a.split('/').pop()}: la còpia del formulari web i la del servidor són idèntiques`);
}

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
