// steps/Step7DDI.jsx — Pas 7: Deduccio per doble imposicio internacional (Art. 48.4)
// Càlcul PAÍS PER PAÍS: una entrada per cada renda estrangera (país + tipus de renda).
import React from 'react';
import RentaBlock from '../components/RentaBlock';
import AnalysisAlert from '../components/AnalysisAlert';
import { PAISOS, CDI_RATES } from '../engine/cdiRates';
import { calcularDDI } from '../engine/exemptions';

const DEFAULT_RENDA_ESTRANGERA = {
  id: null,
  pais: '',            // selector de país/CDI
  tipusRenda: '',      // 'dividends', 'interessos', 'canons', 'guanys_capital', 'altres'
  importBrut: 0,       // renda bruta obtinguda
  retencioEfectiva: 0, // retenció practicada efectivament a l'origen
  tensCDI: false,      // si hi ha CDI vigent amb aquest país
  tipusMaxCDI: 0,      // tipus màxim de retenció del CDI (%) per aquest tipus de renda
  paisLliure: '',      // nom lliure del país quan no hi ha CDI (codi 'OTHER')
};

const TIPUS_RENDA = [
  { value: 'dividends', label: 'Dividends' },
  { value: 'interessos', label: 'Interessos' },
  { value: 'canons', label: 'Cànons' },
  { value: 'guanys_capital', label: 'Guanys de capital' },
  { value: 'altres', label: 'Altres rendes' },
];

const TIPUS_LABEL = TIPUS_RENDA.reduce((m, t) => { m[t.value] = t.label; return m; }, {});

// Tipus màxim de retenció (%) que el CDI permet a l'origen, segons el tipus de renda.
const cdiMaxPerTipus = (codiPais, tipusRenda) => {
  const rates = CDI_RATES[codiPais];
  if (!rates) return 0;
  const v = {
    dividends: rates.dividends_general,
    interessos: rates.interessos,
    canons: rates.canons,
    guanys_capital: rates.plusvalues_accions,
    altres: null,
  }[tipusRenda];
  return typeof v === 'number' ? Math.round(v * 100) : 0;
};

const InputNum = ({ label, value, onChange, min = 0, sufix }) => (
  <div>
    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
    <div className="relative">
      <input
        type="number" onWheel={e => e.target.blur()}
        min={min}
        step="0.01"
        value={value === 0 ? '' : value}
        placeholder="0"
        onChange={e => { const v = e.target.value; onChange(v === '' ? 0 : parseFloat(v) || 0); }}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
      />
      {sufix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{sufix}</span>}
    </div>
  </div>
);

const RendaEstrangeraForm = ({ renda, index, onUpdate, onEliminar }) => {
  const update = (camp, valor) => onUpdate(renda.id, { ...renda, [camp]: valor });

  // En canviar de país: marcar tensCDI segons el conveni i prefixar el tipus màxim CDI.
  const onPaisChange = (codi) => {
    const pais = PAISOS.find(p => p.codi === codi);
    const tensCDI = !!pais?.cdi;
    onUpdate(renda.id, {
      ...renda,
      pais: codi,
      tensCDI,
      tipusMaxCDI: tensCDI ? cdiMaxPerTipus(codi, renda.tipusRenda) : 0,
    });
  };

  // En canviar el tipus de renda: re-prefixar el tipus màxim CDI si hi ha conveni.
  const onTipusChange = (tipus) => {
    onUpdate(renda.id, {
      ...renda,
      tipusRenda: tipus,
      tipusMaxCDI: renda.tensCDI ? cdiMaxPerTipus(renda.pais, tipus) : renda.tipusMaxCDI,
    });
  };

  const ddiInfo = calcularDDI([renda])[0];

  const nomPais = renda.pais === 'OTHER' && renda.paisLliure
    ? renda.paisLliure
    : PAISOS.find(p => p.codi === renda.pais)?.nom || renda.pais || 'País sense especificar';

  const analisi = ddiInfo ? {
    titol: `DDI — ${nomPais}`,
    explicacio: ddiInfo.explicacio,
    ref: ddiInfo.ref,
    formulari: '300-G',
    casella: 'DDI',
    alertType: ddiInfo.teCDI ? 'success' : 'info',
    parcial: false,
  } : null;

  const titol = (
    renda.pais === 'OTHER' && renda.paisLliure
      ? renda.paisLliure
      : PAISOS.find(p => p.codi === renda.pais)?.nom || 'Renda estrangera'
  ) + (renda.tipusRenda ? ` — ${TIPUS_LABEL[renda.tipusRenda]}` : '');

  return (
    <RentaBlock titol={titol} numero={index + 1} onEliminar={onEliminar}>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">País d'origen</label>
          <select
            value={renda.pais}
            onChange={e => onPaisChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="">— Selecciona país —</option>
            {PAISOS.map(p => (
              <option key={p.codi} value={p.codi}>
                {p.nom}{p.cdi ? ' (CDI)' : ''}
              </option>
            ))}
          </select>
        </div>

        {!renda.tensCDI && renda.pais === 'OTHER' && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nom del país (sense CDI amb Andorra)
            </label>
            <input
              type="text"
              value={renda.paisLliure || ''}
              onChange={e => update('paisLliure', e.target.value)}
              placeholder="Ex: Austràlia, Brasil, Estats Units..."
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
            />
            <p className="text-xs text-gray-400 mt-1">
              Sense CDI, la DDI = mínim entre la retenció efectiva i el 10% andorrà (Art. 48.1 Llei 5/2014).
            </p>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Tipus de renda</label>
          <select
            value={renda.tipusRenda}
            onChange={e => onTipusChange(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="">— Selecciona tipus —</option>
            {TIPUS_RENDA.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <InputNum
          label="Renda bruta obtinguda (euros)"
          value={renda.importBrut}
          onChange={v => update('importBrut', v)}
        />
        <InputNum
          label="Retenció efectiva a l'origen (euros)"
          value={renda.retencioEfectiva}
          onChange={v => update('retencioEfectiva', v)}
        />

        <div className="flex items-center gap-2 pt-1">
          <input
            id={`cdi-${renda.id}`}
            type="checkbox"
            checked={renda.tensCDI}
            onChange={e => update('tensCDI', e.target.checked)}
            className="w-4 h-4 accent-[#009B9C]"
          />
          <label htmlFor={`cdi-${renda.id}`} className="text-xs font-medium text-gray-600">
            Hi ha CDI vigent amb aquest país
          </label>
        </div>
        {renda.tensCDI && (
          <InputNum
            label="Tipus màxim de retenció del CDI (%)"
            value={renda.tipusMaxCDI}
            onChange={v => update('tipusMaxCDI', v)}
            sufix="%"
          />
        )}
      </div>

      {ddiInfo && (
        <div className="mt-3 bg-gray-50 rounded-lg p-3 text-xs">
          <div className="grid grid-cols-4 gap-2">
            <div>
              <span className="text-gray-500">Impost estranger computable:</span>
              <p className="font-bold text-gray-800">{ddiInfo.impostEtopat.toFixed(2)} €</p>
            </div>
            <div>
              <span className="text-gray-500">Límit quota andorrana (10%):</span>
              <p className="font-bold text-gray-800">{ddiInfo.quotaAndorrana.toFixed(2)} €</p>
            </div>
            {renda.tensCDI && ddiInfo.excesCDI > 0 && (
              <div>
                <span className="text-gray-500">Excés no computable:</span>
                <p className="font-bold text-red-600">{ddiInfo.excesCDI.toFixed(2)} €</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">DDI aplicable:</span>
              <p className="font-bold text-[#009B9C]">{ddiInfo.ddi.toFixed(2)} €</p>
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
      { ...DEFAULT_RENDA_ESTRANGERA, id: Date.now() }
    ]);
  };

  const updateRenda = (id, rendaActualitzada) => {
    update('rendesExterior', dades.rendesExterior.map(r => r.id === id ? rendaActualitzada : r));
  };

  const removeRenda = (id) => {
    update('rendesExterior', dades.rendesExterior.filter(r => r.id !== id));
  };

  // Detectar retencions a l'origen del pas 5 (capital mobiliari).
  // Nova estructura: cada partida té `linies`; compatibilitat cap enrere amb valors directes.
  const retencionsOrigenMobiliaris = (dades.mobiliaris || []).flatMap(entitat =>
    (entitat.partides || []).flatMap(p => {
      const linies = p.linies || [{ concepte: '', importBrut: p.importBrut, retencioOrigen: p.retencioOrigen }];
      return linies
        .filter(l => (l.retencioOrigen || 0) > 0)
        .map(l => ({
          descripcio: `${entitat.entitat || 'Entitat'} — partida ${p.tipus.toUpperCase()}${l.concepte ? ' · ' + l.concepte : ''}`,
          retencioOrigen: l.retencioOrigen,
          importBrut: l.importBrut,
        }));
    })
  );
  const totalRetOrigenMobiliaris = retencionsOrigenMobiliaris.reduce((a, r) => a + r.retencioOrigen, 0);

  const importarDesMobiliaris = () => {
    const noves = retencionsOrigenMobiliaris.map(r => ({
      ...DEFAULT_RENDA_ESTRANGERA,
      id: Date.now() + Math.random(),
      pais: '',
      tipusRenda: 'dividends',
      importBrut: r.importBrut,
      retencioEfectiva: r.retencioOrigen,
      tensCDI: false,
      tipusMaxCDI: 0,
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
              <p className="text-xs text-gray-500">Art. 48.4 Llei 5/2014 (mod. L2023005) · Convenis de doble imposicio</p>
            </div>
          </div>
          <button
            onClick={addRenda}
            className="text-sm bg-[#009B9C] text-white px-4 py-2 rounded-xl hover:bg-[#007A7B] transition font-medium"
          >
            + Afegir renda estrangera
          </button>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700 mb-4">
          <strong>Art. 48.4 Llei 5/2014 (mod. L2023005):</strong> la DDI es calcula <strong>país per país</strong>. Per a cada renda, DDI = mínim entre (a) l'impost estranger efectiu —topat al tipus màxim del CDI quan n'hi ha— i (b) la quota andorrana (10%) sobre aquella renda. Les rendes sense retenció efectiva no generen DDI ni entren a la base del límit.
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
                  Importeu-les aqui i completeu el país i el CDI per declarar la DDI corresponent.
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
            <p className="text-sm">Cap renda estrangera afegida.</p>
            <p className="text-xs mt-1">Afegiu una entrada per cada renda obtinguda a l'estranger (país i tipus de renda).</p>
          </div>
        )}

        {dades.rendesExterior.length > 0 && (
          <div className="bg-[#009B9C]/5 border border-[#009B9C]/20 rounded-xl p-3 text-sm">
            <span className="font-semibold text-[#009B9C]">Total DDI deduible (suma país per país): </span>
            <span className="font-bold text-gray-800">
              {totalDDI.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} euros
            </span>
          </div>
        )}
      </div>

      {dades.rendesExterior.map((renda, i) => (
        <RendaEstrangeraForm
          key={renda.id}
          renda={renda}
          index={i}
          onUpdate={updateRenda}
          onEliminar={() => removeRenda(renda.id)}
        />
      ))}

      {ddiResults.length > 0 && totalDDI > 0 && (
        <div className="bg-white rounded-2xl border border-[#009B9C]/30 shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-8 h-8 rounded-full bg-[#009B9C]/10 text-[#009B9C] text-sm font-bold flex items-center justify-center">Σ</span>
            <div>
              <h3 className="font-bold text-gray-800">Resum DDI — país per país</h3>
              <p className="text-xs text-gray-500">Art. 48.4 Llei 5/2014 · Càlcul detallat</p>
            </div>
          </div>

          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 text-gray-500 font-medium">País</th>
                <th className="text-left py-2 text-gray-500 font-medium">Tipus renda</th>
                <th className="text-right py-2 text-gray-500 font-medium">Renda bruta</th>
                <th className="text-right py-2 text-gray-500 font-medium">Ret. efectiva</th>
                <th className="text-right py-2 text-gray-500 font-medium">Límit 10% AND</th>
                {ddiResults.some(r => r.excesCDI > 0) && (
                  <th className="text-right py-2 text-gray-500 font-medium">Excés CDI</th>
                )}
                <th className="text-right py-2 text-[#009B9C] font-bold">DDI</th>
              </tr>
            </thead>
            <tbody>
              {ddiResults.map((r, i) => {
                const renda = dades.rendesExterior[i];
                const nomPais = renda?.pais === 'OTHER' && renda?.paisLliure
                  ? renda.paisLliure
                  : PAISOS.find(p => p.codi === renda?.pais)?.nom || renda?.pais || '—';
                return (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="py-2 text-gray-700">
                      {nomPais}
                      {renda?.tensCDI && (
                        <span className="ml-1 text-green-600 text-xs">(CDI)</span>
                      )}
                    </td>
                    <td className="py-2 text-gray-600">
                      {TIPUS_LABEL[renda?.tipusRenda] || '—'}
                    </td>
                    <td className="py-2 text-right font-mono text-gray-700">
                      {(renda?.importBrut || 0).toFixed(2)} €
                    </td>
                    <td className="py-2 text-right font-mono text-gray-700">
                      {(renda?.retencioEfectiva || 0).toFixed(2)} €
                    </td>
                    <td className="py-2 text-right font-mono text-gray-700">
                      {r.quotaAndorrana.toFixed(2)} €
                    </td>
                    {ddiResults.some(d => d.excesCDI > 0) && (
                      <td className="py-2 text-right font-mono text-red-500">
                        {r.excesCDI > 0 ? `${r.excesCDI.toFixed(2)} €` : '—'}
                      </td>
                    )}
                    <td className="py-2 text-right font-mono font-bold text-[#009B9C]">
                      {r.ddi.toFixed(2)} €
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#009B9C]">
                <td colSpan={ddiResults.some(r => r.excesCDI > 0) ? 6 : 5}
                  className="py-2 font-bold text-gray-800">
                  TOTAL DDI deduïble (300-G)
                </td>
                <td className="py-2 text-right font-mono font-bold text-[#009B9C] text-sm">
                  {totalDDI.toLocaleString('ca-AD', { minimumFractionDigits: 2 })} €
                </td>
              </tr>
            </tfoot>
          </table>

          {ddiResults.some(r => r.excesCDI > 0) && (
            <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
              ⚠️ <strong>Excés de retenció sobre el tipus CDI:</strong> l'import que supera el tipus màxim del conveni és reclamable al país d'origen, no deduïble a Andorra.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Step7DDI;
