// steps/Step6GuanysCapital.jsx — Pas 6: Guanys i perdues de capital (300-E)
import React from 'react';
import RentaBlock from '../components/RentaBlock';
import AnalysisAlert from '../components/AnalysisAlert';
import { analizarGuanyCapital } from '../engine/exemptions';
import { IRPF_EF } from '../engine/constants';

// Codis oficials del formulari 300-E
const TIPUS_ELEMENT_300E = [
  { value: 'IMM', label: 'Bens immobles i drets reals (IMM)' },
  { value: 'OIC', label: 'Participacions en OIC (OIC)' },
  { value: 'COT', label: 'Participacio en fons propis cotitzats (COT)' },
  { value: 'NCT', label: 'Participacio en fons propis no cotitzats (NCT)' },
  { value: 'MOB', label: 'Bens mobles (MOB)' },
  { value: 'ALT', label: 'Altres elements patrimonials (ALT)' },
];

const DEFAULT_TRANSMISSIO = {
  id: null,
  descripcio: '',
  tipusElement: 'IMM',
  esHabitatgeHabitual: false,
  reinverteix: false,
  valorTransmissio: 0,
  valorAdquisicio: 0,
  anyAdquisicio: new Date().getFullYear(),
  anyTransmissio: new Date().getFullYear(),
  despesesTransmissio: 0,
  despesesAdquisicio: 0,
  aplicarCoeficients: true,
  participacioPct: 0,
  anysPropieta: 0,
  retencionsPagamentCompte: 0,
};

const calcularGuany = (t) => {
  const anysPropieta = (t.anyTransmissio || 0) - (t.anyAdquisicio || 0);
  let valorAdqActualitzat = t.valorAdquisicio || 0;
  if (t.tipusElement === 'IMM' && t.aplicarCoeficients) {
    const coef = IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT;
    valorAdqActualitzat = valorAdqActualitzat * coef;
  }
  const valorAdqTotal = valorAdqActualitzat + (t.despesesAdquisicio || 0);
  const valorTransTotal = (t.valorTransmissio || 0) - (t.despesesTransmissio || 0);
  const guanyNet = valorTransTotal - valorAdqTotal;
  const coefAplicat = t.tipusElement === 'IMM' && t.aplicarCoeficients
    ? (IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT) : 1;
  return { guanyNet, valorAdqActualitzat, coefAplicat, anysPropieta };
};

// Mapeig de codis 300-E als tipus del motor d'exempcions
const mapTipusElement = (codi300E) => {
  switch (codi300E) {
    case 'IMM': return 'IMMOBLE';
    case 'OIC': return 'VALORS_OIC';
    case 'COT':
    case 'NCT': return 'VALORS_GENERALS';
    case 'MOB':
    case 'ALT': return 'ALTRES';
    default: return 'ALTRES';
  }
};

const analisiValors = (tipusElement, guanyNet, participacioPct, anysPropieta) => {
  if (tipusElement === 'OIC') {
    return {
      titol: 'Participacions OIC — Art. 5.k Llei 5/2014',
      explicacio: guanyNet <= 0
        ? 'Perdua en transmissio d\'OIC. No computa a efectes de l\'exempció.'
        : 'Exempt si participacio < 25% O tinenca >= 10 anys (CT 04/03/2015). Verificar condicions.',
      ref: 'Art. 5.k Llei 5/2014 · CT 04/03/2015',
      formulari: '300-E',
      casella: 'OIC',
      alertType: (participacioPct < 25 || anysPropieta >= 10) ? 'success' : 'warning',
    };
  }
  if (tipusElement === 'COT') {
    return {
      titol: 'Valors cotitzats (COT) — Art. 32 Llei 5/2014',
      explicacio: guanyNet <= 0
        ? 'Perdua en transmissio de valors cotitzats. Analitzar si hi ha valors homogenis adquirits 2 mesos abans/despres (Art. 32 + Reglament).'
        : 'Guany gravat. Integrar a la base de l\'estalvi.',
      ref: 'Art. 32 Llei 5/2014 + Reglament',
      formulari: '300-E',
      casella: 'COT',
      alertType: guanyNet <= 0 ? 'warning' : 'info',
    };
  }
  if (tipusElement === 'NCT') {
    return {
      titol: 'Participacions no cotitzades (NCT)',
      explicacio: 'Gravat. Analitzar substancia i vinculacio societaria. Verificar si aplica algun tractament especific.',
      ref: 'Art. 30-32 Llei 5/2014',
      formulari: '300-E',
      casella: 'NCT',
      alertType: 'info',
    };
  }
  if (tipusElement === 'MOB') {
    return {
      titol: 'Bens mobles (MOB)',
      explicacio: 'Gravat. Import net = valor transmissio - valor adquisicio.',
      ref: 'Art. 30 Llei 5/2014',
      formulari: '300-E',
      casella: 'MOB',
      alertType: 'info',
    };
  }
  return null;
};

const InputNum = ({ label, value, onChange, min = 0 }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number"
      min={min}
      step="0.01"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
  </div>
);

const TransmissioForm = ({ trans, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(trans.id, camp, valor);
  const { guanyNet, valorAdqActualitzat, coefAplicat, anysPropieta } = calcularGuany(trans);

  const tipusMotor = mapTipusElement(trans.tipusElement);
  const analisi = (trans.tipusElement === 'IMM')
    ? analizarGuanyCapital({
        tipusElement: tipusMotor,
        guanyNet,
        esHabitatgeHabitual: trans.esHabitatgeHabitual,
        anysPropieta: trans.anysPropieta || anysPropieta,
        participacioPct: trans.participacioPct,
        reinverteix: trans.reinverteix,
      })
    : analisiValors(trans.tipusElement, guanyNet, trans.participacioPct, trans.anysPropieta || anysPropieta);

  return (
    <RentaBlock
      titol={trans.descripcio || `Transmissio ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripcio del be transmes</label>
          <input
            type="text"
            value={trans.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Pis carrer X, Accions empresa Y, Participacio fons Z..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus d'element (codi 300-E)</label>
          <select
            value={trans.tipusElement}
            onChange={e => update('tipusElement', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            {TIPUS_ELEMENT_300E.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {trans.tipusElement === 'IMM' && (
          <>
            <div className="col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={trans.esHabitatgeHabitual} onChange={e => update('esHabitatgeHabitual', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                <span className="text-xs text-gray-600">Habitatge habitual</span>
              </label>
              {trans.esHabitatgeHabitual && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={trans.reinverteix} onChange={e => update('reinverteix', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                  <span className="text-xs text-gray-600">Reinverteix en nou habitatge habitual (Art. 5.r)</span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={trans.aplicarCoeficients} onChange={e => update('aplicarCoeficients', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                <span className="text-xs text-gray-600">Aplicar coeficients d'actualitzacio (Art. 26.2)</span>
              </label>
            </div>
          </>
        )}

        {trans.tipusElement === 'OIC' && (
          <>
            <InputNum label="Participacio en l'OIC (%)" value={trans.participacioPct} onChange={v => update('participacioPct', v)} />
            <InputNum label="Anys de propietat" value={trans.anysPropieta} onChange={v => update('anysPropieta', v)} />
          </>
        )}

        {(trans.tipusElement === 'COT' || trans.tipusElement === 'NCT') && (
          <div className="col-span-2 mt-1 bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-800 mb-2">Analisi addicional per a valors</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Participacio en el capital (%)</label>
                <input
                  type="number" min="0" max="100" step="0.01"
                  value={trans.participacioPct === 0 ? '' : trans.participacioPct}
                  placeholder="0"
                  onChange={e => update('participacioPct', parseFloat(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Anys de tinenca</label>
                <input
                  type="number" min="0" step="1"
                  value={trans.anysPropieta === 0 ? '' : trans.anysPropieta}
                  placeholder="0"
                  onChange={e => update('anysPropieta', parseInt(e.target.value) || 0)}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                />
              </div>
            </div>
          </div>
        )}

        <InputNum label="Valor de transmissio (euros)" value={trans.valorTransmissio} onChange={v => update('valorTransmissio', v)} />
        <InputNum label="Valor d'adquisicio (euros)" value={trans.valorAdquisicio} onChange={v => update('valorAdquisicio', v)} />
        <InputNum label="Any d'adquisicio" value={trans.anyAdquisicio} onChange={v => update('anyAdquisicio', v)} min={1900} />
        <InputNum label="Any de transmissio" value={trans.anyTransmissio} onChange={v => update('anyTransmissio', v)} min={1900} />
        <InputNum label="Despeses de transmissio (euros)" value={trans.despesesTransmissio} onChange={v => update('despesesTransmissio', v)} />
        <InputNum label="Despeses d'adquisicio (euros)" value={trans.despesesAdquisicio} onChange={v => update('despesesAdquisicio', v)} />
        <InputNum
          label="Pagament a compte (5% transmissio immoble) — Art. 20 Reglament (euros)"
          value={trans.retencionsPagamentCompte}
          onChange={v => update('retencionsPagamentCompte', v)}
        />
      </div>

      {trans.tipusElement === 'IMM' && trans.aplicarCoeficients && anysPropieta >= 0 && (
        <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          Coeficient d'actualitzacio aplicat: <strong>{coefAplicat.toFixed(2)}</strong> (immoble en propietat durant <strong>{anysPropieta} anys</strong>).
          Valor d'adquisicio actualitzat: <strong>{valorAdqActualitzat.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</strong>.
          Font: Art. 26.2 Llei 5/2014.
        </div>
      )}

      <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
        <span className="font-medium text-gray-600">Guany net calculat: </span>
        <span className={`font-bold ${guanyNet >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
          {guanyNet.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros
        </span>
      </div>

      {analisi && <AnalysisAlert analisi={analisi} />}
    </RentaBlock>
  );
};

const Step6GuanysCapital = ({ dades, update }) => {
  const addTransmissio = () => {
    update('transmissions', [
      ...dades.transmissions,
      { ...DEFAULT_TRANSMISSIO, id: Date.now() }
    ]);
  };

  const updateTransmissio = (id, camp, valor) => {
    update('transmissions', dades.transmissions.map(t => t.id === id ? { ...t, [camp]: valor } : t));
  };

  const removeTransmissio = (id) => {
    update('transmissions', dades.transmissions.filter(t => t.id !== id));
  };

  const variacioSeccio1 = (dades.guanysNoTransmissio || 0) - (dades.perduessNoTransmissio || 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">6</span>
            <div>
              <h2 className="font-bold text-gray-800">Guanys i perdues de capital</h2>
              <p className="text-xs text-gray-500">Formulari 300-E · Art. 30-32 Llei 5/2014</p>
            </div>
          </div>
          <button
            onClick={addTransmissio}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir transmissio
          </button>
        </div>

        {/* Seccio 1 del 300-E: Guanys/perdues no derivats de transmissio */}
        <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700">
              Seccio 1 — Variacions patrimonials no derivades de transmissio (300-E sec.1)
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Guanys i perdues no generats per transmissio (premis, indemnitzacions, etc.)
            </p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Import dels guanys de capital generats (euros)
              </label>
              <input
                type="number" min="0" step="0.01"
                value={(dades.guanysNoTransmissio || 0) === 0 ? '' : dades.guanysNoTransmissio}
                placeholder="0"
                onChange={e => update('guanysNoTransmissio', parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Import de les perdues de capital generades (euros)
              </label>
              <input
                type="number" min="0" step="0.01"
                value={(dades.perduessNoTransmissio || 0) === 0 ? '' : dades.perduessNoTransmissio}
                placeholder="0"
                onChange={e => update('perduessNoTransmissio', parseFloat(e.target.value) || 0)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]"
              />
            </div>
            {((dades.guanysNoTransmissio || 0) > 0 || (dades.perduessNoTransmissio || 0) > 0) && (
              <div className="col-span-2 mt-1 bg-gray-50 rounded-lg p-3 text-sm">
                <span className="font-medium">Variacio patrimonial neta (seccio 1): </span>
                <span className={`font-mono ml-2 ${variacioSeccio1 >= 0 ? 'text-[#009B9C]' : 'text-red-600'}`}>
                  {variacioSeccio1.toFixed(2)} euros
                </span>
              </div>
            )}
          </div>
        </div>

        {dades.transmissions.length === 0 && (
          <div className="text-center py-4 text-gray-400">
            <p className="text-sm">Cap transmissio afegida.</p>
            <p className="text-xs mt-1">Afegiu les transmissions d'immobles, accions, fons d'inversio, etc.</p>
          </div>
        )}
      </div>

      {dades.transmissions.map((trans, i) => (
        <TransmissioForm
          key={trans.id}
          trans={trans}
          index={i}
          onUpdate={updateTransmissio}
          onEliminar={() => removeTransmissio(trans.id)}
        />
      ))}
    </div>
  );
};

export default Step6GuanysCapital;
