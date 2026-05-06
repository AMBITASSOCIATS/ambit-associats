// components/SummaryPanel.jsx — Panell resum lateral sempre visible
import React from 'react';

const fmt = n => {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toLocaleString('ca-AD', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
};

const Row = ({ label, value, bold }) => (
  <div className={`flex justify-between ${bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>
    <span>{label}</span>
    <span className="font-mono">{value}</span>
  </div>
);

const SummaryPanel = ({ resultat, pas }) => {
  if (!resultat) return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow p-5 sticky top-20">
      <div className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] -mx-5 -mt-5 px-4 py-3 rounded-t-2xl mb-4">
        <h3 className="font-bold text-sm text-white">Resum provisional</h3>
        <p className="text-white/70 text-xs">S'actualitza en temps real</p>
      </div>
      <p className="text-gray-400 text-sm text-center py-4">
        Introdueix dades per veure el resum
      </p>
    </div>
  );

  const r = resultat;
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow overflow-hidden sticky top-20">
      <div className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] px-4 py-3 text-white">
        <h3 className="font-bold text-sm">Resum provisional</h3>
        <p className="text-white/70 text-xs">S'actualitza en temps real</p>
      </div>
      <div className="p-4 space-y-2 text-sm">
        <Row label="Renda del treball" value={fmt(r.rendaTreball)} />
        <Row label="Activitats econòmiques" value={fmt(r.rendaActivitat)} />
        <Row label="Capital immobiliari" value={fmt(r.rendaImmobiliaria)} />
        <div className="border-t pt-2 font-semibold">
          <Row label="BTG" value={fmt(r.baseTributacioGeneral)} bold />
        </div>
        <Row label="Capital mobiliari" value={fmt(r.rendaMobiliaria)} />
        <Row label="Guanys capital" value={fmt(r.guanysCapital)} />
        <div className="border-t pt-2">
          <Row label="BTE" value={fmt(r.baseTributacioEstalvi)} bold />
        </div>
        <div className="border-t pt-2">
          <Row label="Total reduccions" value={`− ${fmt(r.totalReduccions)}`} />
          <Row label="BLG" value={fmt(r.baseLiquidacioGeneral)} bold />
          <Row label="BLE" value={fmt(r.baseLiquidacioEstalvi)} bold />
        </div>
        <div className="border-t pt-2">
          <Row label="Quota tributació (10%)" value={fmt(r.quotaTributacio)} />
          {r.bonificacio > 0 && <Row label="Bonificació Art.46 (−)" value={`− ${fmt(r.bonificacio)}`} />}
          {r.ddi > 0 && <Row label="DDI (−)" value={`− ${fmt(r.ddi)}`} />}
        </div>
        <div className="mt-3 bg-[#009B9C]/10 rounded-xl p-3 text-center">
          <p className="text-xs text-gray-500 mb-1">QUOTA FINAL</p>
          <p className="text-2xl font-bold text-[#009B9C]">{fmt(r.quotaFinal)}</p>
          <p className="text-xs text-gray-400">
            Tipus efectiu: {((r.tipusEfectiu || 0) * 100).toFixed(2)}%
          </p>
        </div>
        {r.retencions > 0 && (
          <div className="text-center">
            <p className="text-xs text-gray-500">Retencions: − {fmt(r.retencions)}</p>
            <p className={`font-bold ${r.resultatDeclaracio > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {r.resultatDeclaracio > 0 ? 'A INGRESSAR' : 'A RETORNAR'}:&nbsp;
              {fmt(Math.abs(r.resultatDeclaracio))}
            </p>
          </div>
        )}
      </div>
      {pas && (
        <div className="px-4 pb-3">
          <div className="flex gap-0.5">
            {[1,2,3,4,5,6,7,8,9,10].map(p => (
              <div
                key={p}
                className={`h-1 flex-1 rounded-full ${p <= pas ? 'bg-[#009B9C]' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-1 text-center">Pas {pas} de 10</p>
        </div>
      )}
    </div>
  );
};

export default SummaryPanel;
