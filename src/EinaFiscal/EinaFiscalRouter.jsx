// EinaFiscal/EinaFiscalRouter.jsx
// Router intern: mostra la llista o el wizard segons l'estat
// Substitueix l'import directe de EinaFiscal/index.jsx a App.js
import React, { useState, useEffect, useCallback, useRef } from 'react';
import LlistaDeclaracions from './LlistaDeclaracions';
import EinaFiscal from './index';
import {
  obtenirDeclaracio,
  desarDeclaracio,
} from './engine/DeclaracionsStorage';

const AUTODESAT_MS = 30000; // autodesat cada 30 segons

const EinaFiscalRouter = ({ onBack, onLogout, onAdminPanel }) => {
  const [declaracioId, setDeclaracioId] = useState(null);
  const [declaracioActual, setDeclaracioActual] = useState(null);
  const [ultimDesat, setUltimDesat] = useState(null);
  const autoDesatRef = useRef(null);

  // ── Obrir declaració ──────────────────────────────────────────────────────
  const handleObrirDeclaracio = useCallback((id, declaracioDirecta = null) => {
    // Si ens passen l'objecte directament (declaració nova), usar-lo sense llegir localStorage
    const decl = declaracioDirecta || obtenirDeclaracio(id);
    if (!decl) {
      // Fallback: crear un objecte mínim per no petar
      const declMinima = { id, clientNom: '', clientNRT: '', exercici: 2025, dades: {} };
      setDeclaracioActual(declMinima);
      setDeclaracioId(id);
      return;
    }
    setDeclaracioActual(decl);
    setDeclaracioId(id);
  }, []);

  // ── Desar declaració ─────────────────────────────────────────────────────
  const handleDesar = useCallback((dades, clientNom, clientNRT, exercici) => {
    if (!declaracioId) return;
    const ok = desarDeclaracio(declaracioId, { dades, clientNom, clientNRT, exercici });
    if (ok) setUltimDesat(new Date());
    return ok;
  }, [declaracioId]);

  // ── Autodesat ────────────────────────────────────────────────────────────
  const dadesRef = useRef(null);
  const metaRef = useRef({ clientNom: '', clientNRT: '', exercici: 2025 });

  const handleDadesChange = useCallback((dades, clientNom, clientNRT, exercici) => {
    dadesRef.current = dades;
    metaRef.current = { clientNom, clientNRT, exercici };
  }, []);

  useEffect(() => {
    if (!declaracioId) return;
    autoDesatRef.current = setInterval(() => {
      if (dadesRef.current) {
        const { clientNom, clientNRT, exercici } = metaRef.current;
        desarDeclaracio(declaracioId, {
          dades: dadesRef.current,
          clientNom,
          clientNRT,
          exercici,
        });
        setUltimDesat(new Date());
      }
    }, AUTODESAT_MS);
    return () => clearInterval(autoDesatRef.current);
  }, [declaracioId]);

  // ── Sortir del wizard ────────────────────────────────────────────────────
  const handleSortirWizard = useCallback((dades, clientNom, clientNRT, exercici) => {
    // Desar primer
    if (declaracioId && dadesRef.current) {
      desarDeclaracio(declaracioId, {
        dades: dadesRef.current,
        clientNom: metaRef.current.clientNom,
        clientNRT: metaRef.current.clientNRT,
        exercici: metaRef.current.exercici,
      });
    }
    // Tornar a la llista
    setDeclaracioId(null);
    setDeclaracioActual(null);
    setUltimDesat(null);
    clearInterval(autoDesatRef.current);
  }, [declaracioId]);

  // ── Tornar a la web (des de la llista) ───────────────────────────────────
  const handleBackFromLlista = useCallback(() => {
    onBack();
  }, [onBack]);

  // ── Render ───────────────────────────────────────────────────────────────
  if (!declaracioId || !declaracioActual) {
    return (
      <LlistaDeclaracions
        onObrirDeclaracio={handleObrirDeclaracio}
        onBack={handleBackFromLlista}
      />
    );
  }

  return (
    <EinaFiscal
      declaracioId={declaracioId}
      declaracioInicial={declaracioActual}
      onDesar={handleDesar}
      onDadesChange={handleDadesChange}
      onSortir={handleSortirWizard}
      ultimDesat={ultimDesat}
      onLogout={onLogout}
      onAdminPanel={onAdminPanel}
    />
  );
};

export default EinaFiscalRouter;
