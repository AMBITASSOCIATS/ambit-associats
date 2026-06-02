// engine/analysisEngine.js — Motor d'anàlisi de rendes IRPF Andorra
// Exporta calcularIRPFDetallat(dades) que combina totes les rendes i retorna el detall complet.

import { IRPF, IRPF_EF } from './constants.js';
import { calcularDDI } from './exemptions.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularRendaNetaTreball(rendesTreball) {
  let totalCASS = 0;
  let totalGravat3pct = 0;    // renda gravada on s'aplica el 3% d'altres despeses
  let totalGravatDirecte = 0; // renda gravada sense 3% (pensions CASS i Classes Passives)

  for (const font of rendesTreball) {
    const brut = font.importBrut || 0;

    // PENSIO_CASS: gravada parcialment — Disp. add. 5a Llei 5/2014
    // Sense CASS ni 3% d'altres despeses sobre aquesta renda
    if (font.tipus === 'PENSIO_CASS') {
      const anysTotals = font.anysTotals || 0;
      const anysCotAbans2015 = font.anysCotitzatsAbans2015 != null
        ? font.anysCotitzatsAbans2015 : (font.anysCotitzats || 0);
      const ratio = anysTotals >= 15 ? Math.min(anysCotAbans2015 * 0.01, 0.30) : 0;
      totalGravatDirecte += brut * (1 - ratio);
      continue;
    }

    // PENSIO_CLASSES_PASSIVES: Art. 12.2.c + Disp. add. 4a ap.3 Llei 5/2014
    // Sense CASS ni 3% d'altres despeses sobre aquesta renda
    if (font.tipus === 'PENSIO_CLASSES_PASSIVES') {
      const a = brut;
      const b = font.b || 0;
      const c = font.c || 0;
      const d = font.d || 0;
      const dPrima = font.dPrima || 0;
      const e = b > 0 ? Math.min(Math.max(0, a * ((b - c) - (d - dPrima)) / b), a) : 0;
      totalGravatDirecte += e;
      continue;
    }

    const cass = font.cotitzacionsCASS || 0;
    totalCASS += cass;

    // Import gravat de la font (per indemnitzacions i dietes, pot ser parcial)
    let gravat = brut;
    if (font.tipus === 'INDEMNITZACIO_ACOMIADAMENT') {
      gravat = Math.max(0, brut - (font.limitLegal || 0));
    } else if (font.tipus === 'DIETES') {
      gravat = Math.max(0, brut - (font.limitDietes || 0));
    } else if (font.tipus === 'BECA' || font.tipus === 'PREMI') {
      gravat = font.compleixRequisitsExempcio ? 0 : brut;
    }

    totalGravat3pct += gravat;
  }

  // Despeses deduïbles: cotitzacions CASS + 3% altres (màx. 2.500)
  // El 3% s'aplica NOMÉS sobre rendes generals (no sobre pensions)
  const altresDespeses = Math.min(
    totalGravat3pct * IRPF_EF.ALTRES_DESPESES_TREBALL_PCT,
    IRPF_EF.ALTRES_DESPESES_TREBALL_MAX
  );

  const totalGravat = totalGravat3pct + totalGravatDirecte;
  let rendaNeta = totalGravat - totalCASS - altresDespeses;

  // Reducció pensionistes CASS (s'aplica sobre la renda neta gravada de la font)
  let redPensionista = 0;
  for (const font of rendesTreball) {
    const anysTotals = font.anysTotals || font.anysCotitzats || 0;
    if (font.esPensionista && anysTotals > 0 && font.tipus !== 'PENSIO_CASS') {
      const pct = Math.min(anysTotals * IRPF_EF.PENSIONISTA_RED_PER_ANY, IRPF_EF.PENSIONISTA_RED_MAX);
      const fontBrut = font.importBrut || 0;
      const fontCASS = font.cotitzacionsCASS || 0;
      const fontAltres = Math.min(fontBrut * IRPF_EF.ALTRES_DESPESES_TREBALL_PCT, IRPF_EF.ALTRES_DESPESES_TREBALL_MAX);
      const fontNeta = fontBrut - fontCASS - fontAltres;
      redPensionista += fontNeta * pct;
    }
  }

  rendaNeta = rendaNeta - redPensionista;

  return Math.max(0, rendaNeta);
}

function calcularRendaNetaActivitat(activitats) {
  return activitats.reduce((acc, a) => {
    // Suport nova estructura amb columnes CAEA
    if (a.columnes && a.columnes.length > 0) {
      const totalColumnes = a.columnes.reduce((sum, col) => {
        if (a.tipusDeterminacio === 'objectiva') {
          const despeses = (col.ingressosComputables || 0) * ((col.percentatgeDespeses || 40) / 100);
          return sum + (col.ingressosComputables || 0) - despeses + (col.resultatExtraordinari || 0);
        } else {
          const ingressos = (col.xifraNegocios || 0) + (col.ingressosFinancers || 0) + (col.altresIngressos || 0);
          const despeses = (col.consumMercaderies || 0) + (col.despesesPersonal || 0) +
            (col.amortitzacions || 0) + (col.arrendamentsCànons || 0) +
            (col.reparacionsConservacio || 0) + (col.subministraments || 0) +
            (col.tributsDeduibles || 0) + (col.serveisExteriors || 0) +
            (col.despesesFinanceres || 0) + (col.altresDespeses || 0);
          return sum + ingressos - despeses + (col.resultatExtraordinari || 0);
        }
      }, 0);
      return acc + totalColumnes - (a.reduccioArrendament || 0);
    }
    // Fallback estructura antiga
    return acc + (a.rendaNeta || 0);
  }, 0);
}

function calcularRendaNetaImmobiliaria(immobles) {
  let total = 0;
  for (const immoble of immobles) {
    if (immoble.tipusDeterminacio === 'forfetaria') {
      const pct = immoble.esHabitatgeAssequible ? 0.50 : 0.40;
      const despeses = immoble.ingressosIntegres * pct;
      total += immoble.ingressosIntegres - despeses;
    } else {
      const despeses = (immoble.despesaReparacio || 0) + (immoble.despesaFinancera || 0) +
                       (immoble.serveisPrestatsTercers || 0) + (immoble.amortitzacio || 0) +
                       (immoble.tributs || 0) + (immoble.asseguranca || 0) +
                       (immoble.comunitat || 0) + (immoble.altresDespeses || 0);
      const reduccio = immoble.aplicarReduccioHabitatge ? (immoble.reduccioHabitatge || 0) : 0;
      total += (immoble.ingressosIntegres || 0) - despeses - reduccio;
    }
  }
  return total;
}

function calcularRendaNetaMobiliaria(mobiliaris) {
  // Nova estructura: array d'entitats, cada una amb partides a/b/c/d
  let totalNet = 0;
  for (const entitat of mobiliaris) {
    if (!entitat.partides) continue;
    const despesesCustodia = entitat.despesesCustodia || 0;
    for (const partida of entitat.partides) {
      const brut = partida.importBrut || 0;
      const desp = partida.despeses || 0;
      totalNet += brut - desp;
    }
    totalNet -= despesesCustodia;
  }
  return totalNet;
}

function calcularRetencionsAndorraMobiliaris(mobiliaris) {
  let total = 0;
  for (const entitat of mobiliaris) {
    if (!entitat.partides) continue;
    for (const partida of entitat.partides) {
      total += partida.retencioAndorra || 0;
    }
  }
  return total;
}

function calcularGuanysCapitalNet(transmissions, guanysNoTransmissio, perduessNoTransmissio, basesNegativesAnteriors) {
  let totalTransmissions = 0;
  for (const t of transmissions) {
    const anysPropieta = (t.anyTransmissio || 0) - (t.anyAdquisicio || 0);
    let valorAdqActualitzat = t.valorAdquisicio || 0;
    // IMM (antes IMMOBLE)
    if ((t.tipusElement === 'IMM' || t.tipusElement === 'IMMOBLE') && t.aplicarCoeficients) {
      const coef = IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT;
      valorAdqActualitzat = valorAdqActualitzat * coef;
    }
    const valorAdqTotal = valorAdqActualitzat + (t.despesesAdquisicio || 0);
    const valorTransTotal = (t.valorTransmissio || 0) - (t.despesesTransmissio || 0);
    const guanyNet = valorTransTotal - valorAdqTotal;

    // Exempcio reinversio habitatge habitual
    if ((t.tipusElement === 'IMM' || t.tipusElement === 'IMMOBLE') && t.esHabitatgeHabitual && t.reinverteix) {
      continue; // exempt
    }
    // Exempcio OIC
    if (t.tipusElement === 'OIC' || t.tipusElement === 'VALORS_OIC') {
      const exemptPerParticipacio = (t.participacioPct || 0) < 25;
      const exemptPerAnys = (t.anysPropieta || anysPropieta) >= 10;
      if (exemptPerParticipacio || exemptPerAnys) continue;
    }

    totalTransmissions += guanyNet; // pot ser negatiu (perdua)
  }

  // Seccio 1 del 300-E: variacions no derivades de transmissio
  const variacioSeccio1 = (guanysNoTransmissio || 0) - (perduessNoTransmissio || 0);
  const totalGuanys = totalTransmissions + variacioSeccio1;

  // Compensar amb bases negatives d'anys anteriors
  const totalAmbCompensacio = totalGuanys - (basesNegativesAnteriors || 0);
  return totalAmbCompensacio;
}

// ── Funció principal ──────────────────────────────────────────────────────────

export function calcularIRPFDetallat(dades) {
  const {
    // Situacio personal
    estatCivil = 'altres',
    conjugeRendesGenerals = 0,
    obligatDiscapacitat = false,
    descendents = [],
    ascendents = [],
    tutelats = [],
    // Rendes
    rendesTreball = [],
    activitats = [],
    immobles = [],
    mobiliaris = [],
    transmissions = [],
    guanysNoTransmissio = 0,
    perduessNoTransmissio = 0,
    basesNegativesAnteriors = 0,
    rendesExterior = [],
    // Reduccions (ara al pas 1)
    quotesHabitatge = 0,
    aportacioPensions = 0,
    contribucioPensions = 0,
    pensionsCompensatories = 0,
    anualitatAliments = 0,
    // 300-F: bases negatives arrays
    basesNegGenerals = [],
    basesNegEstalvi = [],
    deduccionsAnteriors = [],
    // Pas 8 — Deduccions generades en l'exercici
    deduccionsExercici = {},
    // Pagament fraccionat (Formulari 320) ja ingressat
    pagamentACompte = 0,
    // Nombre de progenitors amb dret a la reducció familiar (1 o 2)
    numProgenitorsReduccio = 1,
    // Any de l'exercici declarat (per calcular edats a 31/12)
    exercici = 2025,
  } = dades;

  // PAS 1 — Rendes netes
  const rendaTreball = calcularRendaNetaTreball(rendesTreball);
  const rendaActivitat = calcularRendaNetaActivitat(activitats);
  const rendaImmobiliaria = calcularRendaNetaImmobiliaria(immobles);
  const rendaMobiliaria = calcularRendaNetaMobiliaria(mobiliaris);
  // Separar transmissions exemptes (marcades manualment) de les gravades
  const transmissionsGravades = transmissions.filter(t => !t.exempta);
  const transmissionsExemptes = transmissions.filter(t => t.exempta);
  const guanysCapital = calcularGuanysCapitalNet(transmissionsGravades, guanysNoTransmissio, perduessNoTransmissio, basesNegativesAnteriors);

  // Compensacio 300-F
  const basesNegGeneralsAplicades = Math.max(0, basesNegGenerals.reduce((a, f) => a + (f.aplicat || 0), 0));
  // Math.max(0, ...) evita que un valor negatiu accidental infli btePositiu per sobre del BTE real
  const basesNegEstalviAplicades = Math.max(0, basesNegEstalvi.reduce((a, f) => a + (f.aplicat || 0), 0));
  const deduccionsAnteriorsAplicades = deduccionsAnteriors.reduce((a, f) => a + (f.aplicat || 0), 0);

  // PAS 2 — Bases de tributació
  const baseTributacioGeneral = rendaTreball + rendaActivitat + rendaImmobiliaria;
  const bteRaw = rendaMobiliaria + guanysCapital;
  const baseTributacioEstalvi = bteRaw; // pot ser negatiu

  // PAS 3 — Mínim personal
  // Art. 35.1: MAX(24.000, 40.000 − renda neta cònjuge) per a casats
  let minimPersonal;
  if (obligatDiscapacitat) {
    minimPersonal = IRPF.MINIM_PERSONAL_DISCAP;
  } else if (estatCivil === 'casat') {
    minimPersonal = Math.max(IRPF.MINIM_PERSONAL, IRPF.MINIM_PERSONAL_CONJU - (conjugeRendesGenerals || 0));
  } else {
    minimPersonal = IRPF.MINIM_PERSONAL;
  }

  // PAS 4 — Reduccions
  // Validació descendents (Art. 35.2.a):
  // — edat < 25 anys el 31/12 de l'exercici (nascut el 2000 → edat 25 el 31/12/2025 → NO aplica)
  // — rendes anuals ≤ SMI (17.367,96 € per a 2025)
  // — excepció: discapacitat reconeguda → sense límit d'edat
  const anyMeritacio = exercici || 2025;
  const descendentsValids = descendents.filter(d => {
    const edat = anyMeritacio - (d.anyNaixement || 0);
    const teDiscapacitat = d.discapacitat || false;
    const compleixEdat = teDiscapacitat || edat < 25;
    const compleixRendes = (d.rendesAnuals || 0) <= IRPF_EF.SMI_ANUAL;
    return compleixEdat && compleixRendes;
  });

  const numDescendents = descendentsValids.length;
  const numAscendents = ascendents.length;
  const numTutelats = tutelats.length;
  const numDiscapacitats = [
    ...descendentsValids.filter(d => d.discapacitat),
    ...ascendents.filter(a => a.discapacitat),
  ].length;

  const matricules = descendentsValids.reduce((acc, d) => acc + (d.matricules || 0), 0);
  const redMatricules = Math.min(matricules, IRPF.RED_MATRICULA_MAX * numDescendents);

  // Reducció familiar: 1.000€ per persona a càrrec, dividida entre els progenitors amb dret (Art. 35.2)
  const numProgenitors = Math.max(1, numProgenitorsReduccio || 1);
  const redFamiliar = ((numDescendents * IRPF.RED_DESCENDENT) +
                       (numAscendents * IRPF.RED_ASCENDENT) +
                       (numTutelats * IRPF.RED_TUTELA) +
                       (numDiscapacitats * IRPF.RED_DESCENDENT * (IRPF.COEF_DISCAPACITAT - 1)) +
                       redMatricules) / numProgenitors;

  const redHabitatge = Math.min(
    quotesHabitatge * IRPF.RED_HABITATGE_PCT,
    IRPF.RED_HABITATGE_MAX
  );

  const redPensions = Math.min(
    (aportacioPensions + contribucioPensions) * IRPF.RED_PLA_PENSIONS_PCT,
    IRPF.RED_PLA_PENSIONS_MAX
  );

  const totalReduccions = minimPersonal + redFamiliar + redHabitatge + redPensions +
                          pensionsCompensatories + anualitatAliments;

  // BLG i BLE (incloent compensacions 300-F)
  const baseLiquidacioGeneral = Math.max(0, baseTributacioGeneral - basesNegGeneralsAplicades - totalReduccions);
  const btePositiu = Math.max(0, baseTributacioEstalvi - basesNegEstalviAplicades);
  const baseLiquidacioEstalvi = Math.max(0, btePositiu - IRPF.MINIM_ESTALVI);

  // PAS 5 — Quota
  const quotaTributacio = (baseLiquidacioGeneral + baseLiquidacioEstalvi) * IRPF.TIPUS_GRAVAMEN;

  // Bonificació Art. 46 — fórmula correcta:
  // bonificació = (BTG − mínim personal base) × 10% × 50%, màxim 800 €
  // S'usa la BTG (base de TRIBUTACIÓ general), NO la BLG
  // NO s'inclou el mínim incrementat per cònjuge ni càrregues familiars
  const minimPersonalBase = obligatDiscapacitat ? IRPF.MINIM_PERSONAL_DISCAP : IRPF.MINIM_PERSONAL;
  const baseBonificacio = Math.max(0, baseTributacioGeneral - minimPersonalBase);
  const bonificacio = Math.min(IRPF.BONIF_MAX, baseBonificacio * IRPF.TIPUS_GRAVAMEN * 0.50);

  const quotaLiquidacio = Math.max(0, quotaTributacio - bonificacio);

  // Total deduccions generades en l'exercici — pas 8 (Art. 43 bis, 44, 44 bis, 47, 48)
  const d8 = deduccionsExercici || {};

  // Art. 47 — impost comunal arrendaments
  const impostComunalArrendaments = immobles.reduce((acc, im) => acc + (im.impostComunal || 0), 0);
  const aplicatArrendaments = Math.min(
    d8.aplicatArrendaments !== undefined ? d8.aplicatArrendaments : impostComunalArrendaments,
    quotaLiquidacio
  );

  // Art. 47 — impost comunal radicació
  const impostComunalRadicacio = activitats.reduce((acc, a) => acc + (a.impostRadicacio || 0), 0);
  const aplicatRadicacio = Math.min(
    d8.aplicatRadicacio !== undefined ? d8.aplicatRadicacio : impostComunalRadicacio,
    quotaLiquidacio
  );

  // Art. 48 — DDI
  const ddiDetall = calcularDDI(rendesExterior);
  const ddiCalculat = ddiDetall.reduce((acc, r) => acc + r.ddi, 0);
  const ddi = Math.min(
    d8.aplicatDDI !== undefined ? d8.aplicatDDI : ddiCalculat,
    Math.max(0, quotaLiquidacio - aplicatArrendaments - aplicatRadicacio)
  );

  // Deduccions voluntàries (mecenatge, projectes, llocs treball, digital, patrocini)
  const mecenatge20 = (d8.donatiu20 || 0) * 0.20;
  const mecenatge90 = Math.min(d8.donatiu90 || 0, 100) * 0.90;
  const dedMecenatge = Math.min(d8.aplicatMecenatge || 0, mecenatge20 + mecenatge90);
  const dedProjectes = Math.min(d8.aplicatProjectes || 0, (d8.aportacionsProjectes || 0) * 0.75);
  const incNI = Math.max(0, (d8.plantillaNIActual||0)-(d8.plantillaNIAnterior||0));
  const incIN = Math.max(0, (d8.plantillaINActual||0)-(d8.plantillaINAnterior||0));
  const incIE = Math.max(0, (d8.plantillaIEActual||0)-(d8.plantillaIEAnterior||0));
  const dedLlocs = Math.min(d8.aplicatLlocs || 0, incNI*1000 + incIN*3500 + incIE*3500);
  const dedDigital = Math.min(d8.aplicatDigital || 0, (d8.inversionsDigital||0)*0.02);
  const dedPatrocini = Math.min(d8.aplicatPatrocini || 0, (d8.despesesPatrocini||0)*0.10);

  // Total únic deduccions generades exercici (una sola línia al 300-L)
  const totalDeduccionsExercici = aplicatArrendaments + aplicatRadicacio + ddi +
    dedMecenatge + dedProjectes + dedLlocs + dedDigital + dedPatrocini;

  // Mantenir per compatibilitat amb altres components
  const deduccioImpostComunal = aplicatArrendaments + aplicatRadicacio;

  // Quota final
  const quotaFinal = Math.max(0, quotaLiquidacio - totalDeduccionsExercici - deduccionsAnteriorsAplicades);

  // Tipus efectiu
  const rendaTotal = baseTributacioGeneral + btePositiu;
  const tipusEfectiu = rendaTotal > 0 ? quotaFinal / rendaTotal : 0;

  // Retencions
  const retencionsTreball = rendesTreball.reduce((acc, f) => acc + (f.retencions || 0), 0);
  const retencionsImmobles = immobles.reduce((acc, im) => acc + (im.retencions || 0), 0);
  const retencionsTransmissions = transmissions.reduce((acc, t) => acc + (t.retencionsPagamentCompte || 0), 0);
  const retencionsAndorraMobiliaris = calcularRetencionsAndorraMobiliaris(mobiliaris);
  const retencions = retencionsTreball + retencionsImmobles + retencionsTransmissions + retencionsAndorraMobiliaris;

  const resultatDeclaracio = quotaFinal - retencions - (pagamentACompte || 0);

  return {
    // Rendes
    rendaTreball,
    rendaActivitat,
    rendaImmobiliaria,
    baseTributacioGeneral,
    rendaMobiliaria,
    guanysCapital,
    baseTributacioEstalvi,
    // Transmissions exemptes (confirmades a Step6)
    transmissionsExemptes,
    totalExempt: transmissionsExemptes.reduce((s, t) => s + (t.importExempt || 0), 0),
    // Reduccions
    minimPersonal,
    redFamiliar,
    redHabitatge,
    redPensions,
    totalReduccions,
    // Bases liquidació
    baseLiquidacioGeneral,
    baseLiquidacioEstalvi,
    // Quota
    quotaTributacio,
    bonificacio,
    quotaLiquidacio,
    totalDeduccionsExercici,
    deduccioImpostComunal,
    ddi,
    ddiCalculat,
    ddiDetall,
    deduccionsAnteriorsAplicades,
    quotaFinal,
    tipusEfectiu,
    // Resultat
    retencions,
    pagamentACompte: pagamentACompte || 0,
    resultatDeclaracio,
  };
}
