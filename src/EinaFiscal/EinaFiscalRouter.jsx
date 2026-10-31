// EinaFiscal/EinaFiscalRouter.jsx
// Router intern: mostra la llista o el wizard segons l'estat
// Substitueix l'import directe de EinaFiscal/index.jsx a App.js
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import LlistaDeclaracions from './LlistaDeclaracions';
import EinaFiscal from './index';
import {
  llistarDeclaracions,
  obtenirDeclaracio,
  desarDeclaracio,
  normalitzarNRT,
} from './engine/DeclaracionsSupabase';
import { supabase } from '../supabaseClient';
import { useAuth } from '../auth/AuthContext';
import PaginaLogin from '../auth/PaginaLogin';
import PaginaAccesDenegat from '../auth/PaginaAccesDenegat';
import PanellMaestro from '../auth/PanellMaestro';
import MarcAcces from '../auth/MarcAcces';
import CapcaleraEina, { botoCapcalera } from '../auth/CapcaleraEina';

const AUTODESAT_MS = 30000; // autodesat cada 30 segons

// ── Configuració capçalera PDF ───────────────────────────────────────────────
const ConfiguracioCapcalera = ({ valorsInicials, onDesar, onCancelar }) => {
  const [form, setForm] = React.useState(valorsInicials);
  const [desant, setDesant] = React.useState(false);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div className="min-h-screen bg-[#F4F8F7] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#D6E4E2] w-full max-w-lg p-6">
        <button onClick={onCancelar} className="text-[#007A7B] text-sm mb-4 hover:underline block">
          ← Zona Professionals
        </button>
        <h3 className="font-display font-medium text-[20px] text-[#12302F] mb-1">⚙️ Configuració de la capçalera</h3>
        <p className="text-xs text-[#4E6765] mb-5">Aquestes dades apareixeran a la capçalera dels informes PDF generats. Si no s'omple, s'usaran les dades d'ÀMBIT Associats per defecte.</p>
        <div className="space-y-3">
          {[
            { key: 'nom', label: 'Nom empresa / Professional', placeholder: 'Ex: Assessoria López, S.L.' },
            { key: 'nrt', label: 'NRT', placeholder: 'Ex: L-XXXXXX-X' },
            { key: 'adreca', label: 'Adreça', placeholder: 'Ex: Carrer Major, 10' },
            { key: 'poblacio', label: 'Població', placeholder: 'Ex: Andorra la Vella' },
            { key: 'email', label: 'Email', placeholder: 'Ex: contact@empresa.ad' },
            { key: 'tel', label: 'Telèfon', placeholder: 'Ex: +376 XXX XXX' },
            { key: 'web', label: 'Web', placeholder: 'Ex: www.empresa.ad' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs font-semibold text-[#4E6765] mb-1">{f.label}</label>
              <input
                type="text"
                value={form[f.key]}
                onChange={e => set(f.key, e.target.value)}
                placeholder={f.placeholder}
                className="w-full border border-[#C5D6D3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#4E6765] mb-2">Color de l'informe</label>
          <div className="flex flex-wrap gap-2">
            {[
              { nom: 'Verd ÀMBIT', valor: '#009B9C' },
              { nom: 'Blau', valor: '#2563EB' },
              { nom: 'Vermell', valor: '#DC2626' },
              { nom: 'Violeta', valor: '#7C3AED' },
              { nom: 'Taronja', valor: '#EA580C' },
              { nom: 'Gris fosc', valor: '#374151' },
              { nom: 'Negre', valor: '#111827' },
            ].map(c => (
              <button
                key={c.valor}
                type="button"
                onClick={() => set('color', c.valor)}
                title={c.nom}
                className={`w-8 h-8 rounded-full border-4 transition ${
                  form.color === c.valor ? 'border-gray-800 scale-110' : 'border-transparent hover:border-[#9FB3B0]'
                }`}
                style={{ backgroundColor: c.valor }}
              />
            ))}
          </div>
          <p className="text-xs text-[#6B8280] mt-1">
            Color per defecte: Verd ÀMBIT
          </p>
        </div>
        <div className="flex gap-3 pt-4">
          <button
            onClick={async () => {
              setDesant(true);
              try { await onDesar(form); } catch (e) { console.error('Error desant capçalera:', e); }
              finally { setDesant(false); }
            }}
            disabled={desant}
            className="flex-1 bg-[#007A7B] hover:bg-[#00676A] text-white font-semibold py-2.5 rounded-full transition text-sm disabled:opacity-50"
          >
            {desant ? 'Desant...' : 'Desar configuració'}
          </button>
          <button onClick={onCancelar} className="px-4 py-2.5 bg-[#EAF2F0] hover:bg-[#DCE9E6] text-[#2B4644] font-semibold rounded-xl transition text-sm">
            Cancel·lar
          </button>
        </div>
        <p className="text-xs text-[#6B8280] mt-3 text-center">Deixa els camps en blanc per usar les dades d'ÀMBIT Associats per defecte.</p>
      </div>
    </div>
  );
};

const EinaFiscalRouter = ({ onBack, onLogout, onAdminPanel }) => {
  const { user, perfil, carregant, esMaestro } = useAuth();
  const [mostrarPanellMaestro, setMostrarPanellMaestro] = useState(false);
  const [vistaActual, setVistaActual] = useState('zona'); // 'zona' | 'irpf'
  const [declaracioId, setDeclaracioId] = useState(null);
  const [declaracioActual, setDeclaracioActual] = useState(null);
  const [ultimDesat, setUltimDesat] = useState(null);
  const [pendents, setPendents] = useState(0);
  const [declaracions, setDeclaracions] = useState([]);
  const [carregantDeclaracions, setCarregantDeclaracions] = useState(false);
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

  // ── Recarregar declaracions ──────────────────────────────────────────────
  const handleRecarregar = useCallback(() => {
    if (!user?.id) return Promise.resolve();
    return llistarDeclaracions(user.id, esMaestro)
      .then(data => setDeclaracions(data || []))
      .catch(e => console.error('Error recarregant declaracions:', e));
  }, [user?.id, esMaestro]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ── Carregar declaracions ────────────────────────────────────────────────
  useEffect(() => {
    if (user?.id && perfil?.id) {
      setCarregantDeclaracions(true);
      handleRecarregar().finally(() => setCarregantDeclaracions(false));
    }
  }, [user?.id, perfil?.id, esMaestro, handleRecarregar]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Obrir declaració ──────────────────────────────────────────────────────
  const handleObrirDeclaracio = useCallback(async (id, declaracioDirecta = null) => {
    // Si ens passen l'objecte directament (declaració nova), usar-lo sense fer fetch
    if (declaracioDirecta) {
      setDeclaracioActual(declaracioDirecta);
      setDeclaracioId(id);
      return;
    }
    // Buscar primer a la llista local (evita un round-trip extra)
    const local = declaracions.find(d => d.id === id);
    if (local) {
      setDeclaracioActual(local);
      setDeclaracioId(id);
      return;
    }
    // Fallback: obtenir de Supabase
    const decl = await obtenirDeclaracio(id);
    const declFinal = decl || { id, clientNom: '', clientNRT: '', exercici: 2025, dades: {} };
    setDeclaracioActual(declFinal);
    setDeclaracioId(id);
  }, [declaracions]);

  // ── Desar declaració ─────────────────────────────────────────────────────
  const handleDesar = useCallback(async (dades, clientNom, clientNRT, exercici) => {
    if (!declaracioId) return false;
    const ok = await desarDeclaracio(declaracioId, { dades, clientNom, clientNRT, exercici });
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
        }).then(ok => { if (ok) setUltimDesat(new Date()); });
      }
    }, AUTODESAT_MS);
    return () => clearInterval(autoDesatRef.current);
  }, [declaracioId]);

  // ── Sortir del wizard ────────────────────────────────────────────────────
  const handleSortirWizard = useCallback(() => {
    if (declaracioId && dadesRef.current) {
      desarDeclaracio(declaracioId, {
        dades: dadesRef.current,
        clientNom: metaRef.current.clientNom,
        clientNRT: metaRef.current.clientNRT,
        exercici: metaRef.current.exercici,
      }).catch(e => console.error('Error desant al sortir:', e));
    }
    clearInterval(autoDesatRef.current);
    setDeclaracioId(null);
    setDeclaracioActual(null);
    setUltimDesat(null);
    handleRecarregar();
  }, [declaracioId, handleRecarregar]);

  // ── Exercicis del client obert (mateix NRT normalitzat + mateix user_id) ─────
  // Retorna [{ exercici, id, estat }] incloent sempre la declaració actual.
  const exercicisClient = useMemo(() => {
    if (!declaracioActual) return [];
    const nrtRef = normalitzarNRT(declaracioActual.clientNRT);
    const mapa = new Map();
    // Sempre incloure la declaració actual (encara que la llista local sigui obsoleta)
    mapa.set(declaracioActual.id, {
      exercici: declaracioActual.exercici,
      id: declaracioActual.id,
      estat: declaracioActual.estat,
    });
    if (nrtRef) {
      declaracions
        .filter(d => d.userId === declaracioActual.userId && normalitzarNRT(d.clientNRT) === nrtRef)
        .forEach(d => mapa.set(d.id, { exercici: d.exercici, id: d.id, estat: d.estat }));
    }
    return Array.from(mapa.values()).sort((a, b) => (b.exercici || 0) - (a.exercici || 0));
  }, [declaracions, declaracioActual]);

  // ── Declaracions "filles" generades a partir de l'oberta (Fase 3) ────────────
  // Detecció EN MEMÒRIA (sense query): declaracions amb dades.origenId === id actual.
  const exercicisGenerats = useMemo(() => {
    if (!declaracioActual) return [];
    return declaracions
      .filter(d => d.dades?.origenId === declaracioActual.id)
      .map(d => ({ exercici: d.exercici, id: d.id }))
      .sort((a, b) => (a.exercici || 0) - (b.exercici || 0));
  }, [declaracions, declaracioActual]);

  // ── Canviar d'exercici = navegar a una altra declaració del mateix client ────
  // Desa l'actual (mateix flux d'autodesat) i obre la destí (fresca de Supabase).
  const handleCanviarExercici = useCallback(async (idDesti) => {
    if (!idDesti || idDesti === declaracioId) return;
    // 1. Desar l'actual reutilitzant el flux de desat existent (dadesRef/metaRef)
    if (declaracioId && dadesRef.current) {
      await desarDeclaracio(declaracioId, {
        dades: dadesRef.current,
        clientNom: metaRef.current.clientNom,
        clientNRT: metaRef.current.clientNRT,
        exercici: metaRef.current.exercici,
      }).catch(e => console.error('Error desant abans de canviar d\'exercici:', e));
    }
    // 2. Obtenir la destí FRESCA (evita la llista local obsoleta) i obrir-la
    const dest = await obtenirDeclaracio(idDesti);
    if (dest) {
      // Preparar els refs amb la destí abans del remount (evita autodesat amb dades velles)
      dadesRef.current = dest.dades || {};
      metaRef.current = { clientNom: dest.clientNom, clientNRT: dest.clientNRT, exercici: dest.exercici };
      setUltimDesat(null);
      handleObrirDeclaracio(idDesti, dest);
    }
    // 3. Refrescar la llista en segon pla (per a exercicisClient i la llista)
    handleRecarregar();
  }, [declaracioId, handleObrirDeclaracio, handleRecarregar]);

  // ── Autenticació ─────────────────────────────────────────────────────────
  if (carregant) return (
    <MarcAcces onBack={onBack}>
      <p className="text-[15px] text-[#4E6765]">Carregant...</p>
    </MarcAcces>
  );

  if (!user) return <PaginaLogin onLoginOk={() => {}} onBack={onBack} />;

  // Si tenim user però encara no tenim perfil, mostrar carregant en lloc d'error
  if (!perfil) return (
    <MarcAcces onBack={onBack}>
      <p className="text-[15px] text-[#4E6765]">Carregant perfil...</p>
    </MarcAcces>
  );

  if (perfil.estat !== 'actiu') return <PaginaAccesDenegat onBack={onBack} />;

  if (mostrarPanellMaestro && esMaestro) return (
    <PanellMaestro onTancar={() => setMostrarPanellMaestro(false)} />
  );

  // ── Zona Professionals ───────────────────────────────────────────────────
  if (vistaActual === 'zona') {
    const teIrpf = esMaestro || (perfil.eines || []).includes('irpf');
    const teBretxa = esMaestro || (perfil.eines || []).includes('bretxa');

    const targetaEina = (te) => `group text-left flex flex-col rounded-2xl border bg-white p-6 transition ${
      te ? 'border-[#D6E4E2] hover:border-[#4DB6B7] cursor-pointer' : 'border-[#E4EEEC] opacity-60 cursor-not-allowed'
    }`;
    const etiquetaAcces = (te) => `text-[13px] font-semibold px-2.5 py-0.5 rounded-full ${te ? 'bg-[#E8F6F6] text-[#00676A]' : 'bg-[#F1F4F3] text-[#4E6765]'}`;

    return (
      <div className="min-h-screen bg-[#F4F8F7] font-text text-[#12302F]">
        <CapcaleraEina
          titol="Zona Professionals"
          subtitol={user?.email}
          accions={
            <>
              <button onClick={onBack} className={botoCapcalera}>← Torna a la web</button>
              {esMaestro && (
                <button onClick={() => setMostrarPanellMaestro(true)} className={`relative ${botoCapcalera}`}>
                  Administració
                  {pendents > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center leading-none">
                      {pendents}
                    </span>
                  )}
                </button>
              )}
              <button onClick={() => { if (typeof onLogout === 'function') onLogout(); }} className={botoCapcalera}>
                Tancar sessió
              </button>
            </>
          }
        />

        {/* Eines disponibles */}
        <div className="max-w-6xl mx-auto px-5 md:px-10 py-10 md:py-16">
          <div className="grid gap-2 max-w-[62ch]">
            <h2 className="font-display font-medium text-[30px] md:text-[40px] leading-[1.12] tracking-[-0.015em]">Eines professionals</h2>
            <p className="text-[17px] text-[#2B4644]">Tria l'eina que vols fer servir.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-8 max-w-4xl">
            {/* Eina Fiscal IRPF */}
            <button onClick={() => teIrpf ? setVistaActual('irpf') : null} disabled={!teIrpf} className={targetaEina(teIrpf)}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-11 h-11 bg-[#007A7B] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                </div>
                <span className={etiquetaAcces(teIrpf)}>{teIrpf ? 'Disponible' : 'Sense accés'}</span>
              </div>
              <h3 className="font-display font-medium text-[21px] group-hover:text-[#007A7B] transition-colors">Eina Fiscal IRPF Andorra</h3>
              <p className="text-[15px] leading-relaxed text-[#4E6765] flex-1 mt-1">Analitza i liquida l'IRPF andorrà amb referència legal de cada renda.</p>
              {teIrpf && <span className="mt-4 text-sm font-semibold text-[#007A7B] underline underline-offset-4 decoration-[#007A7B]/40 group-hover:decoration-[#007A7B]">Obre l'eina</span>}
            </button>

            {/* Eina Bretxa de Gènere */}
            <button onClick={() => teBretxa ? window.open('https://bretxa-genere.onrender.com', '_blank') : null} disabled={!teBretxa} className={targetaEina(teBretxa)}>
              <div className="flex items-start justify-between gap-4 mb-4">
                <div className="w-11 h-11 bg-[#4DB6B7] rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <span className={etiquetaAcces(teBretxa)}>{teBretxa ? 'Disponible' : 'Sense accés'}</span>
              </div>
              <h3 className="font-display font-medium text-[21px] group-hover:text-[#007A7B] transition-colors">Bretxa de Gènere</h3>
              <p className="text-[15px] leading-relaxed text-[#4E6765] flex-1 mt-1">Calcula i genera l'informe de bretxa salarial de gènere segons la Llei 6/2022.</p>
              {teBretxa && <span className="mt-4 text-sm font-semibold text-[#007A7B] underline underline-offset-4 decoration-[#007A7B]/40 group-hover:decoration-[#007A7B]">Obre l'eina</span>}
            </button>
          </div>

          {/* Compte */}
          <div className="mt-10 pt-6 border-t border-[#D6E4E2] max-w-4xl flex flex-wrap gap-x-6 gap-y-2">
            <button onClick={() => setVistaActual('configuracio')} className="text-sm font-semibold text-[#007A7B] hover:underline underline-offset-4">
              Configuració del perfil
            </button>
            <button
              onClick={() => { setNovaContrasenya(''); setConfirmarContrasenya(''); setErrorContrasenya(''); setVistaActual('canviarContrasenya'); }}
              className="text-sm font-semibold text-[#007A7B] hover:underline underline-offset-4"
            >
              Canviar contrasenya
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (vistaActual === 'configuracio') {
    const capDefault = {
      nom: perfil?.capcalera?.nom || '',
      nrt: perfil?.capcalera?.nrt || '',
      adreca: perfil?.capcalera?.adreca || '',
      poblacio: perfil?.capcalera?.poblacio || '',
      email: perfil?.capcalera?.email || '',
      tel: perfil?.capcalera?.tel || '',
      web: perfil?.capcalera?.web || '',
      color: perfil?.capcalera?.color || '#009B9C',
    };
    return <ConfiguracioCapcalera
      valorsInicials={capDefault}
      onDesar={async (novaCapcalera) => {
        const { error } = await supabase
          .from('profiles')
          .update({ capcalera: novaCapcalera })
          .eq('id', user.id);
        if (error) {
          alert('Error desant: ' + error.message);
          return;
        }
        // Forçar recàrrega del perfil des de Supabase
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        if (data) {
          // Actualitzar el perfil al context via recàrrega de pàgina
          window.location.reload();
        }
      }}
      onCancelar={() => setVistaActual('zona')}
    />;
  }

  if (vistaActual === 'canviarContrasenya') {
    return (
      <div className="min-h-screen bg-[#F4F8F7] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-[#D6E4E2] w-full max-w-sm p-6">
          <button
            onClick={() => setVistaActual('zona')}
            className="text-[#007A7B] text-sm mb-4 hover:underline block"
          >
            ← Zona Professionals
          </button>
          <h3 className="font-display font-medium text-[20px] text-[#12302F] mb-4">🔑 Canviar contrasenya</h3>
          <form onSubmit={canviarContrasenya} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#4E6765] mb-1">Nova contrasenya</label>
              <input type="password" value={novaContrasenya} onChange={e => setNovaContrasenya(e.target.value)} required minLength={8} placeholder="Mínim 8 caràcters" className="w-full border border-[#C5D6D3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#4E6765] mb-1">Confirmar nova contrasenya</label>
              <input type="password" value={confirmarContrasenya} onChange={e => setConfirmarContrasenya(e.target.value)} required placeholder="Repeteix la nova contrasenya" className="w-full border border-[#C5D6D3] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#007A7B]/40" />
            </div>
            {errorContrasenya && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">⚠️ {errorContrasenya}</div>
            )}
            <div className="flex gap-3 pt-1">
              <button type="submit" disabled={carregantContrasenya} className="flex-1 bg-[#007A7B] hover:bg-[#00676A] text-white font-semibold py-2.5 rounded-full transition text-sm disabled:opacity-50">
                {carregantContrasenya ? 'Verificant...' : 'Guardar'}
              </button>
              <button type="button" onClick={() => setVistaActual('zona')} className="px-4 py-2.5 bg-[#EAF2F0] hover:bg-[#DCE9E6] text-[#2B4644] font-semibold rounded-xl transition text-sm">
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
          declaracions={declaracions}
          carregantDeclaracions={carregantDeclaracions}
          onRecarregar={handleRecarregar}
          isMaestro={esMaestro}
          userId={user?.id}
        />
      );
    }
    return (
      <EinaFiscal
        key={declaracioId}
        declaracioId={declaracioId}
        declaracioInicial={declaracioActual}
        exercicisClient={exercicisClient}
        exercicisGenerats={exercicisGenerats}
        onCanviarExercici={handleCanviarExercici}
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
