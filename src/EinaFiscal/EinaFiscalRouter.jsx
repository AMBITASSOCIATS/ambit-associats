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
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthContext';
import PaginaLogin from '../auth/PaginaLogin';
import PaginaAccesDenegat from '../auth/PaginaAccesDenegat';
import PanellMaestro from '../auth/PanellMaestro';

const AUTODESAT_MS = 30000; // autodesat cada 30 segons

const EinaFiscalRouter = ({ onBack, onLogout, onAdminPanel }) => {
  const { user, perfil, carregant, esMaestro } = useAuth();
  const [mostrarPanellMaestro, setMostrarPanellMaestro] = useState(false);
  const [vistaActual, setVistaActual] = useState('zona'); // 'zona' | 'irpf'
  const [declaracioId, setDeclaracioId] = useState(null);
  const [declaracioActual, setDeclaracioActual] = useState(null);
  const [ultimDesat, setUltimDesat] = useState(null);
  const [pendents, setPendents] = useState(0);
  const [novaContrasenya, setNovaContrasenya] = useState('');
  const [confirmarContrasenya, setConfirmarContrasenya] = useState('');
  const [errorContrasenya, setErrorContrasenya] = useState('');
  const [carregantContrasenya, setCarregantContrasenya] = useState(false);

  const canviarContrasenya = async (e) => {
    e.preventDefault();
    setErrorContrasenya('');
    if (novaContrasenya.length < 8) {
      setErrorContrasenya('La nova contrasenya ha de tenir mínim 8 caràcters.');
      return;
    }
    if (novaContrasenya !== confirmarContrasenya) {
      setErrorContrasenya('Les contrasenyes no coincideixen.');
      return;
    }
    setCarregantContrasenya(true);
    const { error } = await supabase.auth.updateUser({ password: novaContrasenya });
    if (error) {
      setErrorContrasenya('Error: ' + error.message);
      setCarregantContrasenya(false);
      return;
    }
    // Contrasenya canviada: tancar sessió → SIGNED_OUT mostrarà el login
    // No cridem onLogout per evitar setShowEinaFiscal(false) — millor UX
    await supabase.auth.signOut();
  };

  const autoDesatRef = useRef(null);

  useEffect(() => {
    if (!esMaestro) return;
    const carregarPendents = async () => {
      const { count } = await supabase
        .from('solicituds')
        .select('*', { count: 'exact', head: true })
        .eq('estat', 'pendent');
      setPendents(count || 0);
    };
    carregarPendents();
    const interval = setInterval(carregarPendents, 30000);
    return () => clearInterval(interval);
  }, [esMaestro]);

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

  // ── Autenticació ─────────────────────────────────────────────────────────
  if (carregant) return (
    <div className="min-h-screen bg-gradient-to-br from-[#007A7B] to-[#009B9C] flex items-center justify-center">
      <div className="text-white text-center">
        <div className="text-2xl font-bold mb-2">ÀMBIT Associats</div>
        <div className="text-white/70 text-sm">Carregant...</div>
      </div>
    </div>
  );

  if (!user) return <PaginaLogin onLoginOk={() => {}} />;
  if (perfil && perfil.estat !== 'actiu') return <PaginaAccesDenegat />;
  if (!perfil) return <PaginaAccesDenegat />;

  if (mostrarPanellMaestro && esMaestro) return (
    <PanellMaestro onTancar={() => setMostrarPanellMaestro(false)} />
  );

  // ── Zona Professionals ───────────────────────────────────────────────────
  if (vistaActual === 'zona') {
    const teIrpf = esMaestro || (perfil.eines || []).includes('irpf');
    const teBretxa = esMaestro || (perfil.eines || []).includes('bretxa');

    return (
      <div className="min-h-screen bg-gradient-to-br from-[#007A7B] to-[#009B9C]">
        {/* Capçalera */}
        <header className="bg-black/20 px-6 py-4 flex items-center justify-between">
          <div>
            <button onClick={onBack} className="text-white/70 hover:text-white text-sm transition">
              ← Tornar a la web
            </button>
            <h1 className="text-white font-bold text-xl mt-1">Zona Professionals</h1>
          </div>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span className="text-white/60 text-xs hidden md:inline">{user.email}</span>
            )}
            {esMaestro && (
              <button
                onClick={() => setMostrarPanellMaestro(true)}
                className="relative text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
              >
                ⚙️ Administració
                {pendents > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                    {pendents}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => { if (typeof onLogout === 'function') onLogout(); }}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
            >
              Tancar sessió
            </button>
          </div>
        </header>

        {/* Eines disponibles */}
        <div className="container mx-auto max-w-4xl px-4 py-16">
          <div className="text-center mb-12">
            <span className="inline-flex items-center gap-2 bg-white/20 text-white text-xs font-semibold px-4 py-2 rounded-full border border-white/30 mb-4">
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Accés exclusiu per a professionals
            </span>
            <h2 className="text-3xl font-bold text-white mb-3">Eines Professionals</h2>
            <p className="text-white/70">Selecciona l'eina que vols utilitzar</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Eina Fiscal IRPF */}
            <button
              onClick={() => teIrpf ? setVistaActual('irpf') : null}
              disabled={!teIrpf}
              className={`rounded-2xl p-7 border text-left flex flex-col transition-all duration-300 group ${
                teIrpf
                  ? 'bg-white/15 border-white/30 hover:bg-white/25 hover:border-white/50 cursor-pointer'
                  : 'bg-white/5 border-white/10 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-[#009B9C] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${teIrpf ? 'bg-teal-400 text-teal-900' : 'bg-white/20 text-white/60'}`}>
                  {teIrpf ? 'Disponible' : 'Sense accés'}
                </span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Eina Fiscal IRPF Andorra</h3>
              <p className="text-white/60 text-sm flex-1 mb-4">Analitza i liquida l'IRPF andorrà amb referència legal de cada renda.</p>
              {teIrpf && (
                <span className="inline-flex items-center gap-2 text-teal-300 font-semibold text-sm">
                  Accedir →
                </span>
              )}
            </button>

            {/* Eina Bretxa de Gènere */}
            <button
              onClick={() => teBretxa ? window.open('https://bretxa-genere.onrender.com', '_blank') : null}
              disabled={!teBretxa}
              className={`rounded-2xl p-7 border text-left flex flex-col transition-all duration-300 group ${
                teBretxa
                  ? 'bg-white/15 border-white/30 hover:bg-white/25 hover:border-white/50 cursor-pointer'
                  : 'bg-white/5 border-white/10 cursor-not-allowed opacity-50'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-purple-500 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${teBretxa ? 'bg-purple-400 text-purple-900' : 'bg-white/20 text-white/60'}`}>
                  {teBretxa ? 'Disponible' : 'Sense accés'}
                </span>
              </div>
              <h3 className="text-white font-bold text-lg mb-2">Bretxa de Gènere</h3>
              <p className="text-white/60 text-sm flex-1 mb-4">Calcula i genera l'informe de bretxa salarial de gènere segons la Llei 6/2022.</p>
              {teBretxa && (
                <span className="inline-flex items-center gap-2 text-purple-300 font-semibold text-sm">
                  Accedir →
                </span>
              )}
            </button>
          </div>

          {/* Botó canviar contrasenya */}
          <div className="text-center mt-8">
            <button
              onClick={() => { setNovaContrasenya(''); setConfirmarContrasenya(''); setErrorContrasenya(''); setVistaActual('canviarContrasenya'); }}
              className="bg-white/10 hover:bg-white/20 text-white text-sm px-4 py-2 rounded-lg transition border border-white/20"
            >
              🔑 Canviar contrasenya
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (vistaActual === 'canviarContrasenya') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#007A7B] to-[#009B9C] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <button
            onClick={() => setVistaActual('zona')}
            className="text-[#009B9C] text-sm mb-4 hover:underline block"
          >
            ← Zona Professionals
          </button>
          <h3 className="text-lg font-bold text-gray-800 mb-4">🔑 Canviar contrasenya</h3>
          <form onSubmit={canviarContrasenya} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Nova contrasenya</label>
              <input type="password" value={novaContrasenya} onChange={e => setNovaContrasenya(e.target.value)} required minLength={8} placeholder="Mínim 8 caràcters" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar nova contrasenya</label>
              <input type="password" value={confirmarContrasenya} onChange={e => setConfirmarContrasenya(e.target.value)} required placeholder="Repeteix la nova contrasenya" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
            </div>
            {errorContrasenya && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">⚠️ {errorContrasenya}</div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={carregantContrasenya} className="flex-1 bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
                {carregantContrasenya ? 'Verificant...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setVistaActual('zona')} className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-sm">
                Cancel·lar
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Eina Fiscal IRPF ─────────────────────────────────────────────────────
  if (vistaActual === 'irpf') {
    if (!declaracioId || !declaracioActual) {
      return (
        <LlistaDeclaracions
          onObrirDeclaracio={handleObrirDeclaracio}
          onBack={() => setVistaActual('zona')}
          onLogout={onLogout}
          onAdminPanel={esMaestro ? () => setMostrarPanellMaestro(true) : null}
          pendents={pendents}
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
        onAdminPanel={esMaestro ? () => setMostrarPanellMaestro(true) : null}
        pendents={pendents}
      />
    );
  }

  return null;
};

export default EinaFiscalRouter;
