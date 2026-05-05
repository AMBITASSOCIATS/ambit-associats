// components/WizardNav.jsx — Barra de progrés del wizard
import React from 'react';

const WizardNav = ({ steps, pasActual, onNavegar }) => (
  <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
    <div className="container mx-auto max-w-7xl px-4">
      <div className="flex overflow-x-auto py-3 gap-1">
        {steps.map((step) => {
          const estat = step.id < pasActual ? 'complet'
                      : step.id === pasActual ? 'actiu' : 'pendent';
          return (
            <button
              key={step.id}
              onClick={() => onNavegar(step.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs
                font-medium whitespace-nowrap flex-shrink-0 transition
                ${estat === 'complet' ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : estat === 'actiu' ? 'bg-[#009B9C] text-white shadow-sm'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-50'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center
                text-xs font-bold flex-shrink-0
                ${estat === 'complet' ? 'bg-green-500 text-white'
                : estat === 'actiu' ? 'bg-white text-[#009B9C]'
                : 'bg-gray-200 text-gray-500'}`}>
                {estat === 'complet' ? '✓' : step.id}
              </span>
              <span>{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  </div>
);

export default WizardNav;
