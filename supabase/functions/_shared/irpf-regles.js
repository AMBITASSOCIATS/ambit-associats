// irpf-regles.js
//
// Regles comunes del formulari "Comunicació de dades personals i familiars al
// pagador" (IRPF): les fa servir el formulari web (per guiar el perceptor) i
// l'Edge Function portal-irpf (per decidir). Hi ha dues còpies idèntiques byte
// a byte (src/portal/irpf i supabase/functions/_shared); una prova ho
// comprova. Sense imports, perquè funcioni als dos llocs.
//
// Font dels textos i dels criteris: docs/plantilla-comunicacio-dades-irpf.md.

export const VERSIO = 'IRPF-COM v1';
export const VERSIONS_ACCEPTADES = ['IRPF-COM v1'];

export const MAX = { descendents: 15, ascendents: 8, tutelats: 8 };

// Límits d'edat dels textos d'ajuda (només per als avisos, que no bloquegen;
// el càlcul fa servir els de la taula de paràmetres de cada exercici)
export const EDAT_DESCENDENTS = 25;
export const EDAT_ASCENDENTS = 65;

export const OPCIONS = {
  tipus: ['inicial', 'modificacio'],
  modifica: ['perceptor', 'familiars', 'economiques'],
  estat_civil: ['solter', 'casat', 'separat', 'divorciat', 'vidu'],
  situacio: ['a', 'b', 'c'],
  origen: ['judicial', 'conveni', 'notarial', 'civil'],
};

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFON = /^\+?[0-9 ().-]{6,25}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// ─── Neteja ─────────────────────────────────────────────────────────────────
// Deixa només les claus conegudes, amb el tipus correcte i longituds màximes.
// No comprova si està complet (això ho fa campsPendents).

const txt = (v, max = 200) => {
  if (v === null || v === undefined || typeof v === 'object') return '';
  // Treu els caràcters de control (el text arriba del navegador)
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
};
const bool = (v) => (v === true ? true : v === false ? false : null);
const opcio = (v, llista) => (llista.includes(v) ? v : '');
const data = (v) => {
  const t = txt(v, 10);
  if (!DATA.test(t)) return '';
  const d = new Date(`${t}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? '' : t;
};
const any = (v) => {
  const t = txt(v, 4);
  return /^\d{4}$/.test(t) ? t : '';
};
const enter = (v, min, max) => {
  const t = txt(v, 3);
  if (!/^\d{1,3}$/.test(t)) return '';
  const n = Number(t);
  return n >= min && n <= max ? String(n) : '';
};

// Import en euros: "1.234,56", "45.000", "1234.56" o "1234" → "1234.56" (o '' si no és vàlid)
export const netejaImport = (v) => {
  if (v === null || v === undefined || typeof v === 'object') return '';
  let t = String(v).replace(/[\s€]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');   // punts de milers
  if (!/^\d{1,9}(\.\d{1,2})?$/.test(t)) return '';
  const [e, d = ''] = t.split('.');
  return `${String(Number(e))}.${(d + '00').slice(0, 2)}`;
};

const persona = (p, tipus) => {
  if (!p || typeof p !== 'object') return null;
  const out = {
    id: UUID.test(String(p.id || '')) ? String(p.id) : '',
    nom: txt(p.nom),
    nrt: txt(p.nrt, 30),
    document: txt(p.document, 60),
    any_naixement: any(p.any_naixement),
    conviu: bool(p.conviu),
    rendes_superiors: bool(p.rendes_superiors),
    discapacitat: bool(p.discapacitat),
    persones: enter(p.persones, 1, 20),
  };
  if (tipus === 'descendents') out.matricules = netejaImport(p.matricules);
  if (tipus === 'ascendents') out.dependencia = bool(p.dependencia);
  return out;
};

const llista = (v, tipus) => (Array.isArray(v) ? v.slice(0, MAX[tipus]).map((p) => persona(p, tipus)).filter(Boolean) : []);

export const netejaDades = (d) => {
  const e = d && typeof d === 'object' ? d : {};
  const c = e.comunicacio || {};
  const p = e.perceptor || {};
  const ec = e.estat_civil || {};
  const cj = e.conjuge || {};
  const a = e.altres || {};
  const dc = e.declaracions || {};
  const tipus = opcio(c.tipus, OPCIONS.tipus);
  const estat = opcio(ec.estat, OPCIONS.estat_civil);
  const out = {
    comunicacio: {
      tipus,
      // Només en una modificació
      modifica: tipus === 'modificacio' && Array.isArray(c.modifica)
        ? OPCIONS.modifica.filter((k) => c.modifica.includes(k)) : [],
    },
    perceptor: {
      nom: txt(p.nom),
      nrt: txt(p.nrt, 30),
      document: txt(p.document, 60),
      domicili: txt(p.domicili, 300),
      email: txt(p.email, 200),
      telefon: txt(p.telefon, 30),
      representant_nom: txt(p.representant_nom),
      representant_nrt: txt(p.representant_nrt, 30),
      incapacitat: bool(p.incapacitat),
    },
    estat_civil: { estat, des_de: data(ec.des_de) },
    descendents: llista(e.descendents, 'descendents'),
    ascendents: llista(e.ascendents, 'ascendents'),
    tutelats: llista(e.tutelats, 'tutelats'),
    altres: {
      habitatge: { import: netejaImport(a.habitatge?.import), any: any(a.habitatge?.any) },
      pensions: {
        import: netejaImport(a.pensions?.import), any: any(a.pensions?.any), origen: opcio(a.pensions?.origen, OPCIONS.origen),
      },
      plans: { import: netejaImport(a.plans?.import), any: any(a.plans?.any) },
    },
    data_efectes: data(e.data_efectes),
    declaracions: {
      d1: dc.d1 === true, d2: dc.d2 === true, d3: dc.d3 === true, d4: dc.d4 === true, consentiment: dc.consentiment === true,
    },
  };
  // L'apartat 4 només si està casat/ada o en parella estable: si no, no es
  // desa cap dada del cònjuge
  if (estat === 'casat') {
    const situacio = opcio(cj.situacio, OPCIONS.situacio);
    out.conjuge = {
      nom: txt(cj.nom), nrt: txt(cj.nrt, 30), document: txt(cj.document, 60), situacio,
      rendes: situacio === 'c' ? netejaImport(cj.rendes) : '',
    };
  }
  // El consentiment de l'art. 9.2.a només té sentit si hi ha dades de discapacitat o dependència
  if (!requereixConsentiment(out)) out.declaracions.consentiment = false;
  return out;
};

// ─── Regles ─────────────────────────────────────────────────────────────────

// Alguna discapacitat o dependència marcada als apartats 5, 6 o 7
export const requereixConsentiment = (d) =>
  ['descendents', 'ascendents', 'tutelats'].some((k) =>
    (d?.[k] || []).some((p) => p && (p.discapacitat === true || p.dependencia === true)));

// Any de referència per a les edats ("a 31 de desembre"): el de la data d'efectes
export const anyReferencia = (d, avui) => Number(((d?.data_efectes || '') || avui).slice(0, 4));

// Camps obligatoris pendents: [{ seccio, camp }]
export const campsPendents = (d, avui) => {
  const out = [];
  const falta = (seccio, camp) => out.push({ seccio, camp });
  const buit = (v) => v === null || v === undefined || v === '';
  const anyMax = Number(avui.slice(0, 4));

  // 0. Tipus de comunicació
  if (!d.comunicacio?.tipus) falta(0, 'comunicacio.tipus');
  if (d.comunicacio?.tipus === 'modificacio' && !(d.comunicacio.modifica || []).length) falta(0, 'comunicacio.modifica');

  // 1. Dades del perceptor
  const p = d.perceptor || {};
  for (const k of ['nom', 'nrt', 'document', 'domicili']) if (buit(p[k])) falta(1, `perceptor.${k}`);
  if (p.email && !EMAIL.test(p.email)) falta(1, 'perceptor.email');
  if (p.telefon && !TELEFON.test(p.telefon)) falta(1, 'perceptor.telefon');
  // Representant legal (si escau): nom i NRT, tots dos
  if (!buit(p.representant_nom) && buit(p.representant_nrt)) falta(1, 'perceptor.representant_nrt');
  if (!buit(p.representant_nrt) && buit(p.representant_nom)) falta(1, 'perceptor.representant_nom');
  if (typeof p.incapacitat !== 'boolean') falta(1, 'perceptor.incapacitat');

  // 3. Estat civil
  if (!d.estat_civil?.estat) falta(3, 'estat_civil.estat');
  if (d.estat_civil?.des_de && d.estat_civil.des_de > avui) falta(3, 'estat_civil.des_de');

  // 4. Cònjuge o parella estable (només si està casat/ada o en parella estable)
  if (d.estat_civil?.estat === 'casat') {
    const c = d.conjuge || {};
    if (buit(c.nom)) falta(4, 'conjuge.nom');
    if (buit(c.document)) falta(4, 'conjuge.document');
    if (!c.situacio) falta(4, 'conjuge.situacio');
    if (c.situacio === 'c' && buit(c.rendes)) falta(4, 'conjuge.rendes');
  }

  // 5, 6 i 7. Persones declarades: dades bàsiques i nombre de persones amb dret
  [['descendents', 5], ['ascendents', 6], ['tutelats', 7]].forEach(([k, s]) => {
    (d[k] || []).forEach((x, i) => {
      const c = `${k}.${i}`;
      if (buit(x.nom)) falta(s, `${c}.nom`);
      if (buit(x.any_naixement) || Number(x.any_naixement) < 1900 || Number(x.any_naixement) > anyMax) falta(s, `${c}.any_naixement`);
      for (const b of ['conviu', 'rendes_superiors', 'discapacitat']) if (typeof x[b] !== 'boolean') falta(s, `${c}.${b}`);
      if (k === 'ascendents' && typeof x.dependencia !== 'boolean') falta(s, `${c}.dependencia`);
      if (buit(x.persones)) falta(s, `${c}.persones`);
    });
  });

  // 8. Altres reduccions: l'any d'aplicació és obligatori si s'indica un import
  const a = d.altres || {};
  for (const k of ['habitatge', 'pensions', 'plans']) {
    if (!buit(a[k]?.import) && Number(a[k].import) > 0) {
      if (buit(a[k].any)) falta(8, `altres.${k}.any`);
      if (k === 'pensions' && !a[k].origen) falta(8, 'altres.pensions.origen');
    }
  }

  // 9. Data d'efectes
  if (!d.data_efectes) falta(9, 'data_efectes');

  // 10. Declaracions (i el consentiment de l'art. 9.2.a, només si cal)
  for (const k of ['d1', 'd2', 'd3', 'd4']) if (d.declaracions?.[k] !== true) falta(10, `declaracions.${k}`);
  if (requereixConsentiment(d) && d.declaracions?.consentiment !== true) falta(10, 'declaracions.consentiment');
  return out;
};

// Avisos d'edat (no bloquegen): descendents de 25 anys o més sense
// discapacitat i ascendents de 65 anys o menys sense discapacitat ni dependència
export const avisosEdat = (d, avui) => {
  const ref = anyReferencia(d, avui);
  const out = [];
  (d.descendents || []).forEach((x, i) => {
    if (!x.any_naixement || x.discapacitat === true) return;
    const edat = ref - Number(x.any_naixement);
    if (edat >= EDAT_DESCENDENTS) out.push({ seccio: 5, cami: `descendents.${i}`, nom: x.nom, edat });
  });
  (d.ascendents || []).forEach((x, i) => {
    if (!x.any_naixement || x.discapacitat === true || x.dependencia === true) return;
    const edat = ref - Number(x.any_naixement);
    if (edat <= EDAT_ASCENDENTS) out.push({ seccio: 6, cami: `ascendents.${i}`, nom: x.nom, edat });
  });
  return out;
};

export const AVIS_EDAT = {
  5: {
    ca: 'Té 25 anys o més a 31 de desembre i no consta cap discapacitat: és possible que no doni dret a la reducció.',
    en: 'This person is 25 or over on 31 December and no disability is stated: the allowance may not apply.',
  },
  6: {
    ca: 'Té 65 anys o menys a 31 de desembre i no consta cap discapacitat ni dependència: és possible que no doni dret a la reducció.',
    en: 'This person is 65 or under on 31 December and no disability or dependency is stated: the allowance may not apply.',
  },
};
