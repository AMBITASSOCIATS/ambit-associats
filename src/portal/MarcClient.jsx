// src/portal/MarcClient.jsx
// Marc comú de les pàgines que obre el client (autorització, KYC, IRPF i contractes):
// la franja verda de la web amb el logotip blanc i el document a sobre.
// Sense logotip quan el document es gestiona en nom d'un altre (comunicació IRPF del pagador).
import React from 'react';

const MarcClient = ({ logotip = true, children }) => (
  <div className="min-h-screen bg-[#F4F8F7] font-text text-[#12302F]">
    <div className="bg-[#007A7B] h-40 sm:h-44 print:hidden">
      <div className="max-w-3xl mx-auto px-5 sm:px-3 pt-6 sm:pt-8">
        {logotip && (
          <img src="/logo-blanc.png" alt="ÀMBIT Associats" width="624" height="234" className="block w-[132px] sm:w-[156px] h-auto" />
        )}
      </div>
    </div>
    <div className="-mt-14 pb-10 px-3 print:mt-0">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl border border-[#D6E4E2] px-4 sm:px-10 py-8">
        {children}
      </div>
    </div>
  </div>
);

export default MarcClient;
