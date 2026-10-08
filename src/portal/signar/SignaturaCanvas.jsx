// src/portal/signar/SignaturaCanvas.jsx
// Requadre per signar amb el dit, el llapis o el ratolí (funciona al mòbil).
// Exporta la firma en PNG amb fons transparent.
import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

const SignaturaCanvas = forwardRef(({ onCanvi, etiqueta }, ref) => {
  const canvas = useRef(null);
  const dibuixant = useRef(false);
  const ultim = useRef(null);
  const [buida, setBuida] = useState(true);

  // Ajusta la resolució a la pantalla (nítid en mòbils) i neteja en redimensionar
  const prepara = () => {
    const c = canvas.current;
    if (!c) return;
    const r = c.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    c.width = Math.round(r.width * dpr);
    c.height = Math.round(r.height * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1a2b5a';
    setBuida(true);
    onCanvi?.(false);
  };

  useEffect(() => {
    prepara();
    let ample = window.innerWidth;
    const enRedimensionar = () => {
      // Al mòbil, amagar la barra d'adreces canvia l'alçada: només es reinicia si canvia l'amplada
      if (window.innerWidth !== ample) { ample = window.innerWidth; prepara(); }
    };
    window.addEventListener('resize', enRedimensionar);
    return () => window.removeEventListener('resize', enRedimensionar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const punt = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const inici = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    dibuixant.current = true;
    ultim.current = punt(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(ultim.current.x, ultim.current.y, 1.1, 0, Math.PI * 2);
    ctx.fillStyle = '#1a2b5a';
    ctx.fill();
  };

  const mou = (e) => {
    if (!dibuixant.current) return;
    e.preventDefault();
    const p = punt(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(ultim.current.x, ultim.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ultim.current = p;
    if (buida) { setBuida(false); onCanvi?.(true); }
  };

  const fi = () => { dibuixant.current = false; };

  useImperativeHandle(ref, () => ({
    buida: () => buida,
    neteja: prepara,
    png: () => canvas.current.toDataURL('image/png'),
  }));

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvas}
          onPointerDown={inici}
          onPointerMove={mou}
          onPointerUp={fi}
          onPointerCancel={fi}
          onPointerLeave={fi}
          aria-label={etiqueta}
          className="w-full h-44 sm:h-40 bg-white border-2 border-[#009B9C] rounded-xl cursor-crosshair"
          style={{ touchAction: 'none' }}
        />
        {buida && (
          <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] italic text-[#009B9C]">
            Si us plau, signeu aquí / Please sign here
          </span>
        )}
      </div>
      <button type="button" onClick={prepara} className="mt-1 text-xs text-gray-500 hover:text-gray-700 underline">
        Esborrar la firma / Clear signature
      </button>
    </div>
  );
});

export default SignaturaCanvas;
