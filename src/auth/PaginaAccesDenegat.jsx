// src/auth/PaginaAccesDenegat.jsx
import React from 'react';
import { useAuth } from './AuthContext';

const PaginaAccesDenegat = () => {
  const { perfil, logout } = useAuth();

  const estat = perfil?.estat;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#007A7B] to-[#009B9C] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md text-center p-8">
        <div className="text-5xl mb-4">
          {estat === 'pendent' ? '⏳' : '🚫'}
        </div>
        <h2 className="text-xl font-bold text-gray-800 mb-3">
          {estat === 'pendent'
            ? 'Sol·licitud pendent d\'aprovació'
            : 'Accés bloquejat'}
        </h2>
        <p className="text-sm text-gray-500 mb-6">
          {estat === 'pendent'
            ? 'La teva sol·licitud d\'accés està sent revisada per ÀMBIT Associats. Rebràs un email quan sigui aprovada.'
            : 'El teu accés ha estat suspès. Contacta amb ÀMBIT Associats per a més informació.'}
        </p>
        <div className="text-xs text-gray-400 mb-6">
          info@ambit.ad · +376 655 382
        </div>
        <button
          onClick={logout}
          className="text-sm text-[#009B9C] hover:underline"
        >
          Tancar sessió
        </button>
      </div>
    </div>
  );
};

export default PaginaAccesDenegat;
