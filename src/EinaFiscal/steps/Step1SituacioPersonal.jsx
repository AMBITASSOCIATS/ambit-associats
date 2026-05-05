// steps/Step1SituacioPersonal.jsx — Pas 1: Situació personal i familiar (300-A)
import React from 'react';

const InputNum = ({ label, value, onChange, min = 0 }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number"
      min={min}
      value={value}
      onChange={e => onChange(Number(e.target.value))}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
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

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-5">
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">1</span>
          <div>
            <h2 className="font-bold text-gray-800">Situació personal i familiar</h2>
            <p className="text-xs text-gray-500">Formulari 300-A · Mínim personal i reduccions familiars</p>
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

        {/* Cònjuge */}
        {dades.estatCivil === 'casat' && (
          <div className="bg-blue-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-800 mb-3">Dades del cònjuge / parella de fet</h3>
            <div className="grid grid-cols-2 gap-4">
              <InputText
                label="Nom del cònjuge"
                value={dades.conjugeNom}
                onChange={v => update('conjugeNom', v)}
              />
              <InputText
                label="NRT del cònjuge"
                value={dades.conjugeNRT}
                onChange={v => update('conjugeNRT', v)}
                placeholder="F-XXXXXX-X"
              />
              <div className="col-span-2">
                <InputNum
                  label="Rendes generals del cònjuge (€) — per verificar si aplica mínim ampliat 40.000 €"
                  value={dades.conjugeRendesGenerals}
                  onChange={v => update('conjugeRendesGenerals', v)}
                />
              </div>
            </div>
            {dades.conjugeRendesGenerals < 24000 && (
              <div className="mt-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                <strong>Mínim personal ampliat:</strong> Com que les rendes del cònjuge ({dades.conjugeRendesGenerals.toFixed(2)} €) són inferiors al mínim personal (24.000 €), s'aplica el mínim personal de 40.000 €. Font: Art. 35.1 Llei 5/2014.
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
              Discapacitat reconeguda per CONAVA (mínim personal 30.000 €) — Art. 35.1 Llei 5/2014
            </span>
          </label>
        </div>
      </div>

      {/* Descendents */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-800 text-sm">Descendents a càrrec</h3>
          <button
            onClick={addDescendent}
            className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition"
          >
            + Afegir descendent
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Fills menors de 25 anys que conviuen amb l'obligat tributari. Reducció: 1.000 € per descendent. Font: Art. 35.2.a Llei 5/2014.
        </p>
        {dades.descendents.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Cap descendent afegit</p>
        )}
        {dades.descendents.map((d, i) => (
          <div key={d.id} className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600">Descendent {i + 1}</span>
              <button onClick={() => removeDescendent(d.id)} className="text-gray-400 hover:text-red-500 text-xs">✕ Eliminar</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <InputText label="Nom" value={d.nom} onChange={v => updateDescendent(d.id, 'nom', v)} />
              <InputNum label="Any de naixement" value={d.anyNaixement} onChange={v => updateDescendent(d.id, 'anyNaixement', v)} min={1900} />
              <InputNum label="Matrícules ensenyament superior (€, màx. 300 €)" value={d.matricules} onChange={v => updateDescendent(d.id, 'matricules', v)} />
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
          <h3 className="font-semibold text-gray-800 text-sm">Ascendents a càrrec</h3>
          <button
            onClick={addAscendent}
            className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition"
          >
            + Afegir ascendent
          </button>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Ascendents majors de 65 anys que conviuen amb l'obligat tributari. Reducció: 1.000 € per ascendent. Font: Art. 35.2.b Llei 5/2014.
        </p>
        {dades.ascendents.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-3">Cap ascendent afegit</p>
        )}
        {dades.ascendents.map((a, i) => (
          <div key={a.id} className="bg-gray-50 rounded-xl p-4 mb-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-gray-600">Ascendent {i + 1}</span>
              <button onClick={() => removeAscendent(a.id)} className="text-gray-400 hover:text-red-500 text-xs">✕ Eliminar</button>
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

      {/* Resum situació personal */}
      <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-4 text-sm">
        <h4 className="font-semibold text-[#009B9C] mb-2">Resum — Mínim personal aplicable</h4>
        <div className="space-y-1 text-xs text-gray-700">
          {dades.obligatDiscapacitat ? (
            <p>Mínim personal: <strong>30.000 €</strong> (discapacitat — Art. 35.1)</p>
          ) : dades.estatCivil === 'casat' && dades.conjugeRendesGenerals < 24000 ? (
            <p>Mínim personal: <strong>40.000 €</strong> (cònjuge a càrrec — Art. 35.1)</p>
          ) : (
            <p>Mínim personal: <strong>24.000 €</strong> (general — Art. 35.1)</p>
          )}
          {dades.descendents.length > 0 && (
            <p>Reduccions descendents: <strong>{(dades.descendents.length * 1000).toLocaleString('ca-AD')} €</strong> ({dades.descendents.length} × 1.000 € — Art. 35.2.a)</p>
          )}
          {dades.ascendents.length > 0 && (
            <p>Reduccions ascendents: <strong>{(dades.ascendents.length * 1000).toLocaleString('ca-AD')} €</strong> ({dades.ascendents.length} × 1.000 € — Art. 35.2.b)</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default Step1SituacioPersonal;
