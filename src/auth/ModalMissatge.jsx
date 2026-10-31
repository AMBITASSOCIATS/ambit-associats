// src/auth/ModalMissatge.jsx
//
// Finestra amb un missatge preparat perquè el personal l'enviï des del seu
// propi correu (Copiar / Obrir correu). L'app no envia correus.
// La fan servir el panell del maestro i el portal de signatura.
import React, { useState } from 'react';

const ModalMissatge = ({ missatge, onTancar }) => {
  const [copiat, setCopiat] = useState(false);
  const mailto = `mailto:${encodeURIComponent(missatge.email || '')}` +
    `?subject=${encodeURIComponent(missatge.assumpte)}` +
    `&body=${encodeURIComponent(missatge.cos)}`;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(missatge.cos);
      setCopiat(true);
      setTimeout(() => setCopiat(false), 2000);
    } catch (e) {
      console.warn('No s\'ha pogut copiar el text:', e);
      alert('No s\'ha pogut copiar. Selecciona el text i copia\'l manualment.');
    }
  };

  return (
    <div className="fixed inset-0 bg-[#12302F]/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 font-text">
        <h3 className="font-display font-medium text-[21px] text-[#12302F] mb-1">{missatge.titol}</h3>
        <p className="text-xs text-[#4E6765] mb-4">
          {missatge.ajuda || 'Envia aquest missatge a l\'usuari des del teu correu.'}
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[#4E6765] mb-1">Per a</label>
            <p className="text-sm text-[#2B4644] bg-[#F4F8F7] border border-[#D6E4E2] rounded-lg px-3 py-2">
              {missatge.email || <span className="text-[#6B8280] italic">Escriu l'adreça al teu programa de correu</span>}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E6765] mb-1">Assumpte</label>
            <p className="text-sm text-[#2B4644] bg-[#F4F8F7] border border-[#D6E4E2] rounded-lg px-3 py-2">
              {missatge.assumpte}
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#4E6765] mb-1">Missatge</label>
            <textarea
              readOnly
              value={missatge.cos}
              rows={10}
              className="w-full text-sm text-[#2B4644] bg-[#F4F8F7] border border-[#D6E4E2] rounded-lg px-3 py-2 font-mono"
            />
          </div>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={copiar}
            className="flex-1 bg-[#EAF2F0] hover:bg-[#DCE9E6] text-[#2B4644] font-semibold
                       py-2.5 rounded-full transition text-sm"
          >
            {copiat ? 'Copiat ✓' : 'Copiar'}
          </button>
          <a
            href={mailto}
            className="flex-1 text-center bg-[#007A7B] hover:bg-[#00676A] text-white font-semibold
                       py-2.5 rounded-full transition text-sm"
          >
            Obrir correu
          </a>
          <button
            type="button"
            onClick={onTancar}
            className="px-4 py-2.5 bg-[#EAF2F0] hover:bg-[#DCE9E6] text-[#2B4644]
                       font-semibold rounded-full transition text-sm"
          >
            Tancar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ModalMissatge;
