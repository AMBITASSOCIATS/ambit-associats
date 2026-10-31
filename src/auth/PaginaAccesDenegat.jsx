// src/auth/PaginaAccesDenegat.jsx
import React from 'react';
import { useAuth } from './AuthContext';
import MarcAcces from './MarcAcces';

const PaginaAccesDenegat = ({ onBack }) => {
  const { perfil, logout } = useAuth();

  const estat = perfil?.estat;

  return (
    <MarcAcces onBack={onBack}>
      <div>
        <h2 className="font-display font-medium text-[24px] leading-tight text-[#12302F] mb-3">
          {estat === 'pendent'
            ? 'Sol·licitud pendent d\'aprovació'
            : 'Accés bloquejat'}
        </h2>
        <p className="text-[15px] leading-relaxed text-[#2B4644] mb-4">
          {estat === 'pendent'
            ? 'La teva sol·licitud d\'accés està sent revisada per ÀMBIT Associats. Rebràs un email quan sigui aprovada.'
            : 'El teu accés ha estat suspès. Contacta amb ÀMBIT Associats per a més informació.'}
        </p>
        <div className="text-sm text-[#4E6765] mb-6">
          info@ambit.ad · +376 655 382
        </div>
        <button
          onClick={logout}
          className="text-sm font-semibold text-[#007A7B] hover:underline underline-offset-4"
        >
          Tancar sessió
        </button>
      </div>
    </MarcAcces>
  );
};

export default PaginaAccesDenegat;
