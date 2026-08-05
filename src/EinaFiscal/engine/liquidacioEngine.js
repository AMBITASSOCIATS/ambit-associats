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
  // descripcioKey: el text viu a pdfTranslations. Cada consumidor tradueix
  // (Step9 pantalla en CA; informe PDF en l'idioma seleccionat). Cap càlcul.
  return [
    { casella: '(1)', descripcioKey: 'caselleRendaNetaTreball', valor: r.rendaTreball },
    { casella: '(2)', descripcioKey: 'caselleRendaNetaImmobiliari', valor: r.rendaImmobiliaria },
    { casella: '(3)', descripcioKey: 'caselleRendaNetaActivitats', valor: r.rendaActivitat },
    { casella: 'BTG', descripcioKey: 'caselleBaseTributacioGeneral', valor: r.baseTributacioGeneral, destacat: true },
    { casella: 'MP', descripcioKey: 'caselleMinimPersonalExempt', valor: -r.minimPersonal },
    { casella: '(5)', descripcioKey: 'caselleReduccioCarreguesFamiliars', valor: -r.redFamiliar },
    { casella: '(6)', descripcioKey: 'caselleReduccioHabitatge', valor: -r.redHabitatge },
    { casella: '(7)', descripcioKey: 'caselleReduccioPensions', valor: -r.redPensions },
    { casella: 'BLG', descripcioKey: 'caselleBaseLiquidacioGeneral', valor: r.baseLiquidacioGeneral, destacat: true },
    { casella: '(9)', descripcioKey: 'caselleRendaNetaMobiliari', valor: r.rendaMobiliaria },
    { casella: '(10)', descripcioKey: 'caselleGuanysPerduesCapital', valor: r.guanysCapital },
    { casella: 'BTE', descripcioKey: 'caselleBaseTributacioEstalvi', valor: r.baseTributacioEstalvi, destacat: true },
    { casella: 'ME', descripcioKey: 'caselleMinimExemptEstalvi', valor: -Math.min(3000, Math.max(0, r.baseTributacioEstalvi)) },
    { casella: 'BLE', descripcioKey: 'caselleBaseLiquidacioEstalvi', valor: r.baseLiquidacioEstalvi, destacat: true },
    { casella: '(12)', descripcioKey: 'caselleQuotaTributacio', valor: r.quotaTributacio },
    { casella: '(13)', descripcioKey: 'caselleBonificacioArt46', valor: -r.bonificacio },
    { casella: 'QL', descripcioKey: 'caselleQuotaLiquidacio', valor: r.quotaLiquidacio, destacat: true },
    { casella: 'Ded.ex.', descripcioKey: 'caselleDeduccionsGeneradesAplicades', valor: -r.totalDeduccionsExercici },
    { casella: '(12)', descripcioKey: 'caselleDeduccionsPendentsAnteriors', valor: -r.deduccionsAnteriorsAplicades },
    { casella: '(14)', descripcioKey: 'caselleRetencionsIngressosCompte', valor: -r.retencions },
    { casella: '(16)', descripcioKey: 'casellePagamentFraccionat', valor: -(r.pagamentACompte || 0) },
    { casella: '(15)', descripcioKey: 'caselleResultatDeclaracio', valor: r.resultatDeclaracio, destacat: true },
  ];
}
