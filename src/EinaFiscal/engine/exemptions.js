// engine/exemptions.js — Lògica d'exempcions (Art. 5 Llei 5/2014)
// Cada funció retorna: { exempt, parcial, ratio, importGravat, importExempt, ref, titol, explicacio, alertType, formulari, casella }

import { IRPF_EF } from './constants.js';
import { CDI_RATES } from './cdiRates.js';

// ── 5.2 Exempcions de rendes del treball ──────────────────────────────────────
export function analizarRendaTreball(renda) {
  const { tipus, importBrut, detalls } = renda;
  switch (tipus) {
    case 'PENSIO_CASS':
      return {
        exempt: true, parcial: false, ratio: 1.0,
        importGravat: 0, importExempt: importBrut,
        ref: 'Art. 5.i Llei 5/2014',
        titol: 'Pensió CASS — exempta',
        explicacio: `Les pensions de jubilació, invalidesa permanent i mort i supervivència abonades per la Caixa Andorrana de Seguretat Social (CASS) estan totalment exemptes d'IRPF en virtut de l'art. 5.i de la Llei 5/2014. Import exempt: ${importBrut.toFixed(2)} €.`,
        alertType: 'success', formulari: '300-B', casella: 'I.2'
      };

    case 'BECA':
      return {
        exempt: true, parcial: false, ratio: 1.0,
        importGravat: 0, importExempt: importBrut,
        ref: 'Art. 5.n Llei 5/2014 + Art. 16 Reglament 29/12/2023',
        titol: "Beca a l'estudi — exempta",
        explicacio: "Les beques a l'estudi i els ajuts de recerca concedits per entitats públiques andorranes o per entitats sense ànim de lucre reconegudes estan exemptes d'IRPF (Art. 5.n Llei 5/2014 i Art. 16 Reglament). ATENCIÓ: verificar que l'entitat atorgant compleix els requisits reglamentaris.",
        alertType: 'success', formulari: '300-B', casella: 'I.1'
      };

    case 'INDEMNITZACIO_ACOMIADAMENT': {
      const limitExempt = detalls?.limitLegal || 0;
      const importGravat = Math.max(0, importBrut - limitExempt);
      return {
        exempt: importGravat === 0, parcial: importGravat > 0 && limitExempt > 0,
        ratio: importBrut > 0 ? Math.min(1, limitExempt / importBrut) : 1,
        importGravat, importExempt: Math.min(importBrut, limitExempt),
        ref: 'Art. 5.f Llei 5/2014',
        titol: 'Indemnització per acomiadament — parcialment exempta',
        explicacio: `Les indemnitzacions per acomiadament estan exemptes fins a l'import màxim establert obligatòriament per la normativa laboral andorrana (Art. 5.f Llei 5/2014). L'import que superi el límit legal tributa com a renda del treball. Exempt: ${Math.min(importBrut, limitExempt).toFixed(2)} €. Gravat: ${importGravat.toFixed(2)} €.`,
        alertType: importGravat > 0 ? 'warning' : 'success',
        formulari: '300-B', casella: 'I.1'
      };
    }

    case 'DIETES': {
      const limitDietes = detalls?.limitReglamentari || 0;
      const dietesGravades = Math.max(0, importBrut - limitDietes);
      return {
        exempt: dietesGravades === 0, parcial: dietesGravades > 0,
        ratio: importBrut > 0 ? Math.min(1, limitDietes / importBrut) : 1,
        importGravat: dietesGravades, importExempt: Math.min(importBrut, limitDietes),
        ref: 'Art. 5.e Llei 5/2014',
        titol: 'Dietes — exemptes fins a límit reglamentari',
        explicacio: "Les dietes i assignacions per despeses de locomoció, manutenció i estada en que incorre el treballador per raons de treball estan exemptes fins als límits establerts reglamentàriament (Art. 5.e Llei 5/2014). Verificar que l'empresa ha acreditat el desplaçament.",
        alertType: dietesGravades > 0 ? 'warning' : 'success',
        formulari: '300-B', casella: 'I.1'
      };
    }

    case 'PREMI':
      return {
        exempt: true, parcial: false, ratio: 1.0,
        importGravat: 0, importExempt: importBrut,
        ref: 'Art. 17 Reglament 29/12/2023',
        titol: 'Premi literari, artístic o científic — exempt si compleix requisits',
        explicacio: "Els premis literaris, artístics o científics estan exempts d'IRPF quan siguin atorgats per institucions públiques andorranes o entitats privades reconegudes i no comportin obligació de cedir drets (Art. 17 Reglament). ATENCIÓ: verificar que es compleixen els requisits reglamentaris.",
        alertType: 'success', formulari: '300-B', casella: 'I.1'
      };

    case 'ADMINISTRADOR':
      return {
        exempt: false, parcial: false, ratio: 0,
        importGravat: importBrut, importExempt: 0,
        ref: 'Art. 13.5 Llei 5/2014',
        titol: 'Retribució administrador — gravada',
        explicacio: `Les retribucions dels administradors de societats estan subjectes a IRPF com a rendes del treball. S'aplica la deducció del 3% sobre les retribucions (màx. 2.500 €) en concepte d'altres despeses deduïbles (Art. 13.5.b Llei 5/2014). Import gravat: ${importBrut.toFixed(2)} €.`,
        alertType: 'info', formulari: '300-B', casella: 'I.1'
      };

    case 'ALTRES_TREBALL':
    case 'SALARI_GENERAL':
    default:
      return {
        exempt: false, parcial: false, ratio: 0,
        importGravat: importBrut, importExempt: 0,
        ref: 'Art. 10-13 Llei 5/2014',
        titol: 'Renda del treball — gravada',
        explicacio: "Els rendiments del treball (salaris, pagues extres, retribucions en espècie, etc.) formen part de la base de tributació general. S'apliquen les despeses deduïbles: cotitzacions CASS a càrrec del treballador i el 3% d'altres despeses (màx. 2.500 €) (Art. 13 Llei 5/2014 + Guia IRPF 2025 §6.2).",
        alertType: 'info', formulari: '300-B', casella: 'I.1'
      };
  }
}

// ── 5.3 Exempcions de capital mobiliari ──────────────────────────────────────
export function analizarRCM(renda) {
  const { apartat, importNet, participacioPct, anysParticipacio } = renda;

  if (apartat === 'DIVIDENDS_OIC') {
    const exemptPerParticipacio = participacioPct < 25;
    const exemptPerAnys = anysParticipacio >= 10;
    if (exemptPerParticipacio || exemptPerAnys) {
      return {
        exempt: true, parcial: false, ratio: 1.0,
        importGravat: 0, importExempt: importNet,
        ref: 'Art. 5.k Llei 5/2014 + CT 04/03/2015',
        titol: 'Dividends OIC — exempts',
        explicacio: `Els rendiments de participacions en organismes d'inversió col·lectiva (OIC) estan exempts d'IRPF quan la participació de l'obligat tributari és inferior al 25% del patrimoni de l'organisme (${participacioPct}% < 25%) o quan la participació s'ha mantingut durant 10 anys o més (${anysParticipacio} anys). Font: Art. 5.k Llei 5/2014 i Comunicat Tècnic 04/03/2015.`,
        alertType: 'success', formulari: '300-D', casella: 'a'
      };
    } else {
      return {
        exempt: false, parcial: false, ratio: 0,
        importGravat: importNet, importExempt: 0,
        ref: 'Art. 5.k Llei 5/2014 + CT 04/03/2015',
        titol: 'Dividends OIC — gravats',
        explicacio: `La participació en l'OIC (${participacioPct}%) és igual o superior al 25% i la tinença és inferior a 10 anys (${anysParticipacio} anys). Per tant no s'aplica l'exempció de l'Art. 5.k. Els rendiments tributen com a rendes de l'estalvi al 10%.`,
        alertType: 'warning', formulari: '300-D', casella: 'a'
      };
    }
  }

  if (apartat === 'ASSEGURANCA_VIDA_HIPOTECA') {
    return {
      exempt: true, parcial: false, ratio: 1.0,
      importGravat: 0, importExempt: importNet,
      ref: 'CT 25/03/2026 Ministeri de Finances',
      titol: 'Assegurança vida (cobertura hipoteca) — exempta',
      explicacio: "Segons el Comunicat Tècnic del 25/03/2026 del Ministeri de Finances, les prestacions d'assegurances de vida vinculades exclusivament a la cobertura d'un préstec hipotecari per adquisició d'habitatge habitual no generen renda subjecta a IRPF per a l'obligat tributari quan la beneficiària és l'entitat financera.",
      alertType: 'success', formulari: '300-D', casella: 'c'
    };
  }

  // Rendes generals del capital mobiliari — gravades com a renda de l'estalvi
  return {
    exempt: false, parcial: false, ratio: 0,
    importGravat: importNet, importExempt: 0,
    ref: 'Art. 37 Llei 5/2014',
    titol: "Renda del capital mobiliari — gravada (renda de l'estalvi)",
    explicacio: "Les rendes del capital mobiliari tributen com a rendes de l'estalvi. S'aplica el mínim exempt de 3.000 € anuals sobre el total de rendes de l'estalvi (Art. 37 Llei 5/2014). L'import que superi el mínim tributa al 10%.",
    alertType: 'info', formulari: '300-D', casella: apartat ? apartat.toLowerCase() : 'a'
  };
}

// ── 5.4 Exempcions de guanys i pèrdues de capital ────────────────────────────
export function analizarGuanyCapital(transmissio) {
  const { tipusElement, guanyNet, esHabitatgeHabitual,
          anysPropieta, participacioPct, reinverteix } = transmissio;

  // Art. 5.r — Exempció guanys de capital per reinversió en habitatge habitual
  if (tipusElement === 'IMMOBLE' && esHabitatgeHabitual && reinverteix) {
    return {
      exempt: true, parcial: false, ratio: 1.0,
      importGravat: 0, importExempt: guanyNet,
      ref: 'Art. 5.r Llei 5/2014 + Art. 14 Reglament 29/12/2023',
      titol: 'Guany habitatge habitual — exempt per reinversió',
      explicacio: "El guany derivat de la transmissió de l'habitatge habitual és exempt d'IRPF si l'import obtingut es reinverteix en l'adquisició d'un nou habitatge habitual (Art. 5.r Llei 5/2014). El contribuent ha de sol·licitar l'exempció a l'Administració tributària en el termini establert a l'Art. 14 del Reglament. IMPORTANT: presentar formulari de sol·licitud d'exempció.",
      alertType: 'success', formulari: '300-E', casella: 'II'
    };
  }

  // Art. 5.k aplicat a transmissió de valors OIC
  if (tipusElement === 'VALORS_OIC') {
    const exemptPerParticipacio = participacioPct < 25;
    const exemptPerAnys = anysPropieta >= 10;
    if (exemptPerParticipacio || exemptPerAnys) {
      return {
        exempt: true, parcial: false, ratio: 1.0,
        importGravat: 0, importExempt: guanyNet,
        ref: 'Art. 5.k Llei 5/2014 + CT 04/03/2015',
        titol: 'Transmissió OIC — exempta',
        explicacio: `La transmissió de participacions en OIC és exempta perquè la participació (${participacioPct}%) és inferior al 25% OR la tinença és >= 10 anys (${anysPropieta} anys). Font: Art. 5.k i CT 04/03/2015.`,
        alertType: 'success', formulari: '300-E', casella: 'II'
      };
    }
  }

  // Pèrdua de capital — no tributa però compensa guanys futurs
  if (guanyNet < 0) {
    return {
      exempt: true, parcial: false, ratio: 1.0,
      importGravat: 0, importExempt: 0,
      ref: 'Art. 32 Llei 5/2014',
      titol: 'Pèrdua de capital — no tributa',
      explicacio: `Les pèrdues de capital no generen tributació. Es poden compensar amb guanys de capital obtinguts en els ${IRPF_EF.GP_COMPENSACIO_ANYS} exercicis posteriors (Art. 32 Llei 5/2014). Import de la pèrdua: ${Math.abs(guanyNet).toFixed(2)} €. Consignar al formulari 300-F per a compensació futura.`,
      alertType: 'warning', formulari: '300-E', casella: 'II'
    };
  }

  // Guany gravat — renda de l'estalvi
  return {
    exempt: false, parcial: false, ratio: 0,
    importGravat: guanyNet, importExempt: 0,
    ref: 'Art. 30-32 Llei 5/2014',
    titol: "Guany de capital — gravat (renda de l'estalvi)",
    explicacio: "El guany de capital tributa com a renda de l'estalvi al 10% (Art. 30 Llei 5/2014). El guany = valor de transmissió − valor d'adquisició actualitzat amb els coeficients correctors (Art. 26 Llei + Art. 26 Reglament). Per a immobles andorrans, el valor d'adquisició s'actualitza amb els coeficients de la Llei de pressupostos.",
    alertType: 'info', formulari: '300-E', casella: 'II'
  };
}

// ── 5.5 DDI (Art. 48 Llei 5/2014) ────────────────────────────────────────────
export function calcularDDI(rendesExt) {
  // rendesExt: array de { pais, tipusRenda, importBrut, retencioOrigen, importNet }
  return rendesExt.map(r => {
    const cdi = CDI_RATES[r.pais] || CDI_RATES.DEFAULT;
    const tipusAndorra = 0.10;
    const quotaAndorra = r.importNet * tipusAndorra;
    const ddi = Math.min(r.retencioOrigen, quotaAndorra);
    const teCDI = r.pais in CDI_RATES && r.pais !== 'DEFAULT';
    const explicacio = teCDI
      ? `CDI ${cdi.notes}. La DDI es limita al menor entre la retenció pagada a ${r.pais} (${r.retencioOrigen.toFixed(2)} €) i la quota andorrana sobre aquesta renda (${quotaAndorra.toFixed(2)} €). DDI aplicable: ${ddi.toFixed(2)} €.`
      : `Sense CDI amb ${r.pais}. S'aplica la normativa interna andorrana (Art. 48 Llei 5/2014). La DDI es limita a la quota andorrana sobre la renda estrangera: ${ddi.toFixed(2)} €.`;
    return {
      ...r, quotaAndorra, ddi, teCDI,
      ref: `Art. 48 Llei 5/2014${teCDI ? ` + CDI Andorra-${r.pais}` : ''}`,
      explicacio
    };
  });
}
