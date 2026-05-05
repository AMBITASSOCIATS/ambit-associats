// steps/Step4Immobiliari.jsx — Pas 4: Capital immobiliari (300-B sec.2)
import React from 'react';
import RentaBlock from '../components/RentaBlock';

const DEFAULT_IMMOBLE = {
  id: null,
  descripcio: '',
  tipusDeterminacio: 'directa', // 'directa' | 'forfetaria'
  esHabitatgeAssequible: false,
  ingressosIntegres: 0,
  // Despeses reals (si directa):
  despesaReparacio: 0,
  despesaFinancera: 0,
  amortitzacio: 0,
  tributs: 0,
  asseguranca: 0,
  comunitat: 0,
  impostComunal: 0,
  retencions: 0,
};

const calcularRendaNetaImmoble = (immoble) => {
  if (immoble.tipusDeterminacio === 'forfetaria') {
    const pct = immoble.esHabitatgeAssequible ? 0.50 : 0.40;
    const despeses = immoble.ingressosIntegres * pct;
    return { rendaNeta: immoble.ingressosIntegres - despeses, despeses, pct };
  } else {
    const despeses = (immoble.despesaReparacio || 0) + (immoble.despesaFinancera || 0) +
                     (immoble.amortitzacio || 0) + (immoble.tributs || 0) +
                     (immoble.asseguranca || 0) + (immoble.comunitat || 0);
    return { rendaNeta: immoble.ingressosIntegres - despeses, despeses, pct: null };
  }
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

const ImmobleForm = ({ immoble, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(immoble.id, camp, valor);
  const { rendaNeta, despeses, pct } = calcularRendaNetaImmoble(immoble);

  // Compara mètodes
  const netaForft = immoble.ingressosIntegres * (immoble.esHabitatgeAssequible ? 0.50 : 0.40);
  const rendaForft = immoble.ingressosIntegres - netaForft;
  const despesesReals = (immoble.despesaReparacio || 0) + (immoble.despesaFinancera || 0) +
                        (immoble.amortitzacio || 0) + (immoble.tributs || 0) +
                        (immoble.asseguranca || 0) + (immoble.comunitat || 0);
  const rendaDirecta = immoble.ingressosIntegres - despesesReals;
  const metodeRecomanat = rendaDirecta < rendaForft ? 'directa' : 'forfetaria';

  return (
    <RentaBlock
      titol={immoble.descripcio || `Immoble ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripció de l'immoble</label>
          <input
            type="text"
            value={immoble.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Pis carrer Major 5, Escaldes"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <InputNum
          label="Ingressos íntegres (€)"
          value={immoble.ingressosIntegres}
          onChange={v => update('ingressosIntegres', v)}
        />

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mètode de despeses</label>
          <select
            value={immoble.tipusDeterminacio}
            onChange={e => update('tipusDeterminacio', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="directa">Despeses reals (directa)</option>
            <option value="forfetaria">Forfetari (40% / 50%)</option>
          </select>
        </div>

        <div className="col-span-2 flex items-center gap-2">
          <input
            type="checkbox"
            checked={immoble.esHabitatgeAssequible}
            onChange={e => update('esHabitatgeAssequible', e.target.checked)}
            className="w-4 h-4 accent-[#009B9C]"
          />
          <span className="text-xs text-gray-600">
            Habitatge assequible (50% forfetari, +10%) — Art. 21 Llei 5/2014
          </span>
        </div>

        {immoble.esHabitatgeAssequible && (
          <div className="col-span-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
            <strong>S'aplica el percentatge del 50%</strong> (40% + 10% per habitatge assequible a preu de mercat assequible) — Art. 21 Llei 5/2014.
          </div>
        )}

        {immoble.tipusDeterminacio === 'directa' && (
          <>
            <InputNum label="Reparació i conservació (€)" value={immoble.despesaReparacio} onChange={v => update('despesaReparacio', v)} />
            <InputNum label="Interessos financers (€)" value={immoble.despesaFinancera} onChange={v => update('despesaFinancera', v)} />
            <InputNum label="Amortització (€)" value={immoble.amortitzacio} onChange={v => update('amortitzacio', v)} />
            <InputNum label="Tributs i taxes (IBI) (€)" value={immoble.tributs} onChange={v => update('tributs', v)} />
            <InputNum label="Assegurança (€)" value={immoble.asseguranca} onChange={v => update('asseguranca', v)} />
            <InputNum label="Comunitat de propietaris (€)" value={immoble.comunitat} onChange={v => update('comunitat', v)} />
          </>
        )}

        <InputNum
          label="Impost comunal arrendaments pagat (€) — Art. 47 (deduïble de la quota)"
          value={immoble.impostComunal}
          onChange={v => update('impostComunal', v)}
        />
        <InputNum
          label="Retencions practicades (€)"
          value={immoble.retencions}
          onChange={v => update('retencions', v)}
        />
      </div>

      {immoble.impostComunal > 0 && (
        <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
          <strong>ℹ️ Art. 47 Llei 5/2014:</strong> L'impost comunal sobre arrendaments ({immoble.impostComunal.toFixed(2)} €) <strong>no redueix la renda neta</strong> — es dedueix directament de la quota de tributació.
        </div>
      )}

      {immoble.ingressosIntegres > 0 && immoble.tipusDeterminacio === 'directa' && (
        <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          <strong>Comparativa mètodes:</strong>
          <div className="grid grid-cols-2 gap-2 mt-1">
            <span>Renda neta directa: <strong>{rendaDirecta.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</strong></span>
            <span>Renda neta forfetari ({immoble.esHabitatgeAssequible ? '50' : '40'}%): <strong>{rendaForft.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</strong></span>
          </div>
          <p className="mt-1">
            <strong>Mètode més favorable: {metodeRecomanat === 'directa' ? 'Despeses reals' : 'Forfetari'}</strong>
            {immoble.tipusDeterminacio !== metodeRecomanat && ' ⚠️ Considereu canviar el mètode'}
          </p>
        </div>
      )}

      <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
        <span className="font-medium text-gray-600">Renda neta: </span>
        <span className={`font-bold ${rendaNeta >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
          {rendaNeta.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
        </span>
        {pct !== null && (
          <span className="text-gray-400 ml-2">(despeses forfetàries: {(pct * 100).toFixed(0)}% = {despeses.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €)</span>
        )}
      </div>
    </RentaBlock>
  );
};

const Step4Immobiliari = ({ dades, update }) => {
  const addImmoble = () => {
    update('immobles', [
      ...dades.immobles,
      { ...DEFAULT_IMMOBLE, id: Date.now() }
    ]);
  };

  const updateImmoble = (id, camp, valor) => {
    update('immobles', dades.immobles.map(im => im.id === id ? { ...im, [camp]: valor } : im));
  };

  const removeImmoble = (id) => {
    update('immobles', dades.immobles.filter(im => im.id !== id));
  };

  const totalRenda = dades.immobles.reduce((acc, im) => acc + calcularRendaNetaImmoble(im).rendaNeta, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">4</span>
            <div>
              <h2 className="font-bold text-gray-800">Capital immobiliari</h2>
              <p className="text-xs text-gray-500">Formulari 300-B sec.2 · Art. 20-22 Llei 5/2014</p>
            </div>
          </div>
          <button
            onClick={addImmoble}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir immoble
          </button>
        </div>

        {dades.immobles.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap immoble afegit.</p>
            <p className="text-xs mt-1">Afegiu els immobles arrendats per l'obligat tributari.</p>
          </div>
        )}

        {dades.immobles.length > 0 && (
          <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
            <span className="font-semibold text-[#009B9C]">Total renda neta immobiliària: </span>
            <span className={`font-bold ${totalRenda >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
              {totalRenda.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
            </span>
          </div>
        )}
      </div>

      {dades.immobles.map((immoble, i) => (
        <ImmobleForm
          key={immoble.id}
          immoble={immoble}
          index={i}
          onUpdate={updateImmoble}
          onEliminar={() => removeImmoble(immoble.id)}
        />
      ))}
    </div>
  );
};

export default Step4Immobiliari;
