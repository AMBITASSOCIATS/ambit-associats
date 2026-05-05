// steps/Step9Liquidacio.jsx — Pas 9: Liquidació i informe (300-L)
import React from 'react';
import { generarCaselles300L } from '../engine/liquidacioEngine';

const fmt = n => {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toLocaleString('ca-AD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const CasellaRow = ({ casella, descripcio, valor, destacat }) => {
  const negatiu = typeof valor === 'number' && valor < 0;
  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${
      destacat ? 'bg-[#009B9C]/10 font-semibold' : 'hover:bg-gray-50'
    }`}>
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-gray-500 w-16 text-right flex-shrink-0">{casella}</span>
        <span className={`text-sm ${destacat ? 'text-gray-800' : 'text-gray-600'}`}>{descripcio}</span>
      </div>
      <span className={`font-mono text-sm font-semibold flex-shrink-0 ml-4 ${
        destacat ? 'text-[#009B9C]' : negatiu ? 'text-red-500' : 'text-gray-800'
      }`}>
        {fmt(valor)}
      </span>
    </div>
  );
};

const Step9Liquidacio = ({ dades, resultat, clientNom, exercici }) => {
  if (!resultat) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 text-center">
        <p className="text-gray-500">Introdueix dades als passos anteriors per generar la liquidació.</p>
      </div>
    );
  }

  const caselles = generarCaselles300L(resultat);
  const r = resultat;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Capçalera */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-8 h-8 rounded-full bg-[#009B9C] text-white text-sm font-bold flex items-center justify-center">9</span>
          <div>
            <h2 className="font-bold text-gray-800">Liquidació i informe — Formulari 300-L</h2>
            <p className="text-xs text-gray-500">Resum complet de la liquidació IRPF {exercici}</p>
          </div>
        </div>

        {clientNom && (
          <div className="bg-gray-50 rounded-xl px-4 py-2 text-sm text-gray-600 mb-4">
            <strong>Client:</strong> {clientNom} | <strong>Exercici:</strong> {exercici}
          </div>
        )}

        {/* Full 300-L */}
        <div className="space-y-1">
          {caselles.map((c, i) => (
            <CasellaRow
              key={i}
              casella={c.casella}
              descripcio={c.descripcio}
              valor={c.valor}
              destacat={c.destacat}
            />
          ))}
        </div>
      </div>

      {/* Resultat final destacat */}
      <div className={`rounded-2xl p-6 text-center ${
        r.resultatDeclaracio > 0
          ? 'bg-red-50 border-2 border-red-300'
          : r.resultatDeclaracio < 0
            ? 'bg-green-50 border-2 border-green-300'
            : 'bg-gray-50 border-2 border-gray-200'
      }`}>
        <p className="text-sm font-semibold text-gray-600 mb-2">RESULTAT DE LA DECLARACIÓ</p>
        <p className={`text-3xl font-bold mb-2 ${
          r.resultatDeclaracio > 0 ? 'text-red-600'
          : r.resultatDeclaracio < 0 ? 'text-green-600'
          : 'text-gray-700'
        }`}>
          {fmt(Math.abs(r.resultatDeclaracio))}
        </p>
        <p className={`text-lg font-semibold ${
          r.resultatDeclaracio > 0 ? 'text-red-700'
          : r.resultatDeclaracio < 0 ? 'text-green-700'
          : 'text-gray-600'
        }`}>
          {r.resultatDeclaracio > 0 ? 'A INGRESSAR'
          : r.resultatDeclaracio < 0 ? 'A RETORNAR'
          : 'RESULTAT ZERO'}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          Tipus efectiu: <strong>{((r.tipusEfectiu || 0) * 100).toFixed(2)}%</strong>
          {' '} | Quota final: <strong>{fmt(r.quotaFinal)}</strong>
        </p>
      </div>

      {/* DDI detall */}
      {r.ddiDetall && r.ddiDetall.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
          <h3 className="font-semibold text-gray-800 mb-3 text-sm">Detall DDI — Art. 48</h3>
          {r.ddiDetall.map((d, i) => (
            <div key={i} className="bg-blue-50 rounded-xl p-3 mb-2 text-xs text-blue-800">
              <div className="flex justify-between mb-1">
                <span className="font-semibold">{d.pais} — {d.tipusRenda}</span>
                <span className="font-bold text-[#009B9C]">DDI: {fmt(d.ddi)}</span>
              </div>
              <p className="text-blue-600">{d.explicacio}</p>
            </div>
          ))}
        </div>
      )}

      {/* Formularis necessaris */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
        <h3 className="font-semibold text-gray-800 mb-3 text-sm">Formularis a presentar al Portal Tributari</h3>
        <div className="grid grid-cols-2 gap-2 text-xs">
          {[
            { codi: '300-A', desc: 'Situació personal i familiar', actiu: true },
            { codi: '300-B', desc: 'Rendes del treball i capital immobiliari', actiu: (dades.rendesTreball?.length > 0 || dades.immobles?.length > 0) },
            { codi: '300-C', desc: 'Activitats econòmiques', actiu: dades.activitats?.length > 0 },
            { codi: '300-D', desc: 'Capital mobiliari', actiu: dades.mobiliaris?.length > 0 },
            { codi: '300-E', desc: 'Guanys i pèrdues de capital', actiu: dades.transmissions?.length > 0 },
            { codi: '300-G', desc: 'Deducció doble imposició', actiu: dades.rendesExterior?.length > 0 },
            { codi: '300-L', desc: 'Liquidació', actiu: true },
          ].map(f => (
            <div key={f.codi} className={`flex items-center gap-2 p-2 rounded-lg ${
              f.actiu ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-400'
            }`}>
              <span className={`font-mono font-bold ${f.actiu ? 'text-green-600' : 'text-gray-300'}`}>{f.codi}</span>
              <span>{f.desc}</span>
              {f.actiu && <span className="ml-auto text-green-500">✓</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Botó informe */}
      <div className="no-print">
        <button
          onClick={handlePrint}
          className="w-full bg-[#009B9C] hover:bg-[#007A7B] text-white font-semibold py-3 px-6 rounded-xl transition flex items-center justify-center gap-2"
        >
          <span>🖨️</span>
          Generar informe professional (Impressió / PDF)
        </button>
        <p className="text-xs text-gray-400 text-center mt-2">
          Utilitza la funció d'impressió del navegador per desar com a PDF. Seleccioneu "Desar com a PDF" a les opcions d'impressió.
        </p>
      </div>

      {/* Contingut informe per impressió */}
      <div className="informe-print hidden print:block">
        <div style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
          <h2 style={{ color: '#007A7B', borderBottom: '1px solid #007A7B', paddingBottom: '4px' }}>
            ÀMBIT Associats — Eina Fiscal IRPF {exercici}
          </h2>
          <p><strong>Client:</strong> {clientNom || '—'} | <strong>Exercici:</strong> {exercici} | <strong>Data:</strong> {new Date().toLocaleDateString('ca-AD')}</p>

          <h2 style={{ color: '#007A7B', borderBottom: '1px solid #007A7B', paddingBottom: '4px', marginTop: '16px' }}>
            Full de liquidació 300-L
          </h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {caselles.map((c, i) => (
                <tr key={i} style={{ backgroundColor: c.destacat ? '#e6f7f7' : 'transparent' }}>
                  <td style={{ padding: '3px 6px', fontFamily: 'monospace', fontSize: '10px', color: '#666', width: '60px' }}>{c.casella}</td>
                  <td style={{ padding: '3px 6px', fontSize: '11px' }}>{c.descripcio}</td>
                  <td style={{ padding: '3px 6px', textAlign: 'right', fontFamily: 'monospace', fontWeight: c.destacat ? 'bold' : 'normal' }}>
                    {fmt(c.valor)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p style={{ marginTop: '20px', fontSize: '9px', color: '#666', fontStyle: 'italic' }}>
            Avís legal: Informe elaborat per ÀMBIT Associats en base a la informació facilitada. No substitueix l'assessorament fiscal personalitzat. Llei 5/2014 · L2023005 · L2025005 · Reglament 29/12/2023.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Step9Liquidacio;
