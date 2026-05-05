// steps/Step5Mobiliari.jsx — Pas 5: Capital mobiliari (300-D)
import React from 'react';
import RentaBlock from '../components/RentaBlock';
import AnalysisAlert from '../components/AnalysisAlert';
import { analizarRCM } from '../engine/exemptions';

const TIPUS_MOBILIARI = [
  { value: 'DIVIDENDS', label: 'Dividends i participació en beneficis' },
  { value: 'DIVIDENDS_OIC', label: "Dividends d'OIC (Fons d'inversió)" },
  { value: 'INTERESSOS', label: 'Interessos (dipòsits, obligacions...)' },
  { value: 'CANONS', label: 'Cànons i drets de propietat intel·lectual' },
  { value: 'ASSEGURANCA_VIDA_HIPOTECA', label: "Assegurança vida (cobertura hipoteca)" },
  { value: 'ALTRES_MOBILIARI', label: 'Altres rendiments del capital mobiliari' },
];

const DEFAULT_MOBILIARI = {
  id: null,
  descripcio: '',
  apartat: 'DIVIDENDS',
  importNet: 0,
  participacioPct: 0,
  anysParticipacio: 0,
  retencions: 0,
};

const InputNum = ({ label, value, onChange, min = 0, step = 'any' }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number"
      min={min}
      step={step}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
  </div>
);

const MobiliariForm = ({ mob, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(mob.id, camp, valor);

  const analisi = analizarRCM({
    apartat: mob.apartat,
    importNet: mob.importNet,
    participacioPct: mob.participacioPct,
    anysParticipacio: mob.anysParticipacio,
  });

  return (
    <RentaBlock
      titol={mob.descripcio || `Capital mobiliari ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripció</label>
          <input
            type="text"
            value={mob.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Dividends Empresa XY, Interessos Banc Z..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus de renda</label>
          <select
            value={mob.apartat}
            onChange={e => update('apartat', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            {TIPUS_MOBILIARI.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <InputNum label="Import net (€)" value={mob.importNet} onChange={v => update('importNet', v)} />
        <InputNum label="Retencions practicades (€)" value={mob.retencions} onChange={v => update('retencions', v)} />

        {mob.apartat === 'DIVIDENDS_OIC' && (
          <>
            <InputNum
              label="Participació en l'OIC (%)"
              value={mob.participacioPct}
              onChange={v => update('participacioPct', v)}
              min={0}
              step={0.01}
            />
            <InputNum
              label="Anys de participació"
              value={mob.anysParticipacio}
              onChange={v => update('anysParticipacio', v)}
            />
          </>
        )}
      </div>

      <AnalysisAlert analisi={analisi} />
    </RentaBlock>
  );
};

const Step5Mobiliari = ({ dades, update }) => {
  const addMobiliari = () => {
    update('mobiliaris', [
      ...dades.mobiliaris,
      { ...DEFAULT_MOBILIARI, id: Date.now() }
    ]);
  };

  const updateMobiliari = (id, camp, valor) => {
    update('mobiliaris', dades.mobiliaris.map(m => m.id === id ? { ...m, [camp]: valor } : m));
  };

  const removeMobiliari = (id) => {
    update('mobiliaris', dades.mobiliaris.filter(m => m.id !== id));
  };

  const totalNet = dades.mobiliaris.reduce((acc, m) => {
    const analisi = analizarRCM({ apartat: m.apartat, importNet: m.importNet, participacioPct: m.participacioPct, anysParticipacio: m.anysParticipacio });
    return acc + (analisi.exempt ? 0 : m.importNet || 0);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">5</span>
            <div>
              <h2 className="font-bold text-gray-800">Capital mobiliari</h2>
              <p className="text-xs text-gray-500">Formulari 300-D · Art. 23-29 Llei 5/2014</p>
            </div>
          </div>
          <button
            onClick={addMobiliari}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir renda
          </button>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-4">
          <strong>Art. 37 Llei 5/2014:</strong> S'aplica un mínim exempt de <strong>3.000 €</strong> sobre el total de rendes de l'estalvi (capital mobiliari + guanys capital). L'excés tributa al 10%.
        </div>

        {dades.mobiliaris.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap renda de capital mobiliari afegida.</p>
            <p className="text-xs mt-1">Incloeu dividends, interessos, cànons, etc.</p>
          </div>
        )}

        {dades.mobiliaris.length > 0 && (
          <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
            <span className="font-semibold text-[#009B9C]">Total capital mobiliari gravat: </span>
            <span className="font-bold text-gray-800">
              {totalNet.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
            </span>
          </div>
        )}
      </div>

      {dades.mobiliaris.map((mob, i) => (
        <MobiliariForm
          key={mob.id}
          mob={mob}
          index={i}
          onUpdate={updateMobiliari}
          onEliminar={() => removeMobiliari(mob.id)}
        />
      ))}
    </div>
  );
};

export default Step5Mobiliari;
