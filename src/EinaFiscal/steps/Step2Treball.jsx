// steps/Step2Treball.jsx — Pas 2: Rendes del treball (300-B sec.1)
import React from 'react';
import AnalysisAlert from '../components/AnalysisAlert';
import RentaBlock from '../components/RentaBlock';
import { analizarRendaTreball } from '../engine/exemptions';
import { IRPF_EF } from '../engine/constants';

const TIPUS_TREBALL = [
  { value: 'SALARI_GENERAL', label: 'Salari / nòmina general' },
  { value: 'ADMINISTRADOR', label: "Retribució d'administrador" },
  { value: 'PENSIO_CASS', label: 'Pensió CASS (jubilació, IP, mort/supervivència)' },
  { value: 'INDEMNITZACIO_ACOMIADAMENT', label: 'Indemnització per acomiadament' },
  { value: 'DIETES', label: 'Dietes i despeses de viatge' },
  { value: 'BECA', label: "Beca a l'estudi o ajut de recerca" },
  { value: 'PREMI', label: 'Premi literari, artístic o científic' },
  { value: 'ALTRES_TREBALL', label: 'Altres rendes del treball' },
];

const DEFAULT_FONT_TREBALL = {
  id: null,
  descripcio: '',
  tipus: 'SALARI_GENERAL',
  mode: 'brut',
  importBrut: 0,
  cotitzacionsCASS: 0,
  importNet: 0,
  esPensionista: false,
  anysCotitzats: 0,
  retencions: 0,
  limitLegal: 0,
  limitDietes: 0,
  participacioPct: 0,
  anysParticipacio: 0,
};

const InputNum = ({ label, value, onChange, min = 0, className = '' }) => (
  <div className={className}>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number"
      min={min}
      step="0.01"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={e => { const v = e.target.value; onChange(v === '' ? 0 : parseFloat(v) || 0); }}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
  </div>
);

const FontTreball = ({ font, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(font.id, camp, valor);

  const analisi = analizarRendaTreball({
    tipus: font.tipus,
    importBrut: font.importBrut,
    detalls: { limitLegal: font.limitLegal, limitReglamentari: font.limitDietes }
  });

  // Càlcul renda neta estimada
  const calcularNetaEstimada = () => {
    if (font.tipus === 'PENSIO_CASS') return 0; // exempta
    if (font.tipus === 'BECA' || font.tipus === 'PREMI') return 0;
    let gravat = font.importBrut;
    if (font.tipus === 'INDEMNITZACIO_ACOMIADAMENT') gravat = Math.max(0, font.importBrut - font.limitLegal);
    if (font.tipus === 'DIETES') gravat = Math.max(0, font.importBrut - font.limitDietes);
    const cass = font.cotitzacionsCASS || 0;
    const altres = Math.min(gravat * IRPF_EF.ALTRES_DESPESES_TREBALL_PCT, IRPF_EF.ALTRES_DESPESES_TREBALL_MAX);
    return Math.max(0, gravat - cass - altres);
  };

  return (
    <RentaBlock
      titol={font.descripcio || `Font ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripció (empresa / entitat)</label>
          <input
            type="text"
            value={font.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Empresa ABC SL, Pensió CASS..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus de renda</label>
          <select
            value={font.tipus}
            onChange={e => update('tipus', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            {TIPUS_TREBALL.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <InputNum
          label="Import brut (€)"
          value={font.importBrut}
          onChange={v => update('importBrut', v)}
        />
        <InputNum
          label="Cotitzacions CASS treballador (€)"
          value={font.cotitzacionsCASS}
          onChange={v => update('cotitzacionsCASS', v)}
        />

        {font.tipus === 'INDEMNITZACIO_ACOMIADAMENT' && (
          <InputNum
            label="Limit legal exempt (€) — Art. 5.f"
            value={font.limitLegal}
            onChange={v => update('limitLegal', v)}
            className="col-span-2"
          />
        )}
        {font.tipus === 'DIETES' && (
          <InputNum
            label="Límit reglamentari exempt (€) — Art. 5.e"
            value={font.limitDietes}
            onChange={v => update('limitDietes', v)}
            className="col-span-2"
          />
        )}

        <InputNum
          label="Retencions practicades (€)"
          value={font.retencions}
          onChange={v => update('retencions', v)}
        />

        <div className="flex items-center gap-2 pt-5">
          <input
            type="checkbox"
            checked={font.esPensionista}
            onChange={e => update('esPensionista', e.target.checked)}
            className="w-4 h-4 accent-[#009B9C]"
          />
          <span className="text-xs text-gray-600">Pensionista CASS</span>
        </div>

        {font.esPensionista && (
          <InputNum
            label="Anys cotitzats a la CASS"
            value={font.anysCotitzats}
            onChange={v => update('anysCotitzats', v)}
            className="col-span-2"
          />
        )}
      </div>

      {/* Càlcul reducció pensionista */}
      {font.esPensionista && font.anysCotitzats > 0 && font.tipus !== 'PENSIO_CASS' && (
        <div className="bg-blue-50 rounded-lg p-3 text-sm mt-3">
          <p className="font-medium text-blue-800">Reducció per pensionista CASS:</p>
          <p className="text-blue-600 text-xs">
            {font.anysCotitzats} anys × 1% = {Math.min(font.anysCotitzats, 30)}%
            {' '}→ Reducció: {(calcularNetaEstimada() * Math.min(font.anysCotitzats * 0.01, 0.30)).toFixed(2)} €
          </p>
          <p className="text-blue-500 text-xs">Font: Guia IRPF 2025 §6.2</p>
        </div>
      )}

      {/* Estimació renda neta */}
      {font.tipus !== 'PENSIO_CASS' && font.tipus !== 'BECA' && font.tipus !== 'PREMI' && (
        <div className="bg-gray-50 rounded-lg p-3 text-xs mt-3">
          <span className="font-medium text-gray-600">Renda neta estimada: </span>
          <span className="font-bold text-gray-800">{calcularNetaEstimada().toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</span>
          <span className="text-gray-400 ml-2">(brut gravat − CASS − 3% altres despeses)</span>
        </div>
      )}

      <AnalysisAlert analisi={analisi} />
    </RentaBlock>
  );
};

const Step2Treball = ({ dades, update }) => {
  const addFont = () => {
    update('rendesTreball', [
      ...dades.rendesTreball,
      { ...DEFAULT_FONT_TREBALL, id: Date.now() }
    ]);
  };

  const updateFont = (id, camp, valor) => {
    update('rendesTreball', dades.rendesTreball.map(f => f.id === id ? { ...f, [camp]: valor } : f));
  };

  const removeFont = (id) => {
    update('rendesTreball', dades.rendesTreball.filter(f => f.id !== id));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">2</span>
            <div>
              <h2 className="font-bold text-gray-800">Rendes del treball</h2>
              <p className="text-xs text-gray-500">Formulari 300-B sec.1 · Art. 10-13 Llei 5/2014</p>
            </div>
          </div>
          <button
            onClick={addFont}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir font de renda
          </button>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-4">
          <strong>Despeses deduïbles:</strong> Cotitzacions CASS a càrrec del treballador + 3% d'altres despeses (màx. 2.500 €). Font: Art. 13 Llei 5/2014 + Guia IRPF 2025 §6.2.
        </div>

        {dades.rendesTreball.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap renda del treball afegida.</p>
            <p className="text-xs mt-1">Feu clic a "+ Afegir font de renda" per afegir salaris, pensions, indemnitzacions, etc.</p>
          </div>
        )}
      </div>

      {dades.rendesTreball.map((font, i) => (
        <FontTreball
          key={font.id}
          font={font}
          index={i}
          onUpdate={updateFont}
          onEliminar={() => removeFont(font.id)}
        />
      ))}
    </div>
  );
};

export default Step2Treball;
