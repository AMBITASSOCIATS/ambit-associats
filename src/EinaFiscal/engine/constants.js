// engine/constants.js — Constants normatives Eina Fiscal IRPF Andorra
// Importa les constants base d'IrpfEngine.js i n'afegeix de noves específiques.
// NO modifica IrpfEngine.js.

import { IRPF as IRPF_BASE } from '../../irpf/IrpfEngine.js';

// Re-exportar constants base
export const IRPF = IRPF_BASE;

// Constants addicionals per a l'Eina Fiscal
export const IRPF_EF = {
  // Treball
  CASS_TREBALLADOR_PCT: 0.065,      // 6,5% orientatiu — l'usuari introdueix l'import real
  CASS_EMPRESARI_PCT: 0.155,         // 15,5% orientatiu
  PENSIONISTA_RED_PER_ANY: 0.01,     // 1% per any cotitzat
  PENSIONISTA_RED_MAX: 0.30,         // màxim 30%
  ALTRES_DESPESES_TREBALL_PCT: 0.03, // 3% brut, màx. 2.500 € (Guia §6.2)
  ALTRES_DESPESES_TREBALL_MAX: 2500,
  ADMINISTRADOR_DESPESES_PCT: 0.03,  // 3% retribucions administrador (Art. 13.5.b Llei)
  // Capital immobiliari
  IMMO_DESPESES_FORFET_PCT: 0.40,    // 40% forfetari (Art. 21.2.b Llei)
  IMMO_DESPESES_HABITATGE_PCT: 0.50, // 50% si habitatge residència habitual (Art. 21)
  IMMO_DESPESES_ASSEQUIBLE_PCT: 0.50,// 50% si habitatge assequible (+10%)
  // Capital mobiliari
  MINIM_ESTALVI: 3000,               // Art. 37 — mínim exempt estalvi
  // Guanys i pèrdues de capital
  COEF_ACTUALITZACIO: {              // Coeficients d'actualització immobles (Art. 26.2)
    // anys de tinença: coeficient (font: Llei pressupost general)
    // Valors orientatius — actualitzar cada any amb la Llei de pressupostos
    0: 1.00, 1: 1.00, 2: 1.02, 3: 1.04, 4: 1.06, 5: 1.09,
    6: 1.12, 7: 1.15, 8: 1.18, 9: 1.22, 10: 1.26,
    11: 1.30, 12: 1.34, 13: 1.39, 14: 1.44, 15: 1.49,
    16: 1.55, 17: 1.61, 18: 1.67, 19: 1.74, 20: 1.81,
    DEFAULT: 1.81  // > 20 anys
  },
  GP_COMPENSACIO_ANYS: 10,            // anys de compensació pèrdues (Art. 32)
  // SMI (Salari Mínim Interprofessional Andorra 2025)
  SMI_ANUAL: 17367.96,
  // Pagament fraccionat
  PAGAMENT_FRACC_PCT_RENDES: 0.05,   // 5% sobre rendes netes any anterior (Art. 19 Reglament)
  PAGAMENT_FRACC_PCT_QUOTA: 0.50,    // 50% sobre quota liquidació any anterior
};
