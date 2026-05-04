// Motor de càlcul IRPF Andorra — Llei 5/2014, L2023005, L2025005

export const IRPF = {
  TIPUS_GRAVAMEN: 0.10,          // Art. 43
  MINIM_PERSONAL: 24000,         // Art. 35.1
  MINIM_PERSONAL_CONJU: 40000,   // Art. 35.1 — cònjuge a càrrec
  MINIM_PERSONAL_DISCAP: 30000,  // Art. 35.1 — discapacitat reconeguda (Conava)
  MINIM_ESTALVI: 3000,           // Art. 37
  BONIF_MAX: 800,                // Art. 46
  RED_DESCENDENT: 1000,          // Art. 35.2.a
  RED_ASCENDENT: 1000,           // Art. 35.2.b
  RED_TUTELA: 1000,              // Art. 35.2.c
  RED_MATRICULA_MAX: 300,        // Art. 35.2.d — per fill
  COEF_DISCAPACITAT: 1.5,        // Art. 35.2
  RED_HABITATGE_PCT: 0.50,       // Art. 38
  RED_HABITATGE_MAX: 5000,       // Art. 38
  RED_PLA_PENSIONS_PCT: 0.30,    // Art. 39
  RED_PLA_PENSIONS_MAX: 5000,    // Art. 39
  ALTRES_DESPESES_PCT: 0.03,     // Guia 2025 §6.2 — 3% rendiments íntegres treball
  ALTRES_DESPESES_MAX: 2500,     // Guia 2025 §6.2
  PENSIONISTA_PCT_PER_ANY: 0.01, // Guia 2025 — 1% per any cotitzat CASS
  PENSIONISTA_MAX_PCT: 0.30,     // màxim 30%
};

/**
 * @param {Object} input
 * @param {number}  input.rendaTreballIntegra   - Salari brut anual
 * @param {number}  input.cotitzacionsCASS      - Cotitzacions CASS treballador (import real)
 * @param {boolean} input.esPensionista         - Pensionista CASS
 * @param {number}  input.anysCotitzats         - Anys cotitzats a la CASS (pensionistes)
 * @param {number}  input.rendaActivitat        - Renda neta d'activitats econòmiques
 * @param {number}  input.rendaImmobiliaria     - Renda neta capital immobiliari
 * @param {number}  input.rendaMobiliaria       - Renda capital mobiliari (int./div.)
 * @param {number}  input.guanysCapital         - Guanys de capital nets
 * @param {boolean} input.conjugeACarrec        - Cònjuge a càrrec
 * @param {boolean} input.obligatDiscapacitat   - Discapacitat reconeguda per Conava
 * @param {number}  input.numDescendents        - Fills < 25 anys a càrrec
 * @param {number}  input.numAscendents         - Ascendents > 65 anys a càrrec
 * @param {number}  input.numTutelats           - Persones en tutela/acolliment
 * @param {number}  input.numDiscapacitats      - Membres amb discapacitat
 * @param {number}  input.matricules            - Import matrícules ens. superior
 * @param {number}  input.quotesHabitatge       - Quotes hipoteca/compra habitatge habitual
 * @param {number}  input.aportacioPensions     - Aportació a plans de pensions
 * @param {number}  input.pensionsCompensatories - Pensions compensatòries pagades
 * @param {number}  input.impostComunal         - Impost comunal arrendaments pagat (Art. 47)
 */
export function calcularIRPF(input) {
  const {
    rendaTreballIntegra = 0,
    cotitzacionsCASS = 0,
    esPensionista = false,
    anysCotitzats = 0,
    rendaActivitat = 0,
    rendaImmobiliaria = 0,
    rendaMobiliaria = 0,
    guanysCapital = 0,
    conjugeACarrec = false,
    rendesConjuge = 0,
    obligatDiscapacitat = false,
    numDescendents = 0,
    numAscendents = 0,
    numTutelats = 0,
    numDiscapacitats = 0,
    matricules = 0,
    quotesHabitatge = 0,
    aportacioPensions = 0,
    pensionsCompensatories = 0,
    impostComunal = 0,
  } = input;

  // PAS 1 — Renda neta del treball (Guia §6.2)
  const altresDespeses = Math.min(
    rendaTreballIntegra * IRPF.ALTRES_DESPESES_PCT,
    IRPF.ALTRES_DESPESES_MAX
  );

  let rendaTreball = rendaTreballIntegra - cotitzacionsCASS - altresDespeses;

  // Deducció pensionistes CASS
  let redPensionistaCASS = 0;
  if (esPensionista && anysCotitzats > 0) {
    const pct = Math.min(anysCotitzats * IRPF.PENSIONISTA_PCT_PER_ANY, IRPF.PENSIONISTA_MAX_PCT);
    redPensionistaCASS = rendaTreball * pct;
    rendaTreball = rendaTreball - redPensionistaCASS;
  }

  // PAS 2 — Bases de tributació
  const BTG = rendaTreball + rendaActivitat + rendaImmobiliaria;
  const BTE = rendaMobiliaria + guanysCapital;
  const bteNegatiu = BTE < 0;

  // PAS 3 — Mínim personal (Guia §13.5: per bonif. sempre usar base, no l'incrementat per cònjuge)
  let minimPersonal;
  if (conjugeACarrec && rendesConjuge < IRPF.MINIM_PERSONAL) {
    minimPersonal = IRPF.MINIM_PERSONAL_CONJU;
  } else if (obligatDiscapacitat) {
    minimPersonal = IRPF.MINIM_PERSONAL_DISCAP;
  } else {
    minimPersonal = IRPF.MINIM_PERSONAL;
  }

  // PAS 4 — Reduccions familiars (Art. 35.2)
  let redFamiliar = numDescendents * IRPF.RED_DESCENDENT;
  redFamiliar += numAscendents * IRPF.RED_ASCENDENT;
  redFamiliar += numTutelats * IRPF.RED_TUTELA;
  redFamiliar += Math.min(matricules, numDescendents * IRPF.RED_MATRICULA_MAX);
  const redDiscapacitat = numDiscapacitats * IRPF.RED_DESCENDENT * (IRPF.COEF_DISCAPACITAT - 1);
  redFamiliar += redDiscapacitat;

  // PAS 5 — Reducció habitatge (Art. 38)
  const redHabitatge = Math.min(
    quotesHabitatge * IRPF.RED_HABITATGE_PCT,
    IRPF.RED_HABITATGE_MAX
  );

  // PAS 6 — Reducció pensions (Art. 39)
  const rendNetsTotal = rendaTreball + rendaActivitat;
  const redPensions = Math.min(
    aportacioPensions,
    rendNetsTotal * IRPF.RED_PLA_PENSIONS_PCT,
    IRPF.RED_PLA_PENSIONS_MAX
  );

  // PAS 7 — Base de Liquidació General
  const totalReduccionsGenerals =
    minimPersonal + redFamiliar + redHabitatge + redPensions + pensionsCompensatories;
  const BLG = Math.max(0, BTG - totalReduccionsGenerals);

  // PAS 8 — Base de Liquidació de l'Estalvi
  const BTE_positiu = Math.max(0, BTE);
  const BLE = Math.max(0, BTE_positiu - IRPF.MINIM_ESTALVI);

  // PAS 9 — Quota de tributació
  const quotaTributacio = (BLG + BLE) * IRPF.TIPUS_GRAVAMEN;

  // PAS 10 — Bonificació Art. 46 (usa minimPersonalBase, mai 40.000 €)
  let bonificacio = 0;
  if (rendaTreball > 0 || rendaActivitat > 0 || rendaImmobiliaria > 0) {
    const minimPersonalBase = obligatDiscapacitat
      ? IRPF.MINIM_PERSONAL_DISCAP
      : IRPF.MINIM_PERSONAL;
    const basePerBonif = Math.max(0, BTG - minimPersonalBase);
    bonificacio = Math.min(basePerBonif * IRPF.TIPUS_GRAVAMEN * 0.50, IRPF.BONIF_MAX);
  }

  // PAS 11 — Quota de liquidació
  const quotaLiquidacio = Math.max(0, quotaTributacio - bonificacio);

  // Art. 47 — Deducció doble imposició interna (impost comunal)
  const deduccioDobleImpInterna = Math.min(impostComunal, quotaLiquidacio);
  const quotaFinal = Math.max(0, quotaLiquidacio - deduccioDobleImpInterna);

  // PAS 12 — Tipus efectiu i pagament fraccionat
  const rendaTotal = BTG + BTE_positiu;
  const tipusEfectiu = rendaTotal > 0 ? quotaFinal / rendaTotal : 0;
  const pagamentFraccionat = quotaFinal * 0.50;

  return {
    altresDespeses,
    redPensionistaCASS,
    rendaTreball,
    baseTributacioGeneral: BTG,
    baseTributacioEstalvi: BTE,
    bteNegatiu,
    minimPersonal,
    reduccioFamiliar: redFamiliar,
    reduccioHabitatge: redHabitatge,
    reduccioPensions: redPensions,
    pensionsCompensatories,
    totalReduccions: totalReduccionsGenerals,
    baseLiquidacioGeneral: BLG,
    baseLiquidacioEstalvi: BLE,
    quotaTributacio,
    bonificacio,
    quotaLiquidacio,
    deduccioDobleImpInterna,
    quotaFinal,
    tipusEfectiu,
    rendaTotal,
    pagamentFraccionat,
    obligacioDeclarar: rendaTotal > minimPersonal,
  };
}

// Verificació casos de prova
export function verificarCasos() {
  // Cas oficial Guia IRPF 2025 (p. 77)
  const cas1 = calcularIRPF({
    rendaTreballIntegra: 48000,
    cotitzacionsCASS: 3120,
    rendaImmobiliaria: 15150,
    rendaMobiliaria: 1500,
    impostComunal: 468,
  });
  // Esperat: BTG=58590, BLG=34590, BLE=0, quotaTrib=3459, bonif=800, quotaLiq=2659, quotaFinal=2191

  // Cas 2 — Assalariat amb cònjuge i fill
  const cas2 = calcularIRPF({
    rendaTreballIntegra: 50000,
    cotitzacionsCASS: 0,
    conjugeACarrec: true,
    numDescendents: 1,
  });
  // Esperat: BTG~48500, minimPersonal=40000, redFam=1000, BLG~7500, quotaFinal~375

  // Cas 3 — Autònom amb renda estalvi i pensions
  const cas3 = calcularIRPF({
    rendaActivitat: 60000,
    rendaMobiliaria: 5000,
    aportacioPensions: 5000,
  });
  // Esperat: BTG=60000, redPensions=5000, BLG=31000, BTE=5000, BLE=2000, quotaTrib=3300, bonif=800, quotaFinal=2500

  return { cas1, cas2, cas3 };
}
