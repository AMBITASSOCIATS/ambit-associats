// engine/cdiRates.js — Tipus de retenció per CDI i país
// Conté els tipus màxims de retenció a la font que cada CDI permet aplicar al país d'origen.

export const CDI_RATES = {
  // Format: { dividends: %, interessos: %, canons: %, notes: '' }
  // Tipus: percentatge màxim de retenció al país d'origen permès pel CDI
  'ES': {  // Espanya — CDI en vigor 26/02/2016
    dividends_general: 0.15,   // Art. 10.2.b — cas general
    dividends_qualif: 0.05,    // Art. 10.2.a — participació >= 10% del capital
    interessos: 0.05,          // Art. 11.2
    canons: 0.05,              // Art. 12.2
    plusvalues_immobles: null, // Art. 13 — tributen al país on estan els immobles
    plusvalues_accions: null,  // Art. 13.4 — si >50% actius immobles a ES
    pensions_privades: 'residencia', // Art. 18 — al país de residència
    pensions_SS: 'origen',     // Art. 19 — pensió SS espanyola tributa a Espanya
    salaris: 'treball',        // Art. 15 — al país on s'exerceix la feina
    notes: 'CDI Andorra-Espanya. BOPA núm. 70/2015. En vigor 26/02/2016.'
  },
  'FR': {  // França — CDI en vigor 01/07/2015
    dividends_general: 0.15,   // Art. 11
    dividends_qualif: 0.05,    // Art. 11 — participació >= 10%
    interessos: 0.05,          // Art. 12
    canons: 0.05,              // Art. 13
    plusvalues_immobles: null, // Art. 14 — al país on estan els immobles
    plusvalues_accions: null,  // Art. 14
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-França. BOPA núm. 64/2014. En vigor 01/07/2015.'
  },
  'PT': {  // Portugal — CDI en vigor 23/04/2017
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Portugal. BOPA núm. 77/2016. En vigor 23/04/2017.'
  },
  'LU': {  // Luxemburg — CDI en vigor 07/03/2016
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Luxemburg. BOPA núm. 87/2015. En vigor 07/03/2016.'
  },
  'LI': {  // Liechtenstein — CDI en vigor 21/11/2016
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Liechtenstein. BOPA núm. 38/2016. En vigor 21/11/2016.'
  },
  'AE': {  // Emirats Àrabs — CDI en vigor
    dividends_general: 0.00,
    dividends_qualif: 0.00,
    interessos: 0.00,
    canons: 0.00,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Emirats Àrabs Units.'
  },
  'SM': {  // San Marino
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-San Marino.'
  },
  'MT': {  // Malta
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Malta.'
  },
  'UY': {  // Uruguai
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Uruguai.'
  },
  'KR': {  // Corea del Sud
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Corea del Sud.'
  },
  'LT': {  // Lituània
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Lituània.'
  },
  'ME': {  // Montenegro
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Montenegro.'
  },
  'LV': {  // Letònia
    dividends_general: 0.15,
    dividends_qualif: 0.05,
    interessos: 0.05,
    canons: 0.05,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    pensions_privades: 'residencia',
    pensions_SS: 'origen',
    salaris: 'treball',
    notes: 'CDI Andorra-Letònia.'
  },
  // Sense CDI — no hi ha límit de retenció convencional
  'DEFAULT': {
    dividends_general: null,
    interessos: null,
    canons: null,
    plusvalues_immobles: null,
    plusvalues_accions: null,
    notes: "Sense CDI. La DDI es calcula per la normativa interna andorrana (Art. 48 Llei 5/2014)."
  }
};

export const PAISOS = [
  { codi: 'ES', nom: 'Espanya', cdi: true },
  { codi: 'FR', nom: 'França', cdi: true },
  { codi: 'PT', nom: 'Portugal', cdi: true },
  { codi: 'LU', nom: 'Luxemburg', cdi: true },
  { codi: 'LI', nom: 'Liechtenstein', cdi: true },
  { codi: 'AE', nom: 'Emirats Àrabs Units', cdi: true },
  { codi: 'SM', nom: 'San Marino', cdi: true },
  { codi: 'MT', nom: 'Malta', cdi: true },
  { codi: 'UY', nom: 'Uruguai', cdi: true },
  { codi: 'KR', nom: 'Corea del Sud', cdi: true },
  { codi: 'LT', nom: 'Lituània', cdi: true },
  { codi: 'ME', nom: 'Montenegro', cdi: true },
  { codi: 'LV', nom: 'Letònia', cdi: true },
  { codi: 'OTHER', nom: 'Altre país (sense CDI)', cdi: false },
];
