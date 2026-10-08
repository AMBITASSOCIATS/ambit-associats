// src/portal/PortalApp.jsx
// Portal de signatura · panell del personal d'ÀMBIT (/portal).
// Només hi entra el personal actiu de portal.staff_profiles; la resta veu
// "Accés no autoritzat" encara que tingui compte a la web. L'accés real el
// controla la base (RLS); aquí només es tria què es mostra.
import React, { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { portal } from './portalApi';
import Solicituds from './Solicituds';
import Clients from './Clients';
import Remesa from './Remesa';
import Personal from './Personal';
import Registre from './Registre';

const PESTANYES = [
  { id: 'solicituds', nom: 'Sol·licituds' },
  { id: 'clients', nom: 'Clients' },
  { id: 'remesa', nom: 'Remesa' },
  { id: 'personal', nom: 'Personal', ocic: true },
  { id: 'registre', nom: 'Registre', ocic: true },
];

const Pantalla = ({ children }) => (
  <div className="min-h-screen bg-gradient-to-br from-[#007A7B] to-[#009B9C] flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">{children}</div>
  </div>
);

const Login = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [contrasenya, setContrasenya] = useState('');
  const [error, setError] = useState('');
  const [carregant, setCarregant] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setCarregant(true);
    try {
      await login(email, contrasenya);
    } catch {
      setError('Credencials incorrectes.');
    } finally {
      setCarregant(false);
    }
  };

  return (
    <Pantalla>
      <h1 className="text-xl font-bold text-gray-800 mb-1">Portal de signatura</h1>
      <p className="text-sm text-gray-500 mb-6">Accés per al personal d'ÀMBIT Associats</p>
      <form onSubmit={entrar} className="space-y-4">
        <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Correu electrònic" autoComplete="username"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
        <input type="password" required value={contrasenya} onChange={(e) => setContrasenya(e.target.value)}
          placeholder="Contrasenya" autoComplete="current-password"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#009B9C]/40" />
        {error && <p className="text-xs text-red-600">{error}</p>}
        <button type="submit" disabled={carregant}
          className="w-full bg-[#009B9C] hover:bg-[#007A7B] text-white font-bold py-2.5 rounded-xl transition disabled:opacity-50 text-sm">
          {carregant ? 'Entrant...' : 'Entrar'}
        </button>
      </form>
    </Pantalla>
  );
};

const PortalApp = () => {
  const { user, carregant, logout } = useAuth();
  const [rol, setRol] = useState(undefined); // undefined = comprovant, null = no és personal
  const [pestanya, setPestanya] = useState('solicituds');
  const [solicitudOberta, setSolicitudOberta] = useState(null);

  useEffect(() => {
    document.title = 'Portal de signatura · ÀMBIT Associats';
  }, []);

  useEffect(() => {
    if (!user) { setRol(undefined); return; }
    let viu = true;
    portal.rpc('el_meu_rol').then(({ data, error }) => {
      if (viu) setRol(error ? null : data);
    });
    return () => { viu = false; };
  }, [user]);

  if (carregant || (user && rol === undefined)) {
    return <div className="min-h-screen flex items-center justify-center text-gray-400 text-sm">Carregant...</div>;
  }
  if (!user) return <Login />;
  if (!rol) {
    return (
      <Pantalla>
        <div className="text-center">
          <div className="text-5xl mb-4">🚫</div>
          <h2 className="text-xl font-bold text-gray-800 mb-3">Accés no autoritzat</h2>
          <p className="text-sm text-gray-500 mb-6">
            Aquest portal és només per al personal d'ÀMBIT Associats.
          </p>
          <button onClick={logout} className="text-sm text-[#009B9C] hover:underline">Tancar sessió</button>
        </div>
      </Pantalla>
    );
  }

  const obreSolicitud = (id) => { setSolicitudOberta(id); setPestanya('solicituds'); };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gradient-to-r from-[#007A7B] to-[#009B9C] text-white py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold">Portal de signatura</h1>
            <p className="text-white/70 text-xs mt-0.5">
              Autoritzacions de càrrec en compte · {user.email} · {rol === 'ocic' ? 'OCIC' : 'Gestor'}
            </p>
          </div>
          <button onClick={logout}
            className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-sm font-semibold transition">
            Tancar sessió
          </button>
        </div>
      </header>

      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {PESTANYES.filter((p) => !p.ocic || rol === 'ocic').map((p) => (
            <button key={p.id}
              onClick={() => { setPestanya(p.id); if (p.id !== 'solicituds') setSolicitudOberta(null); }}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                pestanya === p.id ? 'border-[#009B9C] text-[#007A7B]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {p.nom}
            </button>
          ))}
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {pestanya === 'solicituds' && (
          <Solicituds oberta={solicitudOberta} onObre={setSolicitudOberta} />
        )}
        {pestanya === 'clients' && <Clients onObreSolicitud={obreSolicitud} />}
        {pestanya === 'remesa' && <Remesa onObreSolicitud={obreSolicitud} />}
        {pestanya === 'personal' && rol === 'ocic' && <Personal usuariActual={user.id} />}
        {pestanya === 'registre' && rol === 'ocic' && <Registre />}
      </main>
    </div>
  );
};

export default PortalApp;
