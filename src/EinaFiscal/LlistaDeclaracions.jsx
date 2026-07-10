// EinaFiscal/LlistaDeclaracions.jsx
// Pantalla d'inici de l'Eina Fiscal: llista de declaracions guardades a Supabase
import React, { useState, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import {
  novaDeclaracio,
  duplicarDeclaracio,
  eliminarDeclaracio,
  normalitzarNRT,
  crearDeclaracioDerivada,
} from './engine/DeclaracionsSupabase';

// Rang d'exercicis oferts per a declaracions derivades
const ANY_MIN_DERIVAT = 2022;
const ANY_MAX_DERIVAT = 2026;

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function formatData(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('ca-AD', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

const ESTAT_COLORS = {
  esborrany: 'bg-amber-100 text-amber-700 border-amber-200',
  finalitzada: 'bg-green-100 text-green-700 border-green-200',
};

const ESTAT_LABELS = {
  esborrany: 'Esborrany',
  finalitzada: 'Finalitzada',
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL NOVA DECLARACIÓ
// ─────────────────────────────────────────────────────────────────────────────

const ModalNovaDeclaracio = ({ onConfirmar, onCancelar, error = '', operant = false }) => {
  const [clientNom, setClientNom] = useState('');
  const [clientNRT, setClientNRT] = useState('');
  const [exercici, setExercici] = useState(2025);

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">Nova declaració</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Podeu modificar aquestes dades en qualsevol moment
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Nom i cognoms del client
            </label>
            <input
              type="text"
              value={clientNom}
              onChange={e => setClientNom(e.target.value)}
              placeholder="Ex: Nom i cognoms del client"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              NRT del client
            </label>
            <input
              type="text"
              value={clientNRT}
              onChange={e => setClientNRT(e.target.value)}
              placeholder="Ex: F-XXXXXX-X"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Exercici fiscal
            </label>
            <select
              value={exercici}
              onChange={e => setExercici(parseInt(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                         focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
            >
              {[2025, 2024, 2023, 2022].map(any => (
                <option key={any} value={any}>{any}</option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <div className="px-6 pb-2">
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
              ⚠️ {error}
            </div>
          </div>
        )}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onCancelar}
            disabled={operant}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300
                       rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel·lar
          </button>
          <button
            onClick={() => onConfirmar(clientNom.trim(), clientNRT.trim(), exercici)}
            disabled={operant}
            className="px-5 py-2 text-sm bg-[#009B9C] text-white rounded-lg
                       font-semibold hover:bg-[#007A7B] transition disabled:opacity-50"
          >
            {operant ? 'Creant...' : 'Crear declaració →'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL CONFIRMAR ELIMINACIÓ
// ─────────────────────────────────────────────────────────────────────────────

const ModalEliminar = ({ declaracio, onConfirmar, onCancelar }) => (
  <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm">
      <div className="px-6 py-5 text-center">
        <div className="text-4xl mb-3">🗑️</div>
        <h3 className="font-bold text-gray-800 text-lg mb-2">Eliminar declaració</h3>
        <p className="text-sm text-gray-600">
          Esteu segur que voleu eliminar la declaració de{' '}
          <strong>{declaracio.clientNom || 'client sense nom'}</strong>{' '}
          ({declaracio.exercici})?
        </p>
        <p className="text-xs text-red-500 mt-2">Aquesta acció no es pot desfer.</p>
      </div>
      <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-center">
        <button
          onClick={onCancelar}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-300
                     rounded-lg hover:bg-gray-50 transition"
        >
          Cancel·lar
        </button>
        <button
          onClick={onConfirmar}
          className="px-5 py-2 text-sm bg-red-500 text-white rounded-lg
                     font-semibold hover:bg-red-600 transition"
        >
          Eliminar
        </button>
      </div>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// MODAL NOU EXERCICI (declaració derivada)
// ─────────────────────────────────────────────────────────────────────────────

const ModalNouExercici = ({ origen, direccio, anysDisponibles, onCrear, onCancelar, operant }) => {
  const [any, setAny] = useState(anysDisponibles[0] ?? null);
  const esPosterior = direccio === 'posterior';
  const bothDes2025 = (origen.exercici >= 2025) && (any >= 2025);
  const ambSaldos = esPosterior && bothDes2025;
  const creuaCanviLlei = esPosterior && !bothDes2025;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">
            Nova declaració {esPosterior ? 'posterior' : 'anterior'}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Client: <strong>{origen.clientNom || 'sense nom'}</strong>
            {origen.clientNRT ? ` · NRT: ${origen.clientNRT}` : ''} · exercici d'origen {origen.exercici}
          </p>
        </div>
        <div className="px-6 py-5 space-y-4">
          {anysDisponibles.length === 0 ? (
            <p className="text-sm text-gray-500">No queden anys disponibles en aquesta direcció.</p>
          ) : (
            <>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Exercici de destí</label>
                <select
                  value={any ?? ''}
                  onChange={e => setAny(parseInt(e.target.value))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
                >
                  {anysDisponibles.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>

              {ambSaldos && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-xs text-green-700">
                  Es traspassaran les dades del client i la parella, i els <strong>saldos pendents</strong> (bases negatives i deduccions) de {origen.exercici} amb pendent &gt; 0.
                </div>
              )}
              {!esPosterior && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600">
                  Es copiaran <strong>només</strong> les dades del client i la parella. Cap saldo.
                </div>
              )}
              {creuaCanviLlei && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
                  ⚠️ El traspàs de saldos només s'aplica entre exercicis de 2025 en endavant (canvi normatiu). Es crearà la declaració amb les dades del client, sense saldos.
                </div>
              )}
            </>
          )}
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onCancelar}
            disabled={operant}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition disabled:opacity-50"
          >
            Cancel·lar
          </button>
          <button
            onClick={() => onCrear(any, ambSaldos)}
            disabled={operant || !any || anysDisponibles.length === 0}
            className="px-5 py-2 text-sm bg-[#009B9C] text-white rounded-lg font-semibold hover:bg-[#007A7B] transition disabled:opacity-50"
          >
            {operant ? 'Creant...' : `Crear ${any || ''} →`}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MODAL SALDOS DESCARTATS PER CADUCITAT (informatiu)
// ─────────────────────────────────────────────────────────────────────────────

const ModalSaldosDescartats = ({ any, descartats, onObrir }) => {
  const f = (n) => (n || 0).toLocaleString('ca-AD', { minimumFractionDigits: 2 });
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-800 text-lg">Declaració de {any} creada</h3>
        </div>
        <div className="px-6 py-5">
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-3 text-xs text-amber-800 leading-relaxed">
            ⚠️ No s'han traspassat automàticament <strong>{descartats.length}</strong> saldo{descartats.length !== 1 ? 's' : ''} per caducitat de termini:
            <ul className="mt-1.5 space-y-0.5">
              {descartats.map((s, i) => (
                <li key={i}>• {s.tipus} ({s.exercici}): <strong>{f(s.import)} €</strong></li>
              ))}
            </ul>
            <p className="mt-2">
              Si cal, els pots <strong>afegir manualment</strong> al pas 300-F de la nova declaració, que segueix sent totalment editable.
            </p>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={onObrir}
            className="px-5 py-2 text-sm bg-[#009B9C] text-white rounded-lg font-semibold hover:bg-[#007A7B] transition"
          >
            Obrir la declaració →
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMPONENT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const LlistaDeclaracions = ({
  onObrirDeclaracio,
  onBack,
  onLogout,
  onAdminPanel,
  pendents = 0,
  declaracions = [],
  carregantDeclaracions = false,
  onRecarregar,
  isMaestro = false,
  userId,
}) => {
  const { user } = useAuth();
  const [mostrarModal, setMostrarModal] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [filtreExercici, setFiltreExercici] = useState('tots');
  const [filtreEstat, setFiltreEstat] = useState('tots');
  const [cerca, setCerca] = useState('');
  const [operant, setOperant] = useState(false);
  const [errorNova, setErrorNova] = useState('');
  const [menuFila, setMenuFila] = useState(null);       // id de la fila amb el menú "Nou exercici" obert
  const [nouExercici, setNouExercici] = useState(null); // { origen, direccio } o null
  const [saldosDescartats, setSaldosDescartats] = useState(null); // { nova, any, descartats } o null

  const handleNova = async (clientNom, clientNRT, exercici) => {
    setOperant(true);
    setErrorNova('');
    try {
      const nova = await novaDeclaracio(clientNom, clientNRT, exercici, user?.id);
      if (nova) {
        setMostrarModal(false);
        await onRecarregar();
        onObrirDeclaracio(nova.id, nova);
      } else {
        setErrorNova('No s\'ha pogut crear la declaració. Comprova els permisos de la base de dades.');
      }
    } catch (e) {
      console.error('Error inesperat creant declaració:', e);
      setErrorNova('Error inesperat. Torna a intentar-ho.');
    } finally {
      setOperant(false);
    }
  };

  const handleDuplicar = async (id) => {
    await duplicarDeclaracio(id, user?.id);
    await onRecarregar();
  };

  const handleEliminar = useCallback(async () => {
    if (!confirmarEliminar) return;
    setOperant(true);
    try {
      const ok = await eliminarDeclaracio(confirmarEliminar.id);
      setConfirmarEliminar(null);
      if (ok) {
        await onRecarregar();
      } else {
        alert('No s\'ha pogut eliminar la declaració. Comprova els permisos (RLS Supabase).');
      }
    } catch (e) {
      console.error('Error eliminant declaració:', e);
      setConfirmarEliminar(null);
    } finally {
      setOperant(false);
    }
  }, [confirmarEliminar, onRecarregar]);

  // ── Nou exercici (declaració derivada) ────────────────────────────────────
  // Anys que aquest client JA té (per NRT normalitzat + mateix user_id) → Map any→id
  const anysDelClient = useCallback((origen) => {
    const nrtRef = normalitzarNRT(origen.clientNRT);
    const m = new Map();
    if (!nrtRef) return m;
    declaracions.forEach(x => {
      if (x.userId === origen.userId && normalitzarNRT(x.clientNRT) === nrtRef && !m.has(x.exercici)) {
        m.set(x.exercici, x.id);
      }
    });
    return m;
  }, [declaracions]);

  // Anys lliures en una direcció (posterior: origen+1..2026 asc; anterior: origen−1..2022 desc)
  const anysDireccio = useCallback((origen, direccio) => {
    const existents = anysDelClient(origen);
    const anys = [];
    if (direccio === 'posterior') {
      for (let y = origen.exercici + 1; y <= ANY_MAX_DERIVAT; y++) if (!existents.has(y)) anys.push(y);
    } else {
      for (let y = origen.exercici - 1; y >= ANY_MIN_DERIVAT; y--) if (!existents.has(y)) anys.push(y);
    }
    return anys;
  }, [anysDelClient]);

  const handleCrearNouExercici = async (origen, exerciciDesti, ambSaldos) => {
    // Guard: l'any ja existeix (cursa entre pestanyes) → oferir obrir-la
    const existents = anysDelClient(origen);
    if (existents.has(exerciciDesti)) {
      const idExistent = existents.get(exerciciDesti);
      setNouExercici(null);
      if (window.confirm(`Aquest client ja té una declaració de ${exerciciDesti}. Vols obrir-la?`) && idExistent) {
        onObrirDeclaracio(idExistent);
      }
      return;
    }
    setOperant(true);
    try {
      const res = await crearDeclaracioDerivada({ origen, exerciciDesti, ambSaldos });
      setNouExercici(null);
      if (res && res.row) {
        await onRecarregar();
        if (res.descartats && res.descartats.length > 0) {
          // Saldos caducats no prellenats → avís informatiu; s'obre en confirmar
          setSaldosDescartats({ nova: res.row, any: exerciciDesti, descartats: res.descartats });
        } else {
          onObrirDeclaracio(res.row.id, res.row);
        }
      } else {
        alert('No s\'ha pogut crear la declaració derivada. Comprova els permisos.');
      }
    } catch (e) {
      console.error('Error creant declaració derivada:', e);
      alert('Error inesperat creant la declaració.');
    } finally {
      setOperant(false);
    }
  };

  // Filtrat
  const declaracionsFiltrades = declaracions.filter(d => {
    if (filtreExercici !== 'tots' && String(d.exercici) !== filtreExercici) return false;
    if (filtreEstat !== 'tots' && d.estat !== filtreEstat) return false;
    if (cerca) {
      const q = cerca.toLowerCase();
      if (!(d.clientNom || '').toLowerCase().includes(q) &&
          !(d.clientNRT || '').toLowerCase().includes(q) &&
          !(d.userEmail || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const exercicisDisponibles = [...new Set(declaracions.map(d => d.exercici))].sort((a, b) => b - a);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Capçalera */}
      <header className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] text-white py-4 px-4">
        <div className="container mx-auto max-w-6xl flex items-center justify-between">
          <div>
            <button
              onClick={onBack}
              className="text-white/70 hover:text-white text-sm mb-1 block transition"
            >
              ← Zona Professionals
            </button>
            <h1 className="text-xl font-bold">Eina Fiscal IRPF Andorra</h1>
            <p className="text-white/70 text-xs">
              Llei 5/2014 · L2023005 · L2025005 · Reglament 29/12/2023
            </p>
          </div>
          <div className="flex items-center gap-2">
            {user?.email && (
              <span className="text-white/70 text-xs hidden md:inline">
                {user.email}
              </span>
            )}
            {onAdminPanel && (
              <button
                onClick={onAdminPanel}
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
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
              >
                Tancar sessió
              </button>
            )}
            <button
              onClick={() => setMostrarModal(true)}
              disabled={operant}
              className="bg-white text-[#009B9C] font-bold px-5 py-2.5 rounded-xl
                         hover:bg-gray-50 transition shadow text-sm disabled:opacity-50"
            >
              + Nova declaració
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto max-w-6xl px-4 py-8">

        {/* Disclaimer protecció de dades */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-xs text-blue-700">
          <p className="font-semibold mb-1">⚠️ Avís de protecció de dades personals</p>
          <p>
            Les dades personals introduïdes en aquesta eina (nom, NRT i dades fiscals) es guarden en servidors segurs de la Unió Europea (Supabase Inc., certificat RGPD). DEL SOTO – PALEARI & ASSOCIATS, S.L. (NRT L-720543-P) actua com a responsable del tractament d'acord amb la Llei 29/2021, del 28 d'octubre, qualificada de protecció de dades personals del Principat d'Andorra. Les dades s'utilitzen exclusivament per a la gestió de la liquidació de l'IRPF. Drets d'accés, rectificació i supressió: info@ambit.ad.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-[#009B9C]">{declaracions.length}</p>
            <p className="text-xs text-gray-500 mt-0.5">Declaracions totals</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-amber-600">
              {declaracions.filter(d => d.estat === 'esborrany').length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Esborranys</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {declaracions.filter(d => d.estat === 'finalitzada').length}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">Finalitzades</p>
          </div>
        </div>

        {/* Filtres i cerca */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex flex-wrap gap-3 items-center">
          <input
            type="text"
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder={isMaestro ? 'Cercar per nom, NRT o usuari...' : 'Cercar per nom o NRT...'}
            className="flex-1 min-w-48 border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
          <select
            value={filtreExercici}
            onChange={e => setFiltreExercici(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="tots">Tots els exercicis</option>
            {exercicisDisponibles.map(e => (
              <option key={e} value={String(e)}>{e}</option>
            ))}
          </select>
          <select
            value={filtreEstat}
            onChange={e => setFiltreEstat(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="tots">Tots els estats</option>
            <option value="esborrany">Esborranys</option>
            <option value="finalitzada">Finalitzades</option>
          </select>
          {onRecarregar && (
            <button
              onClick={onRecarregar}
              disabled={carregantDeclaracions || operant}
              title="Actualitzar llista"
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-40"
            >
              🔄
            </button>
          )}
        </div>

        {/* Llista */}
        {carregantDeclaracions ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            <p className="text-gray-400 text-sm">Carregant declaracions...</p>
          </div>
        ) : declaracionsFiltrades.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-16 text-center">
            {declaracions.length === 0 ? (
              <>
                <p className="text-4xl mb-4">📋</p>
                <h3 className="font-bold text-gray-700 text-lg mb-2">
                  Cap declaració guardada
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Creeu la primera declaració per a un client
                </p>
                <button
                  onClick={() => setMostrarModal(true)}
                  className="bg-[#009B9C] text-white font-bold px-6 py-3 rounded-xl
                             hover:bg-[#007A7B] transition"
                >
                  + Nova declaració
                </button>
              </>
            ) : (
              <>
                <p className="text-3xl mb-3">🔍</p>
                <p className="text-gray-500">Cap declaració coincideix amb el filtre</p>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {declaracionsFiltrades.map(d => (
              <div
                key={d.id}
                className="bg-white rounded-xl border border-gray-200 hover:border-[#009B9C]/30
                           hover:shadow-sm transition p-4 flex items-center gap-4"
              >
                {/* Icona exercici */}
                <div className="w-12 h-12 rounded-xl bg-[#009B9C]/10 flex items-center
                                justify-center flex-shrink-0 text-[#009B9C] font-bold text-sm">
                  {d.exercici}
                </div>

                {/* Info principal */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-800 truncate">
                      {d.clientNom || <span className="text-gray-400 italic">Client sense nom</span>}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium flex-shrink-0
                      ${ESTAT_COLORS[d.estat] || ESTAT_COLORS.esborrany}`}>
                      {ESTAT_LABELS[d.estat] || d.estat}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-400 flex-wrap">
                    {d.clientNRT && <span>NRT: {d.clientNRT}</span>}
                    <span>·</span>
                    <span>Modificat: {formatData(d.modificatEn)}</span>
                    {isMaestro && d.userEmail && (
                      <>
                        <span>·</span>
                        <span className="text-indigo-400">👤 {d.userEmail}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Accions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onObrirDeclaracio(d.id, d)}
                    disabled={operant}
                    className="px-4 py-2 bg-[#009B9C] text-white text-xs font-semibold
                               rounded-lg hover:bg-[#007A7B] transition disabled:opacity-50"
                  >
                    {d.estat === 'finalitzada' ? 'Veure' : 'Continuar'} →
                  </button>
                  {(() => {
                    const nrtBuit = !normalitzarNRT(d.clientNRT);
                    const anysPost = nrtBuit ? [] : anysDireccio(d, 'posterior');
                    const anysAnt = nrtBuit ? [] : anysDireccio(d, 'anterior');
                    return (
                      <div className="relative">
                        <button
                          onClick={() => setMenuFila(menuFila === d.id ? null : d.id)}
                          disabled={operant || nrtBuit}
                          title={nrtBuit ? 'Cal un NRT per vincular exercicis del client' : 'Crear declaració d\'un altre exercici del mateix client'}
                          className="px-3 py-2 text-xs font-semibold text-[#009B9C] border border-[#009B9C]/30 rounded-lg hover:bg-[#009B9C]/10 transition disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          ➕ Nou exercici
                        </button>
                        {menuFila === d.id && !nrtBuit && (
                          <>
                            <div className="fixed inset-0 z-10" onClick={() => setMenuFila(null)} />
                            <div className="absolute right-0 mt-1 w-60 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                              <button
                                onClick={() => { setMenuFila(null); setNouExercici({ origen: d, direccio: 'posterior' }); }}
                                disabled={anysPost.length === 0}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Crear declaració posterior{anysPost.length === 0 ? ' (cap any lliure)' : ''}
                              </button>
                              <button
                                onClick={() => { setMenuFila(null); setNouExercici({ origen: d, direccio: 'anterior' }); }}
                                disabled={anysAnt.length === 0}
                                className="w-full text-left px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                              >
                                Crear declaració anterior{anysAnt.length === 0 ? ' (cap any lliure)' : ''}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                  <button
                    onClick={() => handleDuplicar(d.id)}
                    disabled={operant}
                    title="Duplicar"
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100
                               rounded-lg transition text-sm disabled:opacity-40"
                  >
                    📄
                  </button>
                  <button
                    onClick={() => setConfirmarEliminar(d)}
                    disabled={operant}
                    title="Eliminar"
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50
                               rounded-lg transition text-sm disabled:opacity-40"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Peu */}
        {declaracions.length > 0 && (
          <p className="text-center text-xs text-gray-400 mt-6">
            {declaracions.length} declaració{declaracions.length !== 1 ? 'ns' : ''} guardada{declaracions.length !== 1 ? 's' : ''} al núvol
          </p>
        )}
      </div>

      {/* Modals */}
      {mostrarModal && (
        <ModalNovaDeclaracio
          onConfirmar={handleNova}
          onCancelar={() => { setMostrarModal(false); setErrorNova(''); }}
          error={errorNova}
          operant={operant}
        />
      )}
      {confirmarEliminar && (
        <ModalEliminar
          declaracio={confirmarEliminar}
          onConfirmar={handleEliminar}
          onCancelar={() => setConfirmarEliminar(null)}
        />
      )}
      {nouExercici && (
        <ModalNouExercici
          origen={nouExercici.origen}
          direccio={nouExercici.direccio}
          anysDisponibles={anysDireccio(nouExercici.origen, nouExercici.direccio)}
          onCrear={(exerciciDesti, ambSaldos) => handleCrearNouExercici(nouExercici.origen, exerciciDesti, ambSaldos)}
          onCancelar={() => setNouExercici(null)}
          operant={operant}
        />
      )}
      {saldosDescartats && (
        <ModalSaldosDescartats
          any={saldosDescartats.any}
          descartats={saldosDescartats.descartats}
          onObrir={() => {
            const nova = saldosDescartats.nova;
            setSaldosDescartats(null);
            onObrirDeclaracio(nova.id, nova);
          }}
        />
      )}

    </div>
  );
};

export default LlistaDeclaracions;
