// EinaFiscal/LlistaDeclaracions.jsx
// Pantalla d'inici de l'Eina Fiscal: llista de declaracions guardades
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import {
  llistarDeclaracions,
  novaDeclaracio,
  duplicarDeclaracio,
  eliminarDeclaracio,
  tamanyEmmagatzemat,
} from './engine/DeclaracionsStorage';

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

const ModalNovaDeclaracio = ({ onConfirmar, onCancelar }) => {
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
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
          <button
            onClick={onCancelar}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-300
                       rounded-lg hover:bg-gray-50 transition"
          >
            Cancel·lar
          </button>
          <button
            onClick={() => onConfirmar(clientNom.trim(), clientNRT.trim(), exercici)}
            className="px-5 py-2 text-sm bg-[#009B9C] text-white rounded-lg
                       font-semibold hover:bg-[#007A7B] transition"
          >
            Crear declaració →
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
// COMPONENT PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

const LlistaDeclaracions = ({ onObrirDeclaracio, onBack, onLogout, onAdminPanel, pendents = 0 }) => {
  const [declaracions, setDeclaracions] = useState([]);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(null);
  const [filtreExercici, setFiltreExercici] = useState('tots');
  const [filtreEstat, setFiltreEstat] = useState('tots');
  const [cerca, setCerca] = useState('');
  const [kb, setKb] = useState('0');
  const [mostrarModalContrasenya, setMostrarModalContrasenya] = useState(false);
  const [novaContrasenya, setNovaContrasenya] = useState('');
  const [confirmarContrasenya, setConfirmarContrasenya] = useState('');
  const [errorContrasenya, setErrorContrasenya] = useState('');

  const canviarContrasenya = async (e) => {
    e.preventDefault();
    setErrorContrasenya('');
    if (novaContrasenya.length < 8) {
      setErrorContrasenya('La contrasenya ha de tenir mínim 8 caràcters.');
      return;
    }
    if (novaContrasenya !== confirmarContrasenya) {
      setErrorContrasenya('Les contrasenyes no coincideixen.');
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: novaContrasenya });
    if (error) {
      setErrorContrasenya('Error: ' + error.message);
    } else {
      alert('Contrasenya canviada correctament!');
      setMostrarModalContrasenya(false);
      setNovaContrasenya('');
      setConfirmarContrasenya('');
    }
  };

  const recarregar = useCallback(() => {
    setDeclaracions(llistarDeclaracions());
    setKb(tamanyEmmagatzemat());
  }, []);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  const handleNova = (clientNom, clientNRT, exercici) => {
    const nova = novaDeclaracio(clientNom, clientNRT, exercici);
    setMostrarModal(false);
    onObrirDeclaracio(nova.id, nova);  // passar l'objecte directament per evitar race condition
  };

  const handleDuplicar = (id) => {
    duplicarDeclaracio(id);
    recarregar();
  };

  const handleEliminar = () => {
    eliminarDeclaracio(confirmarEliminar.id);
    setConfirmarEliminar(null);
    recarregar();
  };

  // Filtrat
  const declaracionsFiltrades = declaracions.filter(d => {
    if (filtreExercici !== 'tots' && String(d.exercici) !== filtreExercici) return false;
    if (filtreEstat !== 'tots' && d.estat !== filtreEstat) return false;
    if (cerca) {
      const q = cerca.toLowerCase();
      if (!(d.clientNom || '').toLowerCase().includes(q) &&
          !(d.clientNRT || '').toLowerCase().includes(q)) return false;
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
              ← Tornar a la web
            </button>
            <h1 className="text-xl font-bold">Eina Fiscal IRPF Andorra</h1>
            <p className="text-white/70 text-xs">
              Llei 5/2014 · L2023005 · L2025005 · Reglament 29/12/2023
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onAdminPanel && (
              <button
                onClick={onAdminPanel}
                className="relative text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
              >
                ⚙️ Administració
                {pendents > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {pendents}
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => { setMostrarModalContrasenya(true); setErrorContrasenya(''); setNovaContrasenya(''); setConfirmarContrasenya(''); }}
              className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
            >
              🔑 Canviar contrasenya
            </button>
            {onLogout && (
              <button
                onClick={onLogout}
                className="text-xs bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-lg transition"
              >
                Tancar sessió
              </button>
            )}

            {/* Modal canvi de contrasenya */}
            {mostrarModalContrasenya && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setMostrarModalContrasenya(false)}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
                  <h3 className="text-lg font-bold text-gray-800 mb-4">🔑 Canviar contrasenya</h3>
                  <form onSubmit={canviarContrasenya} className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Nova contrasenya</label>
                      <input
                        type="password"
                        value={novaContrasenya}
                        onChange={e => setNovaContrasenya(e.target.value)}
                        required
                        minLength={8}
                        placeholder="Mínim 8 caràcters"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Confirmar contrasenya</label>
                      <input
                        type="password"
                        value={confirmarContrasenya}
                        onChange={e => setConfirmarContrasenya(e.target.value)}
                        required
                        placeholder="Repeteix la contrasenya"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
                      />
                    </div>
                    {errorContrasenya && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                        ⚠️ {errorContrasenya}
                      </div>
                    )}
                    <div className="flex gap-3 pt-1">
                      <button
                        type="submit"
                        className="flex-1 bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold py-2.5 rounded-xl transition text-sm"
                      >
                        Guardar
                      </button>
                      <button
                        type="button"
                        onClick={() => setMostrarModalContrasenya(false)}
                        className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-xl transition text-sm"
                      >
                        Cancel·lar
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            <button
              onClick={() => setMostrarModal(true)}
              className="bg-white text-[#009B9C] font-bold px-5 py-2.5 rounded-xl
                         hover:bg-gray-50 transition shadow text-sm"
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
            Les dades introduïdes en aquesta eina es guarden únicament al navegador d'aquest dispositiu
            (localStorage) i no es transmeten a cap servidor extern. El tractament de dades personals
            de tercers (clients, obligats tributaris) és responsabilitat exclusiva de l'usuari de l'eina,
            que ha d'assegurar-se de complir la normativa aplicable en matèria de protecció de dades
            (Llei 29/2021, del 28 d'octubre, qualificada de protecció de dades personals del Principat
            d'Andorra). ÀMBIT Associats no és responsable del tractament de dades realitzat a través
            d'aquesta eina.
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
            placeholder="Cercar per nom o NRT..."
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
        </div>

        {/* Llista */}
        {declaracionsFiltrades.length === 0 ? (
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
                  <div className="flex items-center gap-3 text-xs text-gray-400">
                    {d.clientNRT && <span>NRT: {d.clientNRT}</span>}
                    <span>·</span>
                    <span>Modificat: {formatData(d.modificatEn)}</span>
                  </div>
                </div>

                {/* Accions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => onObrirDeclaracio(d.id)}
                    className="px-4 py-2 bg-[#009B9C] text-white text-xs font-semibold
                               rounded-lg hover:bg-[#007A7B] transition"
                  >
                    {d.estat === 'finalitzada' ? 'Veure' : 'Continuar'} →
                  </button>
                  <button
                    onClick={() => handleDuplicar(d.id)}
                    title="Duplicar"
                    className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100
                               rounded-lg transition text-sm"
                  >
                    📄
                  </button>
                  <button
                    onClick={() => setConfirmarEliminar(d)}
                    title="Eliminar"
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50
                               rounded-lg transition text-sm"
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
            {declaracions.length} declaració{declaracions.length !== 1 ? 'ns' : ''} guardada{declaracions.length !== 1 ? 's' : ''} localment · {kb} KB usats
          </p>
        )}
      </div>

      {/* Modals */}
      {mostrarModal && (
        <ModalNovaDeclaracio
          onConfirmar={handleNova}
          onCancelar={() => setMostrarModal(false)}
        />
      )}
      {confirmarEliminar && (
        <ModalEliminar
          declaracio={confirmarEliminar}
          onConfirmar={handleEliminar}
          onCancelar={() => setConfirmarEliminar(null)}
        />
      )}
    </div>
  );
};

export default LlistaDeclaracions;
