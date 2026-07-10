// engine/tipusDeduccions.js — Catàleg de tipus de deducció de quota de l'IRPF.
// Font única de veritat. Articles verificats contra l'índex de la Llei 5/2014
// (portal jurídic andorrà).
//
// NOTA: els articles 43 bis / 44 / 44 bis / 44 ter / 44 quater que s'usaven abans
// a l'eina són de la Llei de l'impost sobre societats, NO de la Llei 5/2014 (IRPF).
// desDeExercici = any mínim en què el tipus existeix (0 = des de sempre).

export const TIPUS_DEDUCCIONS = [
  { id: 'DDI_INTERNACIONAL', label: 'Deducció per doble imposició internacional', article: 'Art. 48', desDeExercici: 0 },
  { id: 'DDI_INTERNA', label: 'Deducció per doble imposició interna (impost comunal)', article: 'Art. 47', desDeExercici: 0 },
  { id: 'MECENATGE', label: 'Incentius fiscals al mecenatge', article: 'Art. 48 bis', desDeExercici: 2024 },
  { id: 'PROJECTES', label: "Projectes d'interès nacional", article: 'Art. 49', desDeExercici: 2024 },
  { id: 'DIGITALITZACIO', label: 'Inversions en digitalització', article: 'Art. 49', desDeExercici: 2024 },
  { id: 'PATROCINI', label: 'Patrocini esportiu i cultural', article: 'Art. 49', desDeExercici: 2024 },
  { id: 'LLOCS_TREBALL', label: 'Creació de llocs de treball', article: 'Art. 49', desDeExercici: 2024 },
];

const PER_ID = TIPUS_DEDUCCIONS.reduce((m, t) => { m[t.id] = t; return m; }, {});

export const tipusDeduccioPerId = (id) => PER_ID[id] || null;

// Article (curt, per a la cita entre parèntesis) derivat del tipus. Per a
// deduccions antigues sense tipus retorna un fallback genèric; MAI "Art. 43".
export const articleDeduccio = (id) => {
  const t = PER_ID[id];
  return t ? t.article : 'Art. 47-48 (segons naturalesa)';
};

// Tipus disponibles per a un exercici (desDeExercici <= exercici).
export const tipusDeduccionsPerExercici = (ex) =>
  TIPUS_DEDUCCIONS.filter(t => t.desDeExercici <= (ex || 2025));
