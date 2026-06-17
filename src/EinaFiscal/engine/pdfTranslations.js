// pdfTranslations.js — Textos del PDF de liquidació IRPF en 4 idiomes
// CA = Català (per defecte) · ES = Castellà · FR = Francès · EN = Anglès

export const PDF_LANGS = {
  CA: 'Català',
  ES: 'Castellano',
  FR: 'Français',
  EN: 'English',
};

export const T = {
  // ── PORTADA ──────────────────────────────────────────────────────────────
  titolInforme: {
    CA: "Impost sobre la Renda de les Persones Físiques",
    ES: "Impuesto sobre la Renta de las Personas Físicas",
    FR: "Impôt sur le Revenu des Personnes Physiques",
    EN: "Personal Income Tax",
  },
  subtitolInforme: {
    CA: "Informe de Liquidació",
    ES: "Informe de Liquidación",
    FR: "Rapport de Liquidation",
    EN: "Settlement Report",
  },
  exerciciFiscal: {
    CA: "Exercici fiscal",
    ES: "Ejercicio fiscal",
    FR: "Exercice fiscal",
    EN: "Fiscal year",
  },
  dataGeneracio: {
    CA: "Data de generació",
    ES: "Fecha de generación",
    FR: "Date de génération",
    EN: "Generation date",
  },
  normativa: {
    CA: "Normativa",
    ES: "Normativa",
    FR: "Réglementation",
    EN: "Regulations",
  },
  obligatTributari: {
    CA: "OBLIGAT TRIBUTARI",
    ES: "OBLIGADO TRIBUTARIO",
    FR: "CONTRIBUABLE",
    EN: "TAXPAYER",
  },
  dadesInforme: {
    CA: "DADES DE L'INFORME",
    ES: "DATOS DEL INFORME",
    FR: "DONNÉES DU RAPPORT",
    EN: "REPORT DATA",
  },

  // ── RESUM EXECUTIU ────────────────────────────────────────────────────────
  resumExecutiu: {
    CA: "RESUM EXECUTIU",
    ES: "RESUMEN EJECUTIVO",
    FR: "RÉSUMÉ EXÉCUTIF",
    EN: "EXECUTIVE SUMMARY",
  },
  baseTributacioGeneral: {
    CA: "Base Tributació General",
    ES: "Base Tributación General",
    FR: "Base d'Imposition Générale",
    EN: "General Tax Base",
  },
  baseTributacioEstalvi: {
    CA: "Base Tributació Estalvi",
    ES: "Base Tributación Ahorro",
    FR: "Base d'Imposition Épargne",
    EN: "Savings Tax Base",
  },
  quotaTributacio: {
    CA: "Quota de Tributació",
    ES: "Cuota de Tributación",
    FR: "Quote-part d'Imposition",
    EN: "Tax Quota",
  },
  bonificacioArt46: {
    CA: "Bonificació Art. 46",
    ES: "Bonificación Art. 46",
    FR: "Bonification Art. 46",
    EN: "Allowance Art. 46",
  },
  quotaLiquidacio: {
    CA: "Quota de Liquidació",
    ES: "Cuota de Liquidación",
    FR: "Quote-part de Liquidation",
    EN: "Settlement Quota",
  },
  quotaFinal: {
    CA: "Quota Final",
    ES: "Cuota Final",
    FR: "Quote-part Finale",
    EN: "Final Quota",
  },
  resultatDeclaracio: {
    CA: "RESULTAT DE LA DECLARACIÓ",
    ES: "RESULTADO DE LA DECLARACIÓN",
    FR: "RÉSULTAT DE LA DÉCLARATION",
    EN: "DECLARATION RESULT",
  },
  aIngressar: {
    CA: "A INGRESSAR",
    ES: "A INGRESAR",
    FR: "À PAYER",
    EN: "TO PAY",
  },
  aRetornar: {
    CA: "A RETORNAR",
    ES: "A DEVOLVER",
    FR: "À REMBOURSER",
    EN: "TO REFUND",
  },
  quotaZero: {
    CA: "QUOTA ZERO",
    ES: "CUOTA CERO",
    FR: "QUOTE-PART ZÉRO",
    EN: "ZERO QUOTA",
  },
  tipusEfectiu: {
    CA: "Tipus efectiu de tributació",
    ES: "Tipo efectivo de tributación",
    FR: "Taux effectif d'imposition",
    EN: "Effective tax rate",
  },
  retencions: {
    CA: "Retencions practicades",
    ES: "Retenciones practicadas",
    FR: "Retenues pratiquées",
    EN: "Withholdings applied",
  },

  // ── PÀGINA 2 — DETALL DE RENDES ──────────────────────────────────────────
  detallRendes: {
    CA: "Detall de Rendes i Càlcul de la Base de Tributació",
    ES: "Detalle de Rentas y Cálculo de la Base de Tributación",
    FR: "Détail des Revenus et Calcul de la Base d'Imposition",
    EN: "Income Detail and Tax Base Calculation",
  },
  rendesTreball: {
    CA: "Rendes del treball — Formulari 300-B sec.1",
    ES: "Rendimientos del trabajo — Formulario 300-B sec.1",
    FR: "Revenus du travail — Formulaire 300-B sec.1",
    EN: "Employment income — Form 300-B sec.1",
  },
  activitatsEconomiques: {
    CA: "Rendes d'activitats econòmiques — Formulari 300-C",
    ES: "Rendimientos de actividades económicas — Formulario 300-C",
    FR: "Revenus d'activités économiques — Formulaire 300-C",
    EN: "Business income — Form 300-C",
  },
  capitalImmobiliari: {
    CA: "Rendes del capital immobiliari — Formulari 300-B sec.2",
    ES: "Rendimientos del capital inmobiliario — Formulario 300-B sec.2",
    FR: "Revenus du capital immobilier — Formulaire 300-B sec.2",
    EN: "Real estate income — Form 300-B sec.2",
  },
  capitalMobiliari: {
    CA: "Rendes del capital mobiliari — Formulari 300-D",
    ES: "Rendimientos del capital mobiliario — Formulario 300-D",
    FR: "Revenus du capital mobilier — Formulaire 300-D",
    EN: "Investment income — Form 300-D",
  },
  guanysCapital: {
    CA: "Guanys i pèrdues de capital — Formulari 300-E",
    ES: "Ganancias y pérdidas de capital — Formulario 300-E",
    FR: "Gains et pertes en capital — Formulaire 300-E",
    EN: "Capital gains and losses — Form 300-E",
  },
  ddi: {
    CA: "Deducció per doble imposició (DDI) — Art. 48",
    ES: "Deducción por doble imposición (DDI) — Art. 48",
    FR: "Déduction pour double imposition (DDI) — Art. 48",
    EN: "Double taxation relief (DDI) — Art. 48",
  },

  // ── PÀGINA 3 — BASES I REDUCCIONS ────────────────────────────────────────
  basesReduccions: {
    CA: "Bases de Tributació i Reduccions",
    ES: "Bases de Tributación y Reducciones",
    FR: "Bases d'Imposition et Réductions",
    EN: "Tax Bases and Reductions",
  },
  minimPersonal: {
    CA: "Mínim personal exempt",
    ES: "Mínimo personal exento",
    FR: "Minimum personnel exonéré",
    EN: "Personal tax-free allowance",
  },
  reduccioFamiliar: {
    CA: "Reducció per càrregues familiars",
    ES: "Reducción por cargas familiares",
    FR: "Réduction pour charges familiales",
    EN: "Family allowance reduction",
  },
  reduccioHabitatge: {
    CA: "Reducció per habitatge habitual",
    ES: "Reducción por vivienda habitual",
    FR: "Réduction pour résidence principale",
    EN: "Primary residence reduction",
  },

  // ── PÀGINA 4 — LIQUIDACIÓ 300-L ──────────────────────────────────────────
  liquidacio: {
    CA: "Liquidació — Formulari 300-L",
    ES: "Liquidación — Formulario 300-L",
    FR: "Liquidation — Formulaire 300-L",
    EN: "Tax Settlement — Form 300-L",
  },
  formularisPresentar: {
    CA: "Formularis a presentar",
    ES: "Formularios a presentar",
    FR: "Formulaires à présenter",
    EN: "Forms to submit",
  },
  terminiPresentacio: {
    CA: "Termini de presentació",
    ES: "Plazo de presentación",
    FR: "Délai de présentation",
    EN: "Filing deadline",
  },

  // ── ÚLTIMA PÀGINA — DISCLAIMER ───────────────────────────────────────────
  informacioLegal: {
    CA: "Informació legal i avisos importants",
    ES: "Información legal y avisos importantes",
    FR: "Informations légales et avis importants",
    EN: "Legal information and important notices",
  },
  avisImportant: {
    CA: "AVÍS IMPORTANT",
    ES: "AVISO IMPORTANTE",
    FR: "AVIS IMPORTANT",
    EN: "IMPORTANT NOTICE",
  },
  responsabilitat: {
    CA: "Responsabilitat i limitació de responsabilitat",
    ES: "Responsabilidad y limitación de responsabilidad",
    FR: "Responsabilité et limitation de responsabilité",
    EN: "Liability and limitation of liability",
  },
  naturalesa: {
    CA: "Naturalesa de l'informe",
    ES: "Naturaleza del informe",
    FR: "Nature du rapport",
    EN: "Nature of the report",
  },
  proteccioDades: {
    CA: "Protecció de dades personals (Llei 29/2021)",
    ES: "Protección de datos personales (Ley 29/2021)",
    FR: "Protection des données personnelles (Loi 29/2021)",
    EN: "Personal data protection (Law 29/2021)",
  },
  confidencialitat: {
    CA: "Confidencialitat",
    ES: "Confidencialidad",
    FR: "Confidentialité",
    EN: "Confidentiality",
  },
  normativaReferencia: {
    CA: "Normativa de referència",
    ES: "Normativa de referencia",
    FR: "Réglementation de référence",
    EN: "Reference regulations",
  },

  // ── COMUNS ────────────────────────────────────────────────────────────────
  pagina: {
    CA: "Pàgina",
    ES: "Página",
    FR: "Page",
    EN: "Page",
  },
  de: {
    CA: "de",
    ES: "de",
    FR: "de",
    EN: "of",
  },
  client: {
    CA: "Client",
    ES: "Cliente",
    FR: "Client",
    EN: "Client",
  },
  nrt: {
    CA: "NRT",
    ES: "NRT",
    FR: "NRT",
    EN: "NRT",
  },
  exempt: {
    CA: "EXEMPT",
    ES: "EXENTO",
    FR: "EXONÉRÉ",
    EN: "EXEMPT",
  },
  gravat: {
    CA: "GRAVAT",
    ES: "GRAVADO",
    FR: "IMPOSABLE",
    EN: "TAXABLE",
  },
  total: {
    CA: "TOTAL",
    ES: "TOTAL",
    FR: "TOTAL",
    EN: "TOTAL",
  },
  noAplica: {
    CA: "No aplica",
    ES: "No aplica",
    FR: "Non applicable",
    EN: "Not applicable",
  },
};

// Helper per obtenir un text en un idioma
export const t = (key, lang = 'CA') => {
  if (!T[key]) {
    console.warn(`pdfTranslations: clau '${key}' no trobada`);
    return key;
  }
  return T[key][lang] || T[key]['CA'];
};
