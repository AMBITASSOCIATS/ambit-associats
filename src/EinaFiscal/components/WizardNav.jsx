// components/WizardNav.jsx — Barra de progrés del wizard
import React from 'react';

const WizardNav = ({ steps, pasActual, onNavegar }) => (
  <div className="bg-white border-b border-[#D6E4E2] sticky top-0 z-40">
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
                : estat === 'actiu' ? 'bg-[#007A7B] text-white shadow-sm'
                : 'text-[#6B8280] hover:text-[#2B4644] hover:bg-[#F4F8F7]'}`}
            >
              <span className={`w-5 h-5 rounded-full flex items-center justify-center
                text-xs font-bold flex-shrink-0
                ${estat === 'complet' ? 'bg-green-500 text-white'
                : estat === 'actiu' ? 'bg-white text-[#007A7B]'
                : 'bg-[#DCE9E6] text-[#4E6765]'}`}>
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
