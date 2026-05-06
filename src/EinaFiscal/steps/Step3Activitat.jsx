// steps/Step3Activitat.jsx — Pas 3: Activitats econòmiques (300-C)
import React from 'react';
import RentaBlock from '../components/RentaBlock';

const DEFAULT_ACTIVITAT = {
  id: null,
  descripcio: '',
  tipusDeterminacio: 'directa', // 'directa' | 'estimacioObjectiva'
  ingressos: 0,
  despeses: 0,
  rendaNeta: 0,
  epigrafIAE: '',
  retencions: 0,
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

const ActivitatForm = ({ activitat, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(activitat.id, camp, valor);

  const rendaCalculada = activitat.tipusDeterminacio === 'directa'
    ? activitat.ingressos - activitat.despeses
    : activitat.rendaNeta;

  // Sync rendaNeta si mode directa
  const handleIngressos = (v) => {
    onUpdate(activitat.id, 'ingressos', v);
    if (activitat.tipusDeterminacio === 'directa') {
      onUpdate(activitat.id, 'rendaNeta', v - activitat.despeses);
    }
  };
  const handleDespeses = (v) => {
    onUpdate(activitat.id, 'despeses', v);
    if (activitat.tipusDeterminacio === 'directa') {
      onUpdate(activitat.id, 'rendaNeta', activitat.ingressos - v);
    }
  };

  return (
    <RentaBlock
      titol={activitat.descripcio || `Activitat ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripció de l'activitat</label>
          <input
            type="text"
            value={activitat.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Consultoria, Comerç, Serveis professionals..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Epígraf IAE</label>
          <input
            type="text"
            value={activitat.epigrafIAE}
            onChange={e => update('epigrafIAE', e.target.value)}
            placeholder="Ex: 833"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Mètode de determinació</label>
          <select
            value={activitat.tipusDeterminacio}
            onChange={e => update('tipusDeterminacio', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="directa">Estimació directa</option>
            <option value="estimacioObjectiva">Estimació objectiva</option>
          </select>
        </div>

        {activitat.tipusDeterminacio === 'directa' ? (
          <>
            <InputNum label="Ingressos íntegres (€)" value={activitat.ingressos} onChange={handleIngressos} />
            <InputNum label="Despeses deduïbles (€)" value={activitat.despeses} onChange={handleDespeses} />
          </>
        ) : (
          <div className="col-span-2">
            <InputNum
              label="Renda neta (mòduls) (€)"
              value={activitat.rendaNeta}
              onChange={v => update('rendaNeta', v)}
            />
          </div>
        )}

        <InputNum
          label="Retencions i ingressos a compte (€)"
          value={activitat.retencions}
          onChange={v => update('retencions', v)}
        />
      </div>

      <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
        <span className="font-medium text-gray-600">Renda neta activitat: </span>
        <span className={`font-bold ${rendaCalculada >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
          {rendaCalculada.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
        </span>
      </div>

      <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
        <strong>ℹ️ Art. 14-19 Llei 5/2014:</strong> Les rendes netes d'activitats econòmiques formen part de la Base de Tributació General. L'obligat tributari pot optar per l'estimació directa (ingressos − despeses reals) o l'estimació objectiva (mòduls).
      </div>
    </RentaBlock>
  );
};

const Step3Activitat = ({ dades, update }) => {
  const addActivitat = () => {
    update('activitats', [
      ...dades.activitats,
      { ...DEFAULT_ACTIVITAT, id: Date.now() }
    ]);
  };

  const updateActivitat = (id, camp, valor) => {
    // Recalculate rendaNeta if directa
    update('activitats', dades.activitats.map(a => {
      if (a.id !== id) return a;
      const updated = { ...a, [camp]: valor };
      if (updated.tipusDeterminacio === 'directa') {
        updated.rendaNeta = updated.ingressos - updated.despeses;
      }
      return updated;
    }));
  };

  const removeActivitat = (id) => {
    update('activitats', dades.activitats.filter(a => a.id !== id));
  };

  const totalRendaNeta = dades.activitats.reduce((acc, a) => acc + (a.rendaNeta || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">3</span>
            <div>
              <h2 className="font-bold text-gray-800">Activitats econòmiques</h2>
              <p className="text-xs text-gray-500">Formulari 300-C · Art. 14-19 Llei 5/2014</p>
            </div>
          </div>
          <button
            onClick={addActivitat}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir activitat
          </button>
        </div>

        {dades.activitats.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap activitat econòmica afegida.</p>
            <p className="text-xs mt-1">Incloeu aquí les rendes d'empresaris individuals, professionals liberals o arrendataris d'activitats.</p>
          </div>
        )}

        {dades.activitats.length > 0 && (
          <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
            <span className="font-semibold text-[#009B9C]">Total renda neta activitats: </span>
            <span className={`font-bold ${totalRendaNeta >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
              {totalRendaNeta.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
            </span>
          </div>
        )}
      </div>

      {dades.activitats.map((activitat, i) => (
        <ActivitatForm
          key={activitat.id}
          activitat={activitat}
          index={i}
          onUpdate={updateActivitat}
          onEliminar={() => removeActivitat(activitat.id)}
        />
      ))}
    </div>
  );
};

export default Step3Activitat;
