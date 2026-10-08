// src/portal/ui.jsx
// Peces visuals comunes del panell del portal (mateix estil que el panell del maestro).
import React from 'react';
import { ESTATS, nomEstat } from './portalApi';

export const Boto = ({ variant = 'primari', className = '', ...props }) => {
  const estils = {
    primari: 'bg-[#009B9C] hover:bg-[#007A7B] text-white',
    secundari: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
    perill: 'bg-red-100 hover:bg-red-200 text-red-700',
    exit: 'bg-green-500 hover:bg-green-600 text-white',
  };
  return (
    <button type="button" {...props}
      className={`px-3 py-2 text-xs font-semibold rounded-lg transition disabled:opacity-50 ${estils[variant]} ${className}`} />
  );
};

export const Targeta = ({ titol, accions, children, className = '' }) => (
  <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
    {(titol || accions) && (
      <div className="flex items-center justify-between gap-3 mb-4">
        {titol && <h3 className="text-sm font-bold text-gray-800">{titol}</h3>}
        {accions}
      </div>
    )}
    {children}
  </div>
);

export const Entrada = ({ etiqueta, ajuda, className = '', ...props }) => (
  <label className={`block ${className}`}>
    {etiqueta && <span className="block text-xs font-semibold text-gray-600 mb-1">{etiqueta}</span>}
    <input {...props}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40 disabled:bg-gray-50" />
    {ajuda && <span className="block text-[11px] text-gray-400 mt-1">{ajuda}</span>}
  </label>
);

export const Selector = ({ etiqueta, children, className = '', ...props }) => (
  <label className={`block ${className}`}>
    {etiqueta && <span className="block text-xs font-semibold text-gray-600 mb-1">{etiqueta}</span>}
    <select {...props}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40">
      {children}
    </select>
  </label>
);

export const EtiquetaEstat = ({ estat, tipus }) => (
  <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTATS[estat]?.color || ''}`}>
    {nomEstat(estat, tipus)}
  </span>
);

export const Avis = ({ tipus = 'error', children }) => {
  if (!children) return null;
  const estils = {
    error: 'bg-red-50 border-red-200 text-red-700',
    ok: 'bg-green-50 border-green-200 text-green-700',
    info: 'bg-blue-50 border-blue-200 text-blue-700',
  };
  return <div className={`border rounded-lg p-3 text-xs ${estils[tipus]}`}>{children}</div>;
};

export const Dada = ({ etiqueta, children }) => (
  <div>
    <dt className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{etiqueta}</dt>
    <dd className="text-sm text-gray-800 mt-0.5 break-words">{children || '—'}</dd>
  </div>
);
