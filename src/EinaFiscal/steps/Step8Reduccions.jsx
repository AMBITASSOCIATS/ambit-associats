// steps/Step8Reduccions.jsx — Pas 8: Reduccions (Art. 35-39 Llei 5/2014)
import React from 'react';
import { IRPF } from '../engine/constants';

const InputNum = ({ label, value, onChange, hint = '', min = 0 }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number"
      min={min}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const Step8Reduccions = ({ dades, update }) => {
  const redHabitatge = Math.min(
    (dades.quotesHabitatge || 0) * IRPF.RED_HABITATGE_PCT,
    IRPF.RED_HABITATGE_MAX
  );

  const redPensions = Math.min(
    ((dades.aportacioPensions || 0) + (dades.contribucioPensions || 0)) * IRPF.RED_PLA_PENSIONS_PCT,
    IRPF.RED_PLA_PENSIONS_MAX
  );

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">8</span>
          <div>
            <h2 className="font-bold text-gray-800">Reduccions de la base imposable</h2>
            <p className="text-xs text-gray-500">Art. 35-39 Llei 5/2014 · Formulari 300-A sec.2</p>
          </div>
        </div>

        <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700 mb-5">
          El mínim personal i les reduccions familiars s'introdueixen al <strong>Pas 1 (Situació personal)</strong>. Aquí s'introdueixen les reduccions addicionals de la base imposable general.
        </div>

        {/* Habitatge habitual */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">A</span>
            Reducció per habitatge habitual — Art. 38
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InputNum
              label="Quotes hipoteca / lloguer assequible (€)"
              value={dades.quotesHabitatge}
              onChange={v => update('quotesHabitatge', v)}
              hint={`Reducció: 50% de les quotes (màx. ${IRPF.RED_HABITATGE_MAX.toLocaleString('ca-AD')} €/any) — Art. 38 Llei 5/2014`}
            />
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tipus d'habitatge</label>
              <select
                value={dades.esHabitatgeCompra ? 'compra' : 'lloguer'}
                onChange={e => update('esHabitatgeCompra', e.target.value === 'compra')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
              >
                <option value="compra">Compra (hipoteca)</option>
                <option value="lloguer">Lloguer assequible</option>
              </select>
            </div>
          </div>
          {dades.quotesHabitatge > 0 && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
              Reducció aplicada: <strong>{redHabitatge.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</strong>
              {dades.quotesHabitatge * IRPF.RED_HABITATGE_PCT > IRPF.RED_HABITATGE_MAX && (
                <span className="ml-2">(limitada al màxim de {IRPF.RED_HABITATGE_MAX.toLocaleString('ca-AD')} €)</span>
              )}
            </div>
          )}
        </div>

        {/* Plans de pensions */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">B</span>
            Reducció per plans de pensions — Art. 39
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InputNum
              label="Aportació pròpia a pla de pensions (€)"
              value={dades.aportacioPensions}
              onChange={v => update('aportacioPensions', v)}
              hint="Aportació de l'obligat tributari"
            />
            <InputNum
              label="Contribució de l'empresa (€)"
              value={dades.contribucioPensions}
              onChange={v => update('contribucioPensions', v)}
              hint="Contribució imputada a l'obligat tributari"
            />
          </div>
          {(dades.aportacioPensions + dades.contribucioPensions) > 0 && (
            <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
              Reducció aplicada: <strong>{redPensions.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</strong>
              {' '}(30% de {(dades.aportacioPensions + dades.contribucioPensions).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €, màx. {IRPF.RED_PLA_PENSIONS_MAX.toLocaleString('ca-AD')} €) — Art. 39
              {(dades.aportacioPensions + dades.contribucioPensions) * IRPF.RED_PLA_PENSIONS_PCT > IRPF.RED_PLA_PENSIONS_MAX && (
                <span className="ml-1">(limitada al màxim)</span>
              )}
            </div>
          )}
        </div>

        {/* Pensions compensatòries */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">C</span>
            Pensions compensatòries i anualitats per aliments
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <InputNum
              label="Pensions compensatòries al cònjuge (€)"
              value={dades.pensionsCompensatories}
              onChange={v => update('pensionsCompensatories', v)}
              hint="Import satisfet per resolució judicial — Art. 35.3 Llei 5/2014"
            />
            <InputNum
              label="Anualitats per aliments als fills (€)"
              value={dades.anualitatAliments}
              onChange={v => update('anualitatAliments', v)}
              hint="Import satisfet per resolució judicial — Art. 35.3 Llei 5/2014"
            />
          </div>
        </div>

        {/* Bases negatives generals anteriors */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">D</span>
            Compensació de bases negatives generals anteriors
          </h3>
          <InputNum
            label="BTG negativa d'exercicis anteriors a compensar (€)"
            value={dades.basesNegativesGenerals}
            onChange={v => update('basesNegativesGenerals', v)}
            hint="Art. 33 Llei 5/2014 — compensació en els 4 exercicis posteriors"
          />
        </div>
      </div>

      {/* Resum reduccions */}
      <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-[#009B9C] mb-3">Resum de reduccions (pas 8)</h4>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between text-gray-700">
            <span>Reducció habitatge habitual (Art. 38):</span>
            <span className="font-bold">{redHabitatge.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Reducció pla de pensions (Art. 39):</span>
            <span className="font-bold">{redPensions.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Pensions compensatòries (Art. 35.3):</span>
            <span className="font-bold">{(dades.pensionsCompensatories || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between text-gray-700">
            <span>Anualitats per aliments (Art. 35.3):</span>
            <span className="font-bold">{(dades.anualitatAliments || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</span>
          </div>
          <div className="flex justify-between font-bold text-gray-800 border-t pt-1 mt-1">
            <span>Total reduccions pas 8:</span>
            <span>{(redHabitatge + redPensions + (dades.pensionsCompensatories || 0) + (dades.anualitatAliments || 0)).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Step8Reduccions;
