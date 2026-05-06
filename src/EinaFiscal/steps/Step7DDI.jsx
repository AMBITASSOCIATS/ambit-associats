// steps/Step7DDI.jsx — Pas 7: Deduccio per doble imposicio internacional (Art. 48)
import React from 'react';
import RentaBlock from '../components/RentaBlock';
import AnalysisAlert from '../components/AnalysisAlert';
import { PAISOS } from '../engine/cdiRates';
import { calcularDDI } from '../engine/exemptions';

const DEFAULT_RENDA_EXT = {
  id: null,
  descripcio: '',
  pais: 'ES',
  tipusRenda: 'DIVIDENDS',
  importBrut: 0,
  retencioOrigen: 0,
  importNet: 0,
};

const TIPUS_RENDA_EXT = [
  { value: 'DIVIDENDS', label: 'Dividends' },
  { value: 'INTERESSOS', label: 'Interessos' },
  { value: 'CANONS', label: 'Canons' },
  { value: 'SALARIS', label: 'Salaris / rendes del treball' },
  { value: 'PENSIONS', label: 'Pensions' },
  { value: 'IMMOBLES', label: 'Rendiments immobles estrangers' },
  { value: 'PLUSVALUES', label: 'Plusvalues' },
  { value: 'ALTRES', label: 'Altres rendes exteriors' },
];

const InputNum = ({ label, value, onChange, min = 0 }) => (
  <div>
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

const RendaExtForm = ({ renda, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(renda.id, { ...renda, [camp]: valor });

  const ddiResult = calcularDDI([renda]);
  const ddiInfo = ddiResult[0];

  const analisi = ddiInfo ? {
    titol: `DDI — ${PAISOS.find(p => p.codi === renda.pais)?.nom || renda.pais}`,
    explicacio: ddiInfo.explicacio,
    ref: ddiInfo.ref,
    formulari: '300-G',
    casella: 'DDI',
    alertType: ddiInfo.teCDI ? 'success' : 'info',
    parcial: false,
  } : null;

  return (
    <RentaBlock
      titol={renda.descripcio || `Renda exterior ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripcio</label>
          <input
            type="text"
            value={renda.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Dividends Empresa Espanyola, Interessos Banc Frances..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Pais d'origen</label>
          <select
            value={renda.pais}
            onChange={e => update('pais', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            {PAISOS.map(p => (
              <option key={p.codi} value={p.codi}>
                {p.nom}{p.cdi ? ' (CDI)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus de renda</label>
          <select
            value={renda.tipusRenda}
            onChange={e => update('tipusRenda', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            {TIPUS_RENDA_EXT.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <InputNum
          label="Import brut (euros)"
          value={renda.importBrut}
          onChange={v => onUpdate(renda.id, { ...renda, importBrut: v, importNet: v - renda.retencioOrigen })}
        />
        <InputNum
          label="Retencio practicada al pais d'origen (euros)"
          value={renda.retencioOrigen}
          onChange={v => onUpdate(renda.id, { ...renda, retencioOrigen: v, importNet: renda.importBrut - v })}
        />
      </div>

      {ddiInfo && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="text-gray-500">Quota andorrana:</span>
              <p className="font-bold text-gray-800">{ddiInfo.quotaAndorra.toFixed(2)} euros</p>
            </div>
            <div>
              <span className="text-gray-500">Retencio origen:</span>
              <p className="font-bold text-gray-800">{renda.retencioOrigen.toFixed(2)} euros</p>
            </div>
            <div>
              <span className="text-gray-500">DDI aplicable:</span>
              <p className="font-bold text-[#009B9C]">{ddiInfo.ddi.toFixed(2)} euros</p>
            </div>
          </div>
        </div>
      )}

      <AnalysisAlert analisi={analisi} />
    </RentaBlock>
  );
};

const Step7DDI = ({ dades, update }) => {
  const addRenda = () => {
    update('rendesExterior', [
      ...dades.rendesExterior,
      { ...DEFAULT_RENDA_EXT, id: Date.now() }
    ]);
  };

  const updateRenda = (id, rendaActualitzada) => {
    update('rendesExterior', dades.rendesExterior.map(r => r.id === id ? rendaActualitzada : r));
  };

  const removeRenda = (id) => {
    update('rendesExterior', dades.rendesExterior.filter(r => r.id !== id));
  };

  // Detectar retencions a l'origen del pas 5 (capital mobiliari)
  const retencionsOrigenMobiliaris = (dades.mobiliaris || []).flatMap(entitat =>
    entitat.partides
      .filter(p => (p.retencioOrigen || 0) > 0)
      .map(p => ({
        descripcio: `${entitat.entitat || 'Entitat'} — partida ${p.tipus.toUpperCase()}`,
        retencioOrigen: p.retencioOrigen,
        importBrut: p.importBrut,
      }))
  );
  const totalRetOrigenMobiliaris = retencionsOrigenMobiliaris.reduce((a, r) => a + r.retencioOrigen, 0);

  const importarDesMobiliaris = () => {
    const noves = retencionsOrigenMobiliaris.map(r => ({
      ...DEFAULT_RENDA_EXT,
      id: Date.now() + Math.random(),
      descripcio: r.descripcio,
      importBrut: r.importBrut,
      retencioOrigen: r.retencioOrigen,
      importNet: r.importBrut - r.retencioOrigen,
      tipusRenda: 'DIVIDENDS',
      pais: 'ES',
    }));
    update('rendesExterior', [...dades.rendesExterior, ...noves]);
  };

  const ddiResults = calcularDDI(dades.rendesExterior);
  const totalDDI = ddiResults.reduce((acc, r) => acc + r.ddi, 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">7</span>
            <div>
              <h2 className="font-bold text-gray-800">Deduccio per doble imposicio (DDI)</h2>
              <p className="text-xs text-gray-500">Art. 48 Llei 5/2014 · Convenis de doble imposicio</p>
            </div>
          </div>
          <button
            onClick={addRenda}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir renda exterior
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
          <strong>Art. 48 Llei 5/2014:</strong> La DDI = minim entre (a) l'impost efectivament pagat a l'estranger i (b) la quota andorrana que correspondria a aquella renda. Si hi ha CDI, la retencio al pais d'origen es limita al tipus maxim convencional.
        </div>

        {/* Alerta: retencions del pas 5 pendents d'importar */}
        {totalRetOrigenMobiliaris > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-800 mb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold mb-1">
                  Retencions al pais d'origen detectades al Pas 5
                </p>
                <p className="text-xs text-blue-600">
                  S'han detectat {retencionsOrigenMobiliaris.length} partida(es) amb retencio al pais d'origen
                  (total: <strong>{totalRetOrigenMobiliaris.toFixed(2)} euros</strong>) al capital mobiliari.
                  Importeu-les aqui per declarar la DDI corresponent.
                </p>
                <ul className="mt-1 space-y-0.5">
                  {retencionsOrigenMobiliaris.map((r, i) => (
                    <li key={i} className="text-xs text-blue-700">
                      {r.descripcio}: <strong>{r.retencioOrigen.toFixed(2)} euros</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <button
                onClick={importarDesMobiliaris}
                className="flex-shrink-0 bg-blue-600 text-white text-xs font-semibold px-3 py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Importar
              </button>
            </div>
          </div>
        )}

        {dades.rendesExterior.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap renda exterior afegida.</p>
            <p className="text-xs mt-1">Afegiu les rendes obtingudes a l'estranger amb retencio al pais d'origen.</p>
          </div>
        )}

        {dades.rendesExterior.length > 0 && (
          <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
            <span className="font-semibold text-[#009B9C]">Total DDI deduible: </span>
            <span className="font-bold text-gray-800">
              {totalDDI.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros
            </span>
          </div>
        )}
      </div>

      {dades.rendesExterior.map((renda, i) => (
        <RendaExtForm
          key={renda.id}
          renda={renda}
          index={i}
          onUpdate={updateRenda}
          onEliminar={() => removeRenda(renda.id)}
        />
      ))}
    </div>
  );
};

export default Step7DDI;
