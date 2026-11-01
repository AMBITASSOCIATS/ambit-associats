// Àrea de client · textos literals del fitxer docs/textos-area-client.md
// Execució: node supabase/tests/client/textos.test.mjs

import fs from 'node:fs';

const arrel = new URL('../../../', import.meta.url).pathname;
const llegeix = (f) => fs.readFileSync(arrel + f, 'utf8');
const MD = llegeix('docs/textos-area-client.md');
const WEB = llegeix('src/portal/client/text-area-client.json');
const SERVIDOR = llegeix('supabase/functions/_shared/text-area-client.json');
const T = JSON.parse(WEB);

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};

const textos = [];
const recull = (v, cami) => {
  if (typeof v === 'string') { if (!cami.startsWith('_font')) textos.push([cami, v]); return; }
  if (Array.isArray(v)) v.forEach((x, i) => recull(x, `${cami}.${i}`));
  else Object.entries(v).forEach(([k, x]) => recull(x, cami ? `${cami}.${k}` : k));
};
recull(T, '');
comprova(textos.length >= 25, `S'han trobat ${textos.length} textos a text-area-client.json`);
const absents = textos.filter(([, t]) => !MD.includes(t));
comprova(absents.length === 0, `Tots els textos surten literalment del fitxer${absents.length ? ` (falten: ${absents.map((a) => a[0]).join(', ')})` : ''}`);
comprova(WEB === SERVIDOR, 'text-area-client.json: la còpia de la web i la del servidor són idèntiques');
comprova(T.condicions.punts.length === 7, 'Condicions: els 7 punts');
comprova(T.condicions.punts.every((p) => p.ca && p.en), 'Cada punt en català i en anglès');
comprova(T.versio === 'CONDICIONS-AREA v1', 'Versió CONDICIONS-AREA v1');
const migracio = llegeix('supabase/migrations/20261031100000_portal_area_client.sql');
comprova(migracio.includes(`insert into portal.client_condicions (versio, vigent) values ('${T.versio}', true);`), 'La base sembra la mateixa versió com a vigent');
for (const c of ['correu_invitacio', 'correu_restabliment']) {
  comprova(['{nom}', '{enllaç}', '{data}'].every((m) => T[c].ca.includes(m) && T[c].en.includes(m)), `${c}: {nom}, {enllaç} i {data} en català i en anglès`);
}
comprova(T.avis.assumpte === 'Nou enviament de documents al portal', 'Assumpte de l\'avís');
const avis = llegeix('supabase/functions/_shared/area-client.ts');
comprova(/COS_AVIS = \{ _subject: T\.avis\.assumpte, message: T\.avis\.text \}/.test(avis), 'L\'avís de Formspree només porta l\'assumpte i el text del fitxer');
const api = llegeix('src/portal/portalApi.js');
comprova(/TAC\.correu_restabliment : TAC\.correu_invitacio/.test(api) && /`\$\{omple\(c\.ca\)\}\\n\\n\$\{omple\(c\.en\)\}`/.test(api),
  'Els correus d\'invitació i de restabliment es fan amb el text del fitxer (català i, a sota, anglès)');
const app = llegeix('src/portal/client/ClientApp.jsx');
comprova(app.includes('T.condicions.casella') && app.includes('T.condicions.punts'), 'La pantalla mostra les condicions i la casella del fitxer');
const pantalles = llegeix('src/portal/client/text-pantalles.js');
comprova(pantalles.includes("noDisponible: { ca: 'No disponible temporalment', en: 'Temporarily unavailable' }"), '«No disponible temporalment / Temporarily unavailable» exacte');
comprova(llegeix('supabase/functions/portal-client-area/index.ts').includes("'No disponible temporalment / Temporarily unavailable'"), '… també al servidor');
comprova(pantalles.includes("estatEnviat: { ca: 'Enviat'") && pantalles.includes("estatRebut: { ca: 'Rebut per ÀMBIT'"), 'Estats «Enviat» i «Rebut per ÀMBIT»');
comprova(['Enviar documents', 'Els meus enviaments', 'Els meus documents'].every((s) => pantalles.includes(`'${s}'`)), 'Les tres seccions de l\'inici');

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
