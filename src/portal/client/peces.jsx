// src/portal/client/peces.jsx
// Peces visuals de l'àrea de client (mateix estil que les pàgines del client:
// català amb l'anglès a sota, en cursiva).
import React from 'react';

export const Bi = ({ t, className = '', petit = false }) => (
  <span className={`block ${className}`}>
    <span className={`block ${petit ? 'text-sm' : 'text-[15px]'} text-[#12302F]`}>{t.ca}</span>
    <span className="block text-xs italic text-[#4E6765] mt-0.5">{t.en}</span>
  </span>
);

// Missatges del servidor "català / anglès": en dues línies
export const MissatgeError = ({ missatge }) => {
  if (!missatge) return null;
  const [ca, ...en] = String(missatge).split(' / ');
  return (
    <div className="border border-red-200 bg-red-50 rounded-lg px-3 py-2 text-red-700">
      <p className="text-sm">{ca}</p>
      {en.length > 0 && <p className="text-xs italic mt-0.5">{en.join(' / ')}</p>}
    </div>
  );
};

export const Boto = ({ children, secundari = false, ...p }) => (
  <button type="button" {...p}
    className={`${secundari ? 'bg-[#EAF2F0] hover:bg-[#DCE9E6] text-[#2B4644]' : 'bg-[#007A7B] hover:bg-[#00676A] text-white'} font-semibold px-6 py-2.5 rounded-full text-sm transition disabled:opacity-50`}>
    {children}
  </button>
);

export const estilCamp = 'w-full bg-[#F7FBFA] border border-[#B9D3CF] rounded-lg px-3 py-2 text-[15px] text-[#12302F] focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40 disabled:opacity-70';

export const Camp = ({ t, ajuda, children }) => (
  <label className="block">
    <span className="block text-sm font-semibold text-[#2B4644]">{t.ca}</span>
    <span className="block text-xs italic text-[#4E6765] mb-1">{t.en}</span>
    {children}
    {ajuda && <span className="block text-[11px] text-[#6B8280] mt-1">{ajuda.ca}{ajuda.en && <span className="italic"> / {ajuda.en}</span>}</span>}
  </label>
);

