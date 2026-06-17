// steps/Step6GuanysCapital.jsx — Pas 6: Guanys i perdues de capital (300-E)
import React, { useEffect } from 'react';
import RentaBlock from '../components/RentaBlock';
import AnalysisAlert from '../components/AnalysisAlert';
import { analizarGuanyCapital } from '../engine/exemptions';
import { IRPF_EF } from '../engine/constants';

// Codis oficials del formulari 300-E
const TIPUS_ELEMENT_300E = [
  { value: 'IMM', label: 'Bens immobles i drets reals (IMM)' },
  { value: 'OIC', label: 'Participacions en OIC (OIC)' },
  { value: 'COT', label: 'Participacio en fons propis cotitzats (COT)' },
  { value: 'NCT', label: 'Participacio en fons propis no cotitzats (NCT)' },
  { value: 'MOB', label: 'Bens mobles (MOB)' },
  { value: 'ALT', label: 'Altres elements patrimonials (ALT)' },
];

const DEFAULT_TRANSMISSIO = {
  id: null,
  descripcio: '',
  tipusElement: 'IMM',
  esHabitatgeHabitual: false,
  reinverteix: false,
  valorTransmissio: 0,
  valorAdquisicio: 0,
  anyAdquisicio: new Date().getFullYear(),
  anyTransmissio: new Date().getFullYear(),
  despesesTransmissio: 0,
  despesesAdquisicio: 0,
  aplicarCoeficients: true,
  participacioPct: 0,
  anysPropieta: 0,
  retencionsPagamentCompte: 0,
  // Exempció legal
  exempta: false,
  importExempt: 0,
  motivExempcio: '',
  // Devolució de capital no subjecta (Art. 27.3)
  esDevolucioCapital: false,
};

// Secció 1 del 300-E: variacions patrimonials no derivades de transmissió
const TIPUS_RENDA_SENSE_TRANSMISSIO = [
  { value: 'opcions_derivats', label: 'Opcions, derivats i altres instruments financers' },
  { value: 'premis_concursos', label: 'Premis i concursos (no exempts)' },
  { value: 'altres', label: 'Altres guanys/pèrdues no derivats de transmissió' },
];

const DEFAULT_RENDA_SENSE_TRANSMISSIO = {
  id: null,
  descripcio: '',
  tipusRenda: '',
  data: '',
  resultat: 0, // positiu = guany, negatiu = pèrdua
};

const calcularGuany = (t) => {
  const anysPropieta = (t.anyTransmissio || 0) - (t.anyAdquisicio || 0);
  let valorAdqActualitzat = t.valorAdquisicio || 0;
  if (t.tipusElement === 'IMM' && t.aplicarCoeficients) {
    const coef = IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT;
    valorAdqActualitzat = valorAdqActualitzat * coef;
  }
  const valorAdqTotal = valorAdqActualitzat + (t.despesesAdquisicio || 0);
  const valorTransTotal = (t.valorTransmissio || 0) - (t.despesesTransmissio || 0);
  const guanyNet = valorTransTotal - valorAdqTotal;
  const coefAplicat = t.tipusElement === 'IMM' && t.aplicarCoeficients
    ? (IRPF_EF.COEF_ACTUALITZACIO[anysPropieta] || IRPF_EF.COEF_ACTUALITZACIO.DEFAULT) : 1;
  return { guanyNet, valorAdqActualitzat, coefAplicat, anysPropieta };
};

// Mapeig de codis 300-E als tipus del motor d'exempcions
const mapTipusElement = (codi300E) => {
  switch (codi300E) {
    case 'IMM': return 'IMMOBLE';
    case 'OIC': return 'VALORS_OIC';
    case 'COT':
    case 'NCT': return 'VALORS_GENERALS';
    case 'MOB':
    case 'ALT': return 'ALTRES';
    default: return 'ALTRES';
  }
};

const analisiValors = (tipusElement, guanyNet, participacioPct, anysPropieta, exercici = 2025) => {
  // La branca d'exempció "participació > 25% + tinença ≥ 10 anys" la va introduir
  // la L2023005 (en vigor 1/1/2024). Per a 2023 i anteriors (text refós 9) NO existia.
  // null/undefined → comportament 2024+ (idèntic a l'actual).
  const branca10AnysActiva = (exercici == null) || exercici >= 2024;
  const refArt5k = (exercici != null && exercici < 2024)
    ? 'Art. 5.k Llei 5/2014 (text refós 9 — vigent fins 31/12/2023)'
    : 'Art. 5.k Llei 5/2014 · L2023005';
  if (tipusElement === 'OIC') {
    return {
      titol: 'Participacions OIC — Art. 5.k Llei 5/2014',
      explicacio: guanyNet <= 0
        ? 'Perdua en transmissio d\'OIC. No computa a efectes de l\'exempció.'
        : 'Exempt si participacio < 25% O tinenca >= 10 anys (CT 04/03/2015). Verificar condicions.',
      ref: 'Art. 5.k Llei 5/2014 · CT 04/03/2015',
      formulari: '300-E',
      casella: 'OIC',
      alertType: (participacioPct < 25 || anysPropieta >= 10) ? 'success' : 'warning',
    };
  }
  if (tipusElement === 'COT') {
    const esExempt = participacioPct <= 25 || (branca10AnysActiva && participacioPct > 25 && anysPropieta >= 10);
    const explicacio = participacioPct <= 25
      ? 'Participació ≤ 25%: guany EXEMPT per Art. 5.k Llei 5/2014. Podeu confirmar l\'exempció a continuació.'
      : (branca10AnysActiva && participacioPct > 25 && anysPropieta >= 10)
        ? 'Participació > 25% però tinença ≥ 10 anys: EXEMPT per Art. 5.k Llei 5/2014. Podeu confirmar l\'exempció.'
        : (!branca10AnysActiva && participacioPct > 25)
          ? `Exercici ${exercici}: participació > 25% → GRAVAT. La branca d'exempció per tinença ≥ 10 anys va ser introduïda per la L2023005 i només aplica des de l'1/1/2024 (text refós 9 vigent fins 31/12/2023).`
          : guanyNet <= 0
            ? 'Participació > 25% i tinença < 10 anys. Pèrdua: analitzar si hi ha valors homogenis (Art. 32 + Reglament).'
            : 'Participació > 25% i tinença < 10 anys: guany GRAVAT. Integrar a la base de l\'estalvi.';
    return {
      titol: 'Valors cotitzats (COT) — Art. 5.k Llei 5/2014',
      explicacio,
      ref: refArt5k,
      formulari: '300-E',
      casella: 'COT',
      alertType: esExempt ? 'success' : guanyNet <= 0 ? 'warning' : 'info',
      exempt: esExempt,
    };
  }
  if (tipusElement === 'NCT') {
    const esExempt = participacioPct <= 25 || (branca10AnysActiva && participacioPct > 25 && anysPropieta >= 10);
    const explicacio = participacioPct <= 25
      ? 'Participació ≤ 25%: guany EXEMPT per Art. 5.k Llei 5/2014. Podeu confirmar l\'exempció a continuació.'
      : (branca10AnysActiva && participacioPct > 25 && anysPropieta >= 10)
        ? 'Participació > 25% però tinença ≥ 10 anys: EXEMPT per Art. 5.k Llei 5/2014. Podeu confirmar l\'exempció.'
        : (!branca10AnysActiva && participacioPct > 25)
          ? `Exercici ${exercici}: participació > 25% → GRAVAT. La branca d'exempció per tinença ≥ 10 anys va ser introduïda per la L2023005 i només aplica des de l'1/1/2024 (text refós 9 vigent fins 31/12/2023).`
          : 'Participació > 25% i tinença < 10 anys: guany GRAVAT. Analitzar substància i vinculació societària.';
    return {
      titol: 'Participacions no cotitzades (NCT) — Art. 5.k Llei 5/2014',
      explicacio,
      ref: refArt5k,
      formulari: '300-E',
      casella: 'NCT',
      alertType: esExempt ? 'success' : 'info',
      exempt: esExempt,
    };
  }
  if (tipusElement === 'MOB') {
    return {
      titol: 'Bens mobles (MOB)',
      explicacio: 'Gravat. Import net = valor transmissio - valor adquisicio.',
      ref: 'Art. 30 Llei 5/2014',
      formulari: '300-E',
      casella: 'MOB',
      alertType: 'info',
    };
  }
  return null;
};

const InputNum = ({ label, value, onChange, min = 0 }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <input
      type="number" onWheel={e => e.target.blur()}
      min={min}
      step="0.01"
      value={value === 0 ? '' : value}
      placeholder="0"
      onChange={e => { const v = e.target.value; onChange(v === '' ? 0 : parseFloat(v) || 0); }}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
    />
  </div>
);

const TransmissioForm = ({ trans, index, onUpdate, onEliminar, exercici = 2025 }) => {
  // Accepta update('camp', valor) o update({ camp1: v1, camp2: v2 })
  const update = (campOrObj, valor) => onUpdate(trans.id, campOrObj, valor);
  const { guanyNet, valorAdqActualitzat, coefAplicat, anysPropieta } = calcularGuany(trans);

  const tipusMotor = mapTipusElement(trans.tipusElement);
  const analisi = (trans.tipusElement === 'IMM')
    ? analizarGuanyCapital({
        tipusElement: tipusMotor,
        guanyNet,
        esHabitatgeHabitual: trans.esHabitatgeHabitual,
        anysPropieta: trans.anysPropieta || anysPropieta,
        participacioPct: trans.participacioPct,
        reinverteix: trans.reinverteix,
      })
    : analisiValors(trans.tipusElement, guanyNet, trans.participacioPct, trans.anysPropieta || anysPropieta, exercici);

  return (
    <RentaBlock
      titol={trans.descripcio || `Transmissio ${index + 1}`}
      numero={index + 1}
      onEliminar={onEliminar}
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Descripcio del be transmes</label>
          <input
            type="text"
            value={trans.descripcio}
            onChange={e => update('descripcio', e.target.value)}
            placeholder="Ex: Pis carrer X, Accions empresa Y, Participacio fons Z..."
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus d'element (codi 300-E)</label>
          <select
            value={trans.tipusElement}
            onChange={e => update('tipusElement', e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            {TIPUS_ELEMENT_300E.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {trans.tipusElement === 'IMM' && (
          <>
            <div className="col-span-2 flex flex-wrap gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={trans.esHabitatgeHabitual} onChange={e => update('esHabitatgeHabitual', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                <span className="text-xs text-gray-600">Habitatge habitual</span>
              </label>
              {trans.esHabitatgeHabitual && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={trans.reinverteix} onChange={e => update('reinverteix', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                  <span className="text-xs text-gray-600">Reinverteix en nou habitatge habitual (Art. 5.r)</span>
                </label>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={trans.aplicarCoeficients} onChange={e => update('aplicarCoeficients', e.target.checked)} className="w-4 h-4 accent-[#009B9C]" />
                <span className="text-xs text-gray-600">Aplicar coeficients d'actualitzacio (Art. 26.2)</span>
              </label>
            </div>
          </>
        )}

        {trans.tipusElement === 'OIC' && (
          <>
            <InputNum label="Participacio en l'OIC (%)" value={trans.participacioPct} onChange={v => update('participacioPct', v)} />
            <InputNum label="Anys de propietat" value={trans.anysPropieta} onChange={v => update('anysPropieta', v)} />
          </>
        )}

        {(trans.tipusElement === 'COT' || trans.tipusElement === 'NCT') && (
          <div className="col-span-2 mt-1 bg-blue-50 rounded-lg p-3">
            <p className="text-xs font-medium text-blue-800 mb-2">Analisi addicional per a valors</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Participacio en el capital (%)</label>
                <input
                  type="number" onWheel={e => e.target.blur()} min="0" max="100" step="0.01"
                  value={trans.participacioPct === 0 ? '' : trans.participacioPct}
                  placeholder="0"
                  onChange={e => { const v = e.target.value; update('participacioPct', v === '' ? 0 : parseFloat(v) || 0); }}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Anys de tinenca</label>
                <input
                  type="number" onWheel={e => e.target.blur()} min="0" step="1"
                  value={trans.anysPropieta === 0 ? '' : trans.anysPropieta}
                  placeholder="0"
                  onChange={e => { const v = e.target.value; update('anysPropieta', v === '' ? 0 : parseInt(v) || 0); }}
                  className="w-full border border-gray-200 rounded px-2 py-1 text-xs mt-1 focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                />
              </div>
            </div>
          </div>
        )}

        {(trans.tipusElement === 'OIC' || trans.tipusElement === 'COT' || trans.tipusElement === 'NCT') && (
          <div className="col-span-2 flex items-center gap-2 mt-1">
            <input
              type="checkbox"
              checked={trans.esDevolucioCapital || false}
              onChange={e => update({ esDevolucioCapital: e.target.checked })}
              className="w-4 h-4 accent-[#009B9C]"
            />
            <label className="text-xs text-gray-600">
              Devolució de capital no subjecta (Art. 27.3 Llei 5/2014) — no genera guany ni pèrdua
            </label>
          </div>
        )}

        <InputNum label="Valor de transmissio (euros)" value={trans.valorTransmissio} onChange={v => update('valorTransmissio', v)} />
        <InputNum label="Valor d'adquisicio (euros)" value={trans.valorAdquisicio} onChange={v => update('valorAdquisicio', v)} />
        <InputNum label="Any d'adquisicio" value={trans.anyAdquisicio} onChange={v => update('anyAdquisicio', v)} min={1900} />
        <InputNum label="Any de transmissio" value={trans.anyTransmissio} onChange={v => update('anyTransmissio', v)} min={1900} />
        <InputNum label="Despeses de transmissio (euros)" value={trans.despesesTransmissio} onChange={v => update('despesesTransmissio', v)} />
        <InputNum label="Despeses d'adquisicio (euros)" value={trans.despesesAdquisicio} onChange={v => update('despesesAdquisicio', v)} />
        <InputNum
          label="Pagament a compte (5% transmissio immoble) — Art. 20 Reglament (euros)"
          value={trans.retencionsPagamentCompte}
          onChange={v => update('retencionsPagamentCompte', v)}
        />
      </div>

      {trans.tipusElement === 'IMM' && trans.aplicarCoeficients && anysPropieta >= 0 && (
        <div className="mt-3 bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
          Coeficient d'actualitzacio aplicat: <strong>{coefAplicat.toFixed(2)}</strong> (immoble en propietat durant <strong>{anysPropieta} anys</strong>).
          Valor d'adquisicio actualitzat: <strong>{valorAdqActualitzat.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros</strong>.
          Font: Art. 26.2 Llei 5/2014.
        </div>
      )}

      <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
        <span className="font-medium text-gray-600">Guany net calculat: </span>
        <span className={`font-bold ${guanyNet >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
          {guanyNet.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros
        </span>
      </div>

      {analisi && <AnalysisAlert analisi={analisi} />}

      {analisi && analisi.exempt === true && (
        <div className="mt-3 p-4 bg-green-50 border border-green-200 rounded-xl space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={`exempt-${trans.id}`}
              checked={trans.exempta || false}
              onChange={e => update({ exempta: e.target.checked, motivExempcio: e.target.checked ? (analisi.ref || '') : '' })}
              className="accent-green-600 w-4 h-4"
            />
            <label htmlFor={`exempt-${trans.id}`} className="text-sm font-semibold text-green-700 cursor-pointer">
              Confirmar exempció — {analisi.ref}
            </label>
          </div>
          {trans.exempta && (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Guany / pèrdua real obtinguda (€) — no computarà a la base de l'estalvi
                </label>
                <input
                  type="number" onWheel={e => e.target.blur()}
                  step="0.01"
                  value={trans.importExempt || 0}
                  onChange={e => update({ importExempt: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="w-full border border-green-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400/40"
                />
              </div>
              <div className="bg-green-100 rounded-lg px-3 py-2 text-xs text-green-800">
                ✅ Aquest import <strong>no computarà</strong> a la base de tributació de l'estalvi.
                Referència legal: <strong>{analisi.ref}</strong>
              </div>
            </>
          )}
        </div>
      )}
    </RentaBlock>
  );
};

const Step6GuanysCapital = ({ dades, update }) => {
  // Migració única de declaracions antigues: els camps escalars
  // guanysNoTransmissio / perduessNoTransmissio passen a ser entrades de la
  // llista rendesSenseTransmissio, i s'anul·len els escalars (evita que el
  // motor els sumi DOS COPS — un per l'escalar i un per la nova entrada).
  useEffect(() => {
    const g = dades.guanysNoTransmissio || 0;
    const p = dades.perduessNoTransmissio || 0;
    if (g === 0 && p === 0) return; // res a migrar
    const base = Date.now();
    const migrades = [];
    if (g !== 0) migrades.push({ ...DEFAULT_RENDA_SENSE_TRANSMISSIO, id: base, descripcio: 'Guany (migrat automàticament)', tipusRenda: 'altres', resultat: g });
    if (p !== 0) migrades.push({ ...DEFAULT_RENDA_SENSE_TRANSMISSIO, id: base + 1, descripcio: 'Pèrdua (migrada automàticament)', tipusRenda: 'altres', resultat: -p });
    update('rendesSenseTransmissio', [...(dades.rendesSenseTransmissio || []), ...migrades]);
    update('guanysNoTransmissio', 0);
    update('perduessNoTransmissio', 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addTransmissio = () => {
    update('transmissions', [
      ...dades.transmissions,
      { ...DEFAULT_TRANSMISSIO, id: Date.now() }
    ]);
  };

  const updateTransmissio = (id, campOrObj, valor) => {
    update('transmissions', dades.transmissions.map(t => {
      if (t.id !== id) return t;
      if (typeof campOrObj === 'object' && campOrObj !== null) return { ...t, ...campOrObj };
      return { ...t, [campOrObj]: valor };
    }));
  };

  const removeTransmissio = (id) => {
    update('transmissions', dades.transmissions.filter(t => t.id !== id));
  };

  // Secció 1 — llista dinàmica de rendes no derivades de transmissió
  const rendesSenseTransmissio = dades.rendesSenseTransmissio || [];
  const addRendaSense = () => {
    update('rendesSenseTransmissio', [...rendesSenseTransmissio, { ...DEFAULT_RENDA_SENSE_TRANSMISSIO, id: Date.now() }]);
  };
  const updateRendaSense = (id, camp, valor) => {
    update('rendesSenseTransmissio', rendesSenseTransmissio.map(r => r.id === id ? { ...r, [camp]: valor } : r));
  };
  const removeRendaSense = (id) => {
    update('rendesSenseTransmissio', rendesSenseTransmissio.filter(r => r.id !== id));
  };
  const totalSenseTransmissio = rendesSenseTransmissio.reduce((s, r) => s + (r.resultat || 0), 0);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">6</span>
          <div>
            <h2 className="font-bold text-gray-800">Guanys i perdues de capital</h2>
            <p className="text-xs text-gray-500">Formulari 300-E · Art. 30-32 Llei 5/2014</p>
          </div>
        </div>

        {/* Seccio 1 del 300-E: Guanys/perdues no derivats de transmissio */}
        <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                Seccio 1 — Variacions patrimonials no derivades de transmissio (300-E sec.1)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Opcions i derivats, premis no exempts, i altres guanys/pèrdues no generats per transmissió
              </p>
            </div>
            <button
              onClick={addRendaSense}
              className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition font-medium whitespace-nowrap"
            >
              + Afegir variació
            </button>
          </div>
          <div className="p-4 space-y-3">
            {rendesSenseTransmissio.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-2">Cap renda sense transmissió afegida.</p>
            )}
            {rendesSenseTransmissio.map((r, i) => (
              <div key={r.id} className="grid grid-cols-12 gap-2 items-start border border-gray-100 rounded-lg p-2">
                <div className="col-span-4">
                  <label className="block text-xs text-gray-500 mb-1">Concepte de la variació</label>
                  <input
                    type="text"
                    value={r.descripcio}
                    onChange={e => updateRendaSense(r.id, 'descripcio', e.target.value)}
                    placeholder="Ex: Rescat pla de pensions, indemnització, premi…"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                  />
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 mb-1">Tipus</label>
                  <select
                    value={r.tipusRenda}
                    onChange={e => updateRendaSense(r.id, 'tipusRenda', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                  >
                    <option value="">—</option>
                    {TIPUS_RENDA_SENSE_TRANSMISSIO.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Data</label>
                  <input
                    type="date"
                    value={r.data}
                    onChange={e => updateRendaSense(r.id, 'data', e.target.value)}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs text-gray-500 mb-1">Resultat (€)</label>
                  <input
                    type="number" onWheel={e => e.target.blur()} step="0.01"
                    value={r.resultat === 0 ? '' : r.resultat}
                    placeholder="0"
                    onChange={e => { const v = e.target.value; updateRendaSense(r.id, 'resultat', v === '' ? 0 : parseFloat(v) || 0); }}
                    className="w-full border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[#009B9C]"
                  />
                  <span className="block text-[10px] text-gray-400 mt-0.5">+ guany / − pèrdua</span>
                </div>
                <div className="col-span-1 flex items-end h-full">
                  <button onClick={() => removeRendaSense(r.id)} className="text-gray-400 hover:text-red-500 text-xs pb-1">✕</button>
                </div>
              </div>
            ))}
            {rendesSenseTransmissio.length > 0 && (
              <div className="bg-gray-50 rounded-lg p-3 text-sm flex justify-between">
                <span className="font-medium">Variació patrimonial neta (secció 1):</span>
                <span className={`font-mono ${totalSenseTransmissio >= 0 ? 'text-[#009B9C]' : 'text-red-600'}`}>
                  {totalSenseTransmissio.toFixed(2)} €
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Seccio 2 del 300-E: Guanys/perdues derivats de transmissio patrimonial */}
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-gray-700">
                Secció 2 — Guanys i pèrdues derivats de transmissió patrimonial (300-E sec.2)
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Transmissions d'immobles, accions, fons d'inversió i altres elements patrimonials
              </p>
            </div>
            <button
              onClick={addTransmissio}
              className="text-xs bg-[#009B9C] text-white px-3 py-1.5 rounded-lg hover:bg-[#007A7B] transition font-medium whitespace-nowrap"
            >
              + Afegir transmissió
            </button>
          </div>
          {dades.transmissions.length === 0 && (
            <div className="text-center py-4 text-gray-400">
              <p className="text-sm">Cap transmissió afegida.</p>
              <p className="text-xs mt-1">Afegiu les transmissions d'immobles, accions, fons d'inversió, etc.</p>
            </div>
          )}
        </div>
      </div>

      {dades.transmissions.map((trans, i) => (
        <TransmissioForm
          key={trans.id}
          trans={trans}
          index={i}
          onUpdate={updateTransmissio}
          onEliminar={() => removeTransmissio(trans.id)}
          exercici={dades?.exercici || 2025}
        />
      ))}
    </div>
  );
};

export default Step6GuanysCapital;
