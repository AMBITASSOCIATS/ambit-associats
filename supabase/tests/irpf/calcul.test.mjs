// Proves del càlcul del percentatge de retenció (irpf-calcul.js), amb
// l'exemple de la plantilla i els casos de l'apartat "CÀLCUL DEL PERCENTATGE"
// de docs/plantilla-comunicacio-dades-irpf.md.
// Execució: node supabase/tests/irpf/calcul.test.mjs
import { calcula, aCentims, coneixementPerDefecte, AVIS_SENSE_COMUNICACIO } from '../../functions/_shared/irpf-calcul.js';

let fallades = 0;
let total = 0;
const comprova = (cond, nom) => {
  total++;
  console.log(`${cond ? 'ok    ' : 'FALLA '} ${nom}`);
  if (!cond) fallades++;
};
const seccio = (t) => console.log(`\n── ${t} ──`);
const llança = (fn) => { try { fn(); return null; } catch (e) { return e.message; } };

// Paràmetres de l'exercici (els mateixos valors que la plantilla; al portal surten de portal.irpf_parametres)
const P = {
  minim_personal: '24000.00', minim_incapacitat: '30000.00', limit_conjuge: '40000.00', reduccio_familiar: '1000.00',
  coeficient_discapacitat: '1.50', max_matricules: '300.00', salari_minim: '17367.96', habitatge_percentatge: '50.00',
  habitatge_maxim: '5000.00', plans_percentatge: '30.00', plans_maxim: '5000.00', tipus: '10.00', bonificacio_percentatge: '50.00',
  bonificacio_maxim: '800.00', despeses_percentatge: '3.00', despeses_maxim: '2500.00', edat_descendents: 25, edat_ascendents: 65,
  regularitzacio_llindar: '1.00', regularitzacio_maxim: '10.00',
};
const EX = 2026;
const base = (extra = {}) => ({
  perceptor: { incapacitat: false }, estat_civil: { estat: 'solter' }, descendents: [], ascendents: [], tutelats: [], altres: {}, ...extra,
});
const casat = (situacio, rendes = '', extra = {}) => base({ estat_civil: { estat: 'casat' }, conjuge: { situacio, rendes }, ...extra });
const c = (r) => r.imports;
const eur = (n) => Math.round(n * 100);
// Comunicació anual rebuda abans del 15 de desembre de l'any anterior (la situació del cònjuge compta tot l'exercici)
const A_TEMPS = { data_efectes: `${EX}-01-01`, rebuda_el: `${EX - 1}-12-01` };
const calc = (dades, R = '60000', opts = {}) => calcula({ parametres: P, exercici: EX, retribucions: R, cotitzacions: '0', dades, comunicacio: A_TEMPS, ...opts });
// Variació coneguda pel pagador el 10 de juny, amb efectes l'1 de juliol (art. 27.1.b)
const VAR = { data_efectes: `${EX}-07-01`, coneixement: `${EX}-06-10` };

// ─── 1. Exemple de la plantilla ─────────────────────────────────────────────
seccio('Exemple de prova de la plantilla (R = 60.000 €, solter, sense fills)');
{
  const r = calc(base());
  comprova(c(r).despeses === eur(1800), 'Despeses = 1.800 € (3 % de 60.000 €)');
  comprova(c(r).BT === eur(58200), 'BT = 58.200 €');
  comprova(c(r).BL === eur(34200), 'BL = 34.200 €');
  comprova(c(r).QT === eur(3420), 'QT = 3.420 €');
  comprova(c(r).bonificacio === eur(800), 'Bonificació = mínim(800; 0,5 × 0,1 × 34.200 = 1.710) = 800 €');
  comprova(c(r).QL === eur(2620), 'QL = 2.620 €');
  comprova(r.percentatge === '4.37', `Percentatge = 4,37 % (${r.percentatge})`);
  comprova(r.percentatge_aplicat === '4.37' && !r.regularitzat, 'Primer càlcul de l\'exercici: s\'aplica el 4,37 % sense regularització');
  comprova(r.passos.map((p) => p.num).join(',') === '1,2,3,4,4,5,6,6,6,7,8,9,10,11', 'Detall de cada pas (1 a 11)');
}

// ─── 2. Despeses deduïbles ──────────────────────────────────────────────────
seccio('Despeses deduïbles (art. 13.2 Llei)');
{
  comprova(c(calc(base(), '100000')).despeses === eur(2500), '3 % de 100.000 € = 3.000 € → màxim 2.500 €');
  const r = calcula({ parametres: P, exercici: EX, retribucions: '60000', cotitzacions: '1000', dades: base() });
  comprova(c(r).despeses === eur(2800), 'Amb cotitzacions a càrrec del perceptor: 1.000 € + 1.800 €');
}

// ─── 3. Cònjuge (pas 4) ─────────────────────────────────────────────────────
seccio('Cònjuge o parella estable: exemples de la plantilla');
comprova(c(calc(casat('c', '10000'))).minimTotal === eur(30000), 'MP 24.000 i S 10.000 → 30.000');
comprova(c(calc(casat('c', '20000'))).minimTotal === eur(24000), 'MP 24.000 i S 20.000 → 24.000');
comprova(c(calc(casat('a', '', { perceptor: { incapacitat: true } }))).minimTotal === eur(40000), 'MP 30.000 i S 0 → 40.000');
comprova(c(calc(casat('c', '5000', { perceptor: { incapacitat: true } }))).minimTotal === eur(35000), 'MP 30.000 i S 5.000 → 35.000');

seccio('Cònjuge: opcions a, b i c amb R = 60.000 €');
{
  const a = calc(casat('a'));
  comprova(c(a).minimTotal === eur(40000) && a.percentatge === '1.70', `Opció a): mínim total 40.000 €, percentatge 1,70 % (${a.percentatge})`);
  const b = calc(casat('b'));
  comprova(c(b).minimTotal === eur(24000) && b.percentatge === '4.37', `Opció b): sense increment, 4,37 % (${b.percentatge})`);
  const cc = calc(casat('c', '10000'));
  comprova(cc.percentatge === '3.37', `Opció c) amb 10.000 € de rendes del cònjuge: 3,37 % (${cc.percentatge})`);
  comprova(c(calc(base({ estat_civil: { estat: 'separat' }, conjuge: { situacio: 'a' } }))).minimTotal === eur(24000),
    'Separat/ada: les dades d\'un cònjuge no es tenen en compte');
  comprova(a.imports.bonificacio === eur(800), 'La bonificació es calcula amb el mínim personal sense l\'increment per cònjuge');
}

// ─── 4. Reduccions familiars (pas 5) ────────────────────────────────────────
seccio('Descendents amb prorrateig');
{
  const fill = (any, persones, extra = {}) => ({ nom: `Fill ${any}`, any_naixement: String(any), conviu: true, rendes_superiors: false, discapacitat: false, persones: String(persones), ...extra });
  const r = calc(base({ descendents: [fill(2016, 2), fill(2006, 2)] }));
  comprova(c(r).familiars === eur(1000), 'Dos descendents compartits amb l\'altre progenitor: 500 € + 500 €');
  comprova(r.percentatge === '4.20', `Percentatge 4,20 % (${r.percentatge})`);
  const r1 = calc(base({ descendents: [fill(2016, 1), fill(2006, 2)] }));
  comprova(c(r1).familiars === eur(1500), 'Un amb una sola persona amb dret (1.000 €) i un altre compartit (500 €)');
  const r3 = calc(base({ descendents: [fill(2016, 3)] }));
  comprova(c(r3).familiars === eur(333.33), '1.000 € ÷ 3 = 333,33 € (arrodoniment al cèntim)');
  const mat = calc(base({ descendents: [fill(2006, 2, { matricules: '450' })] }));
  comprova(c(mat).familiars === eur(650), 'Matrícules de 450 € → màxim 300 €, prorratejat entre 2: 500 + 150');
  const guia = calc(base({ descendents: [fill(2006, 2, { matricules: '300' })] }));
  comprova(guia.persones[0].matricules === eur(150), 'Exemple de la Guia IRPF 2025: 300 € entre dos progenitors = 150 € (art. 35.3 Llei)');
  comprova(calc(base({ descendents: [fill(2006, 1, { matricules: '300' })] })).persones[0].matricules === eur(300), 'Una sola persona amb dret: 300 €');
  comprova(calc(base({ descendents: [fill(2006, 3, { matricules: '250' })] })).persones[0].matricules === eur(83.33), '250 € entre 3: 83,33 € (arrodoniment al cèntim)');
  const mat2 = calc(base({ descendents: [fill(2000, 1, { discapacitat: true, matricules: '200' })] }));
  comprova(c(mat2).familiars === eur(1500), 'Les matrícules només per a descendents menors de 25 anys');
  const vell = calc(base({ descendents: [fill(2000, 1)] }));
  comprova(c(vell).familiars === 0 && vell.persones[0].compleix === false, 'Descendent de 26 anys sense discapacitat: no dona dret a la reducció');
  const fora = calc(base({ descendents: [fill(2016, 1, { conviu: false })] }));
  comprova(c(fora).familiars === 0, 'Descendent que no conviu ni en depèn: sense reducció');
  const rendes = calc(base({ descendents: [fill(2006, 1, { rendes_superiors: true })] }));
  comprova(c(rendes).familiars === 0, 'Descendent amb rendes superiors al salari mínim: sense reducció');
}

seccio('Discapacitat i dependència (coeficient 1,5)');
{
  const r = calc(base({ descendents: [{ nom: 'Filla', any_naixement: '1996', conviu: true, rendes_superiors: false, discapacitat: true, persones: '1' }] }));
  comprova(c(r).familiars === eur(1500), 'Descendent de 30 anys amb discapacitat: 1.000 × 1,5 = 1.500 € (sense límit d\'edat)');
  const asc = (any, extra) => ({ nom: `Ascendent ${any}`, any_naixement: String(any), conviu: true, rendes_superiors: false, discapacitat: false, dependencia: false, persones: '2', ...extra });
  comprova(c(calc(base({ ascendents: [asc(1950, { dependencia: true })] }))).familiars === eur(750), 'Ascendent amb dependència compartit: 1.500 ÷ 2 = 750 €');
  comprova(c(calc(base({ ascendents: [asc(1955, {})] }))).familiars === eur(500), 'Ascendent de 71 anys: 1.000 ÷ 2 = 500 €');
  comprova(c(calc(base({ ascendents: [asc(1962, {})] }))).familiars === 0, 'Ascendent de 64 anys sense discapacitat ni dependència: sense reducció');
  comprova(c(calc(base({ ascendents: [asc(1962, { discapacitat: true })] }))).familiars === eur(750), 'Ascendent de 64 anys amb discapacitat: 750 €');
  comprova(c(calc(base({ tutelats: [{ nom: 'Menor', any_naixement: '2015', conviu: true, rendes_superiors: false, discapacitat: true, persones: '1' }] }))).familiars === eur(1500),
    'Persona en tutela o acolliment amb discapacitat: 1.500 €');
  const inc = calc(base({ perceptor: { incapacitat: true } }));
  comprova(c(inc).MP === eur(30000) && inc.percentatge === '3.37', `Perceptor en situació d'incapacitat: mínim de 30.000 €, 3,37 % (${inc.percentatge})`);
}

// ─── 5. Reduccions dels arts. 38 i 39 (pas 6) ───────────────────────────────
seccio('Habitatge habitual (art. 38 Llei)');
{
  comprova(c(calc(base({ altres: { habitatge: { import: '6000', any: '2026' } } }))).habitatge === eur(3000), '50 % de 6.000 € = 3.000 €');
  comprova(c(calc(base({ altres: { habitatge: { import: '12000', any: '2026' } } }))).habitatge === eur(5000), '50 % de 12.000 € → màxim 5.000 €');
  comprova(c(calc(base({ altres: { habitatge: { import: '12000', any: '2025' } } }))).habitatge === 0, 'Un import d\'un altre any d\'aplicació no compta');
  const r = calc(base({ altres: { habitatge: { import: '12000', any: '2026' } } }));
  comprova(r.percentatge === '3.53', `Percentatge amb 5.000 € d'habitatge: 3,53 % (${r.percentatge})`);
}
seccio('Plans de pensions (art. 39.1 Llei)');
{
  comprova(c(calc(base({ altres: { plans: { import: '3000', any: '2026' } } }))).plans === eur(3000), 'Aportació de 3.000 €: es redueix tota');
  comprova(c(calc(base({ altres: { plans: { import: '8000', any: '2026' } } }))).plans === eur(5000), 'Aportació de 8.000 € → màxim 5.000 €');
  comprova(c(calc(base({ altres: { plans: { import: '8000', any: '2026' } } }), '10000')).plans === eur(2910),
    'Amb R = 10.000 €: límit del 30 % de 9.700 € = 2.910 €');
}
seccio('Pensions compensatòries i anualitats per aliments (art. 39.2 Llei)');
comprova(c(calc(base({ altres: { pensions: { import: '3000', any: '2026', origen: 'judicial' } } }))).pensions === eur(3000), 'Es redueix l\'import');

// ─── 6. Sense comunicació (art. 24.4 del Reglament) ─────────────────────────
seccio('Sense comunicació (pas 12)');
{
  const r = calc(null);
  comprova(r.mode === 'sense_comunicacio', 'Mode sense comunicació');
  comprova(c(r).MP === eur(24000) && c(r).BL === eur(34200), 'BL = BT − mínim personal (24.000 €): 58.200 − 24.000 = 34.200 € (art. 51.1.a Llei)');
  comprova(c(r).familiars === 0 && c(r).habitatge === 0 && c(r).plans === 0 && c(r).pensions === 0 && c(r).minimTotal === eur(24000),
    'Sense cap dada de l\'art. 28: ni cònjuge, ni familiars, ni habitatge, pensions o plans');
  comprova(c(r).bonificacio === eur(800), 'Bonificació (pas 9, amb el mínim personal)');
  comprova(r.percentatge === '4.37', `R = 60.000 € → 4,37 % (${r.percentatge})`);
  comprova(r.passos.map((p) => p.num).join(',') === '1,2,3,7,8,9,10,11', 'Passos 1, 2, 3, 7 (només el mínim personal), 8, 9, 10 i 11');
  const baix = calc(null, '20000');
  comprova(baix.percentatge === '0.00', `R = 20.000 €: BT 19.400 € < 24.000 € → BL 0 → 0,00 % (${baix.percentatge})`);
  // Sense comunicació el pagador no coneix la incapacitat: sempre 24.000 €
  comprova(c(calc(null)).MP === eur(24000), 'Sense comunicació, sempre el mínim personal general (24.000 €)');
}

// ─── 7. Regularització (art. 25 del Reglament) ──────────────────────────────
seccio('Regularització: només si la variació supera un punt');
{
  const fills = base({ descendents: [{ nom: 'A', any_naixement: '2016', conviu: true, rendes_superiors: false, discapacitat: false, persones: '2' },
                                     { nom: 'B', any_naixement: '2006', conviu: true, rendes_superiors: false, discapacitat: false, persones: '2' }] });
  const r = calc(fills, '60000', { ...VAR, anterior: { percentatge: '4.37', percentatge_aplicat: '4.37' } });
  comprova(r.percentatge === '4.20' && r.percentatge_aplicat === '4.37' && !r.regularitzat,
    'Variació de 0,17 punts (≤ 1): es manté el 4,37 % aplicat');
  const err = llança(() => calc(casat('a'), '60000', { ...VAR, anterior: { percentatge: '4.37', percentatge_aplicat: '4.37' } }));
  comprova(/cal indicar les retribucions satisfetes/i.test(err || ''), 'Variació de 2,67 punts: cal indicar les retribucions satisfetes i les retencions practicades');
  const baixa = calc(casat('a'), '60000', {
    ...VAR, anterior: { percentatge: '4.37', percentatge_aplicat: '4.37' }, regularitzacio: { retribucions_satisfetes: '30000', retencions_practicades: '1311' },
  });
  comprova(baixa.regularitzat && baixa.percentatge === '1.70' && baixa.percentatge_aplicat === '0.00',
    `Ja s'han retingut 1.311 € i la quota anual és 1.020 €: 0,00 % la resta de l'any (${baixa.percentatge_aplicat})`);
  const puja = calc(base({ estat_civil: { estat: 'divorciat' } }), '60000', {
    ...VAR, anterior: { percentatge: '1.70', percentatge_aplicat: '1.70' }, regularitzacio: { retribucions_satisfetes: '30000', retencions_practicades: '510' },
  });
  comprova(puja.regularitzat && puja.percentatge_aplicat === '7.03',
    `(2.620 − 510) ÷ (60.000 − 30.000) = 7,03 % sobre la resta del període (${puja.percentatge_aplicat})`);
  const topall = calc(null, '200000', {
    ...VAR, anterior: { percentatge: '1.00', percentatge_aplicat: '1.00' }, regularitzacio: { retribucions_satisfetes: '190000', retencions_practicades: '0' },
  });
  comprova(topall.percentatge_aplicat === '10.00', `El percentatge regularitzat no pot superar el 10 % (${topall.percentatge_aplicat})`);
  comprova(/inferiors/.test(llança(() => calc(casat('a'), '60000', {
    ...VAR, anterior: { percentatge: '4.37' }, regularitzacio: { retribucions_satisfetes: '60000', retencions_practicades: '0' } })) || ''),
  'Les retribucions satisfetes han de ser inferiors a les anuals');
}

seccio('Regularització: des del mes següent a aquell en què el pagador coneix la variació (art. 27.1.b)');
{
  const ant = { percentatge: '4.37', percentatge_aplicat: '4.37' };
  comprova(/coneix la variació/.test(llança(() => calc(base(), '60000', { data_efectes: `${EX}-07-01`, anterior: ant })) || ''),
    'Amb un càlcul anterior, cal la data en què el pagador coneix la variació');
  comprova(/mes següent/.test(llança(() => calc(base(), '60000', { data_efectes: `${EX}-06-15`, coneixement: `${EX}-06-10`, anterior: ant })) || ''),
    'Coneguda el 10/06: amb efectes el 15/06 → error (encara és el mateix mes)');
  comprova(/01\/07/.test(llança(() => calc(base(), '60000', { data_efectes: `${EX}-06-30`, coneixement: `${EX}-06-10`, anterior: ant })) || ''),
    'El missatge indica la primera data possible (01/07)');
  comprova(calc(base(), '60000', { data_efectes: `${EX}-07-01`, coneixement: `${EX}-06-10`, anterior: ant }).percentatge_aplicat === '4.37',
    'Coneguda el 10/06: amb efectes l\'1/07 → correcte');
  comprova(calc(base(), '60000', { data_efectes: `${EX + 1}-01-01`, exercici: EX + 1, coneixement: `${EX}-12-20`, anterior: ant,
    comunicacio: { data_efectes: `${EX + 1}-01-01`, rebuda_el: `${EX}-12-20` } }).percentatge === '4.37',
  'Coneguda el 20/12: s\'aplica des de l\'1/1 de l\'any següent');
}

// ─── 8. Cònjuge: comunicació anual (arts. 27.1.b, 28.3 i 31.d) ──────────────
seccio('Cònjuge: comunicació anual abans del 15 de desembre');
{
  const a = (rebuda_el, data_efectes = `${EX}-01-01`, opts = {}) => calc(casat('a'), '60000', { comunicacio: { data_efectes, rebuda_el }, ...opts });
  const t1 = a(`${EX - 1}-11-20`);
  comprova(c(t1).minimTotal === eur(40000) && t1.avisos.length === 0, 'Rebuda el 20/11 de l\'any anterior: compta tot l\'exercici, sense avís');
  comprova(c(a(`${EX - 1}-12-15`)).minimTotal === eur(40000), 'Rebuda el mateix 15 de desembre: compta');
  const vella = a(`${EX - 2}-11-20`, `${EX - 1}-01-01`);
  comprova(c(vella).minimTotal === eur(24000) && vella.percentatge === '4.37',
    'Només hi ha la de l\'exercici anterior (no s\'ha rebut l\'anual): des de l\'1 de gener no es té en compte → 4,37 %');
  comprova(vella.avisos.length === 1 && /No s'ha rebut la comunicació anual/.test(vella.avisos[0].ca) && /15\/12\/2025/.test(vella.avisos[0].ca),
    'Avís al personal: no s\'ha rebut la comunicació anual abans del 15/12');
  comprova(vella.passos.find((p) => p.ca.startsWith('Increment per cònjuge')).valor === 0, 'Pas 4: increment 0, amb el motiu al detall');
}
seccio('Cònjuge: comunicació rebuda després del 15 de desembre (variació, sense efecte retroactiu)');
{
  const a = (rebuda_el, data_efectes, opts = {}) => calc(casat('a'), '60000', { data_efectes, comunicacio: { data_efectes: `${EX}-01-01`, rebuda_el }, ...opts });
  const desembre = a(`${EX - 1}-12-20`, `${EX}-01-01`);
  comprova(c(desembre).minimTotal === eur(40000) && /variació/.test(desembre.avisos[0]?.ca || '') && /01\/01\/2026/.test(desembre.avisos[0].ca),
    'Rebuda el 20/12: es tracta com a variació i s\'aplica des del mes següent (1/1), amb avís');
  const gener = a(`${EX}-01-10`, `${EX}-01-01`);
  comprova(c(gener).minimTotal === eur(24000) && /no es té en compte/.test(gener.avisos[0]?.ca || ''),
    'Rebuda el 10/01: en un càlcul amb efectes l\'1/1 no es té en compte (sense efecte retroactiu), amb avís');
  const febrer = a(`${EX}-01-10`, `${EX}-02-01`, { coneixement: `${EX}-01-10`, anterior: { percentatge: '4.37', percentatge_aplicat: '4.37' },
    regularitzacio: { retribucions_satisfetes: '5000', retencions_practicades: '218.50' } });
  comprova(c(febrer).minimTotal === eur(40000) && febrer.regularitzat,
    `Des de l'1/2 sí, amb la regularització de l'art. 25 (${febrer.percentatge} % anual, ${febrer.percentatge_aplicat} % la resta de l'any)`);
  comprova(febrer.percentatge_aplicat === '1.46', '(1.020 − 218,50) ÷ (60.000 − 5.000) = 1,46 % la resta de l\'any');
  comprova(/Falten la data/.test(llança(() => calcula({ parametres: P, exercici: EX, retribucions: '60000', dades: casat('a') })) || ''),
    'Sense les dates de la comunicació no es pot calcular el cònjuge');
  comprova(calcula({ parametres: P, exercici: EX, retribucions: '60000', dades: casat('b') }).avisos.length === 0,
    'Opció b): sense increment, no cal cap data ni hi ha avís');
}

// ─── 9. Comunicació inicial d'un perceptor nou (arts. 27.1.a, 31.a i 31.b) ──
seccio('Comunicació inicial: treballador que comença l\'1/3');
{
  const ini = (rebuda_el, dataEfectes, extra = {}) => calcula({
    parametres: P, exercici: Number(dataEfectes.slice(0, 4)), retribucions: '60000', dades: casat('a'), data_efectes: dataEfectes,
    comunicacio: { tipus: 'inicial', data_efectes: `${EX}-03-01`, rebuda_el, inici_relacio: `${EX}-03-01`, relacio_laboral: true, ...extra },
  });
  const r5 = ini(`${EX}-03-05`, `${EX}-03-01`);
  comprova(r5.mode === 'comunicacio' && c(r5).minimTotal === eur(40000) && r5.percentatge === '1.70' && r5.avisos.length === 0,
    `Comunica el 5/3 (dins dels 10 dies): compta des de l'1/3, també el cònjuge, sense avís (${r5.percentatge} %)`);
  comprova(ini(`${EX}-03-11`, `${EX}-03-01`).avisos.length === 0, 'Comunica l\'11/3 (el desè dia): dins del termini');
  const r20 = ini(`${EX}-03-20`, `${EX}-03-01`);
  comprova(r20.mode === 'sense_comunicacio' && r20.percentatge === '4.37' && /fora del termini/.test(r20.avisos[0]?.ca || '') && /01\/04\/2026/.test(r20.avisos[0].ca),
    `Comunica el 20/3: amb efectes l'1/3 no compta (sense comunicació, ${r20.percentatge} %), amb avís: s'aplica des de l'1/4`);
  const r20b = ini(`${EX}-03-20`, `${EX}-04-01`);
  comprova(r20b.mode === 'comunicacio' && c(r20b).minimTotal === eur(40000) && /es té en compte/.test(r20b.avisos[0]?.ca || ''),
    'Comunica el 20/3: des de l\'1/4 compta (variació, art. 27.1.b), amb avís');
  const seguent = calcula({
    parametres: P, exercici: EX + 1, retribucions: '60000', dades: casat('a'), data_efectes: `${EX + 1}-01-01`,
    comunicacio: { tipus: 'inicial', data_efectes: `${EX}-03-01`, rebuda_el: `${EX}-03-05`, inici_relacio: `${EX}-03-01`, relacio_laboral: true },
  });
  comprova(c(seguent).minimTotal === eur(24000) && /No s'ha rebut la comunicació anual/.test(seguent.avisos[0]?.ca || ''),
    'No renova per a l\'any següent: des de l\'1/1 el cònjuge no compta, amb avís');
  comprova(/data d'inici de la relació/.test(llança(() => ini(`${EX}-03-05`, `${EX}-03-01`, { inici_relacio: null })) || ''),
    'Sense la data d\'inici de la relació no es pot calcular una comunicació inicial');
  const noLab = (rebuda_el) => ini(rebuda_el, `${EX}-03-01`, { relacio_laboral: false, inici_relacio: `${EX}-03-10` });
  comprova(noLab(`${EX}-03-09`).avisos.length === 0 && /fora del termini/.test(noLab(`${EX}-03-10`).avisos[0]?.ca || ''),
    'Rendes no laborals (art. 31.b, sentit estricte): rebuda el 9/3, abans del primer pagament (10/3), compta; el mateix 10/3 ja és fora de termini');
  const mod = calcula({ parametres: P, exercici: EX, retribucions: '60000', dades: casat('a'), data_efectes: `${EX}-01-01`,
    comunicacio: { tipus: 'modificacio', data_efectes: `${EX}-01-01`, rebuda_el: `${EX}-01-10`, inici_relacio: `${EX - 5}-01-01` } });
  comprova(c(mod).minimTotal === eur(24000), 'Una modificació segueix el límit del 15 de desembre (rebuda el 10/1: no compta l\'1/1)');
}

// ─── 10. Arrodoniment i entrades ────────────────────────────────────────────
seccio('Arrodoniment i entrades');
comprova(aCentims('1234,5') === 123450 && aCentims('0.05') === 5 && aCentims(17367.96) === 1736796 && aCentims('x') === null,
  'Imports en cèntims exactes (sense coma flotant)');
{
  // 2.620 / 60.000 = 4,3666… → 4,37 (meitats cap amunt)
  const r = calc(base(), '60000');
  comprova(r.percentatge === '4.37', 'Arrodoniment a dos decimals (art. 24.1.d del Reglament)');
}
comprova(/Paràmetres incomplets/.test(llança(() => calcula({ parametres: { ...P, tipus: undefined }, exercici: EX, retribucions: '1', dades: null })) || ''),
  'Sense algun paràmetre de l\'exercici no es calcula (cap valor fix al codi)');
comprova(/retribucions/.test(llança(() => calc(base(), '0')) || ''), 'Sense retribucions no es calcula');

// ─── 11. Cas de producció: inicial no laboral fora de termini ───────────────
seccio('Inicial no laboral fora de termini: inici 01/10, rebuda 21/10 (cas de la sol·licitud 138d9033)');
{
  const COM = { tipus: 'inicial', data_efectes: `${EX}-10-01`, rebuda_el: `${EX}-10-21`, inici_relacio: `${EX}-10-01`, relacio_laboral: false };
  const dades = base({ comunicacio: { tipus: 'inicial' }, estat_civil: { estat: 'casat' }, conjuge: { situacio: 'a' } });
  const r1 = calcula({ parametres: P, exercici: EX, retribucions: '60000', cotitzacions: '0', dades, comunicacio: COM, data_efectes: `${EX}-10-01` });
  comprova(r1.mode === 'sense_comunicacio' && r1.percentatge === '4.37' && /fora del termini/.test(r1.avisos[0]?.ca || ''),
    `01/10: encara sense comunicació (art. 24.4), 4,37 % (${r1.percentatge}), amb avís`);
  // El càlcul anterior (de la mateixa sol·licitud) no la va fer servir: per defecte, la data de recepció
  const coneixement = coneixementPerDefecte({ mode: 'comunicacio', requestId: 'R', anterior: { request_id: 'R', mode_aplicat: r1.mode }, rebudaEl: COM.rebuda_el });
  comprova(coneixement === `${EX}-10-21`, `Data de coneixement per defecte: la de recepció (${coneixement})`);
  const r2 = calcula({
    parametres: P, exercici: EX, retribucions: '60000', cotitzacions: '0', dades, comunicacio: COM, data_efectes: `${EX}-11-01`,
    anterior: { percentatge: r1.percentatge, percentatge_aplicat: r1.percentatge_aplicat }, coneixement,
    regularitzacio: { retribucions_satisfetes: '5000', retencions_practicades: '218.50' },
  });
  comprova(r2.mode === 'comunicacio' && c(r2).minimTotal === eur(40000) && c(r2).QL === eur(1020) && r2.percentatge === '1.70',
    `01/11: amb la comunicació i el cònjuge (mínim 40.000 €), quota anual 1.020 €, 1,70 % (${r2.percentatge})`);
  comprova(r2.regularitzat && r2.percentatge_aplicat === '1.46',
    `Regularització (art. 25): (1.020 − 218,50) ÷ (60.000 − 5.000) = 1,457… → ${r2.percentatge_aplicat} % (arrodonit)`);
}

seccio('Data de coneixement per defecte i avís de comunicació no utilitzada');
{
  const def = (mode, anterior) => coneixementPerDefecte({ mode, requestId: 'R', anterior, rebudaEl: `${EX}-10-21` });
  comprova(def('comunicacio', null) === null, 'Sense càlcul anterior: cap data (no és una variació)');
  comprova(def('comunicacio', { request_id: 'ALTRA', mode_aplicat: 'comunicacio' }) === `${EX}-10-21`, 'Comunicació nova (una altra sol·licitud): la de recepció');
  comprova(def('comunicacio', { request_id: 'R', mode_aplicat: 'sense_comunicacio' }) === `${EX}-10-21`,
    'Mateixa comunicació, encara no aplicada (sense comunicació o inicial fora de termini): la de recepció');
  comprova(def('comunicacio', { request_id: 'R', mode_aplicat: 'comunicacio' }) === null,
    'Mateixa comunicació ja aplicada: cap data per defecte (la variació és d\'una altra dada)');
  comprova(def('sense_comunicacio', { request_id: 'ALTRA', mode_aplicat: 'comunicacio' }) === null, 'Calculant sense comunicació: cap data per defecte');
  comprova(coneixementPerDefecte({ mode: 'comunicacio', requestId: 'R', anterior: { request_id: 'ALTRA' }, rebudaEl: null }) === null, 'Sense recepció: cap data');
  const amb = calcula({ parametres: P, exercici: EX, retribucions: '60000', cotitzacions: '0', dades: null, comunicacio_rebuda: true });
  comprova(amb.avisos[0] === AVIS_SENSE_COMUNICACIO && /no la fa servir/.test(amb.avisos[0].ca) && amb.avisos[0].en,
    'Comunicació rebuda però càlcul sense comunicació: avís (català i anglès)');
  const senseRebuda = calcula({ parametres: P, exercici: EX, retribucions: '60000', cotitzacions: '0', dades: null });
  comprova(senseRebuda.avisos.length === 0, 'Sense cap comunicació rebuda: cap avís');
  const ambDades = calc(base(), '60000', { comunicacio_rebuda: true });
  comprova(!ambDades.avisos.includes(AVIS_SENSE_COMUNICACIO), 'Calculant amb la comunicació: cap avís');
}

console.log(`\n${total - fallades}/${total} correctes`);
process.exit(fallades ? 1 : 0);
