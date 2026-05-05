// components/RentaBlock.jsx — Bloc reutilitzable per a cada font de renda
import React from 'react';

const RentaBlock = ({ titol, numero, children, onEliminar }) => (
  <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-4">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <span className="w-7 h-7 rounded-full bg-[#009B9C] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
          {numero}
        </span>
        <h4 className="font-semibold text-gray-800 text-sm">{titol}</h4>
      </div>
      {onEliminar && (
        <button
          onClick={onEliminar}
          className="text-gray-400 hover:text-red-500 transition text-sm px-2 py-1 rounded hover:bg-red-50"
          title="Eliminar"
        >
          ✕
        </button>
      )}
    </div>
    {children}
  </div>
);

export default RentaBlock;
