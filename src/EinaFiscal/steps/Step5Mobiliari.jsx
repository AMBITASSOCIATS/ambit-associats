// steps/Step5Mobiliari.jsx — Pas 5: Capital mobiliari (300-D)
// Estructura: ENTITAT (informe fiscal) -> PARTIDES (4 tipus: a, b, c, d)
import React from 'react';
import AnalysisAlert from '../components/AnalysisAlert';

const PARTIDA_LABELS = {
  a: 'Dividends i altres rendiments per participació en fons propis',
  b: 'Interessos i altres rendiments per cessió de capitals',
  c: 'Operacions de capitalització i assegurances de vida',
  d: 'Altres rendiments del capital mobiliari',
};

const novaLinia = () => ({
  id: Date.now() + Math.random(),
  concepte: '',
  importBrut: 0,
  despeses: 0,
  retencioAndorra: 0,
  retencioOrigen: 0,
});

const crearPartidesDefaults = () => [
  { tipus: 'a', label: PARTIDA_LABELS.a, linies: [novaLinia()] },
  { tipus: 'b', label: PARTIDA_LABELS.b, linies: [novaLinia()] },
  { tipus: 'c', label: PARTIDA_LABELS.c, linies: [novaLinia()] },
  { tipus: 'd', label: PARTIDA_LABELS.d, linies: [novaLinia()] },
];

// Compatibilitat amb dades antigues de Supabase (partides sense `linies`):
// crea una línia única a partir dels valors directes de la partida.
const normalitzarPartida = (p) => {
  const label = p.label || PARTIDA_LABELS[p.tipus] || '';
  if (p.linies && p.linies.length > 0) {
    return p.label ? p : { ...p, label };
  }
  return {
    tipus: p.tipus,
    label,
    linies: [{
      id: Date.now() + Math.random(),
      concepte: '',
      importBrut: p.importBrut || 0,
      despeses: p.despeses || 0,
      retencioAndorra: p.retencioAndorra || 0,
      retencioOrigen: p.retencioOrigen || 0,
    }],
  };
};

// Suma d'un camp sobre les línies d'una partida (amb fallback al valor directe antic).
const sumaPartida = (p, camp) =>
  (p.linies && p.linies.length > 0)
    ? p.linies.reduce((s, l) => s + (l[camp] || 0), 0)
    : (p[camp] || 0);

const DEFAULT_RENDA_EXEMPTA = {
  id: null,
  tipus: 'DEVOLUCIO_CAPITAL', // 'DEVOLUCIO_CAPITAL' | 'ALTRES_EXEMPT'
  concepte: '',
  import: 0,
};

const DEFAULT_ENTITAT = {
  id: null,
  entitat: '',
  exercici: 2025,
  partides: crearPartidesDefaults(),
  despesesCustodia: 0,
  rendesExemptes: [],
};

// Analisi d'exempcio per OIC (partida a — dividends)
const analisiOIC = (brut) => {
  if (brut <= 0) return null;
  return {
    titol: 'Dividends OIC — Art. 5.k Llei 5/2014',
    explicacio: 'Els dividends i participacions en OIC (fons d\'inversio) estan exempts si la participacio es inferior al 25% O si la tinenca es igual o superior a 10 anys (CT 04/03/2015).',
    ref: 'Art. 5.k Llei 5/2014',
    formulari: '300-D',
    casella: 'a',
    alertType: 'info',
  };
};

// Analisi d'exempcio per assegurances (partida c)
const analisiAsseguranca = (brut) => {
  if (brut <= 0) return null;
  return {
    titol: 'Assegurances de vida — CT 25/03/2026',
    explicacio: 'Les assegurances de vida vinculades a la cobertura d\'hipoteca poden estar exemptes. Verificar si la polissa compleix les condicions establertes al criteri tributari.',
    ref: 'CT 25/03/2026',
    formulari: '300-D',
    casella: 'c',
    alertType: 'info',
  };
};


const EntitatForm = ({ entitat, index, onUpdate, onEliminar }) => {
  const updatePartida = (tipus, camp, valor) => {
    const noves = entitat.partides.map(p =>
      p.tipus === tipus ? { ...p, [camp]: valor } : p
    );
    onUpdate(entitat.id, 'partides', noves);
  };

  const update = (camp, valor) => onUpdate(entitat.id, camp, valor);

  // Gestió de línies dins de cada partida
  const addLinia = (tipusPartida) => {
    const p = entitat.partides.find(x => x.tipus === tipusPartida);
    updatePartida(tipusPartida, 'linies', [...(p?.linies || []), novaLinia()]);
  };
  const removeLinia = (tipusPartida, liniaId) => {
    const p = entitat.partides.find(x => x.tipus === tipusPartida);
    updatePartida(tipusPartida, 'linies', (p?.linies || []).filter(l => l.id !== liniaId));
  };
  const updateLinia = (tipusPartida, liniaId, camp, valor) => {
    const p = entitat.partides.find(x => x.tipus === tipusPartida);
    updatePartida(tipusPartida, 'linies', (p?.linies || []).map(l =>
      l.id === liniaId ? { ...l, [camp]: valor } : l
    ));
  };

  // Rendes exemptes / no subjectes de l'entitat
  const addRendaExempta = () =>
    update('rendesExemptes', [...(entitat.rendesExemptes || []), { ...DEFAULT_RENDA_EXEMPTA, id: Date.now() + Math.random() }]);
  const removeRendaExempta = (rendaId) =>
    update('rendesExemptes', (entitat.rendesExemptes || []).filter(re => re.id !== rendaId));
  const updateRendaExempta = (rendaId, camp, valor) =>
    update('rendesExemptes', (entitat.rendesExemptes || []).map(re => re.id === rendaId ? { ...re, [camp]: valor } : re));

  const totalBrut = entitat.partides.reduce((a, p) => a + sumaPartida(p, 'importBrut'), 0);
  const totalDespeses = entitat.partides.reduce((a, p) => a + sumaPartida(p, 'despeses'), 0) + (entitat.despesesCustodia || 0);
  const totalRetAndorra = entitat.partides.reduce((a, p) => a + sumaPartida(p, 'retencioAndorra'), 0);
  const totalRetOrigen = entitat.partides.reduce((a, p) => a + sumaPartida(p, 'retencioOrigen'), 0);
  const totalNet = totalBrut - totalDespeses;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Capçalera entitat */}
      <div className="flex items-center justify-between px-5 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <span className="w-7 h-7 rounded-full bg-[#009B9C]/20 text-[#009B9C] text-xs font-bold flex items-center justify-center">
            {index + 1}
          </span>
          <div>
            <input
              type="text"
              value={entitat.entitat}
              onChange={e => update('entitat', e.target.value)}
              placeholder="Nom de l'entitat (MoraBanc, Credit Andorra...)"
              className="font-semibold text-gray-800 text-sm bg-transparent border-0 focus:outline-none focus:ring-0 w-64 placeholder-gray-400"
            />
          </div>
        </div>
        <button
          onClick={onEliminar}
          className="text-gray-400 hover:text-red-500 text-xs transition"
        >
          Eliminar entitat
        </button>
      </div>

      {/* Taula de partides */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left px-4 py-2 font-medium text-gray-600 w-48">Partida 300-D</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Import brut (euros)</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Despeses (euros)</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Ret. Andorra (euros)</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Ret. Origen (euros)</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Net (euros)</th>
              <th className="px-2 py-2 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {entitat.partides.map((partida) => {
              const linies = partida.linies || [];
              const brutPartida = linies.reduce((s, l) => s + (l.importBrut || 0), 0);
              const analisi = partida.tipus === 'a' ? analisiOIC(brutPartida)
                            : partida.tipus === 'c' ? analisiAsseguranca(brutPartida)
                            : null;
              return (
                <React.Fragment key={partida.tipus}>
                  {linies.map((linia) => {
                    const net = (linia.importBrut || 0) - (linia.despeses || 0);
                    return (
                      <tr key={linia.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                        <td className="px-4 py-2">
                          <div className="font-medium text-gray-700 text-xs mb-1">
                            <span className="inline-block bg-[#009B9C]/10 text-[#009B9C] text-xs font-bold rounded px-1.5 py-0.5 mr-1.5">{partida.tipus.toUpperCase()}</span>
                            {partida.label}
                          </div>
                          <input
                            type="text"
                            value={linia.concepte}
                            onChange={e => updateLinia(partida.tipus, linia.id, 'concepte', e.target.value)}
                            placeholder="Concepte / descripció"
                            className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]/40"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
                            value={linia.importBrut === 0 ? '' : linia.importBrut}
                            placeholder="0"
                            onChange={e => { const v = e.target.value; updateLinia(partida.tipus, linia.id, 'importBrut', v === '' ? 0 : parseFloat(v) || 0); }}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
                            value={linia.despeses === 0 ? '' : linia.despeses}
                            placeholder="0"
                            onChange={e => { const v = e.target.value; updateLinia(partida.tipus, linia.id, 'despeses', v === '' ? 0 : parseFloat(v) || 0); }}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
                            value={linia.retencioAndorra === 0 ? '' : linia.retencioAndorra}
                            placeholder="0"
                            onChange={e => { const v = e.target.value; updateLinia(partida.tipus, linia.id, 'retencioAndorra', v === '' ? 0 : parseFloat(v) || 0); }}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs font-mono"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
                            value={linia.retencioOrigen === 0 ? '' : linia.retencioOrigen}
                            placeholder="0"
                            onChange={e => { const v = e.target.value; updateLinia(partida.tipus, linia.id, 'retencioOrigen', v === '' ? 0 : parseFloat(v) || 0); }}
                            className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs font-mono text-amber-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-mono font-medium ${net >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                            {net.toFixed(2)}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-center">
                          {linies.length > 1 && (
                            <button onClick={() => removeLinia(partida.tipus, linia.id)}
                              className="text-red-400 hover:text-red-600 text-xs">✕</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {analisi && brutPartida > 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 pb-2">
                        <AnalysisAlert analisi={analisi} />
                      </td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={7} className="px-4 py-1">
                      <button
                        onClick={() => addLinia(partida.tipus)}
                        className="text-xs text-[#009B9C] hover:text-[#007A7B] font-medium"
                      >
                        + Afegir línia a {partida.label}
                      </button>
                    </td>
                  </tr>
                </React.Fragment>
              );
            })}
            {/* Despeses de custodia */}
            <tr className="border-b border-gray-200 bg-gray-50/50">
              <td className="px-4 py-2 text-gray-600 italic text-xs">
                Despeses d'administracio i custodia (300-D)
              </td>
              <td className="px-3 py-2" colSpan={1}></td>
              <td className="px-3 py-2">
                <input
                  type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
                  value={entitat.despesesCustodia === 0 ? '' : entitat.despesesCustodia}
                  placeholder="0"
                  onChange={e => { const v = e.target.value; update('despesesCustodia', v === '' ? 0 : parseFloat(v) || 0); }}
                  className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs"
                />
              </td>
              <td colSpan={4}></td>
            </tr>
            {/* Total */}
            <tr className="bg-[#009B9C]/5 font-semibold text-sm">
              <td className="px-4 py-2 text-[#009B9C]">Total entitat</td>
              <td className="px-3 py-2 text-right font-mono">{totalBrut.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-mono">{totalDespeses.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-mono">{totalRetAndorra.toFixed(2)}</td>
              <td className="px-3 py-2 text-right font-mono">
                {totalRetOrigen > 0 && (
                  <span className="text-amber-600">{totalRetOrigen.toFixed(2)}</span>
                )}
                {totalRetOrigen === 0 && '0.00'}
              </td>
              <td className="px-3 py-2 text-right font-mono">
                <span className={totalNet >= 0 ? 'text-gray-800' : 'text-red-600'}>
                  {totalNet.toFixed(2)}
                </span>
              </td>
              <td className="px-2 py-2"></td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Rendes exemptes / no subjectes de l'entitat */}
      {(entitat.rendesExemptes || []).length > 0 && (
        <div className="mx-4 mb-3 mt-2 border border-green-200 rounded-xl p-3 bg-green-50">
          <p className="text-xs font-semibold text-green-700 mb-2">
            Rendes exemptes / no subjectes (informatiu — no computen a la base)
          </p>
          {(entitat.rendesExemptes || []).map((re) => (
            <div key={re.id} className="flex gap-2 items-center mb-2">
              <select
                value={re.tipus}
                onChange={e => updateRendaExempta(re.id, 'tipus', e.target.value)}
                className="border border-green-300 rounded px-2 py-1 text-xs"
              >
                <option value="DEVOLUCIO_CAPITAL">Devolució de capital (Art. 27.3)</option>
                <option value="ALTRES_EXEMPT">Altra renda exempta</option>
              </select>
              <input
                type="text"
                value={re.concepte}
                onChange={e => updateRendaExempta(re.id, 'concepte', e.target.value)}
                placeholder="Concepte / descripció"
                className="flex-1 border border-green-300 rounded px-2 py-1 text-xs"
              />
              <input
                type="number" onWheel={e => e.target.blur()} min="0" step="0.01"
                value={re.import === 0 ? '' : re.import}
                onChange={e => { const v = e.target.value; updateRendaExempta(re.id, 'import', v === '' ? 0 : parseFloat(v) || 0); }}
                placeholder="0.00"
                className="w-24 border border-green-300 rounded px-2 py-1 text-xs text-right font-mono"
              />
              <button onClick={() => removeRendaExempta(re.id)}
                className="text-red-400 hover:text-red-600 text-xs">✕</button>
            </div>
          ))}
          {(entitat.rendesExemptes || []).some(re => re.tipus === 'DEVOLUCIO_CAPITAL') && (
            <p className="text-xs text-green-600 mt-1">
              ℹ️ La devolució de capital (Art. 27.3 Llei 5/2014) no és renda: minora el valor d'adquisició dels valors restants. No computa a la base de l'estalvi.
            </p>
          )}
        </div>
      )}
      <button
        onClick={addRendaExempta}
        className="mx-4 mb-3 text-xs text-green-600 hover:text-green-800 font-medium"
      >
        + Afegir renda exempta / no subjecta
      </button>

      {totalRetOrigen > 0 && (
        <div className="mx-4 mb-3 mt-1 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          <strong>Retencio al pais d'origen detectada ({totalRetOrigen.toFixed(2)} euros).</strong> Aneu al pas 7 (DDI) per declarar aquesta retencio i aplicar la deduccio per doble imposicio.
        </div>
      )}
    </div>
  );
};

const Step5Mobiliari = ({ dades, update }) => {
  const addEntitat = () => {
    update('mobiliaris', [
      ...dades.mobiliaris,
      { ...DEFAULT_ENTITAT, id: Date.now(), partides: crearPartidesDefaults() }
    ]);
  };

  const updateEntitat = (id, camp, valor) => {
    update('mobiliaris', dades.mobiliaris.map(e => e.id === id ? { ...e, [camp]: valor } : e));
  };

  const removeEntitat = (id) => {
    update('mobiliaris', dades.mobiliaris.filter(e => e.id !== id));
  };

  // Migració de dades antigues (partides sense `linies`, entitats sense `rendesExemptes`).
  // S'executa un cop per càrrega; després `normalitzarPartida` retorna la partida sense canvis.
  React.useEffect(() => {
    let cal = false;
    const migrats = (dades.mobiliaris || []).map(e => {
      const partidesNorm = (e.partides || []).map(normalitzarPartida);
      const canviPartides = partidesNorm.some((p, i) => p !== (e.partides || [])[i]);
      const calExemptes = !Array.isArray(e.rendesExemptes);
      if (canviPartides || calExemptes) cal = true;
      return { ...e, partides: partidesNorm, rendesExemptes: e.rendesExemptes || [] };
    });
    if (cal) update('mobiliaris', migrats);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dades.mobiliaris]);

  const totalBrutGlobal = dades.mobiliaris.reduce((acc, e) =>
    acc + e.partides.reduce((a, p) => a + sumaPartida(p, 'importBrut'), 0), 0);
  const totalNetGlobal = dades.mobiliaris.reduce((acc, e) => {
    const brut = e.partides.reduce((a, p) => a + sumaPartida(p, 'importBrut'), 0);
    const desp = e.partides.reduce((a, p) => a + sumaPartida(p, 'despeses'), 0) + (e.despesesCustodia || 0);
    return acc + brut - desp;
  }, 0);
  const totalRetOrigenGlobal = dades.mobiliaris.reduce((acc, e) =>
    acc + e.partides.reduce((a, p) => a + sumaPartida(p, 'retencioOrigen'), 0), 0);

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
            onClick={addEntitat}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir entitat
          </button>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-4">
          <strong>Art. 37 Llei 5/2014:</strong> S'aplica un minim exempt de <strong>3.000 euros</strong> sobre el total de rendes de l'estalvi (capital mobiliari + guanys capital). L'exces tributa al 10%.
        </div>

        <div className="bg-gray-50 rounded-xl p-3 text-xs text-gray-600 mb-4">
          <p className="font-medium mb-1">Com introduir les dades:</p>
          <ol className="list-decimal list-inside space-y-1 text-gray-500">
            <li>Afegiu una entitat per cada informe fiscal (banc, broker...)</li>
            <li>Per cada entitat, ompliu les 4 partides del 300-D amb les xifres de l'informe</li>
            <li>Si hi ha retencio al pais d'origen (dividends estrangers, etc.), introduir-la a la columna "Ret. Origen"</li>
          </ol>
        </div>

        {dades.mobiliaris.length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <p className="text-sm">Cap entitat afegida.</p>
            <p className="text-xs mt-1">Afegiu una entitat per cada informe fiscal (banc, broker...).</p>
          </div>
        )}

        {dades.mobiliaris.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
              <p className="text-xs text-gray-500">Import brut total</p>
              <p className="font-bold text-gray-800">{totalBrutGlobal.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</p>
            </div>
            <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
              <p className="text-xs text-gray-500">Renda neta total</p>
              <p className="font-bold text-gray-800">{totalNetGlobal.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</p>
            </div>
            {totalRetOrigenGlobal > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
                <p className="text-xs text-amber-600">Ret. pais origen total</p>
                <p className="font-bold text-amber-700">{totalRetOrigenGlobal.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</p>
              </div>
            )}
          </div>
        )}
      </div>

      {dades.mobiliaris.map((entitat, i) => (
        <EntitatForm
          key={entitat.id}
          entitat={entitat}
          index={i}
          onUpdate={updateEntitat}
          onEliminar={() => removeEntitat(entitat.id)}
        />
      ))}

      {/* Resum total al final — només si hi ha més d'una entitat */}
      {dades.mobiliaris.length > 1 && (() => {
        const totalBrut = dades.mobiliaris.reduce((s, e) =>
          s + e.partides.reduce((a, p) => a + sumaPartida(p, 'importBrut'), 0), 0);
        const totalDespesesPartida = dades.mobiliaris.reduce((s, e) =>
          s + e.partides.reduce((a, p) => a + sumaPartida(p, 'despeses'), 0), 0);
        const totalDespesesCustodia = dades.mobiliaris.reduce((s, e) =>
          s + (e.despesesCustodia || 0), 0);
        const totalDespeses = totalDespesesPartida + totalDespesesCustodia;
        const totalNet = totalBrut - totalDespeses;
        const f = (n) => n.toLocaleString('ca-AD', { minimumFractionDigits: 2 });

        return (
          <div className="mt-6 bg-[#f0fafa] border border-[#b2e0e0] rounded-xl p-4">
            <p className="text-xs font-bold text-[#007A7B] uppercase tracking-wide mb-3">
              Resum total capital mobiliari — totes les entitats
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-700">
                <span>Total ingressos bruts</span>
                <span className="font-mono">{f(totalBrut)} €</span>
              </div>
              {totalDespesesPartida > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>  − Despeses per partida</span>
                  <span className="font-mono text-red-600">−{f(totalDespesesPartida)} €</span>
                </div>
              )}
              {totalDespesesCustodia > 0 && (
                <div className="flex justify-between text-xs text-gray-500">
                  <span>  − Despeses d'administració i custòdia</span>
                  <span className="font-mono text-red-600">−{f(totalDespesesCustodia)} €</span>
                </div>
              )}
              {totalDespeses > 0 && (
                <div className="flex justify-between text-xs text-gray-500 border-t border-[#b2e0e0] pt-1 mt-1">
                  <span>  − Total despeses deduïbles</span>
                  <span className="font-mono text-red-600">−{f(totalDespeses)} €</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold text-[#007A7B] border-t-2 border-[#009B9C] pt-2 mt-2">
                <span>= Renda neta total capital mobiliari</span>
                <span className="font-mono">{f(totalNet)} €</span>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default Step5Mobiliari;
