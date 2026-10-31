// src/auth/MarcAcces.jsx
// Marc de les pantalles d'accés (Zona Professionals i portal del personal):
// la franja verda de la web amb el logotip blanc i la targeta a sobre.
import React from 'react';

const MarcAcces = ({ onBack, children }) => (
  <div className="min-h-screen bg-[#F4F8F7] font-text text-[#12302F]">
    <div className="bg-[#007A7B] h-48 sm:h-56">
      <div className="max-w-md mx-auto px-5 pt-6 sm:pt-8 flex items-start justify-between gap-4">
        <img src="/logo-blanc.png" alt="ÀMBIT Associats" width="624" height="234" className="block w-[132px] sm:w-[156px] h-auto" />
        {onBack && (
          <button onClick={onBack} className="mt-2 text-[13px] font-semibold text-[#DDF1F1] hover:text-white hover:underline underline-offset-4">
            ← Torna a la web
          </button>
        )}
      </div>
    </div>
    <div className="-mt-20 pb-10 px-4">
      <div className="max-w-md mx-auto bg-white rounded-2xl border border-[#D6E4E2] p-6 sm:p-8">
        {children}
      </div>
    </div>
  </div>
);

export default MarcAcces;
