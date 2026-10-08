// kyc-regles.js
//
// Regles comunes del formulari KYC: les fa servir el formulari web (per
// guiar el client) i l'Edge Function portal-kyc (per decidir). Hi ha dues
// còpies idèntiques byte a byte (src/portal/kyc i supabase/functions/_shared);
// una prova ho comprova. Sense imports, perquè funcioni als dos llocs.
//
// Els documents obligatoris no són aquí: els decideix la base de dades
// (portal.kyc_documents_requerits), que és la que impedeix signar.

export const VERSIONS = { kyc_pf: 'KYC-PF v1', kyc_pj: 'KYC-PJ v1', pdp: 'PDP v1' };

// Idiomes de comunicació (valors, no textos de la plantilla)
export const IDIOMES = {
  ca: { ca: 'Català', en: 'Catalan' },
  es: { ca: 'Castellà', en: 'Spanish' },
  en: { ca: 'Anglès', en: 'English' },
  fr: { ca: 'Francès', en: 'French' },
};

// Llistes de sancions que l'OCIC ha de comprovar sempre (totes obligatòries)
export const LLISTES_SANCIONS = [
  { codi: 'onu', nom: 'Llista consolidada del Consell de Seguretat de l\'ONU' },
  { codi: 'cp_1_2026', nom: 'Resolució 1/2026 de la Comissió Permanent (capítol novè de la Llei 14/2017)' },
  { codi: 'decret_182_2026', nom: 'Decret 182/2026, annexos 1 i 2 (Llei 5/2022)' },
  { codi: 'ct_02_2016', nom: 'Comunicat tècnic CT-02/2016, annex' },
];

// Avís quan una persona supera el 25 % i no s'ha declarat com a beneficiari efectiu
export const AVIS_25 = {
  ca: 'Aquesta persona supera el 25 % i s\'ha de declarar com a beneficiari efectiu',
  en: 'This person holds more than 25% and must be declared as a beneficial owner',
};
export const LLINDAR_BE = 25;

export const MAX = { representants: 10, administradors: 30, socis: 40, beneficiaris: 20, parts_trust: 20, paisos: 30 };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TELEFON = /^\+?[0-9 ().-]{6,25}$/;

const OPCIONS = {
  doc_tipus: ['passaport', 'dni'],
  estat_civil: ['solter', 'casat', 'separat', 'divorciat', 'vidu'],
  repr_tipus: ['poder_notarial', 'autoritzacio', 'tutela', 'altres'],
  activitat: ['compte_altri', 'comerc', 'professional', 'societat', 'sense'],
  sense: ['jubilat', 'pensionista', 'rendista', 'llar', 'estudiant', 'altres'],
  contracte: ['indefinit', 'temporal'],
  jornada: ['completa', 'reduida'],
  serveis: ['comptabilitat', 'fiscal', 'laboral', 'mercantil', 'constitucio', 'residencia', 'altres'],
  fons_pf: ['salaris', 'pensions', 'dividends', 'activitat', 'immobles', 'venda', 'herencia', 'inversions', 'altres', 'no_escau'],
  fons_pj: ['activitat_societat', 'aportacions', 'dividends', 'venda', 'immobles', 'inversions', 'financament', 'altres', 'no_escau'],
  actua_com: ['administrador', 'apoderat'],
  criteri: ['a', 'b', 'c'],
  rol_trust: ['fideicomitent', 'fiduciari', 'protector', 'beneficiari'],
  soci_tipus: ['pf', 'pj'],
};
export { OPCIONS };

// Camps de cada tipus d'activitat (persona física, apartat 3). web és opcional.
export const CAMPS_ACTIVITAT = {
  compte_altri: ['empresa', 'adreca', 'nrt', 'sector', 'paisos', 'carrec', 'contracte', 'jornada', 'hores', 'data_inici'],
  comerc: ['nom', 'titular', 'domicili', 'nrt', 'data_inici', 'sector', 'detall', 'paisos', 'web'],
  professional: ['sector', 'titol', 'oficina', 'data_inici', 'detall', 'paisos', 'web'],
  societat: ['denominacio', 'forma', 'pais', 'domicili', 'nrt', 'carrec', 'sector', 'detall', 'paisos', 'web'],
  sense: ['sense', 'sense_altres'],
};

// ─── Neteja ─────────────────────────────────────────────────────────────────
// Deixa només les claus conegudes, amb el tipus correcte i longituds màximes.
// No comprova si està complet (això ho fa campsPendents).

const txt = (v, max = 200) => {
  if (v === null || v === undefined || typeof v === 'object') return '';
  // Treu els caràcters de control (el text arriba del navegador)
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
};
const txtLlarg = (v, max = 2000) => {
  if (v === null || v === undefined || typeof v === 'object') return '';
  // eslint-disable-next-line no-control-regex
  return String(v).replace(/[\u0000-\u0009\u000B-\u001F\u007F]/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, max);
};
const bool = (v) => (v === true ? true : v === false ? false : null);
const data = (v) => (typeof v === 'string' && DATA.test(v) ? v : '');
const opcio = (v, llista) => (llista.includes(v) ? v : '');
const opcions = (v, llista) => (Array.isArray(v) ? [...new Set(v.filter((x) => llista.includes(x)))] : []);
const pais = (v, codis) => (typeof v === 'string' && /^[A-Z]{2}$/.test(v) && (!codis || codis.has(v)) ? v : '');
const paisos = (v, codis) => (Array.isArray(v) ? [...new Set(v.map((x) => pais(x, codis)).filter(Boolean))].slice(0, MAX.paisos) : []);
const id = (v) => (typeof v === 'string' && UUID.test(v) ? v : null);
const llista = (v, max, fn) => (Array.isArray(v) ? v.slice(0, max).map(fn).filter(Boolean) : []);
const nouId = () => (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : null);
const ambId = (o) => {
  const i = id(o?.id) || nouId();
  return i ? { id: i } : null;
};
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});

const netejaPpe = (p) => {
  const x = obj(p);
  return {
    exerceix: bool(x.exerceix),
    carrec: txt(x.carrec),
    pais_institucio: txt(x.pais_institucio),
    data_inici: data(x.data_inici),
    data_fi: data(x.data_fi),
    familiar: bool(x.familiar),
    relacio: txt(x.relacio),
    nom_ppe: txt(x.nom_ppe),
    carrec_ppe: txt(x.carrec_ppe),
    origen_patrimoni: txtLlarg(x.origen_patrimoni),
  };
};

const netejaProposit = (p) => {
  const x = obj(p);
  return { serveis: opcions(x.serveis, OPCIONS.serveis), serveis_altres: txt(x.serveis_altres), descripcio: txtLlarg(x.descripcio) };
};

const netejaFons = (f, tipus, codis) => {
  const x = obj(f);
  return {
    origen: opcions(x.origen, tipus === 'kyc_pf' ? OPCIONS.fons_pf : OPCIONS.fons_pj),
    origen_altres: txt(x.origen_altres),
    andorra: bool(x.andorra),
    paisos: paisos(x.paisos, codis),
    descripcio: txtLlarg(x.descripcio),
  };
};

const netejaDeclaracions = (d) => {
  const x = obj(d);
  return { d1: x.d1 === true, d2: x.d2 === true, d3: x.d3 === true, d4: x.d4 === true };
};

export const netejaDades = (entrada, tipus, codis = null) => {
  const d = obj(entrada);
  if (tipus === 'kyc_pf') {
    const i = obj(d.identificacio);
    const r = obj(d.representacio);
    const a = obj(d.activitat);
    const tipusAct = opcio(a.tipus, OPCIONS.activitat);
    const act = { tipus: tipusAct };
    for (const k of CAMPS_ACTIVITAT[tipusAct] || []) {
      if (k === 'paisos') act.paisos = paisos(a.paisos, codis);
      else if (k === 'pais') act.pais = pais(a.pais, codis);
      else if (k === 'data_inici') act.data_inici = data(a.data_inici);
      else if (k === 'contracte') act.contracte = opcio(a.contracte, OPCIONS.contracte);
      else if (k === 'jornada') act.jornada = opcio(a.jornada, OPCIONS.jornada);
      else if (k === 'hores') act.hores = txt(a.hores, 10);
      else if (k === 'sense') act.sense = opcio(a.sense, OPCIONS.sense);
      else if (k === 'detall') act.detall = txtLlarg(a.detall, 1000);
      else act[k] = txt(a[k]);
    }
    const s = obj(d.sancions);
    const fills = bool(i.fills);
    const actua = bool(r.actua);
    return {
      identificacio: {
        nom: txt(i.nom),
        data_naixement: data(i.data_naixement),
        lloc_naixement: txt(i.lloc_naixement),
        nacionalitats: paisos(i.nacionalitats, codis).slice(0, 5),
        doc_tipus: opcio(i.doc_tipus, OPCIONS.doc_tipus),
        doc_numero: txt(i.doc_numero, 50),
        doc_autoritat: txt(i.doc_autoritat),
        doc_caducitat: data(i.doc_caducitat),
        nrt: txt(i.nrt, 30),
        nia: txt(i.nia, 30),
        domicili: txt(i.domicili, 300),
        pais_residencia: pais(i.pais_residencia, codis),
        pais_anterior: pais(i.pais_anterior, codis),
        nif_estranger: txt(i.nif_estranger, 50),
        estat_civil: opcio(i.estat_civil, OPCIONS.estat_civil),
        fills,
        fills_nombre: fills ? txt(i.fills_nombre, 3) : '',
        telefon: txt(i.telefon, 30),
        email: txt(i.email, 200).toLowerCase(),
        idioma: opcio(i.idioma, Object.keys(IDIOMES)),
      },
      representacio: actua
        ? { actua, nom: txt(r.nom), document: txt(r.document, 100), tipus: opcio(r.tipus, OPCIONS.repr_tipus), tipus_altres: txt(r.tipus_altres) }
        : { actua },
      activitat: act,
      proposit: netejaProposit(d.proposit),
      fons: netejaFons(d.fons, tipus, codis),
      ppe: netejaPpe(d.ppe),
      sancions: { residencia_ru_by: bool(s.residencia_ru_by), actua_ru_by: bool(s.actua_ru_by) },
      declaracions: netejaDeclaracions(d.declaracions),
    };
  }

  // Persona jurídica
  const so = obj(d.societat);
  const t = obj(d.trust);
  const s = obj(d.sancions);
  const formaPart = bool(t.forma_part);
  return {
    societat: {
      denominacio: txt(so.denominacio),
      nom_comercial: txt(so.nom_comercial),
      forma: txt(so.forma, 100),
      pais_constitucio: pais(so.pais_constitucio, codis),
      data_constitucio: data(so.data_constitucio),
      pais_activitat: pais(so.pais_activitat, codis),
      domicili_social: txt(so.domicili_social, 300),
      adreca_activitat: txt(so.adreca_activitat, 300),
      nrt: txt(so.nrt, 50),
      registrals: txt(so.registrals, 300),
      capital: txt(so.capital, 50),
      objecte: txtLlarg(so.objecte, 1500),
      paisos: paisos(so.paisos, codis),
      telefon: txt(so.telefon, 30),
      email: txt(so.email, 200).toLowerCase(),
      web: txt(so.web, 200),
      cotitza: bool(so.cotitza),
    },
    representants: llista(d.representants, MAX.representants, (p) => {
      const x = ambId(p);
      if (!x) return null;
      return {
        ...x,
        nom: txt(p.nom), nacionalitat: pais(p.nacionalitat, codis), data_naixement: data(p.data_naixement),
        domicili: txt(p.domicili, 300), document: txt(p.document, 100), nrt: txt(p.nrt, 30),
        carrec: txt(p.carrec), actua_com: opcio(p.actua_com, OPCIONS.actua_com),
        telefon: txt(p.telefon, 30), email: txt(p.email, 200).toLowerCase(), idioma: opcio(p.idioma, Object.keys(IDIOMES)),
      };
    }),
    administradors: llista(d.administradors, MAX.administradors, (p) => {
      const x = ambId(p);
      return x && { ...x, nom: txt(p.nom), carrec: txt(p.carrec), nacionalitat: pais(p.nacionalitat, codis) };
    }),
    socis: llista(d.socis, MAX.socis, (p) => {
      const x = ambId(p);
      return x && {
        ...x, nom: txt(p.nom), tipus: opcio(p.tipus, OPCIONS.soci_tipus),
        percentatge: txt(p.percentatge, 10).replace(',', '.'), soci_de: id(p.soci_de),
      };
    }),
    beneficiaris: llista(d.beneficiaris, MAX.beneficiaris, (p) => {
      const x = ambId(p);
      return x && {
        ...x, representant_id: id(p.representant_id),
        nom: txt(p.nom), nacionalitats: paisos(p.nacionalitats, codis).slice(0, 5), data_naixement: data(p.data_naixement),
        domicili: txt(p.domicili, 300), pais_residencia: pais(p.pais_residencia, codis), document: txt(p.document, 100),
        nrt: txt(p.nrt, 30), participacio: txt(p.participacio), criteri: opcio(p.criteri, OPCIONS.criteri), ppe: netejaPpe(p.ppe),
      };
    }),
    declaracio_beneficiaris: d.declaracio_beneficiaris === true,
    trust: formaPart
      ? {
          forma_part: formaPart,
          parts: llista(t.parts, MAX.parts_trust, (p) => {
            const x = ambId(p);
            return x && { ...x, rol: opcio(p.rol, OPCIONS.rol_trust), nom: txt(p.nom), nacionalitat: pais(p.nacionalitat, codis), residencia: pais(p.residencia, codis) };
          }),
        }
      : { forma_part: formaPart },
    sancions: { establert_ru_by: bool(s.establert_ru_by), actua_ru_by: bool(s.actua_ru_by) },
    proposit: netejaProposit(d.proposit),
    fons: netejaFons(d.fons, tipus, codis),
    declaracions: netejaDeclaracions(d.declaracions),
  };
};

// ─── Participació directa i indirecta ───────────────────────────────────────
// Nom normalitzat per comparar persones (mateixa regla que la base de dades:
// minúscules, sense espais als extrems i espais simples).
export const nomNormal = (n) => String(n || '').toLowerCase().replace(/\s+/g, ' ').trim();

// Percentatge directe + indirecte de cada persona física de l'estructura de
// propietat: per a cada soci persona física, el seu percentatge multiplicat
// pels de les societats per sobre seu; si la mateixa persona hi surt més d'un
// cop, se sumen. Retorna [{ nom, percentatge }] ordenat de més a menys.
export const participacions = (entrada) => {
  const socis = Array.isArray(entrada?.socis) ? entrada.socis : [];
  const perId = new Map(socis.map((s) => [s.id, s]));
  const total = new Map();
  for (const s of socis) {
    if (s.tipus !== 'pf') continue;
    let pc = Number(String(s.percentatge || '').replace(',', '.'));
    if (!(pc > 0)) continue;
    let pare = s.soci_de ? perId.get(s.soci_de) : null;
    let valid = true;
    for (let k = 0; pare && k <= socis.length; k++) {
      const pp = Number(String(pare.percentatge || '').replace(',', '.'));
      if (!(pp > 0) || pare.tipus !== 'pj') { valid = false; break; }
      pc = (pc * pp) / 100;
      pare = pare.soci_de ? perId.get(pare.soci_de) : null;
    }
    if (!valid || pare) continue;
    const clau = nomNormal(s.nom);
    if (!clau) continue;
    const prev = total.get(clau) || { nom: s.nom, percentatge: 0 };
    total.set(clau, { nom: prev.nom, percentatge: prev.percentatge + pc });
  }
  return [...total.values()]
    .map((x) => ({ ...x, percentatge: Math.round(x.percentatge * 100) / 100 }))
    .sort((a, b) => b.percentatge - a.percentatge);
};

// Persones de més del 25 % que no són a la llista de beneficiaris efectius
export const beneficiarisNoDeclarats = (entrada) => {
  const declarats = new Set((Array.isArray(entrada?.beneficiaris) ? entrada.beneficiaris : []).map((b) => nomNormal(b.nom)));
  return participacions(entrada).filter((p) => p.percentatge > LLINDAR_BE && !declarats.has(nomNormal(p.nom)));
};

// ─── Camps pendents ─────────────────────────────────────────────────────────
// Retorna [{ seccio, camp }] amb tot el que falta o no és vàlid per poder
// signar. seccio = número d'apartat de la plantilla; camp = camí de la dada.
// avui: 'AAAA-MM-DD' (per comparar dates sense dependre del rellotge local).

const buit = (v) => v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

const pendentsPpe = (p, seccio, prefix, avui, out) => {
  if (p.exerceix === null) out.push({ seccio, camp: `${prefix}.exerceix` });
  if (p.exerceix) {
    for (const k of ['carrec', 'pais_institucio', 'data_inici']) if (buit(p[k])) out.push({ seccio, camp: `${prefix}.${k}` });
    if (p.data_inici && p.data_inici > avui) out.push({ seccio, camp: `${prefix}.data_inici`, motiu: 'data' });
  }
  if (p.familiar === null) out.push({ seccio, camp: `${prefix}.familiar` });
  if (p.familiar) for (const k of ['relacio', 'nom_ppe', 'carrec_ppe']) if (buit(p[k])) out.push({ seccio, camp: `${prefix}.${k}` });
  if ((p.exerceix || p.familiar) && buit(p.origen_patrimoni)) out.push({ seccio, camp: `${prefix}.origen_patrimoni` });
};

const pendentsProposit = (p, seccio, out) => {
  if (buit(p.serveis)) out.push({ seccio, camp: 'proposit.serveis' });
  if (p.serveis.includes('altres') && buit(p.serveis_altres)) out.push({ seccio, camp: 'proposit.serveis_altres' });
  if (buit(p.descripcio)) out.push({ seccio, camp: 'proposit.descripcio' });
};

const pendentsFons = (f, seccio, out) => {
  if (buit(f.origen)) out.push({ seccio, camp: 'fons.origen' });
  if (f.origen.includes('no_escau') && f.origen.length > 1) out.push({ seccio, camp: 'fons.origen', motiu: 'incompatible' });
  if (f.origen.includes('altres') && buit(f.origen_altres)) out.push({ seccio, camp: 'fons.origen_altres' });
  const senseFons = f.origen.length === 1 && f.origen[0] === 'no_escau';
  if (!senseFons) {
    if (f.andorra === null) out.push({ seccio, camp: 'fons.andorra' });
    if (f.andorra === false && buit(f.paisos)) out.push({ seccio, camp: 'fons.paisos' });
    if (buit(f.descripcio)) out.push({ seccio, camp: 'fons.descripcio' });
  }
};

const pendentsDeclaracions = (d, seccio, out) => {
  for (const k of ['d1', 'd2', 'd3', 'd4']) if (!d[k]) out.push({ seccio, camp: `declaracions.${k}` });
};

export const campsPendents = (entrada, tipus, avui) => {
  const d = netejaDades(entrada, tipus);
  const out = [];
  if (tipus === 'kyc_pf') {
    const i = d.identificacio;
    for (const k of ['nom', 'data_naixement', 'lloc_naixement', 'nacionalitats', 'doc_tipus', 'doc_numero', 'doc_autoritat',
      'doc_caducitat', 'domicili', 'pais_residencia', 'estat_civil', 'telefon', 'email', 'idioma']) {
      if (buit(i[k])) out.push({ seccio: 1, camp: `identificacio.${k}` });
    }
    if (i.fills === null) out.push({ seccio: 1, camp: 'identificacio.fills' });
    if (i.fills && !/^[1-9][0-9]?$/.test(i.fills_nombre)) out.push({ seccio: 1, camp: 'identificacio.fills_nombre' });
    if (i.data_naixement && i.data_naixement >= avui) out.push({ seccio: 1, camp: 'identificacio.data_naixement', motiu: 'data' });
    if (i.doc_caducitat && i.doc_caducitat < avui) out.push({ seccio: 1, camp: 'identificacio.doc_caducitat', motiu: 'caducat' });
    if (i.email && !EMAIL.test(i.email)) out.push({ seccio: 1, camp: 'identificacio.email', motiu: 'format' });
    if (i.telefon && !TELEFON.test(i.telefon)) out.push({ seccio: 1, camp: 'identificacio.telefon', motiu: 'format' });

    const r = d.representacio;
    if (r.actua === null) out.push({ seccio: 2, camp: 'representacio.actua' });
    if (r.actua) {
      for (const k of ['nom', 'document', 'tipus']) if (buit(r[k])) out.push({ seccio: 2, camp: `representacio.${k}` });
      if (r.tipus === 'altres' && buit(r.tipus_altres)) out.push({ seccio: 2, camp: 'representacio.tipus_altres' });
    }

    const a = d.activitat;
    if (!a.tipus) out.push({ seccio: 3, camp: 'activitat.tipus' });
    for (const k of CAMPS_ACTIVITAT[a.tipus] || []) {
      if (k === 'web' || k === 'sense_altres') continue;
      if (buit(a[k])) out.push({ seccio: 3, camp: `activitat.${k}` });
    }
    if (a.tipus === 'sense' && a.sense === 'altres' && buit(a.sense_altres)) out.push({ seccio: 3, camp: 'activitat.sense_altres' });
    if (a.hores && !/^\d{1,2}([.,]\d)?$/.test(a.hores)) out.push({ seccio: 3, camp: 'activitat.hores', motiu: 'format' });
    if (a.data_inici && a.data_inici > avui) out.push({ seccio: 3, camp: 'activitat.data_inici', motiu: 'data' });

    pendentsProposit(d.proposit, 4, out);
    pendentsFons(d.fons, 5, out);
    pendentsPpe(d.ppe, 6, 'ppe', avui, out);
    if (d.sancions.residencia_ru_by === null) out.push({ seccio: 7, camp: 'sancions.residencia_ru_by' });
    if (d.sancions.actua_ru_by === null) out.push({ seccio: 7, camp: 'sancions.actua_ru_by' });
    pendentsDeclaracions(d.declaracions, 8, out);
    return out;
  }

  // Persona jurídica
  const so = d.societat;
  for (const k of ['denominacio', 'forma', 'pais_constitucio', 'data_constitucio', 'pais_activitat', 'domicili_social', 'nrt',
    'registrals', 'capital', 'objecte', 'paisos', 'telefon', 'email']) {
    if (buit(so[k])) out.push({ seccio: 1, camp: `societat.${k}` });
  }
  if (so.cotitza === null) out.push({ seccio: 1, camp: 'societat.cotitza' });
  if (so.data_constitucio && so.data_constitucio > avui) out.push({ seccio: 1, camp: 'societat.data_constitucio', motiu: 'data' });
  if (so.email && !EMAIL.test(so.email)) out.push({ seccio: 1, camp: 'societat.email', motiu: 'format' });
  if (so.telefon && !TELEFON.test(so.telefon)) out.push({ seccio: 1, camp: 'societat.telefon', motiu: 'format' });

  if (d.representants.length === 0) out.push({ seccio: 2, camp: 'representants' });
  d.representants.forEach((p, n) => {
    // Del signant (el primer) cal tot; dels altres representants, també
    for (const k of ['nom', 'nacionalitat', 'data_naixement', 'domicili', 'document', 'carrec', 'actua_com']) {
      if (buit(p[k])) out.push({ seccio: 2, camp: `representants.${n}.${k}` });
    }
    if (n === 0) for (const k of ['telefon', 'email', 'idioma']) if (buit(p[k])) out.push({ seccio: 2, camp: `representants.${n}.${k}` });
    if (p.email && !EMAIL.test(p.email)) out.push({ seccio: 2, camp: `representants.${n}.email`, motiu: 'format' });
    if (p.telefon && !TELEFON.test(p.telefon)) out.push({ seccio: 2, camp: `representants.${n}.telefon`, motiu: 'format' });
    if (p.data_naixement && p.data_naixement >= avui) out.push({ seccio: 2, camp: `representants.${n}.data_naixement`, motiu: 'data' });
  });

  if (d.administradors.length === 0) out.push({ seccio: 3, camp: 'administradors' });
  d.administradors.forEach((p, n) => {
    for (const k of ['nom', 'carrec', 'nacionalitat']) if (buit(p[k])) out.push({ seccio: 3, camp: `administradors.${n}.${k}` });
  });

  // Socis: directes (soci_de null) i, per a cada soci que és societat, els seus socis
  const socis = d.socis;
  const perId = new Map(socis.map((s) => [s.id, s]));
  if (!socis.some((s) => !s.soci_de)) out.push({ seccio: 4, camp: 'socis' });
  socis.forEach((s, n) => {
    for (const k of ['nom', 'tipus', 'percentatge']) if (buit(s[k])) out.push({ seccio: 4, camp: `socis.${n}.${k}` });
    const pc = Number(s.percentatge);
    if (s.percentatge && !(pc > 0 && pc <= 100)) out.push({ seccio: 4, camp: `socis.${n}.percentatge`, motiu: 'format' });
    if (s.soci_de) {
      const pare = perId.get(s.soci_de);
      if (!pare || pare.tipus !== 'pj' || pare.id === s.id) out.push({ seccio: 4, camp: `socis.${n}.soci_de` });
      // sense cicles
      let cur = pare;
      for (let k = 0; cur && k <= socis.length; k++) {
        if (cur.id === s.id) { out.push({ seccio: 4, camp: `socis.${n}.soci_de`, motiu: 'cicle' }); break; }
        cur = cur.soci_de ? perId.get(cur.soci_de) : null;
      }
    }
    if (s.tipus === 'pj' && !socis.some((f) => f.soci_de === s.id)) out.push({ seccio: 4, camp: `socis.${n}.socis` });
  });

  if (d.beneficiaris.length === 0) out.push({ seccio: 5, camp: 'beneficiaris' });
  d.beneficiaris.forEach((b, n) => {
    for (const k of ['nom', 'nacionalitats', 'data_naixement', 'domicili', 'pais_residencia', 'document', 'participacio', 'criteri']) {
      if (buit(b[k])) out.push({ seccio: 5, camp: `beneficiaris.${n}.${k}` });
    }
    if (b.data_naixement && b.data_naixement >= avui) out.push({ seccio: 5, camp: `beneficiaris.${n}.data_naixement`, motiu: 'data' });
    pendentsPpe(b.ppe, 5, `beneficiaris.${n}.ppe`, avui, out);
  });
  if (!d.declaracio_beneficiaris) out.push({ seccio: 5, camp: 'declaracio_beneficiaris' });
  // Qui supera el 25 % (directe i indirecte) s'ha de declarar com a beneficiari efectiu
  for (const p of beneficiarisNoDeclarats(d)) {
    out.push({ seccio: 5, camp: 'beneficiaris', motiu: 'supera_25', nom: p.nom, percentatge: p.percentatge });
  }
  // El vincle amb un representant ha de ser a un representant que existeixi
  d.beneficiaris.forEach((b, n) => {
    if (b.representant_id && !d.representants.some((r) => r.id === b.representant_id)) {
      out.push({ seccio: 5, camp: `beneficiaris.${n}.representant_id` });
    }
  });

  if (d.trust.forma_part === null) out.push({ seccio: 6, camp: 'trust.forma_part' });
  if (d.trust.forma_part) {
    if (d.trust.parts.length === 0) out.push({ seccio: 6, camp: 'trust.parts' });
    d.trust.parts.forEach((p, n) => {
      for (const k of ['rol', 'nom', 'nacionalitat', 'residencia']) if (buit(p[k])) out.push({ seccio: 6, camp: `trust.parts.${n}.${k}` });
    });
  }

  if (d.sancions.establert_ru_by === null) out.push({ seccio: 7, camp: 'sancions.establert_ru_by' });
  if (d.sancions.actua_ru_by === null) out.push({ seccio: 7, camp: 'sancions.actua_ru_by' });
  pendentsProposit(d.proposit, 8, out);
  pendentsFons(d.fons, 9, out);
  pendentsDeclaracions(d.declaracions, 10, out);
  return out;
};

// ─── Signant ────────────────────────────────────────────────────────────────
// PF: el client o, si actua un representant, el representant.
// PJ: el primer representant (el signant), amb el seu càrrec.
export const signant = (entrada, tipus) => {
  const d = obj(entrada);
  if (tipus === 'kyc_pf') {
    const r = obj(d.representacio);
    if (r.actua === true) return { nom: txt(r.nom), carrec: null };
    return { nom: txt(obj(d.identificacio).nom), carrec: null };
  }
  const p = Array.isArray(d.representants) ? obj(d.representants[0]) : {};
  return { nom: txt(p.nom), carrec: txt(p.carrec) || null };
};
