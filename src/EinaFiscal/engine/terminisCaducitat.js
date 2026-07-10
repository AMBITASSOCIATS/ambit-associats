// engine/terminisCaducitat.js — Terminis de caducitat (anys d'aplicació posterior)
// per a l'IRPF d'Andorra. Font única de veritat.
//
// Valors verificats contra la Llei 5/2014 per a exercicis 2024+.
// Per a exercicis anteriors a 2024 es conserven els valors legacy (text refós 9)
// que ja usava l'eina. null/undefined → comportament 2024+ (fallback segur).

const es2024 = (ex) => (ex || 2025) >= 2024;

// Bases negatives generals — Art. 31.2 Llei 5/2014
export const terminiBasesNegGenerals = (ex) => (es2024(ex) ? 10 : 4);

// Bases negatives de l'estalvi — Art. 32.2 Llei 5/2014
export const terminiBasesNegEstalvi = () => 10;

// Deduccions de quota (300-F apartat 3) — Guia IRPF 2025 ap. 12.2
// (el formulari 300-F només té 3 files). Legacy < 2024: 5.
export const terminiDeduccionsQuota = (ex) => (es2024(ex) ? 3 : 5);

// DDI interna / impost comunal — Art. 47.2 Llei 5/2014
export const terminiDDIInterna = () => 3;

// DDI internacional — Art. 48.4 Llei 5/2014
export const terminiDDIInternacional = () => 3;
