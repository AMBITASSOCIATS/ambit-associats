// irpf-calcul.js
//
// Càlcul del percentatge de retenció de l'IRPF sobre rendes del treball no
// cotitzades (art. 24.1 del Reglament), exactament com l'apartat "CÀLCUL DEL
// PERCENTATGE" de docs/plantilla-comunicacio-dades-irpf.md. Dues còpies
// idèntiques byte a byte (src/portal/irpf i supabase/functions/_shared); una
// prova ho comprova. Sense imports.
//
// · Els paràmetres arriben de la taula de cada exercici (portal.irpf_parametres);
//   aquí no n'hi ha cap de fix.
// · Tots els imports es calculen en cèntims (enters) i els percentatges en
//   centèsimes de punt, amb arrodoniment a la unitat més propera (meitats
//   cap amunt). Res no es calcula amb decimals de coma flotant.
// · Sense comunicació (art. 24.4 del Reglament, pas 12): passos 1, 2, 3, 7
//   (restant només el mínim personal, sempre el general: el pagador no coneix
//   la incapacitat; art. 51.1.a de la Llei), 8, 9, 10 i 11. Sense cap dada de
//   l'art. 28 (cònjuge, familiars, habitatge, pensions ni plans).
// · Cònjuge (arts. 27.1.b, 28.3 i 31.d del Reglament): la seva situació només
//   compta per a l'exercici de la comunicació. Rebuda fins al 15 de desembre de
//   l'any anterior, s'aplica des de la data d'efectes; rebuda després, és una
//   variació: s'aplica des del mes següent a la recepció, sense efecte
//   retroactiu. Si l'any anterior no se n'ha rebut cap per a l'exercici, des de
//   l'1 de gener no es té en compte. En tots dos casos, avís al personal.
// · Regularització (arts. 25 i 27.1.b): el percentatge nou s'aplica des del mes
//   següent a aquell en què el pagador coneix la variació.
// · Comunicació inicial d'un perceptor nou (arts. 27.1.a, 31.a i 31.b): rebuda
//   dins dels 10 dies següents a l'inici de la relació laboral (o, si no és
//   laboral, abans del primer pagament: com a molt tard el dia anterior), compta des de la seva data
//   d'efectes, també el cònjuge, sense avís. Fora d'aquest termini és una
//   variació: des del mes següent a rebre-la, amb avís; abans, el càlcul es fa
//   sense comunicació. El límit del 15 de desembre només afecta la renovació
//   anual i les modificacions.

/* global BigInt */

export const PARAMETRES = [
  'minim_personal', 'minim_incapacitat', 'limit_conjuge', 'reduccio_familiar', 'coeficient_discapacitat',
  'max_matricules', 'salari_minim', 'habitatge_percentatge', 'habitatge_maxim', 'plans_percentatge', 'plans_maxim',
  'tipus', 'bonificacio_percentatge', 'bonificacio_maxim', 'despeses_percentatge', 'despeses_maxim',
  'edat_descendents', 'edat_ascendents', 'regularitzacio_llindar', 'regularitzacio_maxim',
];
const EDATS = ['edat_descendents', 'edat_ascendents'];

// ─── Aritmètica exacta ──────────────────────────────────────────────────────

// "1234.5", "1234,56", 1234.5 → cèntims (o centèsimes) enters; null si no és vàlid
export const aCentims = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const t = typeof v === 'number' ? v.toFixed(2) : String(v).trim().replace(',', '.');
  const m = t.match(/^(\d+)(?:\.(\d{1,2}))?$/);
  if (!m) return null;
  return Number(m[1]) * 100 + Number(((m[2] || '') + '00').slice(0, 2));
};

// round(a × b / c) amb enters (BigInt) i meitats cap amunt; a, b ≥ 0, c > 0
const DOS = BigInt(2);
const mulDiv = (a, b, c) => {
  const n = BigInt(a) * BigInt(b);
  const d = BigInt(c);
  return Number((DOS * n + d) / (DOS * d));
};
const mulDiv3 = (a, b, c, d) => {
  const n = BigInt(a) * BigInt(b) * BigInt(c);
  const q = BigInt(d);
  return Number((DOS * n + q) / (DOS * q));
};
const min = (...x) => Math.min(...x);
const max0 = (x) => Math.max(0, x);

// ─── Dates (AAAA-MM-DD) ─────────────────────────────────────────────────────
const DATA = /^\d{4}-\d{2}-\d{2}$/;
export const dma = (s) => (s ? s.split('-').reverse().join('/') : '');
// Primer dia del mes següent: "2026-10-20" → "2026-11-01"
export const mesSeguent = (s) => {
  const [a, m] = s.split('-').map(Number);
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, '0')}-01`;
};

const sumaDies = (s, n) => {
  const d = new Date(`${s}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// Vigència d'una comunicació inicial: { aplica, des_de, avis }
//   comunicacio: { tipus, data_efectes, rebuda_el, inici_relacio, relacio_laboral }
export const vigenciaInicial = ({ dataEfectes, comunicacio }) => {
  const c = comunicacio || {};
  if (!DATA.test(String(c.data_efectes || '')) || !DATA.test(String(c.rebuda_el || ''))) {
    throw new Error('Falten la data d\'efectes i la data de recepció de la comunicació');
  }
  if (!DATA.test(String(c.inici_relacio || ''))) {
    throw new Error('Cal indicar la data d\'inici de la relació laboral (o del primer pagament) del perceptor');
  }
  const laboral = c.relacio_laboral !== false;
  // art. 31.a: 10 dies des de l'inici de la relació laboral; art. 31.b: abans del
  // primer pagament, en sentit estricte (el mateix dia ja és fora de termini)
  const limit = laboral ? sumaDies(c.inici_relacio, 10) : sumaDies(c.inici_relacio, -1);
  if (c.rebuda_el <= limit) return { aplica: true, des_de: c.data_efectes, avis: null };
  const desDe = [c.data_efectes, mesSeguent(c.rebuda_el)].sort()[1];
  const aplica = dataEfectes >= desDe;
  const termini = laboral
    ? { ca: `dels 10 dies següents a l'inici de la relació laboral (${dma(c.inici_relacio)}, art. 31.a)`, en: `the 10 days following the start of employment (${dma(c.inici_relacio)}, Article 31.a)` }
    : { ca: `del primer pagament (${dma(c.inici_relacio)}, art. 31.b)`, en: `the first payment (${dma(c.inici_relacio)}, Article 31.b)` };
  return {
    aplica, des_de: desDe,
    avis: {
      ca: `La comunicació inicial es va rebre el ${dma(c.rebuda_el)}, fora del termini ${laboral ? '' : 'd\'abans '}${termini.ca}: es tracta com una variació i s'aplica des del ${dma(desDe)} (art. 27.1.b del Reglament). ${aplica ? 'En aquest càlcul es té en compte.' : 'En aquest càlcul no es té en compte: es calcula sense comunicació (art. 24.4).'}`,
      en: `The initial communication was received on ${dma(c.rebuda_el)}, outside the period ${laboral ? 'of ' : 'before '}${termini.en}: it is treated as a change and applies from ${dma(desDe)} (Article 27.1.b of the Regulation). ${aplica ? 'It is taken into account in this calculation.' : 'It is not taken into account in this calculation: calculated without communication (Article 24.4).'}`,
    },
  };
};

// Situació del cònjuge per a un càlcul: { aplica, des_de, avis }
//   exercici, dataEfectes: les del càlcul
//   comunicacio: { data_efectes, rebuda_el } (rebuda_el: data en què el pagador la va rebre)
export const situacioConjuge = ({ exercici, dataEfectes, comunicacio }) => {
  const any = Number(String(comunicacio?.data_efectes || '').slice(0, 4));
  const rebuda = comunicacio?.rebuda_el;
  if (!DATA.test(String(comunicacio?.data_efectes || '')) || !DATA.test(String(rebuda || ''))) {
    throw new Error('Falten la data d\'efectes i la data de recepció de la comunicació');
  }
  const limit = `${exercici - 1}-12-15`;
  // Comunicació inicial de l'exercici: el cònjuge segueix la vigència de la
  // comunicació (vigenciaInicial); el 15 de desembre és per a la renovació
  if (comunicacio.tipus === 'inicial' && any === exercici) return { aplica: true, des_de: comunicacio.data_efectes, avis: null };
  if (any !== exercici) {
    return {
      aplica: false, des_de: null,
      avis: {
        ca: `No s'ha rebut la comunicació anual de la situació del cònjuge per a l'exercici ${exercici} abans del 15/12/${exercici - 1}: des de l'1/1/${exercici} no es té en compte la de l'exercici ${any} (arts. 28.3 i 31.d del Reglament).`,
        en: `The annual communication of the spouse's situation for tax year ${exercici} was not received before 15/12/${exercici - 1}: from 1/1/${exercici} the one for tax year ${any} is not taken into account (Articles 28.3 and 31.d of the Regulation).`,
      },
    };
  }
  if (rebuda <= limit) return { aplica: true, des_de: comunicacio.data_efectes, avis: null };
  // Rebuda després del 15 de desembre: variació, des del mes següent a la recepció
  const desDe = [comunicacio.data_efectes, mesSeguent(rebuda)].sort()[1];
  const aplica = dataEfectes >= desDe;
  return {
    aplica, des_de: desDe,
    avis: {
      ca: `La comunicació es va rebre el ${dma(rebuda)}, després del 15/12/${exercici - 1}: la situació del cònjuge es tracta com una variació i s'aplica des del ${dma(desDe)}, sense efecte retroactiu (arts. 25 i 27.1.b del Reglament). ${aplica ? 'En aquest càlcul es té en compte.' : 'En aquest càlcul no es té en compte.'}`,
      en: `The communication was received on ${dma(rebuda)}, after 15/12/${exercici - 1}: the spouse's situation is treated as a change and applies from ${dma(desDe)}, without retroactive effect (Articles 25 and 27.1.b of the Regulation). ${aplica ? 'It is taken into account in this calculation.' : 'It is not taken into account in this calculation.'}`,
    },
  };
};

// ─── Formats ────────────────────────────────────────────────────────────────
const milers = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
export const euros = (c) => `${c < 0 ? '−' : ''}${milers(Math.floor(Math.abs(c) / 100))},${String(Math.abs(c) % 100).padStart(2, '0')} €`;
export const percent = (h) => `${Math.floor(h / 100)},${String(h % 100).padStart(2, '0')} %`;
// Centèsimes → text amb punt per desar a la base ("4.37")
export const decimal = (h) => `${Math.floor(h / 100)}.${String(h % 100).padStart(2, '0')}`;
const coef = (h) => (h % 100 === 0 ? String(h / 100) : `${Math.floor(h / 100)},${String(h % 100).padStart(2, '0').replace(/0$/, '')}`);

// ─── Paràmetres ─────────────────────────────────────────────────────────────
export const llegeixParametres = (p) => {
  const out = {};
  const falten = [];
  for (const k of PARAMETRES) {
    if (EDATS.includes(k)) {
      const n = Number(p?.[k]);
      if (Number.isInteger(n) && n > 0) out[k] = n; else falten.push(k);
    } else {
      const c = aCentims(p?.[k]);
      if (c === null) falten.push(k); else out[k] = c;
    }
  }
  if (falten.length) throw new Error(`Paràmetres incomplets: ${falten.join(', ')}`);
  return out;
};

// ─── Persones dels apartats 5, 6 i 7 ────────────────────────────────────────
const reduccionsFamiliars = (dades, exercici, P) => {
  const out = [];
  for (const tipus of ['descendents', 'ascendents', 'tutelats']) {
    for (const x of dades?.[tipus] || []) {
      const edat = x.any_naixement ? exercici - Number(x.any_naixement) : null;
      const persones = Math.max(1, Number(x.persones) || 1);
      const motius = [];
      if (x.conviu !== true) motius.push('no conviu ni en depèn');
      if (x.rendes_superiors !== false) motius.push('rendes superiors al salari mínim');
      let especial = false;   // coeficient per discapacitat o dependència
      if (tipus === 'descendents') {
        especial = x.discapacitat === true;
        if (!(edat !== null && edat < P.edat_descendents) && !especial) motius.push(`${P.edat_descendents} anys o més sense discapacitat`);
      } else if (tipus === 'ascendents') {
        especial = x.discapacitat === true || x.dependencia === true;
        if (!(edat !== null && edat > P.edat_ascendents) && !especial) motius.push(`${P.edat_ascendents} anys o menys sense discapacitat ni dependència`);
      } else {
        especial = x.discapacitat === true;
      }
      const compleix = motius.length === 0;
      const base = especial ? mulDiv(P.reduccio_familiar, P.coeficient_discapacitat, 100) : P.reduccio_familiar;
      const reduccio = compleix ? mulDiv(base, 1, persones) : 0;
      // Matrícules (art. 35.2.d i 35.3 Llei): només descendents menors de 25 anys
      // que donen dret a la reducció; mínim(import pagat, 300 €) prorratejat
      // entre les persones amb dret, com la resta de reduccions de l'apartat 2
      const matPagades = tipus === 'descendents' && compleix && edat !== null && edat < P.edat_descendents
        ? min(aCentims(x.matricules) || 0, P.max_matricules) : 0;
      const matricules = matPagades ? mulDiv(matPagades, 1, persones) : 0;
      out.push({
        tipus, nom: x.nom || '—', edat, persones, especial, compleix, motius, base, reduccio, matricules,
        formula: compleix
          ? `${euros(P.reduccio_familiar)}${especial ? ` × ${coef(P.coeficient_discapacitat)}` : ''} ÷ ${persones}${matricules ? ` + matrícules ${euros(matPagades)} ÷ ${persones}` : ''}`
          : `no compleix els requisits: ${motius.join('; ')}`,
      });
    }
  }
  return out;
};

// ─── Càlcul ─────────────────────────────────────────────────────────────────
// entrada: {
//   parametres,               fila de portal.irpf_parametres de l'exercici
//   exercici,                 any (per a les edats i els imports de l'apartat 8)
//   retribucions,             R: retribucions anuals totals estimades (euros)
//   cotitzacions,             cotitzacions a un sistema públic a càrrec del perceptor (euros)
//   dades,                    respostes de la comunicació (null: sense comunicació, art. 24.4)
//   data_efectes,             data d'efectes del càlcul (AAAA-MM-DD)
//   comunicacio,              { data_efectes, rebuda_el } de la comunicació (si hi ha dades)
//   anterior,                 { percentatge, percentatge_aplicat } del càlcul anterior del mateix exercici, o null
//   coneixement,              data en què el pagador coneix la variació (si n'hi ha d'anterior)
//   regularitzacio,           { retribucions_satisfetes, retencions_practicades } (euros), si n'hi ha d'anterior
// }
export const calcula = (entrada) => {
  const P = llegeixParametres(entrada.parametres);
  const exercici = Number(entrada.exercici);
  if (!Number.isInteger(exercici)) throw new Error('Exercici no vàlid');
  const R = aCentims(entrada.retribucions);
  const cot = aCentims(entrada.cotitzacions ?? 0);
  if (!R || R <= 0) throw new Error('Cal indicar les retribucions anuals estimades');
  if (cot === null) throw new Error('Cotitzacions no vàlides');
  let d = entrada.dades || null;
  const dataEfectes = String(entrada.data_efectes || `${exercici}-01-01`);
  if (!DATA.test(dataEfectes) || Number(dataEfectes.slice(0, 4)) !== exercici) throw new Error('Data d\'efectes no vàlida per a l\'exercici');
  const avisos = [];
  // Comunicació inicial rebuda fora de termini: fins que s'aplica, sense comunicació
  if (d && entrada.comunicacio?.tipus === 'inicial') {
    const v = vigenciaInicial({ dataEfectes, comunicacio: entrada.comunicacio });
    if (v.avis) avisos.push(v.avis);
    if (!v.aplica) d = null;
  }
  const ambComunicacio = !!d;
  // Variació (hi ha un càlcul anterior de l'exercici): s'aplica des del mes
  // següent a aquell en què el pagador la coneix (art. 27.1.b del Reglament)
  if (entrada.anterior) {
    const coneixement = String(entrada.coneixement || '');
    if (!DATA.test(coneixement)) throw new Error('Cal indicar la data en què el pagador coneix la variació');
    if (dataEfectes < mesSeguent(coneixement)) {
      throw new Error(`La variació s'aplica des del mes següent a aquell en què el pagador la coneix (art. 27.1.b del Reglament): la data d'efectes ha de ser el ${dma(mesSeguent(coneixement))} o posterior`);
    }
  }
  const passos = [];
  // valor: cèntims (imports) o text (percentatges)
  const pas = (num, ca, en, formula, valor) => passos.push({ num, ca, en, formula, valor });

  // 1. Despeses deduïbles (art. 13.2 Llei)
  const tresPerCent = mulDiv(R, P.despeses_percentatge, 10000);
  const despeses = cot + min(tresPerCent, P.despeses_maxim);
  pas('1', 'Despeses deduïbles (art. 13.2 Llei)', 'Deductible expenses (Art. 13.2 of the Law)',
    `${euros(cot)} + mínim(${percent(P.despeses_percentatge)} × ${euros(R)}; ${euros(P.despeses_maxim)})`, despeses);

  // 2. Base de tributació
  const BT = max0(R - despeses);
  pas('2', 'Base de tributació', 'Tax base', `${euros(R)} − ${euros(despeses)}`, BT);

  // 3. Mínim personal (sense comunicació no es coneix la incapacitat)
  const incapacitat = ambComunicacio && d.perceptor?.incapacitat === true;
  const MP = incapacitat ? P.minim_incapacitat : P.minim_personal;
  pas('3', 'Mínim personal', 'Personal allowance', incapacitat ? 'incapacitat (art. 35.1 Llei)' : 'general (art. 35.1 Llei)', MP);

  let minimTotal = MP;
  let familiars = 0;
  let persones = [];
  let habitatge = 0;
  let plans = 0;
  let pensions = 0;
  let BL;

  if (ambComunicacio) {
    // 4. Increment per cònjuge (art. 35.1 Llei)
    const c = d.estat_civil?.estat === 'casat' ? d.conjuge || {} : {};
    let increment = 0;
    let formula = 'sense cònjuge o parella estable';
    if (c.situacio === 'a' || c.situacio === 'c') {
      const sc = situacioConjuge({ exercici, dataEfectes, comunicacio: entrada.comunicacio });
      if (sc.avis) avisos.push(sc.avis);
      if (sc.aplica) {
        const S = c.situacio === 'a' ? 0 : aCentims(c.rendes) || 0;
        increment = max0(P.limit_conjuge - MP - S);
        formula = `opció ${c.situacio}) màxim(0; ${euros(P.limit_conjuge)} − ${euros(MP)} − ${euros(S)})`;
      } else {
        formula = sc.des_de
          ? `opció ${c.situacio}) no es té en compte fins al ${dma(sc.des_de)} (art. 27.1.b)`
          : `opció ${c.situacio}) no es té en compte: no s'ha rebut la comunicació anual (arts. 28.3 i 31.d)`;
      }
    } else if (c.situacio === 'b') {
      formula = 'opció b): sense increment';
    }
    minimTotal = MP + increment;
    pas('4', 'Increment per cònjuge (art. 35.1 Llei)', 'Spouse increment (Art. 35.1 of the Law)', formula, increment);
    pas('4', 'Mínim total', 'Total allowance', `${euros(MP)} + ${euros(increment)}`, minimTotal);

    // 5. Reduccions familiars (art. 35.2 i 35.3 Llei)
    persones = reduccionsFamiliars(d, exercici, P);
    familiars = persones.reduce((s, x) => s + x.reduccio + x.matricules, 0);
    pas('5', 'Reduccions familiars (art. 35.2 i 35.3 Llei)', 'Family allowances (Art. 35.2 and 35.3 of the Law)',
      persones.length ? persones.map((x) => `${x.nom}: ${x.compleix ? euros(x.reduccio + x.matricules) : '0,00 €'}`).join(' · ') : 'cap persona declarada', familiars);

    // 6. Reduccions arts. 38 i 39 Llei (només els imports de l'exercici)
    const a = d.altres || {};
    const del = (k) => (String(a[k]?.any || '') === String(exercici) ? aCentims(a[k]?.import) || 0 : 0);
    const impHab = del('habitatge');
    habitatge = min(mulDiv(impHab, P.habitatge_percentatge, 10000), P.habitatge_maxim);
    pas('6', 'Habitatge habitual (art. 38 Llei)', 'Main residence (Art. 38 of the Law)',
      `mínim(${percent(P.habitatge_percentatge)} × ${euros(impHab)}; ${euros(P.habitatge_maxim)})`, habitatge);
    const impPlans = del('plans');
    plans = min(impPlans, mulDiv(BT, P.plans_percentatge, 10000), P.plans_maxim);
    pas('6', 'Plans de pensions (art. 39.1 Llei)', 'Pension plans (Art. 39.1 of the Law)',
      `mínim(${euros(impPlans)}; ${percent(P.plans_percentatge)} × ${euros(BT)}; ${euros(P.plans_maxim)})`, plans);
    pensions = del('pensions');
    pas('6', 'Pensions compensatòries i anualitats per aliments (art. 39.2 Llei)', 'Maintenance payments (Art. 39.2 of the Law)',
      euros(pensions), pensions);

    // 7. Base de liquidació
    const reduccions = minimTotal + familiars + habitatge + plans + pensions;
    BL = max0(BT - reduccions);
    pas('7', 'Base de liquidació', 'Taxable base', `màxim(0; ${euros(BT)} − ${euros(reduccions)})`, BL);
  } else {
    // 12. Sense comunicació (art. 24.4 del Reglament): pas 7 restant només el mínim personal
    BL = max0(BT - MP);
    pas('7', 'Base de liquidació (sense comunicació, art. 24.4 del Reglament)', 'Taxable base (no communication, Art. 24.4 of the Regulation)',
      `màxim(0; ${euros(BT)} − ${euros(MP)}): només el mínim personal (art. 51.1.a Llei)`, BL);
  }

  // 8. Quota de tributació
  const QT = mulDiv(BL, P.tipus, 10000);
  pas('8', 'Quota de tributació', 'Gross tax', `${percent(P.tipus)} × ${euros(BL)}`, QT);

  // 9. Bonificació (art. 46 Llei), amb el mínim personal del primer paràgraf de l'art. 35.1
  const baseBonif = max0(BT - MP);
  const bonificacio = min(P.bonificacio_maxim, mulDiv3(baseBonif, P.bonificacio_percentatge, P.tipus, 100000000));
  pas('9', 'Bonificació (art. 46 Llei)', 'Tax credit (Art. 46 of the Law)',
    `mínim(${euros(P.bonificacio_maxim)}; ${percent(P.bonificacio_percentatge)} × ${percent(P.tipus)} × màxim(0; ${euros(BT)} − ${euros(MP)}))`, bonificacio);

  // 10. Quota de liquidació
  const QL = max0(QT - bonificacio);
  pas('10', 'Quota de liquidació', 'Net tax', `màxim(0; ${euros(QT)} − ${euros(bonificacio)})`, QL);

  // 11. Percentatge (dos decimals, art. 24.1.d del Reglament)
  const percentatge = mulDiv(QL, 10000, R);
  pas('11', 'Percentatge', 'Withholding rate', `${euros(QL)} ÷ ${euros(R)} × 100`, percent(percentatge));

  // 13. Regularització (art. 25 del Reglament)
  let aplicat = percentatge;
  let regularitzacio = null;
  const ant = entrada.anterior;
  if (ant) {
    const anterior = aCentims(ant.percentatge);
    const anteriorAplicat = aCentims(ant.percentatge_aplicat ?? ant.percentatge);
    const variacio = Math.abs(percentatge - anterior);
    if (variacio <= P.regularitzacio_llindar) {
      aplicat = anteriorAplicat;
      regularitzacio = { aplica: false, anterior, anterior_aplicat: anteriorAplicat, variacio };
      pas('13', 'Regularització (art. 25 del Reglament)', 'Adjustment (Art. 25 of the Regulation)',
        `variació ${percent(variacio)} ≤ ${percent(P.regularitzacio_llindar)}: es manté el percentatge aplicat`, percent(aplicat));
    } else {
      const satisfetes = aCentims(entrada.regularitzacio?.retribucions_satisfetes);
      const practicades = aCentims(entrada.regularitzacio?.retencions_practicades);
      if (satisfetes === null || practicades === null) {
        throw new Error('La variació supera el llindar: cal indicar les retribucions satisfetes i les retencions practicades de l\'exercici');
      }
      if (satisfetes >= R) throw new Error('Les retribucions satisfetes han de ser inferiors a les anuals estimades');
      const regularitzat = min(P.regularitzacio_maxim, mulDiv(max0(QL - practicades), 10000, R - satisfetes));
      aplicat = regularitzat;
      regularitzacio = { aplica: true, anterior, anterior_aplicat: anteriorAplicat, variacio, satisfetes, practicades, regularitzat };
      pas('13', 'Regularització (art. 25 del Reglament)', 'Adjustment (Art. 25 of the Regulation)',
        `mínim(${percent(P.regularitzacio_maxim)}; màxim(0; ${euros(QL)} − ${euros(practicades)}) ÷ (${euros(R)} − ${euros(satisfetes)}) × 100)`, percent(aplicat));
    }
  }

  return {
    mode: ambComunicacio ? 'comunicacio' : 'sense_comunicacio',
    exercici,
    percentatge: decimal(percentatge),
    percentatge_aplicat: decimal(aplicat),
    regularitzat: !!regularitzacio?.aplica,
    imports: {
      retribucions: R, cotitzacions: cot, despeses, BT, MP, minimTotal, familiars, habitatge, plans, pensions, BL, QT, bonificacio, QL,
    },
    persones,
    regularitzacio,
    passos,
    avisos,
  };
};
