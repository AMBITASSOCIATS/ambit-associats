// engine/immobiliariHelpers.js — Font única de veritat per al càlcul forfetari immobiliari.
// El llindar €/m² i l'increment del percentatge forfetari per habitatge de residència
// habitual depenen de l'exercici (L2025005). null/undefined → 2025+.

export const llindarEurosM2 = (ex) => (ex || 2025) >= 2025 ? 9 : 8;
export const incrementForfetari = (ex) => (ex || 2025) >= 2025 ? 0.10 : 0.05; // +10% (2025+) / +5% (abans)
export const pctForfetari = (im, ex) => 0.40 + (im.esHabitatgeAssequible ? incrementForfetari(ex) : 0);
