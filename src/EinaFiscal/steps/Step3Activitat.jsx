// steps/Step3Activitat.jsx — Pas 3: Activitats econòmiques (300-C)
// Redisseny complet fidel al formulari oficial 300-C del Govern d'Andorra
import React, { useState } from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const TIPUS_ACTIVITAT = [
  { value: 'empresarial', label: 'Empresarial' },
  { value: 'professional', label: 'Professional' },
  { value: 'administrador', label: 'Administrador' },
  { value: 'altres', label: 'Altres' },
];

// Percentatge fix de despeses per al mètode objectiu (art. 8.3 Guia IRPF 2025)
const PCT_OBJECTIU = [
  { value: 80, label: '80% — Activitat estrictament comercial (lliurament de béns sense transformació)' },
  { value: 40, label: '40% — Resta d\'activitats' },
  { value: 3,  label: '3% — Retribucions a administradors o membres d\'òrgans d\'administració' },
];

const DEFAULT_COLUMNA = {
  caea: '',
  // Ingressos (mètode directe)
  xifraNegocios: 0,
  ingressosFinancers: 0,
  altresIngressos: 0,
  // Despeses (mètode directe)
  consumMercaderies: 0,
  despesesPersonal: 0,
  amortitzacions: 0,
  arrendamentsCànons: 0,
  reparacionsConservacio: 0,
  subministraments: 0,
  tributsDeduibles: 0,
  serveisExteriors: 0,
  despesesFinanceres: 0,
  altresDespeses: 0,
  // Mètode objectiu
  ingressosComputables: 0,
  percentatgeDespeses: 40,
  // Resultat extraordinari (comú als dos mètodes)
  resultatExtraordinari: 0,
};

const DEFAULT_ACTIVITAT = {
  id: null,
  tipusActivitat: 'professional',
  tipusDeterminacio: 'directa', // 'directa' | 'objectiva'
  reduccioArrendament: 0,
  retencions: 0,
  opcioFraccionat: false,
  columnes: [{ ...DEFAULT_COLUMNA }], // fins a 3 columnes per CAEA
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

const fmt = (n) =>
  (n || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const totalIngressos = (col) =>
  (col.xifraNegocios || 0) + (col.ingressosFinancers || 0) + (col.altresIngressos || 0);

const totalDespeses = (col) =>
  (col.consumMercaderies || 0) +
  (col.despesesPersonal || 0) +
  (col.amortitzacions || 0) +
  (col.arrendamentsCànons || 0) +
  (col.reparacionsConservacio || 0) +
  (col.subministraments || 0) +
  (col.tributsDeduibles || 0) +
  (col.serveisExteriors || 0) +
  (col.despesesFinanceres || 0) +
  (col.altresDespeses || 0);

const rendaNetaColumna = (col, tipusDeterminacio) => {
  if (tipusDeterminacio === 'directa') {
    return totalIngressos(col) - totalDespeses(col) + (col.resultatExtraordinari || 0);
  } else {
    const despeses = (col.ingressosComputables || 0) * ((col.percentatgeDespeses || 40) / 100);
    return (col.ingressosComputables || 0) - despeses + (col.resultatExtraordinari || 0);
  }
};

const rendaNetaTotal = (activitat) =>
  activitat.columnes.reduce((acc, col) => acc + rendaNetaColumna(col, activitat.tipusDeterminacio), 0) -
  (activitat.reduccioArrendament || 0);

// ─────────────────────────────────────────────────────────────────────────────
// INPUT NUMÈRIC — patró correcte per evitar el bug de value=0
// ─────────────────────────────────────────────────────────────────────────────

const Num = ({ value, onChange, className = '' }) => (
  <input
    type="number"
    min={0}
    step="0.01"
    value={value === 0 ? '' : value}
    placeholder="0"
    onChange={(e) => {
      const v = e.target.value;
      onChange(v === '' ? 0 : parseFloat(v) || 0);
    }}
    className={`border border-gray-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#009B9C] w-full ${className}`}
  />
);

// ─────────────────────────────────────────────────────────────────────────────
// FILA DE LA TAULA (label + fins a 3 inputs)
// ─────────────────────────────────────────────────────────────────────────────

const Fila = ({ label, camp, columnes, onUpdateColumna, bold = false, readOnly = false, values = null }) => (
  <tr className={`border-b border-gray-100 ${bold ? 'bg-gray-50' : ''}`}>
    <td className={`py-1.5 px-3 text-xs ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'} w-1/2`}>
      {label}
    </td>
    {columnes.map((col, idx) => (
      <td key={idx} className="py-1 px-1 text-right">
        {readOnly ? (
          <span className={`text-xs font-semibold px-2 ${bold ? 'text-[#009B9C]' : 'text-gray-800'}`}>
            {fmt(values ? values[idx] : 0)} €
          </span>
        ) : (
          <Num
            value={col[camp] || 0}
            onChange={(v) => onUpdateColumna(idx, camp, v)}
          />
        )}
      </td>
    ))}
    {/* Omplir columnes buides si n'hi ha menys de 3 */}
    {[...Array(3 - columnes.length)].map((_, i) => (
      <td key={`empty-${i}`} className="py-1 px-1" />
    ))}
  </tr>
);

// ─────────────────────────────────────────────────────────────────────────────
// FORMULARI D'UNA ACTIVITAT
// ─────────────────────────────────────────────────────────────────────────────

const ActivitatForm = ({ activitat, index, onUpdateTot, onEliminar }) => {
  const [expandida, setExpandida] = useState(true);

  const updateCamp = (camp, valor) => {
    onUpdateTot(activitat.id, { ...activitat, [camp]: valor });
  };

  const updateColumna = (colIdx, camp, valor) => {
    const novesColumnes = activitat.columnes.map((col, i) =>
      i === colIdx ? { ...col, [camp]: valor } : col
    );
    onUpdateTot(activitat.id, { ...activitat, columnes: novesColumnes });
  };

  const afegirColumna = () => {
    if (activitat.columnes.length >= 3) return;
    onUpdateTot(activitat.id, {
      ...activitat,
      columnes: [...activitat.columnes, { ...DEFAULT_COLUMNA }],
    });
  };

  const eliminarColumna = (colIdx) => {
    if (activitat.columnes.length <= 1) return;
    onUpdateTot(activitat.id, {
      ...activitat,
      columnes: activitat.columnes.filter((_, i) => i !== colIdx),
    });
  };

  const cols = activitat.columnes;
  const rn = rendaNetaTotal(activitat);
  const isDirect = activitat.tipusDeterminacio === 'directa';

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Capçalera */}
      <div
        className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer"
        onClick={() => setExpandida(!expandida)}
      >
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-[#009B9C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
            {index + 1}
          </span>
          <div>
            <span className="font-semibold text-sm text-gray-800">
              Activitat {index + 1}
              {cols[0]?.caea ? ` — CAEA ${cols[0].caea}` : ''}
            </span>
            <span className="ml-3 text-xs text-gray-500">
              Renda neta: <span className={`font-bold ${rn >= 0 ? 'text-[#009B9C]' : 'text-red-600'}`}>{fmt(rn)} €</span>
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onEliminar(); }}
            className="text-red-400 hover:text-red-600 text-xs px-2 py-1 rounded hover:bg-red-50 transition"
          >
            Eliminar
          </button>
          <span className="text-gray-400 text-sm">{expandida ? '▲' : '▼'}</span>
        </div>
      </div>

      {expandida && (
        <div className="p-5 space-y-4">

          {/* Tipus d'activitat + mètode de determinació */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Tipus d'activitat
              </label>
              <div className="flex flex-wrap gap-2">
                {TIPUS_ACTIVITAT.map((t) => (
                  <label key={t.value} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name={`tipus-${activitat.id}`}
                      checked={activitat.tipusActivitat === t.value}
                      onChange={() => updateCamp('tipusActivitat', t.value)}
                      className="accent-[#009B9C]"
                    />
                    <span className="text-xs text-gray-700">{t.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Mètode de determinació
              </label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`metode-${activitat.id}`}
                    checked={activitat.tipusDeterminacio === 'directa'}
                    onChange={() => updateCamp('tipusDeterminacio', 'directa')}
                    className="accent-[#009B9C]"
                  />
                  <span className="text-xs text-gray-700">Determinació directa</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`metode-${activitat.id}`}
                    checked={activitat.tipusDeterminacio === 'objectiva'}
                    onChange={() => updateCamp('tipusDeterminacio', 'objectiva')}
                    className="accent-[#009B9C]"
                  />
                  <span className="text-xs text-gray-700">Determinació objectiva</span>
                </label>
              </div>
            </div>
          </div>

          {/* Capçalera de les columnes CAEA */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#009B9C]/10">
                  <th className="text-left py-2 px-3 text-xs font-semibold text-gray-700 w-1/2">
                    {isDirect ? '1. Determinació directa' : '2. Determinació objectiva'}
                  </th>
                  {cols.map((col, idx) => (
                    <th key={idx} className="py-1 px-2 text-center w-[17%]">
                      <div className="flex items-center justify-center gap-1">
                        <input
                          type="text"
                          value={col.caea}
                          onChange={(e) => updateColumna(idx, 'caea', e.target.value)}
                          placeholder="CAEA"
                          className="border border-gray-300 rounded px-2 py-1 text-xs text-center w-20 focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                        />
                        {cols.length > 1 && (
                          <button
                            onClick={() => eliminarColumna(idx)}
                            className="text-red-400 hover:text-red-600 text-xs"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </th>
                  ))}
                  {[...Array(3 - cols.length)].map((_, i) => (
                    <th key={`eh-${i}`} className="w-[17%]" />
                  ))}
                </tr>
              </thead>

              <tbody>
                {isDirect ? (
                  <>
                    {/* INGRESSOS */}
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="py-1.5 px-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Ingressos computables
                      </td>
                    </tr>
                    <Fila label="Import net de la xifra de negocis" camp="xifraNegocios" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Ingressos financers" camp="ingressosFinancers" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Altres ingressos computables" camp="altresIngressos" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila
                      label="Total d'ingressos computables"
                      bold
                      readOnly
                      values={cols.map(totalIngressos)}
                      columnes={cols}
                      onUpdateColumna={updateColumna}
                    />

                    {/* DESPESES */}
                    <tr className="bg-gray-50">
                      <td colSpan={4} className="py-1.5 px-3 text-xs font-semibold text-gray-700 uppercase tracking-wide">
                        Despeses fiscalment deduïbles
                      </td>
                    </tr>
                    <Fila label="Consum de mercaderies i altres materials" camp="consumMercaderies" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Despeses de personal" camp="despesesPersonal" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Amortitzacions, deteriorament i resultats per baixa d'immobilitzat" camp="amortitzacions" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Arrendaments i cànons" camp="arrendamentsCànons" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Reparacions i conservació" camp="reparacionsConservacio" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Subministraments" camp="subministraments" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Tributs fiscalment deduïbles" camp="tributsDeduibles" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Serveis exteriors" camp="serveisExteriors" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Despeses financeres" camp="despesesFinanceres" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila label="Altres despeses fiscalment deduïbles" camp="altresDespeses" columnes={cols} onUpdateColumna={updateColumna} />
                    <Fila
                      label="Total de despeses fiscalment deduïbles"
                      bold
                      readOnly
                      values={cols.map(totalDespeses)}
                      columnes={cols}
                      onUpdateColumna={updateColumna}
                    />
                  </>
                ) : (
                  <>
                    {/* MÈTODE OBJECTIU */}
                    <Fila label="Ingressos computables" camp="ingressosComputables" columnes={cols} onUpdateColumna={updateColumna} />
                    <tr className="border-b border-gray-100">
                      <td className="py-1.5 px-3 text-xs text-gray-600">Percentatge de despeses fiscalment deduïbles</td>
                      {cols.map((col, idx) => (
                        <td key={idx} className="py-1 px-1">
                          <select
                            value={col.percentatgeDespeses}
                            onChange={(e) => updateColumna(idx, 'percentatgeDespeses', parseInt(e.target.value))}
                            className="border border-gray-200 rounded px-1 py-1 text-xs w-full focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                          >
                            {PCT_OBJECTIU.map((p) => (
                              <option key={p.value} value={p.value}>{p.value}%</option>
                            ))}
                          </select>
                        </td>
                      ))}
                      {[...Array(3 - cols.length)].map((_, i) => <td key={i} />)}
                    </tr>
                    <Fila
                      label="Despeses fiscalment deduïbles"
                      bold
                      readOnly
                      values={cols.map(col => (col.ingressosComputables || 0) * ((col.percentatgeDespeses || 40) / 100))}
                      columnes={cols}
                      onUpdateColumna={updateColumna}
                    />
                    <Fila
                      label="Rendiment net per activitat"
                      bold
                      readOnly
                      values={cols.map(col => (col.ingressosComputables || 0) - (col.ingressosComputables || 0) * ((col.percentatgeDespeses || 40) / 100))}
                      columnes={cols}
                      onUpdateColumna={updateColumna}
                    />
                    {/* Total rendiment net objectiu */}
                    <tr className="bg-[#009B9C]/5">
                      <td className="py-1.5 px-3 text-xs font-semibold text-gray-700">Rendiment net d'activitats econòmiques</td>
                      <td colSpan={3} className="py-1.5 px-3 text-right text-xs font-bold text-[#009B9C]">
                        {fmt(cols.reduce((a, col) => a + (col.ingressosComputables || 0) - (col.ingressosComputables || 0) * ((col.percentatgeDespeses || 40) / 100), 0))} €
                      </td>
                    </tr>
                  </>
                )}

                {/* RESULTAT EXTRAORDINARI (comú als dos mètodes) */}
                <tr className="border-b border-gray-100 bg-amber-50/40">
                  <td className="py-1.5 px-3 text-xs text-gray-600">
                    Resultats extraordinaris per la transmissió d'actius fixos afectes a l'activitat
                  </td>
                  <td colSpan={3} className="py-1 px-2">
                    <Num
                      value={cols[0]?.resultatExtraordinari || 0}
                      onChange={(v) => updateColumna(0, 'resultatExtraordinari', v)}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Reducció per arrendament d'habitatges */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Reducció per arrendament d'habitatges (€)
                <span className="ml-1 text-gray-400 font-normal">Art. 8.3 — 10% dels ingressos d'habitatge a preu assequible</span>
              </label>
              <Num
                value={activitat.reduccioArrendament || 0}
                onChange={(v) => updateCamp('reduccioArrendament', v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Retencions i ingressos a compte (€)
              </label>
              <Num
                value={activitat.retencions || 0}
                onChange={(v) => updateCamp('retencions', v)}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                Impost comunal de radicació pagat (€)
                <span className="ml-1 text-gray-400 font-normal">Art. 47 — deduïble de la quota</span>
              </label>
              <Num
                value={activitat.impostRadicacio || 0}
                onChange={(v) => updateCamp('impostRadicacio', v)}
              />
            </div>
          </div>

          {/* Renda neta final */}
          <div className={`rounded-xl p-4 flex items-center justify-between ${rn >= 0 ? 'bg-[#009B9C]/10 border border-[#009B9C]/20' : 'bg-red-50 border border-red-200'}`}>
            <span className="font-semibold text-sm text-gray-700">
              Renda neta d'activitats econòmiques — casella (3)
            </span>
            <span className={`text-xl font-bold ${rn >= 0 ? 'text-[#009B9C]' : 'text-red-600'}`}>
              {fmt(rn)} €
            </span>
          </div>

          {/* Afegir columna CAEA */}
          {cols.length < 3 && (
            <button
              onClick={afegirColumna}
              className="text-xs text-[#009B9C] hover:text-[#007A7B] border border-[#009B9C]/30 hover:border-[#009B9C] rounded-lg px-3 py-1.5 transition"
            >
              + Afegir CAEA addicional ({cols.length}/3)
            </button>
          )}

          {/* Opció pagament fraccionat */}
          <label className="flex items-center gap-2 cursor-pointer text-xs text-gray-600">
            <input
              type="checkbox"
              checked={activitat.opcioFraccionat}
              onChange={(e) => updateCamp('opcioFraccionat', e.target.checked)}
              className="accent-[#009B9C] w-4 h-4"
            />
            Sol·licitar que l'Administració efectuï d'ofici la liquidació i domiciliació del pagament fraccionat
            <span className="text-gray-400">(apartat 3 del 300-C)</span>
          </label>

          {/* Nota informativa */}
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            <strong>ℹ️ Art. 14-19 Llei 5/2014:</strong> Les rendes netes d'activitats econòmiques formen part de la Base de Tributació General.
            El pagament fraccionat (5% sobre rendes netes any anterior o 50% sobre quota liquidació) es presenta al setembre (formulari 320).
          </div>
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const Step3Activitat = ({ dades, update }) => {
  const addActivitat = () => {
    update('activitats', [
      ...dades.activitats,
      { ...DEFAULT_ACTIVITAT, id: Date.now(), columnes: [{ ...DEFAULT_COLUMNA }] },
    ]);
  };

  const updateActivitatTot = (id, activitatActualitzada) => {
    update('activitats', dades.activitats.map((a) => (a.id === id ? activitatActualitzada : a)));
  };

  const removeActivitat = (id) => {
    update('activitats', dades.activitats.filter((a) => a.id !== id));
  };

  const totalRendaNeta = dades.activitats.reduce((acc, a) => acc + rendaNetaTotal(a), 0);
  const totalRetencions = dades.activitats.reduce((acc, a) => acc + (a.retencions || 0), 0);

  return (
    <div className="space-y-4">
      {/* Capçalera del pas */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">
              3
            </span>
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
            <p className="text-xs mt-1">
              Incloeu aquí les rendes d'empresaris individuals, professionals liberals o arrendataris d'activitats.
            </p>
          </div>
        )}

        {dades.activitats.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
              <span className="font-semibold text-[#009B9C]">Total renda neta activitats (3): </span>
              <span className={`font-bold ${totalRendaNeta >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                {fmt(totalRendaNeta)} €
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-sm">
              <span className="font-semibold text-gray-600">Total retencions: </span>
              <span className="font-bold text-gray-800">{fmt(totalRetencions)} €</span>
            </div>
          </div>
        )}
      </div>

      {/* Una targeta per activitat */}
      {dades.activitats.map((activitat, i) => (
        <ActivitatForm
          key={activitat.id}
          activitat={activitat}
          index={i}
          onUpdateTot={updateActivitatTot}
          onEliminar={() => removeActivitat(activitat.id)}
        />
      ))}
    </div>
  );
};

export default Step3Activitat;
