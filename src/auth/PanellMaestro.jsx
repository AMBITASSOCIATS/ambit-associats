// src/auth/PanellMaestro.jsx
import React, { useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from './AuthContext';
import emailjs from '@emailjs/browser';

const ROLS = ['individual', 'empleat', 'empresa', 'maestro'];

const ESTAT_COLORS = {
  pendent:   'bg-amber-100 text-amber-700 border-amber-200',
  actiu:     'bg-green-100 text-green-700 border-green-200',
  bloquejat: 'bg-red-100 text-red-700 border-red-200',
};

const ROL_COLORS = {
  maestro:    'bg-purple-100 text-purple-700',
  empresa:    'bg-blue-100 text-blue-700',
  empleat:    'bg-teal-100 text-teal-700',
  individual: 'bg-gray-100 text-gray-600',
};

const PanellMaestro = ({ onTancar }) => {
  const { user } = useAuth();
  const [usuaris, setUsuaris] = useState([]);
  const [carregant, setCarregant] = useState(true);
  const [cerca, setCerca] = useState('');
  const [filtreEstat, setFiltreEstat] = useState('tots');
  const [solicituds, setSolicituds] = useState([]);
  const [modalCrear, setModalCrear] = useState(null); // null o objecte solicitud
  const [contrasenyaCrear, setContrasenyaCrear] = useState('');
  const [errorCrear, setErrorCrear] = useState('');
  const [carregantCrear, setCarregantCrear] = useState(false);
  const [einesAprovant, setEinesAprovant] = useState([]);

  const carregarUsuaris = async () => {
    setCarregant(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('creat_el', { ascending: false });
    if (!error) setUsuaris(data || []);
    setCarregant(false);
  };

  const carregarSolicituds = async () => {
    const { data } = await supabase
      .from('solicituds')
      .select('*')
      .eq('estat', 'pendent')
      .order('creat_el', { ascending: false });
    setSolicituds(data || []);
  };

  useEffect(() => { carregarUsuaris(); carregarSolicituds(); }, []);

  const aprovarSolicitud = async (sol, einesAprovades) => {
    setErrorCrear('');
    setCarregantCrear(true);
    try {
      // Crear compte auth
      const { data: authData, error } = await supabase.auth.signUp({
        email: sol.email,
        password: contrasenyaCrear,
        options: { data: { nom: sol.nom } },
      });
      if (error) throw error;

      // Crear perfil ja actiu amb eines aprovades
      if (authData.user) {
        await supabase.from('profiles').insert({
          id: authData.user.id,
          email: sol.email,
          nom: sol.nom,
          rol: 'individual',
          estat: 'actiu',
          eines: einesAprovades,
        });
      }

      // Enviar email amb credencials a l'usuari via EmailJS
      await emailjs.send('service_2jvc0w9', 'template_5ro2sjh', {
        nom: sol.nom || '',
        email_usuari: sol.email,
        contrasenya: contrasenyaCrear,
        eines: einesAprovades.includes('irpf') && einesAprovades.includes('bretxa')
          ? 'Eina Fiscal IRPF + Bretxa de Gènere'
          : einesAprovades.includes('irpf') ? 'Eina Fiscal IRPF' : 'Bretxa de Gènere',
      }, 'KzIVD4mtDxpovIs4G').catch(() => {});

      // Eliminar de solicituds
      await supabase.from('solicituds').delete().eq('id', sol.id);

      setModalCrear(null);
      setContrasenyaCrear('');
      carregarSolicituds();
      carregarUsuaris();
    } catch (err) {
      setErrorCrear(err.message || 'Error creant el compte.');
    } finally {
      setCarregantCrear(false);
    }
  };

const actualitzar = async (id, canvis) => {
    await supabase.from('profiles').update(canvis).eq('id', id);

    // Si s'aprova l'usuari, enviar email de notificació
    if (canvis.estat === 'actiu') {
      const usuari = usuaris.find(u => u.id === id);
      if (usuari?.email) {
        try {
          await fetch('https://formspree.io/f/mdkdrkze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'ÀMBIT Associats - Sistema',
              email: usuari.email,
              message: `Hola ${usuari.nom || ''},\n\nEl teu accés a l'Eina Fiscal IRPF d'ÀMBIT Associats ha estat aprovat.\n\nJa pots iniciar sessió a:\nhttps://www.ambit.ad\n\nSi tens qualsevol dubte, contacta'ns a info@ambit.ad o al +376 655 382.\n\nÀMBIT Associats`,
            }),
          });
        } catch(e) {
          console.warn('No s\'ha pogut enviar email de confirmació:', e);
        }
      }
    }

    // Si es bloqueja, enviar email avisant
    if (canvis.estat === 'bloquejat') {
      const usuari = usuaris.find(u => u.id === id);
      if (usuari?.email) {
        try {
          await fetch('https://formspree.io/f/mdkdrkze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'ÀMBIT Associats - Sistema',
              email: usuari.email,
              message: `Hola ${usuari.nom || ''},\n\nEl teu accés a l'Eina Fiscal IRPF d'ÀMBIT Associats ha estat suspès.\n\nPer a més informació, contacta'ns a info@ambit.ad o al +376 655 382.\n\nÀMBIT Associats`,
            }),
          });
        } catch(e) {
          console.warn('No s\'ha pogut enviar email de bloqueig:', e);
        }
      }
    }

    carregarUsuaris();
  };

  const usuarisFiltrats = usuaris.filter(u => {
    if (filtreEstat !== 'tots' && u.estat !== filtreEstat) return false;
    if (cerca) {
      const q = cerca.toLowerCase();
      return (u.nom || '').toLowerCase().includes(q) ||
             (u.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  const stats = {
    total: usuaris.length,
    pendents: usuaris.filter(u => u.estat === 'pendent').length,
    actius: usuaris.filter(u => u.estat === 'actiu').length,
    bloquejats: usuaris.filter(u => u.estat === 'bloquejat').length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Capçalera */}
      <header className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] text-white py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Panel d'administració — Accés Maestro</h1>
            <p className="text-white/70 text-xs mt-0.5">Gestió d'usuaris i accessos · ÀMBIT Associats</p>
          </div>
          <button
            onClick={onTancar}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            ← Tornar a l'Eina Fiscal
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-8">

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total usuaris', valor: stats.total, color: 'text-gray-700' },
            { label: 'Pendents aprovació', valor: stats.pendents, color: 'text-amber-600' },
            { label: 'Actius', valor: stats.actius, color: 'text-green-600' },
            { label: 'Bloquejats', valor: stats.bloquejats, color: 'text-red-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.valor}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Sol·licituds pendents */}
        {solicituds.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-bold text-amber-700 mb-2 flex items-center gap-2">
              <span className="bg-amber-100 border border-amber-200 rounded-full px-2 py-0.5 text-xs font-bold">
                {solicituds.length}
              </span>
              Sol·licituds d'accés pendents
            </h2>
            <div className="space-y-2">
              {solicituds.map(s => (
                <div key={s.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800">{s.nom}</p>
                    <p className="text-xs text-gray-500">{s.email}</p>
                    <p className="text-xs text-teal-600 font-medium mt-0.5">
                      Sol·licita: {(s.eines || []).map(e => e === 'irpf' ? 'IRPF' : 'Bretxa').join(' + ') || '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Sol·licitat: {new Date(s.creat_el).toLocaleDateString('ca-AD')}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-shrink-0">
                    {(s.eines || []).includes('irpf') && (
                      <button
                        onClick={() => { setModalCrear(s); setContrasenyaCrear(''); setErrorCrear(''); setEinesAprovant(['irpf']); }}
                        className="px-3 py-1.5 bg-teal-500 hover:bg-teal-600 text-white text-xs font-semibold rounded-lg transition"
                      >
                        ✓ Aprovar IRPF
                      </button>
                    )}
                    {(s.eines || []).includes('bretxa') && (
                      <button
                        onClick={() => { setModalCrear(s); setContrasenyaCrear(''); setErrorCrear(''); setEinesAprovant(['bretxa']); }}
                        className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-xs font-semibold rounded-lg transition"
                      >
                        ✓ Aprovar Bretxa
                      </button>
                    )}
                    {(s.eines || []).length > 1 && (
                      <button
                        onClick={() => { setModalCrear(s); setContrasenyaCrear(''); setErrorCrear(''); setEinesAprovant(s.eines); }}
                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold rounded-lg transition"
                      >
                        ✓ Aprovar totes
                      </button>
                    )}
                    <button
                      onClick={async () => {
                        await supabase.from('solicituds').update({ estat: 'rebutjat' }).eq('id', s.id);
                        carregarSolicituds();
                      }}
                      className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-xs font-semibold rounded-lg transition"
                    >
                      ✗ Rebutjar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Modal Crear compte */}
        {modalCrear && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-gray-800 mb-4">
                Crear compte per a {modalCrear.nom}
              </h3>
              <form onSubmit={(e) => { e.preventDefault(); aprovarSolicitud(modalCrear, einesAprovant); }} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Email</label>
                  <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    {modalCrear.email}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">
                    Contrasenya temporal
                  </label>
                  <input
                    type="text"
                    value={contrasenyaCrear}
                    onChange={e => setContrasenyaCrear(e.target.value)}
                    required
                    minLength={8}
                    placeholder="Mínim 8 caràcters"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm
                               focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
                  />
                </div>
                {errorCrear && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
                    ⚠️ {errorCrear}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={carregantCrear}
                    className="flex-1 bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold
                               py-2.5 rounded-xl transition disabled:opacity-50 text-sm"
                  >
                    {carregantCrear ? 'Creant...' : '✓ Crear compte i enviar email'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setModalCrear(null); setContrasenyaCrear(''); setErrorCrear(''); setEinesAprovant([]); }}
                    className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700
                               font-semibold rounded-xl transition text-sm"
                  >
                    Cancel·lar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Filtres */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4 flex gap-3">
          <input
            type="text"
            value={cerca}
            onChange={e => setCerca(e.target.value)}
            placeholder="Cercar per nom o email..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          />
          <select
            value={filtreEstat}
            onChange={e => setFiltreEstat(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm
                       focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
          >
            <option value="tots">Tots els estats</option>
            <option value="pendent">Pendents</option>
            <option value="actiu">Actius</option>
            <option value="bloquejat">Bloquejats</option>
          </select>
        </div>

        {/* Taula d'usuaris */}
        {carregant ? (
          <div className="text-center py-12 text-gray-400">Carregant usuaris...</div>
        ) : usuarisFiltrats.length === 0 ? (
          <div className="text-center py-12 text-gray-400">Cap usuari trobat</div>
        ) : (
          <div className="space-y-2">
            {usuarisFiltrats.map(u => (
              <div key={u.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4">
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-semibold text-gray-800 text-sm truncate">
                      {u.nom || <span className="text-gray-400 italic">Sense nom</span>}
                    </p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROL_COLORS[u.rol]}`}>
                      {u.rol}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTAT_COLORS[u.estat]}`}>
                      {u.estat}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">{u.email}</p>
                  <span className="text-xs text-gray-400">
                    {(u.eines || []).map(e => e === 'irpf' ? 'IRPF' : 'Bretxa').join(' + ') || 'Sense eines'}
                  </span>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Registrat: {new Date(u.creat_el).toLocaleDateString('ca-AD')}
                    {u.id === user?.id && <span className="ml-2 text-[#009B9C] font-semibold">(Tu)</span>}
                  </p>
                </div>

                {/* Accions — no mostrar si és el propi usuari Maestro */}
                {u.id !== user?.id && (
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Canvi de rol */}
                    <select
                      value={u.rol}
                      onChange={e => actualitzar(u.id, { rol: e.target.value })}
                      className="border border-gray-300 rounded-lg px-2 py-1.5 text-xs
                                 focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40"
                    >
                      {ROLS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>

                    {/* Botons d'acció */}
                    {u.estat === 'pendent' && (
                      <>
                        <button
                          onClick={() => actualitzar(u.id, { estat: 'actiu' })}
                          className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white
                                     text-xs font-semibold rounded-lg transition"
                        >
                          ✓ Aprovar
                        </button>
                        <button
                          onClick={() => actualitzar(u.id, { estat: 'bloquejat' })}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700
                                     text-xs font-semibold rounded-lg transition"
                        >
                          ✗ Rebutjar
                        </button>
                      </>
                    )}
                    {u.estat === 'actiu' && (
                      <button
                        onClick={() => actualitzar(u.id, { estat: 'bloquejat' })}
                        className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700
                                   text-xs font-semibold rounded-lg transition"
                      >
                        Bloquejar
                      </button>
                    )}
                    {u.estat === 'bloquejat' && (
                      <button
                        onClick={() => actualitzar(u.id, { estat: 'actiu' })}
                        className="px-3 py-1.5 bg-green-100 hover:bg-green-200 text-green-700
                                   text-xs font-semibold rounded-lg transition"
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-gray-400 mt-6">
          {usuaris.length} usuari{usuaris.length !== 1 ? 's' : ''} registrat{usuaris.length !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
};

export default PanellMaestro;
