// components/AnalysisAlert.jsx — Alerta normativa (exempt/gravat)
import React from 'react';

const AnalysisAlert = ({ analisi }) => {
  if (!analisi) return null;

  const colors = {
    success: 'bg-green-50 border-green-300 text-green-800',
    warning: 'bg-amber-50 border-amber-300 text-amber-800',
    info: 'bg-blue-50 border-blue-300 text-blue-800',
    error: 'bg-red-50 border-red-300 text-red-800',
  };
  const icons = {
    success: '✅', warning: '⚠️', info: 'ℹ️', error: '🔴'
  };

  return (
    <div className={`border rounded-xl p-4 mt-3 ${colors[analisi.alertType] || colors.info}`}>
      <div className="flex items-start gap-2">
        <span className="text-base flex-shrink-0">{icons[analisi.alertType] || icons.info}</span>
        <div className="flex-1">
          <p className="font-semibold text-sm mb-1">{analisi.titol}</p>
          <p className="text-xs leading-relaxed mb-2">{analisi.explicacio}</p>
          <div className="flex flex-wrap gap-3 text-xs">
            <span className="font-mono bg-white/60 px-2 py-0.5 rounded">
              📖 {analisi.ref}
            </span>
            {analisi.formulari && (
              <span className="font-mono bg-white/60 px-2 py-0.5 rounded">
                📋 {analisi.formulari} — casella {analisi.casella}
              </span>
            )}
            {analisi.parcial && (
              <span className="font-semibold">
                Exempt: {analisi.importExempt?.toFixed(2)} € |
                Gravat: {analisi.importGravat?.toFixed(2)} €
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AnalysisAlert;
