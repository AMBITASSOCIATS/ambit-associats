// steps/Step1SituacioPersonal.jsx — Pas 1: Situacio personal i familiar (300-A complet)
import React, { useState } from 'react';
import { IRPF } from '../engine/constants';

const InputNum = ({ label, value, onChange, min = 0, hint = '' }) => (
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
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const InputText = ({ label, value, onChange, placeholder = '' }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
  </div>
);

const Step1SituacioPersonal = ({ dades, update }) => {
  const [showEconomiques, setShowEconomiques] = useState(false);

  const addDescendent = () => {
    update('descendents', [...dades.descendents, {
      id: Date.now(), nom: '', anyNaixement: new Date().getFullYear() - 10, discapacitat: false, matricules: 0
    }]);
  };

  const updateDescendent = (id, camp, valor) => {
    update('descendents', dades.descendents.map(d => d.id === id ? { ...d, [camp]: valor } : d));
  };

  const removeDescendent = (id) => {
    update('descendents', dades.descendents.filter(d => d.id !== id));
  };

  const addAscendent = () => {
    update('ascendents', [...dades.ascendents, {
      id: Date.now(), nom: '', anyNaixement: new Date().getFullYear() - 70, discapacitat: false
    }]);
  };

  const updateAscendent = (id, camp, valor) => {
    update('ascendents', dades.ascendents.map(a => a.id === id ? { ...a, [camp]: valor } : a));
  };

  const removeAscendent = (id) => {
    update('ascendents', dades.ascendents.filter(a => a.id !== id));
  };

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
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">1</span>
          <div>
            <h2 className="font-bold text-gray-800">Situacio personal i familiar</h2>
            <p className="text-xs text-gray-500">Formulari 300-A · Minim personal i reduccions familiars</p>
          </div>
        </div>

        {/* Estat civil */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Estat civil</h3>
          <div className="grid grid-cols-2 gap-3">
            {[
              { valor: 'casat', etiqueta: 'Casat/da o parella de fet' },
              { valor: 'altres', etiqueta: "Solter/a, vidu/a, divorciat/da" },
            ].map(opt => (
              <button
                key={opt.valor}
                onClick={() => update('estatCivil', opt.valor)}
                className={`p-3 rounded-xl border-2 text-sm font-medium transition text-left ${
                  dades.estatCivil === opt.valor
                    ? 'border-[#009B9C] bg-[#009B9C]/10 text-[#009B9C]'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                {opt.etiqueta}
              </button>
            ))}
          </div>
        </div>

        {/* Conjuge */}
        {dades.estatCivil === 'casat' && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">Dades del conjuge / parella de fet</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputText
                label="Nom del conjuge"
                value={dades.conjugeNom}
                onChange={v => update('conjugeNom', v)}
              />
              <InputText
                label="NRT del conjuge"
                value={dades.conjugeNRT}
                onChange={v => update('conjugeNRT', v)}
                placeholder="F-XXXXXX-X"
              />
              <div className="col-span-2">
                <InputNum
                  label="Rendes generals del conjuge (euros) — per verificar si aplica minim ampliat 40.000 euros"
                  value={dades.conjugeRendesGenerals}
                  onChange={v => update('conjugeRendesGenerals', v)}
                />
              </div>
            </div>
            {dades.conjugeRendesGenerals < 24000 && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                <strong>Minim personal ampliat:</strong> Com que les rendes del conjuge ({(dades.conjugeRendesGenerals || 0).toFixed(2)} euros) son inferiors al minim personal (24.000 euros), s'aplica el minim personal de 40.000 euros. Font: Art. 35.1 Llei 5/2014.
              </div>
            )}
          </div>
        )}

        {/* Discapacitat */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={dades.obligatDiscapacitat}
              onChange={e => update('obligatDiscapacitat', e.target.checked)}
              className="w-4 h-4 rounded accent-[#009B9C]"
            />
            <span className="text-sm text-gray-700">
              Discapacitat reconeguda per CONAVA (minim personal 30.000 euros) — Art. 35.1 Llei 5/2014
            </span>
          </label>
        </div>
      </div>

      {/* Descendents */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Descendents a carrec</h3>
          <button
            onClick={addDescendent}
            className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition"
          >
            + Afegir descendent
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Fills menors de 25 anys que conviuen amb l'obligat tributari. Reduccio: 1.000 euros per descendent. Font: Art. 35.2.a Llei 5/2014.
        </p>
        {dades.descendents.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Cap descendent afegit</p>
        )}
        {dades.descendents.map((d, i) => (
          <div key={d.id} className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600">Descendent {i + 1}</span>
              <button onClick={() => removeDescendent(d.id)} className="text-gray-400 hover:text-red-500 text-xs">Eliminar</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputText label="Nom" value={d.nom} onChange={v => updateDescendent(d.id, 'nom', v)} />
              <InputNum label="Any de naixement" value={d.anyNaixement} onChange={v => updateDescendent(d.id, 'anyNaixement', v)} min={1900} />
              <InputNum label="Matricules ensenyament superior (euros, max. 300 euros)" value={d.matricules} onChange={v => updateDescendent(d.id, 'matricules', v)} />
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" checked={d.discapacitat} onChange={e => updateDescendent(d.id, 'discapacitat', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                <span className="text-xs text-gray-600">Discapacitat reconeguda</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Ascendents */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Ascendents a carrec</h3>
          <button
            onClick={addAscendent}
            className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition"
          >
            + Afegir ascendent
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Ascendents majors de 65 anys que conviuen amb l'obligat tributari. Reduccio: 1.000 euros per ascendent. Font: Art. 35.2.b Llei 5/2014.
        </p>
        {dades.ascendents.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Cap ascendent afegit</p>
        )}
        {dades.ascendents.map((a, i) => (
          <div key={a.id} className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600">Ascendent {i + 1}</span>
              <button onClick={() => removeAscendent(a.id)} className="text-gray-400 hover:text-red-500 text-xs">Eliminar</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputText label="Nom" value={a.nom} onChange={v => updateAscendent(a.id, 'nom', v)} />
              <InputNum label="Any de naixement" value={a.anyNaixement} onChange={v => updateAscendent(a.id, 'anyNaixement', v)} min={1900} />
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" checked={a.discapacitat} onChange={e => updateAscendent(a.id, 'discapacitat', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                <span className="text-xs text-gray-600">Discapacitat reconeguda</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Seccio 2 del 300-A: Reduccions economiques (habitatge, pensions, compensatories) */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setShowEconomiques(!showEconomiques)}
          className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 text-left transition border-b border-gray-200"
        >
          <div>
            <span className="font-semibold text-sm text-gray-800">
              Dades economiques (300-A sec.2) — Reduccions
            </span>
            <p className="text-xs text-gray-500 mt-0.5">Habitatge habitual, plans de pensions, pensions compensatories</p>
          </div>
          <span className="text-gray-400 font-bold text-lg">{showEconomiques ? '-' : '+'}</span>
        </button>

        {showEconomiques && (
          <div className="p-6 space-y-6">
            {/* Habitatge habitual */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">A</span>
                2.1 Inversio en habitatge habitual (Art. 38) — casella 6
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputNum
                  label="Quotes hipoteca / lloguer assequible (euros)"
                  value={dades.quotesHabitatge}
                  onChange={v => update('quotesHabitatge', v)}
                  hint={`Reduccio: 50% de les quotes (max. ${IRPF.RED_HABITATGE_MAX ? IRPF.RED_HABITATGE_MAX.toLocaleString('ca-AD') : '3.000'} euros/any) — Art. 38 Llei 5/2014`}
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
              {(dades.quotesHabitatge || 0) > 0 && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  Reduccio aplicada: <strong>{redHabitatge.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</strong>
                  {(dades.quotesHabitatge || 0) * IRPF.RED_HABITATGE_PCT > IRPF.RED_HABITATGE_MAX && (
                    <span className="ml-2">(limitada al maxim de {IRPF.RED_HABITATGE_MAX ? IRPF.RED_HABITATGE_MAX.toLocaleString('ca-AD') : '3.000'} euros)</span>
                  )}
                </div>
              )}
            </div>

            {/* Plans de pensions */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">B</span>
                2.2 Reduccio per plans de pensions (Art. 39) — casella 7
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputNum
                  label="Aportacio propia a pla de pensions (euros)"
                  value={dades.aportacioPensions}
                  onChange={v => update('aportacioPensions', v)}
                  hint="Aportacio de l'obligat tributari"
                />
                <InputNum
                  label="Contribucio de l'empresa (euros)"
                  value={dades.contribucioPensions}
                  onChange={v => update('contribucioPensions', v)}
                  hint="Contribucio imputada a l'obligat tributari"
                />
              </div>
              {((dades.aportacioPensions || 0) + (dades.contribucioPensions || 0)) > 0 && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  Reduccio aplicada: <strong>{redPensions.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</strong>
                  {' '}(30% de {((dades.aportacioPensions || 0) + (dades.contribucioPensions || 0)).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros,
                  max. {IRPF.RED_PLA_PENSIONS_MAX ? IRPF.RED_PLA_PENSIONS_MAX.toLocaleString('ca-AD') : '5.000'} euros) — Art. 39
                </div>
              )}
            </div>

            {/* Pensions compensatories */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center">C</span>
                2.3 Pensions compensatories i anualitats per aliments — casella 8
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <InputNum
                  label="Pensions compensatories al conjuge (euros)"
                  value={dades.pensionsCompensatories}
                  onChange={v => update('pensionsCompensatories', v)}
                  hint="Import satisfet per resolucio judicial — Art. 35.3 Llei 5/2014"
                />
                <InputNum
                  label="Anualitats per aliments als fills (euros)"
                  value={dades.anualitatAliments}
                  onChange={v => update('anualitatAliments', v)}
                  hint="Import satisfet per resolucio judicial — Art. 35.3 Llei 5/2014"
                />
              </div>
            </div>

            {/* Resum reduccions sec.2 */}
            {(redHabitatge + redPensions + (dades.pensionsCompensatories || 0) + (dades.anualitatAliments || 0)) > 0 && (
              <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-xs">
                <p className="font-semibold text-[#009B9C] mb-2">Resum reduccions 300-A sec.2</p>
                <div className="space-y-1 text-gray-700">
                  {redHabitatge > 0 && (
                    <div className="flex justify-between">
                      <span>Reduccio habitatge (Art. 38):</span>
                      <span className="font-bold">{redHabitatge.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
                    </div>
                  )}
                  {redPensions > 0 && (
                    <div className="flex justify-between">
                      <span>Reduccio pensions (Art. 39):</span>
                      <span className="font-bold">{redPensions.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
                    </div>
                  )}
                  {(dades.pensionsCompensatories || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Pensions compensatories:</span>
                      <span className="font-bold">{(dades.pensionsCompensatories || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
                    </div>
                  )}
                  {(dades.anualitatAliments || 0) > 0 && (
                    <div className="flex justify-between">
                      <span>Anualitats aliments:</span>
                      <span className="font-bold">{(dades.anualitatAliments || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-gray-800 border-t pt-1 mt-1">
                    <span>Total reduccions 300-A sec.2:</span>
                    <span>{(redHabitatge + redPensions + (dades.pensionsCompensatories || 0) + (dades.anualitatAliments || 0)).toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resum situacio personal */}
      <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-[#009B9C] mb-2">Resum — Minim personal aplicable</h4>
        <div className="space-y-1 text-xs text-gray-700">
          {dades.obligatDiscapacitat ? (
            <p>Minim personal: <strong>30.000 euros</strong> (discapacitat — Art. 35.1)</p>
          ) : dades.estatCivil === 'casat' && (dades.conjugeRendesGenerals || 0) < 24000 ? (
            <p>Minim personal: <strong>40.000 euros</strong> (conjuge a carrec — Art. 35.1)</p>
          ) : (
            <p>Minim personal: <strong>24.000 euros</strong> (general — Art. 35.1)</p>
          )}
          {dades.descendents.length > 0 && (
            <p>Reduccions descendents: <strong>{(dades.descendents.length * 1000).toLocaleString('ca-AD')} euros</strong> ({dades.descendents.length} x 1.000 euros — Art. 35.2.a)</p>
          )}
          {dades.ascendents.length > 0 && (
            <p>Reduccions ascendents: <strong>{(dades.ascendents.length * 1000).toLocaleString('ca-AD')} euros</strong> ({dades.ascendents.length} x 1.000 euros — Art. 35.2.b)</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step1SituacioPersonal;
