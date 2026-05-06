// steps/Step5Mobiliari.jsx — Pas 5: Capital mobiliari (300-D)
// Estructura: ENTITAT (informe fiscal) -> PARTIDES (4 tipus: a, b, c, d)
import React from 'react';
import AnalysisAlert from '../components/AnalysisAlert';

const PARTIDES_300D = [
  { tipus: 'a', nom: 'Dividends i participacio en patrimoni net', codi: 'DIV' },
  { tipus: 'b', nom: 'Interessos i cessio de capitals propis', codi: 'INT' },
  { tipus: 'c', nom: 'Operacions de capitalitzacio i assegurances', codi: 'CAP' },
  { tipus: 'd', nom: 'Altres rendes de capital mobiliari', codi: 'ALT' },
];

const crearPartidesDefaults = () =>
  PARTIDES_300D.map(p => ({
    tipus: p.tipus,
    importBrut: 0,
    despeses: 0,
    retencioAndorra: 0,
    retencioOrigen: 0,
  }));

const DEFAULT_ENTITAT = {
  id: null,
  entitat: '',
  exercici: 2025,
  partides: crearPartidesDefaults(),
  despesesCustodia: 0,
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

  const totalBrut = entitat.partides.reduce((a, p) => a + (p.importBrut || 0), 0);
  const totalDespeses = entitat.partides.reduce((a, p) => a + (p.despeses || 0), 0) + (entitat.despesesCustodia || 0);
  const totalRetAndorra = entitat.partides.reduce((a, p) => a + (p.retencioAndorra || 0), 0);
  const totalRetOrigen = entitat.partides.reduce((a, p) => a + (p.retencioOrigen || 0), 0);
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
            </tr>
          </thead>
          <tbody>
            {PARTIDES_300D.map((pd) => {
              const partida = entitat.partides.find(p => p.tipus === pd.tipus) || {};
              const net = (partida.importBrut || 0) - (partida.despeses || 0);
              const analisi = pd.tipus === 'a' ? analisiOIC(partida.importBrut)
                            : pd.tipus === 'c' ? analisiAsseguranca(partida.importBrut)
                            : null;
              return (
                <React.Fragment key={pd.tipus}>
                  <tr className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-2">
                      <div>
                        <span className="inline-block bg-[#009B9C]/10 text-[#009B9C] text-xs font-bold rounded px-1.5 py-0.5 mr-1.5">{pd.tipus.toUpperCase()}</span>
                        <span className="text-gray-700">{pd.nom}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={partida.importBrut === 0 ? '' : partida.importBrut}
                        placeholder="0"
                        onChange={e => updatePartida(pd.tipus, 'importBrut', parseFloat(e.target.value) || 0)}
                        className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={partida.despeses === 0 ? '' : partida.despeses}
                        placeholder="0"
                        onChange={e => updatePartida(pd.tipus, 'despeses', parseFloat(e.target.value) || 0)}
                        className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={partida.retencioAndorra === 0 ? '' : partida.retencioAndorra}
                        placeholder="0"
                        onChange={e => updatePartida(pd.tipus, 'retencioAndorra', parseFloat(e.target.value) || 0)}
                        className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={partida.retencioOrigen === 0 ? '' : partida.retencioOrigen}
                        placeholder="0"
                        onChange={e => updatePartida(pd.tipus, 'retencioOrigen', parseFloat(e.target.value) || 0)}
                        className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono font-medium ${net >= 0 ? 'text-gray-700' : 'text-red-600'}`}>
                        {net.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                  {analisi && (partida.importBrut || 0) > 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 pb-2">
                        <AnalysisAlert analisi={analisi} />
                      </td>
                    </tr>
                  )}
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
                  type="number" min="0" step="0.01"
                  value={entitat.despesesCustodia === 0 ? '' : entitat.despesesCustodia}
                  placeholder="0"
                  onChange={e => update('despesesCustodia', parseFloat(e.target.value) || 0)}
                  className="w-full text-right border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C] text-xs"
                />
              </td>
              <td colSpan={3}></td>
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
            </tr>
          </tbody>
        </table>
      </div>

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

  const totalBrutGlobal = dades.mobiliaris.reduce((acc, e) =>
    acc + e.partides.reduce((a, p) => a + (p.importBrut || 0), 0), 0);
  const totalNetGlobal = dades.mobiliaris.reduce((acc, e) => {
    const brut = e.partides.reduce((a, p) => a + (p.importBrut || 0), 0);
    const desp = e.partides.reduce((a, p) => a + (p.despeses || 0), 0) + (e.despesesCustodia || 0);
    return acc + brut - desp;
  }, 0);
  const totalRetOrigenGlobal = dades.mobiliaris.reduce((acc, e) =>
    acc + e.partides.reduce((a, p) => a + (p.retencioOrigen || 0), 0), 0);

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
    </div>
  );
};

export default Step5Mobiliari;
