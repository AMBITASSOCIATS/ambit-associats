// engine/analysisEngine.js — Motor d'anàlisi de rendes IRPF Andorra
// Exporta calcularIRPFDetallat(dades) que combina totes les rendes i retorna el detall complet.

import { IRPF, IRPF_EF } from './constants.js';
import { calcularDDI } from './exemptions.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcularRendaNetaTreball(rendesTreball) {
  let totalCASS = 0;
  let totalGravat = 0;

  for (const font of rendesTreball) {
    // Pensions CASS: totalment exemptes (no s'inclouen en renda gravada)
    if (font.tipus === 'PENSIO_CASS') {
      // Però apliquem la reducció pensionista si correspon (però la pensió és exempta)
      continue;
    }

    const brut = font.importBrut || 0;
    const cass = font.cotitzacionsCASS || 0;
    totalCASS += cass;

    // Import gravat de la font (per indemnitzacions i dietes, pot ser parcial)
    let gravat = brut;
    if (font.tipus === 'INDEMNITZACIO_ACOMIADAMENT') {
      gravat = Math.max(0, brut - (font.limitLegal || 0));
    } else if (font.tipus === 'DIETES') {
      gravat = Math.max(0, brut - (font.limitDietes || 0));
    } else if (font.tipus === 'BECA' || font.tipus === 'PREMI') {
      gravat = 0; // exemptes
    }

    totalGravat += gravat;
  }

  // Despeses deduïbles: cotitzacions CASS + 3% altres (màx. 2.500)
  const altresDespeses = Math.min(
    totalGravat * IRPF_EF.ALTRES_DESPESES_TREBALL_PCT,
    IRPF_EF.ALTRES_DESPESES_TREBALL_MAX
  );

  let rendaNeta = totalGravat - totalCASS - altresDespeses;

  // Reducció pensionistes CASS (s'aplica sobre la renda neta gravada del pensionista)
  // Si hi ha algun ingrés de pensionista CASS que NO és la pensió (peu de pàgina: improbable)
  // En la pràctica la reducció s'aplica si el contribuent cobra pensió CASS + altres rendes
  // Aquí implementem la reducció sobre la renda neta total si hi ha fonts amb esPensionista
  let redPensionista = 0;
  for (const font of rendesTreball) {
    if (font.esPensionista && font.anysCotitzats > 0 && font.tipus !== 'PENSIO_CASS') {
      const pct = Math.min(font.anysCotitzats * IRPF_EF.PENSIONISTA_RED_PER_ANY, IRPF_EF.PENSIONISTA_RED_MAX);
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
                       (immoble.amortitzacio || 0) + (immoble.tributs || 0) +
                       (immoble.asseguranca || 0) + (immoble.comunitat || 0);
      total += (immoble.ingressosIntegres || 0) - despeses;
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
  } = dades;

  // PAS 1 — Rendes netes
  const rendaTreball = calcularRendaNetaTreball(rendesTreball);
  const rendaActivitat = calcularRendaNetaActivitat(activitats);
  const rendaImmobiliaria = calcularRendaNetaImmobiliaria(immobles);
  const rendaMobiliaria = calcularRendaNetaMobiliaria(mobiliaris);
  const guanysCapital = calcularGuanysCapitalNet(transmissions, guanysNoTransmissio, perduessNoTransmissio, basesNegativesAnteriors);

  // Compensacio 300-F
  const basesNegGeneralsAplicades = basesNegGenerals.reduce((a, f) => a + (f.aplicat || 0), 0);
  const basesNegEstalviAplicades = basesNegEstalvi.reduce((a, f) => a + (f.aplicat || 0), 0);
  const deduccionsAnteriorsAplicades = deduccionsAnteriors.reduce((a, f) => a + (f.aplicat || 0), 0);

  // PAS 2 — Bases de tributació
  const baseTributacioGeneral = rendaTreball + rendaActivitat + rendaImmobiliaria;
  const bteRaw = rendaMobiliaria + guanysCapital;
  const baseTributacioEstalvi = bteRaw; // pot ser negatiu

  // PAS 3 — Mínim personal
  const conjugeACarrec = estatCivil === 'casat' && conjugeRendesGenerals < IRPF.MINIM_PERSONAL;
  let minimPersonal;
  if (conjugeACarrec) {
    minimPersonal = IRPF.MINIM_PERSONAL_CONJU;
  } else if (obligatDiscapacitat) {
    minimPersonal = IRPF.MINIM_PERSONAL_DISCAP;
  } else {
    minimPersonal = IRPF.MINIM_PERSONAL;
  }

  // PAS 4 — Reduccions
  const numDescendents = descendents.length;
  const numAscendents = ascendents.length;
  const numTutelats = tutelats.length;
  const numDiscapacitats = [
    ...descendents.filter(d => d.discapacitat),
    ...ascendents.filter(a => a.discapacitat),
  ].length + (obligatDiscapacitat ? 0 : 0);

  const matricules = descendents.reduce((acc, d) => acc + (d.matricules || 0), 0);
  const redMatricules = Math.min(matricules, IRPF.RED_MATRICULA_MAX * numDescendents);

  const redFamiliar = (numDescendents * IRPF.RED_DESCENDENT) +
                      (numAscendents * IRPF.RED_ASCENDENT) +
                      (numTutelats * IRPF.RED_TUTELA) +
                      (numDiscapacitats * IRPF.RED_DESCENDENT * (IRPF.COEF_DISCAPACITAT - 1)) +
                      redMatricules;

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

  // Bonificació Art. 46
  const minimPersonalBase = obligatDiscapacitat ? IRPF.MINIM_PERSONAL_DISCAP : IRPF.MINIM_PERSONAL;
  const basePerBonif = Math.max(0, baseTributacioGeneral - minimPersonalBase);
  const bonificacio = basePerBonif > 0
    ? Math.min(IRPF.BONIF_MAX, (minimPersonalBase / (baseTributacioGeneral)) * quotaTributacio)
    : 0;

  const quotaLiquidacio = Math.max(0, quotaTributacio - bonificacio);

  // Deducció impost comunal (Art. 47)
  const impostComunalTotal = immobles.reduce((acc, im) => acc + (im.impostComunal || 0), 0);
  const deduccioImpostComunal = Math.min(impostComunalTotal, quotaLiquidacio);

  // DDI (Art. 48)
  const ddiDetall = calcularDDI(rendesExterior);
  const ddiTotal = ddiDetall.reduce((acc, r) => acc + r.ddi, 0);
  const ddi = Math.min(ddiTotal, Math.max(0, quotaLiquidacio - deduccioImpostComunal));

  // Quota final (incloent deduccions 300-F)
  const quotaFinal = Math.max(0, quotaLiquidacio - deduccioImpostComunal - ddi - deduccionsAnteriorsAplicades);

  // Tipus efectiu
  const rendaTotal = baseTributacioGeneral + btePositiu;
  const tipusEfectiu = rendaTotal > 0 ? quotaFinal / rendaTotal : 0;

  // Retencions
  const retencionsTreball = rendesTreball.reduce((acc, f) => acc + (f.retencions || 0), 0);
  const retencionsImmobles = immobles.reduce((acc, im) => acc + (im.retencions || 0), 0);
  const retencionsTransmissions = transmissions.reduce((acc, t) => acc + (t.retencionsPagamentCompte || 0), 0);
  const retencionsAndorraMobiliaris = calcularRetencionsAndorraMobiliaris(mobiliaris);
  const retencions = retencionsTreball + retencionsImmobles + retencionsTransmissions + retencionsAndorraMobiliaris;

  const resultatDeclaracio = quotaFinal - retencions;

  return {
    // Rendes
    rendaTreball,
    rendaActivitat,
    rendaImmobiliaria,
    baseTributacioGeneral,
    rendaMobiliaria,
    guanysCapital,
    baseTributacioEstalvi,
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
    deduccioImpostComunal,
    ddi,
    ddiDetall,
    quotaFinal,
    tipusEfectiu,
    // Resultat
    retencions,
    resultatDeclaracio,
  };
}
