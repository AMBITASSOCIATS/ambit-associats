// engine/liquidacioEngine.js — Motor de liquidació ampliat
// Importa i re-exporta la funció base d'IrpfEngine.js per a compatibilitat,
// i afegeix helpers específics per a l'Eina Fiscal.

import { calcularIRPF, IRPF } from '../../irpf/IrpfEngine.js';
import { calcularIRPFDetallat } from './analysisEngine.js';

export { calcularIRPF, IRPF };
export { calcularIRPFDetallat };

// Genera el resum de caselles del formulari 300-L a partir del resultat detallat
export function generarCaselles300L(resultat) {
  if (!resultat) return [];
  const r = resultat;
  return [
    { casella: '(1)', descripcio: 'Renda neta del treball', valor: r.rendaTreball },
    { casella: '(2)', descripcio: 'Renda neta capital immobiliari', valor: r.rendaImmobiliaria },
    { casella: '(3)', descripcio: 'Renda neta activitats econòmiques', valor: r.rendaActivitat },
    { casella: 'BTG', descripcio: 'Base de tributació general', valor: r.baseTributacioGeneral, destacat: true },
    { casella: 'MP', descripcio: 'Mínim personal exempt', valor: -r.minimPersonal },
    { casella: '(5)', descripcio: 'Reducció càrregues familiars', valor: -r.redFamiliar },
    { casella: '(6)', descripcio: 'Reducció habitatge habitual', valor: -r.redHabitatge },
    { casella: '(7)', descripcio: 'Reducció plans de pensions', valor: -r.redPensions },
    { casella: 'BLG', descripcio: 'Base de liquidació general', valor: r.baseLiquidacioGeneral, destacat: true },
    { casella: '(9)', descripcio: 'Renda neta capital mobiliari', valor: r.rendaMobiliaria },
    { casella: '(10)', descripcio: 'Guanys i pèrdues de capital', valor: r.guanysCapital },
    { casella: 'BTE', descripcio: "Base de tributació de l'estalvi", valor: r.baseTributacioEstalvi, destacat: true },
    { casella: 'ME', descripcio: 'Mínim exempt estalvi (3.000 €)', valor: -Math.min(3000, Math.max(0, r.baseTributacioEstalvi)) },
    { casella: 'BLE', descripcio: "Base de liquidació de l'estalvi", valor: r.baseLiquidacioEstalvi, destacat: true },
    { casella: '(12)', descripcio: 'Quota de tributació (10%)', valor: r.quotaTributacio },
    { casella: '(13)', descripcio: 'Bonificació Art. 46', valor: -r.bonificacio },
    { casella: 'QL', descripcio: 'Quota de liquidació', valor: r.quotaLiquidacio, destacat: true },
    { casella: 'Ded.ex.', descripcio: 'Deduccions generades en l\'exercici que s\'apliquen', valor: -r.totalDeduccionsExercici },
    { casella: '(12)', descripcio: 'Deduccions pendents d\'exercicis anteriors (300-F)', valor: -r.deduccionsAnteriorsAplicades },
    { casella: '(14)', descripcio: 'Retencions i ingressos a compte', valor: -r.retencions },
    { casella: '(15)', descripcio: 'Resultat de la declaració', valor: r.resultatDeclaracio, destacat: true },
  ];
}
