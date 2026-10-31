// src/auth/CapcaleraEina.jsx
// Capçalera de les eines internes (Zona Professionals, panell del maestro):
// franja verda amb el logotip blanc, el nom de l'eina i les accions a la dreta.
import React from 'react';

export const botoCapcalera = 'text-[13px] font-semibold text-white border border-white/40 hover:bg-white/10 px-4 py-2 rounded-full transition';

const CapcaleraEina = ({ titol, subtitol, accions }) => (
  <header className="bg-[#007A7B] text-white font-text print:hidden">
    <div className="max-w-6xl mx-auto px-5 md:px-10 py-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
      <div className="flex items-center gap-4 sm:gap-5 min-w-0">
        <img src="/logo-blanc.png" alt="ÀMBIT Associats" width="624" height="234" className="block w-[96px] sm:w-[108px] h-auto shrink-0" />
        <div className="min-w-0 border-l border-white/30 pl-4 sm:pl-5">
          <h1 className="font-display font-medium text-[18px] sm:text-[20px] leading-tight">{titol}</h1>
          {subtitol && <p className="text-[13px] text-[#BFE4E4] mt-0.5">{subtitol}</p>}
        </div>
      </div>
      {accions && <div className="flex flex-wrap items-center gap-2">{accions}</div>}
    </div>
  </header>
);

export default CapcaleraEina;
