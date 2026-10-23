// src/portal/contracte/VisorPdf.jsx
// Mostra totes les pàgines d'un PDF dins del portal (pdf.js), una sota l'altra,
// ajustades a l'amplada. Avisa quan s'han mostrat totes. textPagina retorna
// { ca, en } (en buit si el contracte és només en català).
import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `${process.env.PUBLIC_URL}/pdf.worker.min.js`;

const VisorPdf = ({ url, textPagina, textCarregant, textError, onLlegit }) => {
  const contenidor = useRef(null);
  const [estat, setEstat] = useState('carregant'); // carregant | fet | error
  const [pagines, setPagines] = useState(0);

  useEffect(() => {
    let viu = true;
    let doc = null;
    (async () => {
      try {
        const bytes = await (await fetch(url)).arrayBuffer();
        doc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false }).promise;
        if (!viu) return;
        setPagines(doc.numPages);
        const ample = Math.min(contenidor.current?.clientWidth || 800, 900);
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        for (let n = 1; n <= doc.numPages && viu; n++) {
          const p = await doc.getPage(n);
          const base = p.getViewport({ scale: 1 });
          const vista = p.getViewport({ scale: (ample / base.width) * dpr });
          const canvas = document.createElement('canvas');
          canvas.width = vista.width;
          canvas.height = vista.height;
          canvas.style.width = '100%';
          canvas.className = 'border border-gray-200 shadow-sm bg-white';
          const tp = textPagina(n, doc.numPages);
          canvas.setAttribute('aria-label', tp.ca);
          const marc = document.createElement('figure');
          marc.className = 'mb-4';
          const peu = document.createElement('figcaption');
          peu.className = 'text-[11px] text-gray-400 text-center mt-1';
          peu.textContent = tp.ca;
          if (tp.en) {
            const en = document.createElement('span');
            en.className = 'block italic';
            en.textContent = tp.en;
            peu.appendChild(en);
          }
          marc.appendChild(canvas);
          marc.appendChild(peu);
          contenidor.current?.appendChild(marc);
          await p.render({ canvasContext: canvas.getContext('2d'), viewport: vista }).promise;
        }
        if (viu) { setEstat('fet'); onLlegit?.(); }
      } catch (e) {
        console.warn('Visor PDF', e?.name);
        if (viu) setEstat('error');
      }
    })();
    return () => { viu = false; doc?.destroy?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <div>
      <div ref={contenidor} className="max-h-[75vh] overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-3" />
      {estat === 'carregant' && <div className="text-xs text-gray-500 mt-2">{textCarregant}{pagines ? ` (${pagines})` : ''}</div>}
      {estat === 'error' && <div className="text-sm text-red-600 mt-2">{textError}</div>}
    </div>
  );
};

export default VisorPdf;
