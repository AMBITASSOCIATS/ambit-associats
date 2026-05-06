// steps/Step8_300F.jsx — Pas 8: Bases negatives i deduccions anteriors (300-F)
// Formulari 300-F: compensacio de bases negatives d'exercicis anteriors i deduccions pendents
import React from 'react';

const EXERCICIS_DISPONIBLES = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

const InputNum = ({ value, onChange, className = '' }) => (
  <input
    type="number"
    min="0"
    step="0.01"
    value={value === 0 ? '' : value}
    placeholder="0"
    onChange={e => onChange(parseFloat(e.target.value) || 0)}
    className={`border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C] ${className}`}
  />
);

const TaulaBasesNeg = ({ titol, descr, dades, onUpdate, maxFiles = 10, casellaTotal }) => {
  const addFila = () => {
    if (dades.length >= maxFiles) return;
    const exerciciMax = dades.length > 0 ? Math.min(...dades.map(f => f.exercici)) - 1 : new Date().getFullYear() - 1;
    onUpdate([...dades, { exercici: exerciciMax, pendentInici: 0, aplicat: 0, pendentFuturs: 0 }]);
  };

  const removeFila = (i) => {
    onUpdate(dades.filter((_, idx) => idx !== i));
  };

  const updateFila = (i, camp, valor) => {
    const noves = dades.map((f, idx) => {
      if (idx !== i) return f;
      const updated = { ...f, [camp]: valor };
      // Recalcular pendent futurs automaticament
      if (camp === 'pendentInici' || camp === 'aplicat') {
        updated.pendentFuturs = Math.max(0, (camp === 'pendentInici' ? valor : f.pendentInici) - (camp === 'aplicat' ? valor : f.aplicat));
      }
      return updated;
    });
    onUpdate(noves);
  };

  const totalAplicat = dades.reduce((a, f) => a + (f.aplicat || 0), 0);

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">{titol}</h3>
          <p className="text-xs text-gray-500">{descr}</p>
        </div>
        <button
          onClick={addFila}
          disabled={dades.length >= maxFiles}
          className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition disabled:opacity-40"
        >
          + Afegir exercici
        </button>
      </div>

      {dades.length === 0 ? (
        <div className="text-center py-4 text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl">
          Cap base negativa pendent. Afegiu si s'escau.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-3 py-2 font-medium text-gray-600">Exercici</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Pendent inici (euros)</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Aplicat en aquesta declaracio (euros)</th>
                <th className="text-right px-3 py-2 font-medium text-gray-600">Pendent exercicis futurs (euros)</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {dades.map((fila, i) => (
                <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="px-3 py-2">
                    <select
                      value={fila.exercici}
                      onChange={e => updateFila(i, 'exercici', parseInt(e.target.value))}
                      className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                    >
                      {EXERCICIS_DISPONIBLES.map(ex => (
                        <option key={ex} value={ex}>{ex}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <InputNum
                      value={fila.pendentInici}
                      onChange={v => updateFila(i, 'pendentInici', v)}
                      className="w-full text-right"
                    />
                  </td>
                  <td className="px-3 py-2">
                    <InputNum
                      value={fila.aplicat}
                      onChange={v => updateFila(i, 'aplicat', v)}
                      className="w-full text-right"
                    />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="font-mono text-gray-700">
                      {Math.max(0, (fila.pendentInici || 0) - (fila.aplicat || 0)).toFixed(2)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button onClick={() => removeFila(i)} className="text-gray-400 hover:text-red-500 text-xs">Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#009B9C]/5 font-semibold text-sm border-t border-gray-200">
                <td className="px-3 py-2 text-[#009B9C]">Total (casella {casellaTotal})</td>
                <td className="px-3 py-2 text-right font-mono">{dades.reduce((a, f) => a + (f.pendentInici || 0), 0).toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono text-[#009B9C]">{totalAplicat.toFixed(2)}</td>
                <td className="px-3 py-2 text-right font-mono">{dades.reduce((a, f) => a + Math.max(0, (f.pendentInici || 0) - (f.aplicat || 0)), 0).toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

const Step8Bases300F = ({ dades, update }) => {
  const basesNegGenerals = dades.basesNegGenerals || [];
  const basesNegEstalvi = dades.basesNegEstalvi || [];
  const deduccionsAnteriors = dades.deduccionsAnteriors || [];

  const totalAplicatGenerals = basesNegGenerals.reduce((a, f) => a + (f.aplicat || 0), 0);
  const totalAplicatEstalvi = basesNegEstalvi.reduce((a, f) => a + (f.aplicat || 0), 0);
  const totalDeduccions = deduccionsAnteriors.reduce((a, f) => a + (f.aplicat || 0), 0);

  const addDeducc = () => {
    if (deduccionsAnteriors.length >= 3) return;
    const exerciciMax = deduccionsAnteriors.length > 0 ? Math.min(...deduccionsAnteriors.map(f => f.exercici)) - 1 : new Date().getFullYear() - 1;
    update('deduccionsAnteriors', [...deduccionsAnteriors, { exercici: exerciciMax, pendentInici: 0, aplicat: 0, diferit: 0 }]);
  };

  const updateDeducc = (i, camp, valor) => {
    const noves = deduccionsAnteriors.map((f, idx) => {
      if (idx !== i) return f;
      const updated = { ...f, [camp]: valor };
      if (camp === 'pendentInici' || camp === 'aplicat') {
        updated.diferit = Math.max(0, (camp === 'pendentInici' ? valor : f.pendentInici) - (camp === 'aplicat' ? valor : f.aplicat));
      }
      return updated;
    });
    update('deduccionsAnteriors', noves);
  };

  const removeDeducc = (i) => {
    update('deduccionsAnteriors', deduccionsAnteriors.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">8</span>
          <div>
            <h2 className="font-bold text-gray-800">Bases negatives i deduccions anteriors</h2>
            <p className="text-xs text-gray-500">Formulari 300-F · Art. 33-34 Llei 5/2014</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-5">
          <strong>Art. 33 Llei 5/2014:</strong> Les bases de tributacio negatives es poden compensar en els <strong>4 exercicis</strong> fiscals posteriors (base general) o en els <strong>10 exercicis</strong> posteriors (base de l'estalvi). Art. 34: les deduccions de quota pendents es poden aplicar en els 5 exercicis posteriors.
        </div>

        {/* Apartat 1: Bases negatives generals */}
        <TaulaBasesNeg
          titol="Apartat 1 — Bases de tributacio negatives (base general)"
          descr="Casella (4) = suma de 'Aplicat en aquesta declaracio'"
          dades={basesNegGenerals}
          onUpdate={v => update('basesNegGenerals', v)}
          maxFiles={10}
          casellaTotal="4"
        />

        {/* Apartat 2: Bases negatives de l'estalvi */}
        <TaulaBasesNeg
          titol="Apartat 2 — Bases de tributacio negatives (base de l'estalvi)"
          descr="Casella (11) = suma de 'Aplicat en aquesta declaracio'"
          dades={basesNegEstalvi}
          onUpdate={v => update('basesNegEstalvi', v)}
          maxFiles={10}
          casellaTotal="11"
        />

        {/* Apartat 3: Deduccions quota exercicis anteriors */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">Apartat 3 — Deduccions de quota d'exercicis anteriors</h3>
              <p className="text-xs text-gray-500">Casella (12) = suma de 'Deduccio aplicada'</p>
            </div>
            <button
              onClick={addDeducc}
              disabled={deduccionsAnteriors.length >= 3}
              className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition disabled:opacity-40"
            >
              + Afegir exercici
            </button>
          </div>

          {deduccionsAnteriors.length === 0 ? (
            <div className="text-center py-4 text-gray-400 text-xs border border-dashed border-gray-200 rounded-xl">
              Cap deduccio pendent. Afegiu si s'escau.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200 rounded-xl overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left px-3 py-2 font-medium text-gray-600">Exercici</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Pendent inici (euros)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Deduccio aplicada (euros)</th>
                    <th className="text-right px-3 py-2 font-medium text-gray-600">Import diferit (euros)</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {deduccionsAnteriors.map((fila, i) => (
                    <tr key={i} className="border-b border-gray-100 hover:bg-gray-50/50">
                      <td className="px-3 py-2">
                        <select
                          value={fila.exercici}
                          onChange={e => updateDeducc(i, 'exercici', parseInt(e.target.value))}
                          className="border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                        >
                          {EXERCICIS_DISPONIBLES.map(ex => (
                            <option key={ex} value={ex}>{ex}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <InputNum
                          value={fila.pendentInici}
                          onChange={v => updateDeducc(i, 'pendentInici', v)}
                          className="w-full text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <InputNum
                          value={fila.aplicat}
                          onChange={v => updateDeducc(i, 'aplicat', v)}
                          className="w-full text-right"
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <span className="font-mono text-gray-700">
                          {Math.max(0, (fila.pendentInici || 0) - (fila.aplicat || 0)).toFixed(2)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <button onClick={() => removeDeducc(i)} className="text-gray-400 hover:text-red-500 text-xs">Eliminar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#009B9C]/5 font-semibold text-sm border-t border-gray-200">
                    <td className="px-3 py-2 text-[#009B9C]">Total (casella 12)</td>
                    <td className="px-3 py-2 text-right font-mono">{deduccionsAnteriors.reduce((a, f) => a + (f.pendentInici || 0), 0).toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono text-[#009B9C]">{totalDeduccions.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right font-mono">{deduccionsAnteriors.reduce((a, f) => a + Math.max(0, (f.pendentInici || 0) - (f.aplicat || 0)), 0).toFixed(2)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Resum 300-F */}
      {(totalAplicatGenerals > 0 || totalAplicatEstalvi > 0 || totalDeduccions > 0) && (
        <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-4 text-sm">
          <h4 className="font-semibold text-[#009B9C] mb-3">Resum 300-F — Compensacions aplicades</h4>
          <div className="space-y-1 text-xs">
            {totalAplicatGenerals > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Bases neg. generals aplicades (casella 4):</span>
                <span className="font-bold">{totalAplicatGenerals.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
              </div>
            )}
            {totalAplicatEstalvi > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Bases neg. estalvi aplicades (casella 11):</span>
                <span className="font-bold">{totalAplicatEstalvi.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
              </div>
            )}
            {totalDeduccions > 0 && (
              <div className="flex justify-between text-gray-700">
                <span>Deduccions quota aplicades (casella 12):</span>
                <span className="font-bold">{totalDeduccions.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Step8Bases300F;
