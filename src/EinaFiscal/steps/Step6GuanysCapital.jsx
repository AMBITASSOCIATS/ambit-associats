// steps/Step6GuanysCapital.jsx — Pas 6: Guanys i pèrdues de capital (300-E)
import React from 'react';
import RentaBlock from '../components/RentaBlock';
import AnalysisAlert from '../components/AnalysisAlert';
import { analizarGuanyCapital } from '../engine/exemptions';
import { IRPF_EF } from '../engine/constants';

const DEFAULT_TRANSMISSIO = {
  id: null,
  descripcio: '',
  tipusElement: 'IMMOBLE',
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
  if (t.tipusElement === 'IMMOBLE' && t.aplicarCoeficients) {
    const coef = IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT;
    valorAdqActualitzat = valorAdqActualitzat * coef;
  }
  const valorAdqTotal = valorAdqActualitzat + (t.despesesAdquisicio || 0);
  const valorTransTotal = (t.valorTransmissio || 0) - (t.despesesTransmissio || 0);
  const guanyNet = valorTransTotal - valorAdqTotal;
  const coefAplicat = t.tipusElement === 'IMMOBLE' && t.aplicarCoeficients
    ? (IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT) : 1;
  return { guanyNet, valorAdqActualitzat, coefAplicat, anysPropieta };
};

const InputNum = ({ label, value, onChange, min = 0 }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number"
      min={min}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
  </div>
);

const TransmissioForm = ({ trans, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(trans.id, camp, valor);
  const { guanyNet, valorAdqActualitzat, coefAplicat, anysPropieta } = calcularGuany(trans);

  const analisi = analizarGuanyCapital({
    tipusElement: trans.tipusElement,
    guanyNet,
    esHabitatgeHabitual: trans.esHabitatgeHabitual,
    anysPropieta: trans.anysPropieta || anysPropieta,
    participacioPct: trans.participacioPct,
    reinverteix: trans.reinverteix,
  });

  return (
    <RentaBlock
      titol={trans.descripcio || `Transmissió ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripció del bé transmès</label>
          <input
            type="text"
            value={trans.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Pis carrer X, Accions empresa Y, Participació fons Z..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus d'element</label>
          <select
            value={trans.tipusElement}
            onChange={e => update('tipusElement', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="IMMOBLE">Immoble</option>
            <option value="VALORS_OIC">Valors OIC (fons d'inversió)</option>
            <option value="VALORS_GENERALS">Valors generals (accions, obligacions)</option>
            <option value="ALTRES">Altres elements patrimonials</option>
          </select>
        </div>

        {trans.tipusElement === 'IMMOBLE' && (
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
                <span className="text-xs text-gray-600">Aplicar coeficients d'actualització (Art. 26.2)</span>
              </label>
            </div>
          </>
        )}

        {trans.tipusElement === 'VALORS_OIC' && (
          <>
            <InputNum label="Participació en l'OIC (%)" value={trans.participacioPct} onChange={v => update('participacioPct', v)} />
            <InputNum label="Anys de propietat" value={trans.anysPropieta} onChange={v => update('anysPropieta', v)} />
          </>
        )}

        <InputNum label="Valor de transmissió (€)" value={trans.valorTransmissio} onChange={v => update('valorTransmissio', v)} />
        <InputNum label="Valor d'adquisició (€)" value={trans.valorAdquisicio} onChange={v => update('valorAdquisicio', v)} />
        <InputNum label="Any d'adquisició" value={trans.anyAdquisicio} onChange={v => update('anyAdquisicio', v)} min={1900} />
        <InputNum label="Any de transmissió" value={trans.anyTransmissio} onChange={v => update('anyTransmissio', v)} min={1900} />
        <InputNum label="Despeses de transmissió (€)" value={trans.despesesTransmissio} onChange={v => update('despesesTransmissio', v)} />
        <InputNum label="Despeses d'adquisició (€)" value={trans.despesesAdquisicio} onChange={v => update('despesesAdquisicio', v)} />
        <InputNum
          label="Pagament a compte (5% transmissió immoble) — Art. 20 Reglament (€)"
          value={trans.retencionsPagamentCompte}
          onChange={v => update('retencionsPagamentCompte', v)}
        />
      </div>

      {trans.tipusElement === 'IMMOBLE' && trans.aplicarCoeficients && anysPropieta >= 0 && (
        <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          Coeficient d'actualització aplicat: <strong>{coefAplicat.toFixed(2)}</strong> (immoble en propietat durant <strong>{anysPropieta} anys</strong>).
          Valor d'adquisició actualitzat: <strong>{valorAdqActualitzat.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</strong>.
          Font: Art. 26.2 Llei 5/2014.
        </div>
      )}

      <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
        <span className="font-medium text-gray-600">Guany net calculat: </span>
        <span className={`font-bold ${guanyNet >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
          {guanyNet.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
        </span>
      </div>

      <AnalysisAlert analisi={analisi} />
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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">6</span>
            <div>
              <h2 className="font-bold text-gray-800">Guanys i pèrdues de capital</h2>
              <p className="text-xs text-gray-500">Formulari 300-E · Art. 30-32 Llei 5/2014</p>
            </div>
          </div>
          <button
            onClick={addTransmissio}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir transmissió
          </button>
        </div>

        <div className="mb-4">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Bases negatives d'estalvi d'exercicis anteriors a compensar (€)
          </label>
          <input
            type="number"
            min={0}
            value={dades.basesNegativesAnteriors}
            onChange={e => update('basesNegativesAnteriors', Number(e.target.value))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
          <p className="text-xs text-gray-400 mt-1">Art. 32 Llei 5/2014 — màxim 10 exercicis anteriors</p>
        </div>

        {dades.transmissions.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap transmissió afegida.</p>
            <p className="text-xs mt-1">Afegiu les transmissions d'immobles, accions, fons d'inversió, etc.</p>
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
